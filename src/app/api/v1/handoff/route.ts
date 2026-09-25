import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureSchema } from '@/lib/server/db';
import { checkWebhookSecret } from '@/lib/server/webhookAuth';
import { openOrUpdateChatWpp, cleanPhone } from '@/lib/server/atendimento';

/* Tool do Agente n8n: transferir conversa para atendimento humano. */
export async function POST(req: NextRequest) {
    if (!checkWebhookSecret(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await ensureSchema();
    const b = await req.json().catch(() => ({}));
    const phone = cleanPhone(b.phone);
    if (!phone) return NextResponse.json({ error: 'phone é obrigatório' }, { status: 400 });

    const chat = await openOrUpdateChatWpp({
        phone,
        customerName: String(b.customer_name || b.customerName || ''),
        conversationStatus: 'EM_HUMANO',
        subject: String(b.subject || 'Transferido para atendente'),
        messageText: String(b.message || ''),
        channel: String(b.channel || 'waha'),
        wahaChatId: b.waha_chat_id || b.chatId,
        metadata: { from_automation: true, handoff: true },
    }).catch((e) => {
        console.error('Erro no handoff:', e);
        return null;
    });
    if (!chat) return NextResponse.json({ error: 'Falha no handoff' }, { status: 500 });

    await pool
        .query(`UPDATE whatsapp_sessions SET human_active=true, state='HUMANO', updated_at=now() WHERE phone=$1`, [phone])
        .catch(() => undefined);

    return NextResponse.json({ ok: true, conversation_id: chat.id, status: 'EM_HUMANO', phone });
}
