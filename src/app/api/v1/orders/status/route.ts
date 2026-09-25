import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureSchema } from '@/lib/server/db';
import { checkWebhookSecret } from '@/lib/server/webhookAuth';
import { cleanPhone } from '@/lib/server/atendimento';

const STATUS_MAP: Record<string, string> = {
    pendente: '📝 aguardando confirmação',
    em_preparo: '🍳 em preparo',
    concluido: '✅ pronto',
    cancelado: '❌ cancelado',
};

export async function GET(req: NextRequest) {
    if (!checkWebhookSecret(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await ensureSchema();
    const phone = cleanPhone(req.nextUrl.searchParams.get('phone'));
    if (!phone) return NextResponse.json({ error: 'phone é obrigatório' }, { status: 400 });

    const r = await pool
        .query('SELECT id, status, total, created_at FROM pedidos_web WHERE telefone = $1 ORDER BY id DESC LIMIT 1', [phone])
        .catch(() => ({ rowCount: 0, rows: [] as any[] }));
    if (!r.rowCount) return NextResponse.json({ found: false, phone });
    const row = r.rows[0];
    return NextResponse.json({
        found: true,
        phone,
        order: {
            id: row.id,
            status: STATUS_MAP[String(row.status)] || String(row.status),
            raw_status: row.status,
            total: Number(row.total) || 0,
            created_at: row.created_at ? String(row.created_at) : null,
        },
    });
}
