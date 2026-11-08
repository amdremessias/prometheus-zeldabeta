import { after, NextRequest, NextResponse } from 'next/server';
import { getWhatsAppIntegrationSettings } from '@/lib/server/atendimento';
import { verifyWahaWebhook } from '@/lib/server/webhookSignatures';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const hmacKey = process.env.WAHA_WEBHOOK_HMAC_KEY || '';
  if (!hmacKey) return NextResponse.json({ error: 'WAHA_WEBHOOK_HMAC_KEY não configurado' }, { status: 503 });
  if (!verifyWahaWebhook(raw, req.headers.get('x-webhook-hmac'), req.headers.get('x-webhook-hmac-algorithm'), hmacKey)) {
    return NextResponse.json({ error: 'Assinatura WAHA inválida' }, { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }
  const eventName = String(event?.event || '').toLowerCase();
  if (eventName && !eventName.startsWith('message')) return NextResponse.json({ ok: true, ignored: 'event_not_supported' });
  const payload = event?.payload && typeof event.payload === 'object' ? event.payload : event;
  if (payload?.fromMe === true) return NextResponse.json({ ok: true, ignored: 'outgoing_echo' });

  const settings = await getWhatsAppIntegrationSettings();
  if (!settings.enabled || settings.provider !== 'waha') return NextResponse.json({ ok: true, ignored: 'provider_disabled' });
  const sharedSecret = process.env.ZELDAPDV_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || '';
  if (!sharedSecret) return NextResponse.json({ error: 'ZELDAPDV_WEBHOOK_SECRET não configurado' }, { status: 503 });

  const baseUrl = String(process.env.ZELDAPDV_INTERNAL_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  const rawId = payload?.id;
  const eventId = String((typeof rawId === 'string' ? rawId : rawId?._serialized) || payload?._data?.id?._serialized || '');
  after(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.ZELDAPDV_INBOUND_TIMEOUT_MS || 55000));
    try {
      const response = await fetch(baseUrl + '/api/whatsapp/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-zeldapdv-secret': sharedSecret },
        body: JSON.stringify({ channel: 'waha', event_id: eventId, payload }),
        signal: controller.signal,
      });
      if (!response.ok) console.error('[whatsapp:waha] CRM interno retornou HTTP ' + response.status);
    } catch {
      console.error('[whatsapp:waha] falha ao encaminhar evento ao CRM interno');
    } finally {
      clearTimeout(timer);
    }
  });
  return NextResponse.json({ ok: true, accepted: true });
}
