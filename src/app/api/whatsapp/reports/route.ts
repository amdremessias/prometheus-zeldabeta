import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/session';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const ticketId = (req.nextUrl.searchParams.get('ticket_id') || '').trim();
  const phone = (req.nextUrl.searchParams.get('phone') || '').trim();

  try {
    if (ticketId) {
      const chatRes = await pool.query(
        `SELECT c.id, c.phone, c.customer_name, c.subject, c.ticket_id, c.status, c.created_at, c.closed_at,
                (SELECT json_agg(json_build_object(
                    'direction', m.direction, 'senderType', m.sender_type, 'text', m.text, 'createdAt', m.created_at
                 ) ORDER BY m.created_at) FROM chat_wpp_messages m WHERE m.ticket_id = c.id) AS messages
         FROM chat_wpp c WHERE c.ticket_id = $1 ORDER BY c.created_at DESC`,
        [ticketId]
      );
      const orders = await pool.query(
        `SELECT id, cliente, telefone, pagamento, modo_entrega, itens, subtotal, total, status, ticket_id, created_at
         FROM pedidos_web WHERE ticket_id = $1 ORDER BY id DESC`,
        [ticketId]
      );
      return NextResponse.json({ ok: true, ticket_id: ticketId, chats: chatRes.rows, orders: orders.rows });
    }

    if (phone) {
      const chats = await pool.query(
        `SELECT c.id, c.phone, c.customer_name, c.subject, c.ticket_id, c.status, c.created_at, c.closed_at,
                (SELECT count(*) FROM chat_wpp_messages m WHERE m.ticket_id = c.id) AS message_count
         FROM chat_wpp c WHERE c.phone = $1 ORDER BY c.created_at DESC`,
        [phone]
      );
      const orders = await pool.query(
        `SELECT id, cliente, telefone, total, status, ticket_id, created_at
         FROM pedidos_web WHERE telefone = $1 ORDER BY id DESC`,
        [phone]
      );
      return NextResponse.json({ ok: true, phone, chats: chats.rows, orders: orders.rows });
    }

    const summary = await pool.query(
      `SELECT c.ticket_id, c.phone, c.customer_name, c.subject, c.status, c.created_at, c.closed_at,
              c.assigned_to, u.name AS assigned_to_name,
              (SELECT count(*) FROM chat_wpp_messages m WHERE m.ticket_id = c.id) AS message_count,
              (SELECT count(*) FROM pedidos_web p WHERE p.ticket_id = c.ticket_id) AS order_count
       FROM chat_wpp c LEFT JOIN users u ON u.id = c.assigned_to
       ORDER BY c.created_at DESC LIMIT 1000`
    );
    return NextResponse.json({ ok: true, tickets: summary.rows });
  } catch (error: unknown) {
    console.error('whatsapp reports error', error);
    return NextResponse.json({ error: String((error as Error)?.message ?? error) }, { status: 500 });
  }
}