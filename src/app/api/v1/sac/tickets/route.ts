import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureSchema } from '@/lib/server/db';
import { checkWebhookSecret } from '@/lib/server/webhookAuth';

/* Tool do Agente n8n: registra elogio/reclamação (SAC). */
export async function POST(req: NextRequest) {
    if (!checkWebhookSecret(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await ensureSchema();
    const b = await req.json().catch(() => ({}));
    if (!b?.phone || !b?.message) return NextResponse.json({ error: 'phone e message são obrigatórios' }, { status: 400 });

    const kind = ['elogio', 'reclamacao', 'sugestao'].includes(String(b.kind || '').toLowerCase())
        ? String(b.kind || '').toLowerCase()
        : 'elogio';
    const r = await pool
        .query(
            'INSERT INTO feedback_pedidos_wpp (phone, customer_name, kind, message, order_number, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
            [
                String(b.phone),
                String(b.customer_name || ''),
                kind,
                String(b.message),
                b.order_number ? String(b.order_number) : null,
                b.metadata || {},
            ]
        )
        .catch((e) => {
            console.error('Erro ao registrar SAC:', e);
            return { rowCount: 0, rows: [] as any[] };
        });
    if (!r.rowCount) return NextResponse.json({ error: 'Falha ao registrar ticket' }, { status: 500 });
    return NextResponse.json({ ok: true, ticket: r.rows[0] }, { status: 201 });
}
