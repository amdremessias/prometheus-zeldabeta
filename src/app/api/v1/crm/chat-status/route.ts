import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureSchema } from '@/lib/server/db';
import { checkWebhookSecret } from '@/lib/server/webhookAuth';
import { cleanPhone } from '@/lib/server/atendimento';

export async function GET(req: NextRequest) {
    if (!checkWebhookSecret(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await ensureSchema();
    const phone = cleanPhone(req.nextUrl.searchParams.get('phone'));
    if (!phone) return NextResponse.json({ error: 'phone é obrigatório' }, { status: 400 });

    const r = await pool
        .query('SELECT id, conversation_status, status FROM chat_wpp WHERE phone = $1 ORDER BY updated_at DESC LIMIT 1', [phone])
        .catch(() => ({ rowCount: 0, rows: [] as any[] }));
    if (!r.rowCount) return NextResponse.json({ status: 'NOVO', phone, conversation_id: null });

    const row = r.rows[0];
    let status = row.conversation_status as string;
    if (status === 'EM_IA' && row.status === 'finalizado') status = 'FINALIZADO';
    return NextResponse.json({ status, phone, conversation_id: row.id });
}
