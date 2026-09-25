import { generateKeyPairSync } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';
import { writeFileSync } from 'node:fs';

/**
 * Gera par Ed25519 + dois LICENSE_JWT para o staging:
 *   staging-licensing.env      -> licença VÁLIDA (12 meses, 7d grace)
 *   staging-licensing-expired.env -> licença EXPIRADA (7 dias, 0 grace) p/ testar bloqueio
 */
async function main() {
    const clientId = 'zelda-core';
    const domain = 'localhost';
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
    const key = await importPKCS8(privatePem, 'Ed25519');
    const now = Math.floor(Date.now() / 1000);

    const valid = await new SignJWT({
        lic_id: 'lic_staging_valid',
        client_id: clientId,
        type: '12_MONTHS',
        grace_days: 7,
        temp_active: false,
        domain,
    })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuedAt()
        .setExpirationTime(now + 365 * 86400)
        .sign(key);

    const expired = await new SignJWT({
        lic_id: 'lic_staging_expired',
        client_id: clientId,
        type: '7_DAYS',
        grace_days: 0,
        temp_active: false,
        domain,
    })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuedAt()
        .setExpirationTime(now - 86400) // expirou há 1 dia
        .sign(key);

    const base = (jwt) =>
        `LICENSE_CLIENT_ID=${clientId}\nLICENSE_DOMAIN=${domain}\n` +
        `LICENSE_MASTER_PUBLIC_KEY=${JSON.stringify(publicPem).slice(1, -1)}\n` +
        `LICENSE_MASTER_PRIVATE_KEY=${JSON.stringify(privatePem).slice(1, -1)}\n` +
        `LICENSE_JWT=${jwt}\nMASTER_API_TOKEN=staging-master-token\n`;

    writeFileSync('staging-licensing.env', base(valid));
    writeFileSync('staging-licensing-expired.env', base(expired));
    console.log('Gerado: staging-licensing.env (válida) e staging-licensing-expired.env (expirada).');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
