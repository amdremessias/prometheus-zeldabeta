import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { clearLicenseCache } from '@/lib/server/licensing';

/** Revogação instantânea (Master API). Requer MASTER_API_TOKEN quando configurado. */
export async function POST(req: NextRequest) {
    const masterToken = process.env.MASTER_API_TOKEN;
    if (masterToken) {
        const provided = req.headers.get('x-master-token') || '';
        if (provided !== masterToken) {
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }
    }

    const body = await req.json().catch(() => ({}));
    const licId = String(body.lic_id || '').trim();
    const reason = String(body.reason || 'revogado via master').trim();
    if (!licId) return NextResponse.json({ error: 'lic_id obrigatório.' }, { status: 400 });

    await pool.query(
        `INSERT INTO license_revocations (lic_id, reason) VALUES ($1, $2)
         ON CONFLICT (lic_id) DO UPDATE SET reason = EXCLUDED.reason, revoked_at = now()`,
        [licId, reason]
    );
    clearLicenseCache();
    return NextResponse.json({ ok: true, lic_id: licId, revoked: true });
}
