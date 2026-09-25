import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';

function resolveKey(): Buffer {
    const raw = process.env.FISCAL_ENCRYPTION_KEY || process.env.JWT_SECRET || '';
    if (!raw) {
        throw new Error('fiscalCrypto: FISCAL_ENCRYPTION_KEY ou JWT_SECRET ausente.');
    }
    // Aceita chave já em base64 de 32 bytes (FISCAL_ENCRYPTION_KEY) ou deriva de um texto (JWT_SECRET).
    try {
        const b = Buffer.from(raw, 'base64');
        if (b.length === 32) return b;
    } catch {
        /* ignore */
    }
    return createHash('sha256').update(raw).digest();
}

export function fiscalEncrypt(value: Buffer | string): Buffer {
    const key = resolveKey();
    const plain = Buffer.isBuffer(value) ? value : Buffer.from(value, 'utf8');
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]);
}

export function fiscalDecrypt(data: Buffer): Buffer {
    const key = resolveKey();
    if (data.length < 28) throw new Error('fiscalCrypto: payload criptografado inválido.');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const enc = data.subarray(28);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]);
}

export function fiscalEncryptString(value: string): string {
    return fiscalEncrypt(value).toString('base64');
}

export function fiscalDecryptString(value: string | null | undefined): string {
    if (!value) return '';
    return fiscalDecrypt(Buffer.from(value, 'base64')).toString('utf8');
}
