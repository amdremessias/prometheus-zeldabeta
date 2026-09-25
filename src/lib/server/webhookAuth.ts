import { NextRequest } from 'next/server';

/** Valida o segredo do webhook (n8n → CRM). Quando não configurado, libera por compatibilidade. */
export function checkWebhookSecret(req: NextRequest): boolean {
    const expected = process.env.ZELDAPDV_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || '';
    if (!expected) return false;
    const got =
        req.headers.get('x-zeldapdv-secret') ||
        req.headers.get('x-crm-webhook-secret') ||
        req.headers.get('x-wpp-inbound-token') ||
        '';
    return got === expected;
}
