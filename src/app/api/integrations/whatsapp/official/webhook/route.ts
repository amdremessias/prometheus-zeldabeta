import { after, NextRequest, NextResponse } from 'next/server';
import { getWhatsAppIntegrationSettings } from '@/lib/server/atendimento';
import { verifyMetaWebhook } from '@/lib/server/webhookSignatures';

export const runtime = 'nodejs';

const verifyToken = () => process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || process.env.META_WA_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || '';
const appSecret = () => process.env.WHATSAPP_CLOUD_APP_SECRET || process.env.META_WA_APP_SECRET || process.env.META_APP_SECRET || '';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const expected = verifyToken();
  if (expected && u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === expected) {
    return new NextResponse(u.searchParams.get('hub.challenge') || '', { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

function parseMessages(body: any) {
  const messages: { id: string; from: string; name: string; text: string }[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value || {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const from = String(message?.from || '').replace(/\D/g, '');
        const id = String(message?.id || '').trim();
        const text = message?.type === 'text'
          ? String(message?.text?.body || '').trim()
          : message?.type === 'interactive'
            ? String(message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || '').trim()
            : '';
        if (!from || !id || !text) continue;
        const contact = contacts.find((item: any) => String(item?.wa_id || '').replace(/\D/g, '') === from);
        messages.push({ id, from, name: String(contact?.profile?.name || ''), text });
      }
    }
  }
  return messages;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = appSecret();
  if (!secret) return NextResponse.json({ error: 'App Secret da Meta não configurado' }, { status: 503 });
  if (!verifyMetaWebhook(raw, req.headers.get('x-hub-signature-256'), secret)) {
    return NextResponse.json({ error: 'Assinatura Meta inválida' }, { status: 401 });
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }); }

  const settings = await getWhatsAppIntegrationSettings();
  if (!settings.enabled || settings.provider !== 'meta') return NextResponse.json({ ok: true, received: true, ignored: 'provider_disabled' });
  const sharedSecret = process.env.ZELDAPDV_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || '';
  if (!sharedSecret) return NextResponse.json({ error: 'ZELDAPDV_WEBHOOK_SECRET não configurado' }, { status: 503 });
  const messages = parseMessages(body);
  const baseUrl = String(process.env.ZELDAPDV_INTERNAL_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');

  after(async () => {
    for (const message of messages) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(process.env.ZELDAPDV_INBOUND_TIMEOUT_MS || 55000));
      try {
        const response = await fetch(baseUrl + '/api/whatsapp/inbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-zeldapdv-secret': sharedSecret },
          body: JSON.stringify({ channel: 'cloud_api', event_id: message.id, phone: message.from, text: message.text, name: message.name, customer_name: message.name, chatId: message.from }),
          signal: controller.signal,
        });
        if (!response.ok) console.error('[whatsapp:meta] CRM interno retornou HTTP ' + response.status);
      } catch {
        console.error('[whatsapp:meta] falha ao encaminhar evento ao CRM interno');
      } finally {
        clearTimeout(timer);
      }
    }
  });
  return NextResponse.json({ ok: true, received: true, accepted: messages.length });
}
