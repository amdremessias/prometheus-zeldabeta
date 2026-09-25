import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/server/db';
import { checkWebhookSecret } from '@/lib/server/webhookAuth';
import { checkInConversation, cleanPhone } from '@/lib/server/atendimento';

export async function POST(req: NextRequest) {
    if (!checkWebhookSecret(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    await ensureSchema();
    const b = await req.json().catch(() => ({}));
    const phone = cleanPhone(b.phone);
    if (!phone) return NextResponse.json({ error: 'phone é obrigatório' }, { status: 400 });

    const result = await checkInConversation({ phone, customerName: String(b.customer_name || b.customerName || '') });
    return NextResponse.json({ ok: true, ...result });
}
