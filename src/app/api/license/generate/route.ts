import { NextRequest, NextResponse } from 'next/server';
import { signLicense } from '@/lib/server/licensing';
import type { LicenseType } from '@/lib/license-verify';

const MASTER_TOKEN = process.env.MASTER_API_TOKEN || '';

function getPrivateKey(): string {
    const pk = (process.env.LICENSE_MASTER_PRIVATE_KEY || '').trim();
    if (!pk) throw new Error('LICENSE_MASTER_PRIVATE_KEY não definida nesta instância.');
    return pk;
}

function masterAuth(req: NextRequest): boolean {
    if (!MASTER_TOKEN) return false;
    return req.headers.get('x-master-token') === MASTER_TOKEN;
}

const DEFAULT_DAYS: Record<LicenseType, number> = {
    '7_DAYS': 7,
    '30_DAYS': 30,
    '12_MONTHS': 365,
    RECURRENTE: 3650,
    TEMP_24H: 1,
};

export async function POST(req: NextRequest) {
    if (!MASTER_TOKEN || !masterAuth(req)) {
        return NextResponse.json({ error: 'Não autorizado (Master).' }, { status: 401 });
    }
    let body: any;
    try {
        body = await req.json();
    } catch {
        body = {};
    }

    const type = String(body.type || '12_MONTHS') as LicenseType;
    if (!DEFAULT_DAYS[type]) {
        return NextResponse.json({ error: 'type inválido.' }, { status: 400 });
    }
    const clientId = String(body.client_id || process.env.LICENSE_CLIENT_ID || '').trim();
    if (!clientId) {
        return NextResponse.json({ error: 'client_id obrigatório.' }, { status: 400 });
    }
    const graceDays = Number(body.grace_days ?? 7);
    const days = Number(body.days ?? DEFAULT_DAYS[type]);
    if (!Number.isFinite(days) || days <= 0) {
        return NextResponse.json({ error: 'days inválido.' }, { status: 400 });
    }
    const now = Math.floor(Date.now() / 1000);
    const exp = now + Math.round(days * 86400);
    const domain = body.domain ? String(body.domain).trim() : undefined;
    const cnpj = body.cnpj ? String(body.cnpj).trim() : undefined;
    const tempActive = type === 'TEMP_24H';
    const licId = String(body.lic_id || `lic_${clientId}_${now}`).trim();

    try {
        const token = await signLicense(
            { lic_id: licId, client_id: clientId, type, grace_days: graceDays, temp_active: tempActive, ...(domain ? { domain } : {}), ...(cnpj ? { cnpj } : {}), exp } as any,
            getPrivateKey()
        );
        return NextResponse.json({
            ok: true,
            lic_id: licId,
            client_id: clientId,
            type,
            exp,
            token,
            note: 'Defina LICENSE_JWT com este token na instância cliente para ativá-la.',
        });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message || 'Falha ao assinar licença.' }, { status: 500 });
    }
}
