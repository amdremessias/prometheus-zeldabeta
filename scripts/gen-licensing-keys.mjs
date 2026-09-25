import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

/**
 * Gera um par de chaves Ed25519 (EdDSA) para o licenciamento e um token de
 * exemplo assinado. Uso:
 *   node scripts/gen-licensing-keys.mjs [client_id] [domain]
 *
 * Saída: PEMs público/privado e um LICENSE_JWT de exemplo (12 meses, 7 dias grace).
 */
async function main() {
    const clientId = process.argv[2] || 'zelda-core';
    const domain = process.argv[3] || 'localhost';

    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 365 * 86400;
    const key = await importPKCS8(privatePem, 'Ed25519');
    const token = await new SignJWT({
        lic_id: `lic_${Date.now()}`,
        client_id: clientId,
        type: '12_MONTHS',
        grace_days: 7,
        temp_active: false,
        domain,
    })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(key);

    console.log('# === Chave Pública (instância: LICENSE_MASTER_PUBLIC_KEY) ===');
    console.log(publicPem);
    console.log('# === Chave Privada (APENAS Master: LICENSE_MASTER_PRIVATE_KEY) ===');
    console.log(privatePem);
    console.log('# === LICENSE_JWT de exemplo (12 meses, 7d grace) ===');
    console.log(token);
    console.log('\n# client_id:', clientId, '| domain:', domain, '| exp:', new Date(exp * 1000).toISOString());
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
