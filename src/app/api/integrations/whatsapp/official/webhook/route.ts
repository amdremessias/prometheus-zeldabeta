import { NextRequest, NextResponse } from 'next/server';

const META_VERIFY_TOKEN = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || '';
const AI_SECRET = process.env.ZELDAPDV_WEBHOOK_SECRET || process.env.CRM_WEBHOOK_SECRET || '';
const META_AI_WEBHOOK_URL =
  process.env.ZELDAPDV_META_AI_WEBHOOK_URL || 'http://n8n-zeldapdv:5678/webhook/zeldapdv-meta-cloud';

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  if (u.searchParams.get('hub.mode') === 'subscribe' && u.searchParams.get('hub.verify_token') === META_VERIFY_TOKEN) {
    return new NextResponse(u.searchParams.get('hub.challenge') || '');
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

async function forwardToN8n(from: string, text: string, name: string) {
  const payload = { payload: { from, body: text, pushName: name, channel: 'cloud_api' } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(META_AI_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-zeldapdv-secret': AI_SECRET },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    // Falha no encaminhamento não deve quebrar a resposta à Meta (evita retry em loop).
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const entry = Array.isArray(body?.entry) ? body.entry : [];
  for (const e of entry) {
    for (const change of e?.changes || []) {
      const value = change?.value || {};
      if (!Array.isArray(value?.messages)) continue;
      const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
      for (const msg of value.messages) {
        if (msg?.type !== 'text') continue;
        const from = String(msg?.from || '').trim();
        const text = String(msg?.text?.body || '').trim();
        if (!from || !text) continue;
        const contact = contacts.find((c: any) => String(c?.wa_id) === from);
        const name = contact?.profile?.name ? String(contact.profile.name) : '';
        await forwardToN8n(from, text, name);
      }
    }
  }
  return NextResponse.json({ ok: true, received: true });
}
