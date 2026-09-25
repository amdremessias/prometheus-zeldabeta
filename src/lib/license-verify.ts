import { importSPKI, jwtVerify, decodeJwt } from 'jose';

// Captura `process.env` numa binding indireta para EVITAR que o Next.js faça
// inlining estático de `process.env.X` no bundle do middleware (edge runtime).
// Sem isso, as vars de licenciamento (injetadas em runtime via compose) ficam
// indefinidas no middleware, embora funcionem nas rotas Node.
const ENV = process.env;

/**
 * Verificação de licença (JWT Ed25519 / EdDSA) — MÓDULO PURO, SEM BANCO.
 *
 * Este arquivo NÃO importa `pg`/db e é seguro para o bundle do middleware do Next.
 * A validação completa (com banco: token ativo + revogação) vive em
 * `@/lib/server/licensing`. Aqui cobrimos assinatura + expiração + grace + tenant,
 * lendo o token de LICENSE_JWT (env). Sem chave pública => desligado (retrocompatível).
 */

export type LicenseType = '7_DAYS' | '30_DAYS' | '12_MONTHS' | 'RECURRENTE' | 'TEMP_24H';

export interface LicensePayload {
    lic_id: string;
    client_id: string;
    type: LicenseType;
    iat: number;
    exp: number;
    grace_days: number;
    temp_active: boolean;
    domain?: string;
    cnpj?: string;
    [key: string]: unknown;
}

export type LicenseStatus =
    | 'valid'
    | 'grace'
    | 'temp'
    | 'blocked'
    | 'disabled';

export interface LicenseEvaluation {
    status: LicenseStatus;
    reason?: string;
    payload?: LicensePayload;
    exp?: number;
    graceUntil?: number;
}

export function isLicensingEnabled(): boolean {
    return Boolean(ENV.LICENSE_MASTER_PUBLIC_KEY);
}

function normalizePem(value: string): string {
    return String(value || '')
        .replace(/\\n/g, '\n')
        .replace(/\r/g, '')
        .trim();
}

let pubKeyCache: CryptoKey | null = null;
async function getPublicKey(): Promise<CryptoKey | null> {
    const pem = normalizePem(ENV.LICENSE_MASTER_PUBLIC_KEY || '');
    if (!pem) return null;
    if (pubKeyCache) return pubKeyCache;
    try {
        pubKeyCache = await importSPKI(pem, 'Ed25519');
        return pubKeyCache;
    } catch {
        pubKeyCache = null;
        return null;
    }
}

/** Verifica assinatura, IGNORANDO exp (para permitir janela de tolerância/grace). */
export async function verifySignatureOnly(token: string, key: CryptoKey): Promise<LicensePayload | null> {
    try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['EdDSA'], clockTolerance: '0s' });
        return payload as LicensePayload;
    } catch (e: any) {
        if (e?.code === 'ERR_JWT_EXPIRED' || e?.code === 'ERR_JWT_CLAIM') {
            try {
                return decodeJwt(token) as LicensePayload;
            } catch {
                return null;
            }
        }
        return null;
    }
}

/** Aplica regras de exp/grace/tenant a um payload cuja assinatura já foi validada. */
export function evaluatePayloadSignature(payload: LicensePayload, signedOk: boolean): LicenseEvaluation {
    if (!signedOk) return { status: 'blocked', reason: 'assinatura inválida ou token ilegível' };
    const now = Math.floor(Date.now() / 1000);
    const clientId = String(ENV.LICENSE_CLIENT_ID || '').trim();
    const domain = String(ENV.LICENSE_DOMAIN || '').trim();
    if (clientId && payload.client_id && payload.client_id !== clientId) {
        return { status: 'blocked', reason: 'client_id não corresponde a esta instância' };
    }
    if (domain && payload.domain && payload.domain !== domain) {
        return { status: 'blocked', reason: 'domain não corresponde a esta instância' };
    }
    const exp = Number(payload.exp) || 0;
    const graceDays = Number(payload.grace_days) || 0;
    const graceUntil = exp + graceDays * 86400;
    if (now <= exp) {
        return { status: payload.temp_active ? 'temp' : 'valid', payload, exp, graceUntil };
    }
    if (now <= graceUntil) {
        return {
            status: 'grace',
            reason: 'licença expirada — dentro do período de tolerância',
            payload,
            exp,
            graceUntil,
        };
    }
    return { status: 'blocked', reason: 'licença expirada', payload, exp, graceUntil };
}

/**
 * Avalia a licença a partir de LICENSE_JWT (env). Sem banco, sem revogação.
 * Usado pelo middleware (gate de acesso).
 */
export async function evaluateLicenseToken(token?: string | null): Promise<LicenseEvaluation> {
    if (!isLicensingEnabled()) return { status: 'disabled' };
    const key = await getPublicKey();
    if (!key) return { status: 'blocked', reason: 'chave pública inválida' };
    const t = token ?? ENV.LICENSE_JWT ?? null;
    if (!t) return { status: 'blocked', reason: 'nenhuma licença ativa' };
    const payload = await verifySignatureOnly(t, key);
    if (!payload) return { status: 'blocked', reason: 'assinatura inválida' };
    return evaluatePayloadSignature(payload, true);
}
