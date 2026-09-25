import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureSchema } from '@/lib/server/db';
import { checkWebhookSecret } from '@/lib/server/webhookAuth';

export async function GET(req: NextRequest) {
    if (!checkWebhookSecret(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await ensureSchema();
    const r = await pool
        .query(`SELECT data->'config'->>'cardapioDigitalSlug' AS slug, data->'config'->'geralData'->>'restaurantName' AS name FROM app_state WHERE id = 1`)
        .catch(() => ({ rowCount: 0, rows: [{ slug: null, name: '' }] }));
    const slug = r.rows[0]?.slug;
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host || '';
    const base = (process.env.CRM_PUBLIC_URL || process.env.NEXT_PUBLIC_BASE_URL || `http://${host}` || '').replace(/\/$/, '');
    if (!slug) return NextResponse.json({ link: null, message: 'Cardápio digital não configurado' });
    return NextResponse.json({ link: `${base}/m/${slug}`, slug, restaurant: r.rows[0]?.name || '' });
}
