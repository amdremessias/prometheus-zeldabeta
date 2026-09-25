import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, pool } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/session';
import { finalizeChatWpp, sendWahaMessage } from '@/lib/server/atendimento';

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { id } = await context.params;
  const chatId = Number(id);
  if (!Number.isInteger(chatId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  await ensureSchema();
  const chat = await finalizeChatWpp(chatId, user.id);
  if (!chat) return NextResponse.json({ error: 'Chat não encontrado' }, { status: 404 });
  try {
    await sendWahaMessage(chat.phone, `✅ Atendimento finalizado pelo nosso team. Ticket: ${chat.ticket_id}. Obrigado de ter escolhido o Zelda PDV!`);
  } catch {
    // Falha ao enviar a mensagem de encerramento não deve impedir a finalização do ticket.
  }
  return NextResponse.json({ chat, automation_resumes_on_next_message: true, closing_message_sent: true });
}
