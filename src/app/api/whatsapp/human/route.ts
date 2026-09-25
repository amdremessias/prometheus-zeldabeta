import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');
  try {
    const q = status
      ? `SELECT * FROM chat_wpp WHERE status = $1 ORDER BY updated_at DESC`
      : `SELECT * FROM chat_wpp ORDER BY updated_at DESC`;
    const res = await pool.query(q, status ? [status] : []);
    const chats = res.rows.map((row) => ({
      id: row.id,
      phone: row.phone,
      customer_name: row.customer_name ?? undefined,
      subject: row.subject ?? undefined,
      last_message: row.last_message ?? undefined,
      status: row.status,
      conversation_status: row.conversation_status ?? 'EM_IA',
      assigned_to: row.assigned_to ?? undefined,
      ticket_id: row.ticket_id ?? undefined,
      updated_at: row.updated_at ? String(row.updated_at) : undefined,
    }));
    return NextResponse.json({ chats });
  } catch (e) {
    console.error('Erro ao listar chats humanos:', e);
    return NextResponse.json({ chats: [], error: 'Falha ao carregar chats' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.WPP_INBOUND_TOKEN || process.env.CRM_WEBHOOK_SECRET || '';
  const got = req.headers.get('x-wpp-inbound-token') || req.headers.get('x-crm-webhook-secret') || req.nextUrl.searchParams.get('token') || '';
  if (expected && got !== expected) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const phone = String(b.phone || b.chatId || '').replace(/@c\.us$/i, '').trim();
  const message = String(b.message ?? b.text ?? b.last_message ?? '').trim();
  if (!phone || !message) return NextResponse.json({ error: 'phone e message são obrigatórios' }, { status: 400 });

  const customerName = String(b.customer_name || b.customerName || b.pushName || '').trim();
  const channel = String(b.channel || 'waha');
  const theirMetadata = b.metadata && typeof b.metadata === 'object' ? b.metadata : {};
  const ticketId = String(theirMetadata.ticket_id || theirMetadata.ticketId || '').trim() || undefined;

  const open = await pool.query(
    `SELECT * FROM chat_wpp
     WHERE phone = $1 AND status IN ('aberto', 'assumido')
     ORDER BY updated_at DESC LIMIT 1`,
    [phone]
  );

  if (open.rowCount === 0) {
    return NextResponse.json({
      ok: false,
      message: '🎫 AGUARDANDO ACEITE — Este atendimento aguarda confirmação do atendente humano. Aceite para começar a conversar.',
      needs_approval: true,
      phone,
      customer_name: customerName || phone,
      ticket_id: ticketId,
      subject: 'Transferência de atendimento WhatsApp',
      last_message: message,
    });
  }

  const row = open.rows[0];

  if (row.status === 'finalizado') {
    const newTicket = `ZP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(100000 + Math.random() * 900000)}`;
    const res = await pool.query(
      `UPDATE chat_wpp SET
        customer_name = COALESCE(NULLIF($2, ''), customer_name),
        subject = COALESCE(NULLIF($3, ''), subject),
        last_message = COALESCE(NULLIF($4, ''), last_message),
        status = 'aberto',
        ticket_id = $5,
        waha_chat_id = COALESCE($6, waha_chat_id),
        phone_normalized = $7,
        channel = $8,
        metadata = $9::jsonb,
        updated_at = now()
       WHERE id = $1 RETURNING *`,
      [row.id, customerName || '', 'Atendimento via WhatsApp', message, newTicket, b?.metadata?.chatId || null, phone, channel, JSON.stringify({ ticket_id: newTicket, from_automation: true, chatId: b?.metadata?.chatId, lastChatId: b?.metadata?.chatId })]
    );
    const updated = res.rows[0];
    await pool.query(
      `INSERT INTO chat_wpp_messages (ticket_id, direction, sender_type, text, waha_message_id, delivery_status, metadata)
       SELECT id, 'inbound', 'customer', $2, NULL, 'sent', '{}'::jsonb FROM chat_wpp WHERE id = $1`,
      [row.id, message]
    );
    await pool.query('UPDATE chat_wpp SET last_message = $2, updated_at = now() WHERE id = $1', [row.id, message]);
    await pool.query(
      `UPDATE whatsapp_sessions SET human_active=true, state='HUMANO', updated_at=now(), context = context || jsonb_build_object('ticket_id', $2, 'chatId', $3) WHERE phone=$1`,
      [phone, newTicket, b?.metadata?.chatId || null]
    );
    return NextResponse.json({
      ok: true,
      chat: { id: updated.id, phone: updated.phone, ticket_id: updated.ticket_id, status: updated.status },
      ticket_id: updated.ticket_id,
      needs_approval: false,
      is_new_ticket: true,
      new_ticket_id: newTicket,
    });
  }

  const prevMetadata = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<string, unknown>;
  const mergedMetadata = { ...prevMetadata, ...(b?.metadata || {}) };
  if (b?.metadata?.chatId) mergedMetadata.chatId = b.metadata.chatId;
  if (b?.metadata?.chatId) mergedMetadata.lastChatId = b.metadata.chatId;

  const res = await pool.query(
    `UPDATE chat_wpp SET
      customer_name = COALESCE(NULLIF($2, ''), customer_name),
      subject = COALESCE(NULLIF($3, ''), subject),
      last_message = COALESCE(NULLIF($4, ''), last_message),
      status = CASE WHEN status = 'finalizado' THEN 'aberto' ELSE status END,
      ticket_id = $5,
      waha_chat_id = COALESCE($6, waha_chat_id),
      phone_normalized = $7,
      channel = $8,
      metadata = $9::jsonb,
      updated_at = now()
     WHERE id = $1 RETURNING *`,
    [row.id, customerName || '', 'Atendimento via WhatsApp', message, ticketId, b?.metadata?.chatId || null, phone, channel, JSON.stringify(mergedMetadata)]
  );
  const updated = res.rows[0];

  const last = await pool.query(
    `SELECT 1 FROM chat_wpp_messages
     WHERE ticket_id = $1 AND direction = 'inbound' AND sender_type = 'customer' AND text = $2
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [updated.id, message]
  );
  if (!last.rowCount) {
    await pool.query(
      `INSERT INTO chat_wpp_messages (ticket_id, direction, sender_type, text, waha_message_id, delivery_status, metadata)
       SELECT id, 'inbound', 'customer', $2, NULL, 'sent', '{}'::jsonb FROM chat_wpp WHERE id = $1`,
      [updated.id, message]
    );
  }
  await pool.query('UPDATE chat_wpp SET last_message = $2, updated_at = now() WHERE id = $1', [updated.id, message]);
  await pool.query(
    `UPDATE whatsapp_sessions SET human_active=true, state='HUMANO', updated_at=now() WHERE phone=$1`,
    [phone]
  );
  return NextResponse.json({
    ok: true,
    chat: { id: updated.id, phone: updated.phone, ticket_id: updated.ticket_id, status: updated.status },
    ticket_id: updated.ticket_id,
    needs_approval: false,
  });
}