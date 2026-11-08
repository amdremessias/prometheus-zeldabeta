import { createHmac, timingSafeEqual } from 'node:crypto';

function matchesDigest(rawBody: string, signature: string, secret: string, algorithm: 'sha256' | 'sha512', prefix: RegExp) {
  if (!rawBody || !signature || !secret) return false;
  const match = signature.match(prefix);
  if (!match) return false;
  const supplied = Buffer.from(match[1], 'hex');
  const expected = createHmac(algorithm, secret).update(rawBody, 'utf8').digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function verifyWahaWebhook(rawBody: string, signature: string | null, algorithmHeader: string | null, secret: string) {
  if (String(algorithmHeader || '').toLowerCase() !== 'sha512') return false;
  return matchesDigest(rawBody, String(signature || ''), secret, 'sha512', /^([a-f0-9]{128})$/i);
}

export function verifyMetaWebhook(rawBody: string, signature: string | null, appSecret: string) {
  return matchesDigest(rawBody, String(signature || ''), appSecret, 'sha256', /^sha256=([a-f0-9]{64})$/i);
}
