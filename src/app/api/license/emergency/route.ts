import { NextRequest, NextResponse } from 'next/server';
import {
    signLicense,
    activateLicense,
    isTempTokenUsed,
    markTempTokenUsed,
    isLicensingEnabled,
} from '@/lib/server/licensing';

/**
 * Emissão de licença emergencial de 24h.
 *
 * Em produção, este endpoint é chamado pela Master API (que possui a chave privada)
 * e deve vir protegido por x-master-token quando MASTER_API_TOKEN está configurado.
 * Se a instância também tiver LICENSING_PRIVATE_KEY (modo Master/dev), assina localmente.
 *
 * Trava: apenas 1 ativação por ciclo por cliente (temp_token_used).
 */
export async function POST(req: NextRequest) {
    if (!isLicensingEnabled()) {
        return NextResponse.json({ error: 'Licenciamento não está habilitado nesta instância.' }, { status: 400 });
    }

    const masterToken = process.env.MASTER_API_TOKEN;
    if (masterToken) {
        const provided = req.headers.get('x-master-token') || '';
        if (provided !== masterToken) {
            return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
        }
    }

    const privateKey = process.env.LICENSE_MASTER_PRIVATE_KEY;
    if (!privateKey) {
        return NextResponse.json(
            {
                error:
                    'Esta instância não possui a chave privada para assinar. A solicitação deve ser feita à Master API.',
            },
            { status: 501 }
        );
    }

    const clientId = String(process.env.LICENSE_CLIENT_ID || 'cli_temp').trim();
    const domain = String(process.env.LICENSE_DOMAIN || '').trim();
    const cycle = clientId || 'no-license';

    if (await isTempTokenUsed(cycle)) {
        return NextResponse.json(
            { error: 'Já foi utilizado 1 acesso emergencial (24h) neste ciclo. Aguarde a renovação da licença.' },
            { status: 409 }
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const token = await signLicense(
        {
            lic_id: `temp_${clientId}_${now}`,
            client_id: clientId,
            type: 'TEMP_24H',
            iat: now,
            exp: now + 86400,
            grace_days: 0,
            temp_active: true,
            ...(domain ? { domain } : {}),
        },
        privateKey
    );

    await activateLicense(token);
    await markTempTokenUsed(cycle);

    return NextResponse.json({
        ok: true,
        token,
        exp: now + 86400,
        note: 'Defina LICENSE_JWT com este token (ou ele já está ativo no banco) para liberar o acesso por 24h.',
    });
}
