import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { finalizeChatWpp } from '@/lib/server/atendimento';

export async function PATCH(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const { id } = await context.params;
    const chatId = Number(id);
    if (!Number.isInteger(chatId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

    const row = await finalizeChatWpp(chatId, user.id);
    if (!row) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
    return NextResponse.json({ ok: true, conversation_id: chatId, status: 'FINALIZADO' });
}
