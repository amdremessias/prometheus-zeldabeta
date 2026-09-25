import { pool, upsertClient, ensureSchema } from './db';

export interface ChatMessageInput {
    direction: 'inbound' | 'outbound';
    senderType: 'customer' | 'human' | 'automation' | 'system';
    text: string;
    wahaMessageId?: string;
    metadata?: Record<string, unknown>;
}

export interface ChatWppRow {
    id: number;
    phone: string;
    customer_name: string;
    subject: string;
    last_message: string;
    status: string;
    assigned_to: number | null;
    cliente_id: number | null;
    conversation_status: string;
    metadata: Record<string, unknown> | null;
    ticket_id: string;
    waha_chat_id: string | null;
    phone_normalized: string | null;
    channel: string;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
}

const cleanPhone = (value: unknown) => String(value ?? '').replace(/@(c\.us|lid)$/i, '').trim();
const makeTicket = () => `ZP-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(100000 + Math.random() * 900000)}`;

/** Insere/atualiza a linha chat_wpp correspondente a um ticket de atendimento. */
export async function openOrUpdateChatWpp(input: {
    phone: string;
    customerName?: string;
    ticketId?: string;
    channel?: string;
    subject?: string;
    messageText?: string;
    wahaChatId?: string;
    metadata?: Record<string, unknown>;
    conversationStatus?: 'EM_IA' | 'EM_HUMANO';
}): Promise<ChatWppRow> {
    const phone = cleanPhone(input.phone);
    if (!phone) throw new Error('phone inválido');
    const ticketId = input.ticketId?.trim() || makeTicket();

    // Mantém a tabela clients em sincronia (FK canônica do chat_wpp).
    let clienteId: number | null = null;
    try {
        const c = await upsertClient({ nome: input.customerName, telefone: phone });
        clienteId = c.id;
    } catch {
        clienteId = null;
    }
    const convStatus = input.conversationStatus || 'EM_IA';

    // Reusa ticket aberto do mesmo telefone (nunca cria dois tickets simultâneos).
    const open = await pool.query(
        `SELECT * FROM chat_wpp
         WHERE phone = $1 AND status IN ('aberto', 'assumido')
         ORDER BY updated_at DESC LIMIT 1`,
        [phone]
    );
    const prevMetadata = (open.rows[0]?.metadata && typeof open.rows[0].metadata === 'object' ? open.rows[0].metadata : {}) as Record<string, unknown>;
    const mergedMetadata = { ...prevMetadata, ...(input.metadata || {}) };
    if (input.wahaChatId) mergedMetadata.chatId = input.wahaChatId;
    if (input.wahaChatId) mergedMetadata.lastChatId = input.wahaChatId;

    if (open.rowCount) {
        const row = open.rows[0];
        const res = await pool.query(
            `UPDATE chat_wpp SET
                customer_name = COALESCE(NULLIF($2, ''), customer_name),
                subject = COALESCE(NULLIF($3, ''), subject),
                last_message = COALESCE(NULLIF($4, ''), last_message),
                status = CASE WHEN status = 'finalizado' THEN 'aberto' ELSE status END,
                conversation_status = CASE WHEN status = 'finalizado' THEN 'EM_IA' ELSE COALESCE($10, conversation_status) END,
                cliente_id = COALESCE($11, cliente_id),
                ticket_id = $5,
                waha_chat_id = COALESCE($6, waha_chat_id),
                phone_normalized = $7,
                channel = $8,
                metadata = $9::jsonb,
                updated_at = now()
             WHERE id = $1 RETURNING *`,
            [
                row.id,
                input.customerName || '',
                input.subject || '',
                input.messageText || '',
                ticketId,
                input.wahaChatId || null,
                phone,
                input.channel || 'waha',
                JSON.stringify(mergedMetadata),
                convStatus,
                clienteId,
            ]
        );
        return res.rows[0];
    }

    const ins = await pool.query(
        `INSERT INTO chat_wpp (phone, customer_name, subject, last_message, status, conversation_status, cliente_id, ticket_id, waha_chat_id, phone_normalized, channel, metadata)
         VALUES ($1, $2, $3, $4, 'aberto', $5, $6, $7, $8, $9, $10, $11::jsonb) RETURNING *`,
        [
            phone,
            input.customerName || 'Cliente WhatsApp',
            input.subject || 'Atendimento via WhatsApp',
            input.messageText || '',
            convStatus,
            clienteId,
            ticketId,
            input.wahaChatId || null,
            phone,
            input.channel || 'waha',
            JSON.stringify(mergedMetadata),
        ]
    );
    return ins.rows[0];
}

/** check-in da conversa (usado pelo n8n antes de chamar a LLM).
    Se não há conversa ativa ou a última está FINALIZADA, cria uma nova EM_IA. */
export async function checkInConversation(input: {
    phone: string;
    customerName?: string;
}): Promise<{ id: number; is_new_session: boolean; status: string }> {
    const phone = cleanPhone(input.phone);
    const latest = await pool.query(
        'SELECT id, conversation_status, status FROM chat_wpp WHERE phone = $1 ORDER BY updated_at DESC LIMIT 1',
        [phone]
    );
    if (latest.rowCount) {
        const row = latest.rows[0];
        if (row.conversation_status !== 'FINALIZADO' && row.status !== 'finalizado') {
            return { id: row.id, is_new_session: false, status: row.conversation_status };
        }
    }
    const row = await openOrUpdateChatWpp({ phone, customerName: input.customerName, conversationStatus: 'EM_IA' });
    return { id: row.id, is_new_session: true, status: 'EM_IA' };
}

/** Assunção da conversa por atendente humano (painel CRM). */
export async function assumeConversation(id: number, userId: number): Promise<ChatWppRow | null> {
    await ensureSchema();
    const res = await pool.query(
        `UPDATE chat_wpp SET conversation_status='EM_HUMANO', status='assumido', assigned_to=$2, updated_at=now() WHERE id=$1 RETURNING *`,
        [id, userId]
    );
    const row = res.rows[0];
    if (row) {
        await pool.query(
            `UPDATE whatsapp_sessions SET human_active=true, state='HUMANO', updated_at=now() WHERE phone=$1`,
            [row.phone]
        );
    }
    return row ?? null;
}

/** Registra uma mensagem no histórico do ticket (chat_wpp_messages). */
export async function appendChatMessage(chatId: number, input: ChatMessageInput): Promise<void> {
    if (!input.text) return;
    if (input.wahaMessageId) {
        const dup = await pool.query('SELECT 1 FROM chat_wpp_messages WHERE waha_message_id = $1 LIMIT 1', [input.wahaMessageId]);
        if (dup.rowCount) {
            await pool.query('UPDATE chat_wpp SET last_message = $2, updated_at = now() WHERE id = $1', [chatId, input.text]);
            return;
        }
    }
    await pool.query(
        `INSERT INTO chat_wpp_messages (ticket_id, direction, sender_type, text, waha_message_id, delivery_status, metadata)
         SELECT id, $2, $3, $4, $5, $6, $7::jsonb FROM chat_wpp WHERE id = $1`,
        [
            chatId,
            input.direction,
            input.senderType,
            input.text,
            input.wahaMessageId || null,
            'sent',
            JSON.stringify(input.metadata || {}),
        ]
    );
    // Mantém last_message sincronizado com a última troca.
    await pool.query('UPDATE chat_wpp SET last_message = $2, updated_at = now() WHERE id = $1', [chatId, input.text]);
}

/** Lê o histórico completo do ticket. */
export async function getChatMessages(chatId: number) {
    const r = await pool.query(
        'SELECT id, direction, sender_type AS "senderType", text, waha_message_id AS "wahaMessageId", created_at AS "createdAt" FROM chat_wpp_messages WHERE ticket_id = $1 ORDER BY created_at ASC, id ASC',
        [chatId]
    );
    return r.rows;
}

/** Finaliza o ticket e retorna a automação ao MENU. */
export async function finalizeChatWpp(chatId: number, userId: number | null) {
    await ensureSchema();
    const res = await pool.query(
        "UPDATE chat_wpp SET status='finalizado', conversation_status='FINALIZADO', closed_at=now(), updated_at=now(), assigned_to = COALESCE($2, assigned_to) WHERE id=$1 RETURNING *",
        [chatId, userId]
    );
    const chat = res.rows[0];
    if (chat) {
        await pool.query(
            `UPDATE whatsapp_sessions SET state='MENU', human_active=false,
               context = COALESCE(context,'{}'::jsonb) - 'ticket_id' - 'chatId' - 'lastChatId', updated_at=now()
             WHERE phone=$1`,
            [chat.phone]
        );
    }
    return chat;
}

export { cleanPhone, makeTicket };

export async function sendWahaMessage(phone: string, text: string): Promise<void> {
  const clean = phone.replace(/@(c\.us|lid)$/i, '').trim();
  if (!clean) return;
  const chatTarget = clean.includes('@') ? clean : `${clean}@c.us`;
  await sendWahaMessageTo(chatTarget, text);
}

/** Envia texto para um chat WAHA específico (usa o chatId real, ex.: @lid ou @c.us). */
export async function sendWahaMessageTo(chatId: string, text: string): Promise<void> {
  const target = String(chatId || '').trim();
  if (!target || !text) return;
  const wahaUrl = String(process.env.WAHA_API_URL ?? 'http://waha-zeldapdv:3000').replace(/\/$/, '');
  const apiKey = String(process.env.WAHA_API_KEY ?? '');
  try {
    await fetch(`${wahaUrl}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'X-Api-Key': apiKey } : {}) },
      body: JSON.stringify({ session: process.env.WAHA_SESSION ?? 'session_zeldapdv', chatId: target, text }),
    });
  } catch {
    // Falha silenciosa — não bloqueia o fluxo de atendimento
  }
}