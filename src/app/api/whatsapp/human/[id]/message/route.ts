import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, pool } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/session';
import { appendChatMessage, getChatMessages, sendWhatsAppMessageTo, getWhatsAppIntegrationSettings } from '@/lib/server/atendimento';

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { id } = await context.params;
  const chatId = Number(id);
  if (!Number.isInteger(chatId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await ensureSchema();
  const found = await pool.query('SELECT * FROM chat_wpp WHERE id = $1 LIMIT 1', [chatId]);
  if (!found.rows[0]) return NextResponse.json({ error: 'Chat não encontrado' }, { status: 404 });
  const messages = await getChatMessages(chatId);
  return NextResponse.json({ ok: true, chat: found.rows[0], messages });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { id } = await context.params;
  const chatId = Number(id);
  if (!Number.isInteger(chatId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  const payload = await req.json().catch(() => ({}));
  const text = String(payload?.text ?? '').trim();
  if (!text) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
  await ensureSchema();
  const found = await pool.query('SELECT * FROM chat_wpp WHERE id = $1 LIMIT 1', [chatId]);
  const chat = found.rows[0];
  if (!chat) return NextResponse.json({ error: 'Chat não encontrado' }, { status: 404 });
  if (chat.status === 'finalizado') return NextResponse.json({ error: 'Chat finalizado; abra um novo atendimento' }, { status: 409 });
  const metadata = chat.metadata && typeof chat.metadata === 'object' ? chat.metadata : {};
  const contextData = metadata.context && typeof metadata.context === 'object' ? metadata.context : {};
  const rawChatId = String(contextData.lastChatId ?? metadata.chat_id ?? metadata.chatId ?? chat.phone).trim();
  const integration = await getWhatsAppIntegrationSettings();
  const provider = integration.provider;
  const chatTarget = provider === 'meta' ? String(chat.phone) : rawChatId.includes('@') ? rawChatId : String(chat.phone) + '@c.us';
  let delivery: { provider: string; messageId?: string };
  try {
    delivery = await sendWhatsAppMessageTo(provider, chatTarget, text);
  } catch (error) {
    return NextResponse.json({ error: 'Falha no envio pelo provedor WhatsApp ativo', details: error instanceof Error ? error.message : String(error) }, { status: 502 });
  }
const nextMetadata = { ...metadata, last_human_message: text, last_human_user_id: user.id, last_human_sent_at: new Date().toISOString(), context: { ...contextData, lastChatId: chatTarget, lastMessage: text } };
  await appendChatMessage(chatId, { direction: 'outbound', senderType: 'human', text, metadata: { user_id: user.id } });
  const updated = await pool.query('UPDATE chat_wpp SET last_message=$2, updated_at=now(), metadata=$3::jsonb, status=CASE WHEN status=$4 THEN $5 ELSE status END WHERE id=$1 RETURNING *', [chatId, text, JSON.stringify(nextMetadata), 'aberto', 'assumido']);
  return NextResponse.json({ ok: true, chat: updated.rows[0], delivery });
}




