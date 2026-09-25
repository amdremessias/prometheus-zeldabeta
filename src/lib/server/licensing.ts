import { importPKCS8, SignJWT, decodeJwt } from 'jose';
import { pool } from '@/lib/server/db';
import {
    isLicensingEnabled,
    verifySignatureOnly,
    evaluatePayloadSignature,
    LicensePayload,
    LicenseEvaluation,
    LicenseStatus,
} from '@/lib/license-verify';

/**
 * Licenciamento (JWT assimétrico Ed25519 / EdDSA) — camada SERVER (com banco).
 *
 * SEGURANÇA POR DEFAULT-OFF:
 *   O sistema SÓ valida licença quando LICENSE_MASTER_PUBLIC_KEY está definido.
 *   Sem a chave pública, nenhuma checagem é feita (retrocompatível, não quebra).
 *
 * - A instância conhece APENAS a chave PÚBLICA (LICENSE_MASTER_PUBLIC_KEY) e valida localmente.
 * - A chave PRIVADA (LICENSE_MASTER_PRIVATE_KEY) vive na Master API e ASSINA.
 *   Pode existir na instância para emergência/testes locais.
 *
 * O gate de middleware usa o módulo puro `@/lib/license-verify` (sem banco, edge-safe).
 * Aqui acrescentamos: fonte de token no banco, revogação e persistência.
 */

export async function ensureLicensingTables(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS instance_license (
            id SERIAL PRIMARY KEY,
            lic_id TEXT,
            client_id TEXT,
            type TEXT,
            token TEXT NOT NULL,
            active BOOLEAN NOT NULL DEFAULT TRUE,
            temp_active BOOLEAN NOT NULL DEFAULT FALSE,
            temp_token_used BOOLEAN NOT NULL DEFAULT FALSE,
            temp_token_cycle TEXT,
            temp_token_used_at TIMESTAMPTZ,
            exp INTEGER,
            grace_days INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS license_revocations (
            lic_id TEXT PRIMARY KEY,
            reason TEXT,
            revoked_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);
}

/** Fonte do token ativo: env LICENSE_JWT tem prioridade; senão, a linha ativa no banco. */
async function getActiveLicenseToken(): Promise<string | null> {
    if (process.env.LICENSE_JWT) return String(process.env.LICENSE_JWT);
    try {
        await ensureLicensingTables();
        const r = await pool.query(
            'SELECT token FROM instance_license WHERE active = TRUE ORDER BY id DESC LIMIT 1'
        );
        return r.rows[0]?.token || null;
    } catch {
        return null;
    }
}

async function isRevoked(licId: string): Promise<boolean> {
    try {
        await ensureLicensingTables();
        const r = await pool.query('SELECT 1 FROM license_revocations WHERE lic_id = $1 LIMIT 1', [licId]);
        return (r.rowCount ?? 0) > 0;
    } catch {
        return false;
    }
}

// Cache curto (60s) para não bater no banco a cada request.
let evalCache: { at: number; value: LicenseEvaluation } | null = null;

/** Avaliação completa (banco + revogação). Usada por /api/license/status e rotas server. */
export async function evaluateLicense(): Promise<LicenseEvaluation> {
    if (!isLicensingEnabled()) return { status: 'disabled' };
    if (evalCache && Date.now() - evalCache.at < 60000) return evalCache.value;

    const key = await (async () => {
        const { importSPKI } = await import('jose');
        const pem = String(process.env.LICENSE_MASTER_PUBLIC_KEY || '')
            .replace(/\\n/g, '\n')
            .trim();
        if (!pem) return null;
        try {
            return await importSPKI(pem, 'Ed25519');
        } catch {
            return null;
        }
    })();
    if (!key) {
        const r: LicenseEvaluation = { status: 'blocked', reason: 'chave pública inválida' };
        evalCache = { at: Date.now(), value: r };
        return r;
    }

    const token = await getActiveLicenseToken();
    if (!token) {
        const r: LicenseEvaluation = { status: 'blocked', reason: 'nenhuma licença ativa' };
        evalCache = { at: Date.now(), value: r };
        return r;
    }
    const payload = await verifySignatureOnly(token, key);
    if (!payload) {
        const r: LicenseEvaluation = { status: 'blocked', reason: 'assinatura inválida' };
        evalCache = { at: Date.now(), value: r };
        return r;
    }
    let result = evaluatePayloadSignature(payload, true);
    if (result.status !== 'blocked' && payload.lic_id && (await isRevoked(payload.lic_id))) {
        result = {
            status: 'blocked',
            reason: 'licença revogada',
            payload,
            exp: result.exp,
            graceUntil: result.graceUntil,
        };
    }
    evalCache = { at: Date.now(), value: result };
    return result;
}

export function clearLicenseCache(): void {
    evalCache = null;
}

/** Assina um token de licença (lado Master / emergência). Requer chave privada. */
export async function signLicense(payload: Omit<LicensePayload, 'iat'>, privateKeyPem: string): Promise<string> {
    const key = await importPKCS8(
        String(privateKeyPem).replace(/\\n/g, '\n').trim(),
        'Ed25519'
    );
    return new SignJWT({
        lic_id: payload.lic_id,
        client_id: payload.client_id,
        type: payload.type,
        grace_days: payload.grace_days,
        temp_active: payload.temp_active,
        ...(payload.domain ? { domain: payload.domain } : {}),
        ...(payload.cnpj ? { cnpj: payload.cnpj } : {}),
    } as Record<string, unknown>)
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuedAt()
        .setExpirationTime(payload.exp as number)
        .sign(key);
}

/** Persiste um token como licença ativa na instância (usado por emergência/ativação). */
export async function activateLicense(token: string): Promise<void> {
    await ensureLicensingTables();
    const payload = decodeJwt(token) as LicensePayload;
    const isTemp = Boolean(payload.temp_active);
    if (!isTemp) {
        await pool.query(
            'UPDATE instance_license SET temp_token_used = FALSE, temp_token_used_at = NULL WHERE temp_token_used = TRUE'
        );
    }
    // Desativa licenças ativas anteriores (statement separado: pg não aceita
    // múltiplos comandos em prepared statement com parâmetros).
    await pool.query('UPDATE instance_license SET active = FALSE WHERE active = TRUE');
    await pool.query(
        `INSERT INTO instance_license (lic_id, client_id, type, token, active, temp_active, exp, grace_days)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7)`,
        [
            payload.lic_id || '',
            payload.client_id || '',
            payload.type || '',
            token,
            isTemp,
            Number(payload.exp) || 0,
            Number(payload.grace_days) || 0,
        ]
    );
    clearLicenseCache();
}

/** Verifica se o token emergencial já foi consumido no ciclo corrente. */
export async function isTempTokenUsed(cycle: string): Promise<boolean> {
    await ensureLicensingTables();
    const r = await pool.query(
        'SELECT 1 FROM instance_license WHERE temp_token_used = TRUE AND temp_token_cycle = $1 LIMIT 1',
        [cycle]
    );
    return (r.rowCount ?? 0) > 0;
}

/** Marca o consumo do token emergencial para o ciclo corrente. */
export async function markTempTokenUsed(cycle: string): Promise<void> {
    await pool.query(
        `UPDATE instance_license SET temp_token_used = TRUE, temp_token_cycle = $1, temp_token_used_at = now() WHERE active = TRUE`,
        [cycle]
    );
}

export { isLicensingEnabled };
export type { LicensePayload, LicenseEvaluation, LicenseStatus };
