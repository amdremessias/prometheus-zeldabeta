import { NextRequest } from 'next/server';

export interface RateLimitResult {
    allowed: boolean;
    retryAfterSec?: number;
}

/* Limiter em memória (janela fixa) por chave — suficiente para o escopo do projeto
   (deploy single-node). Em multi-instância, trocar por Redis. */
const buckets = new Map<string, { count: number; resetAt: number }>();
const MAX_BUCKETS = 10_000;

export function checkRateLimit(
    key: string,
    opts: { max?: number; windowMs?: number } = {}
): RateLimitResult {
    const max = opts.max ?? 10;
    const windowMs = opts.windowMs ?? 60_000;
    const now = Date.now();

    // Evita crescimento infinito da tabela de buckets.
    if (buckets.size >= MAX_BUCKETS) {
        for (const [k, v] of buckets) {
            if (v.resetAt < now) buckets.delete(k);
        }
    }

    const entry = buckets.get(key);
    if (!entry || entry.resetAt < now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true };
    }

    entry.count += 1;
    if (entry.count <= max) return { allowed: true };
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
}

/* IP real do cliente.
   Preferência: x-real-ip (definido pelo nginx a partir de $remote_addr — confiável),
   depois o primeiro valor de x-forwarded-for. XFF pode ser forjado pelo cliente,
   por isso nunca usar um valor do meio/do fim da cadeia. */
export function clientIp(req: NextRequest): string {
    const real = req.headers.get('x-real-ip');
    if (real) return real;
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
    return 'unknown';
}
