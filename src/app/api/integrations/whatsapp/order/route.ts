import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const expected = process.env.CRM_WEBHOOK_SECRET;
    const received = request.headers.get("x-crm-webhook-secret");
    if (expected && received !== expected) {
      return NextResponse.json({ accepted: false, reason: "invalid_webhook_secret" }, { status: 401 });
    }
    const body = await request.json();
    const event = body?.event ?? body;
    const payload = event?.payload ?? {};
    const text = String(payload?.body ?? payload?.text ?? "").trim();
    const chatId = payload?.from ?? payload?.chatId ?? null;
    if (!chatId || !text) {
      return NextResponse.json({ accepted: false, reason: "missing_chat_or_text" }, { status: 400 });
    }
    const order = { source: "whatsapp", chatId, text, receivedAt: new Date().toISOString(), raw: body };
    console.log("[whatsapp-order]", JSON.stringify(order));
    return NextResponse.json({ accepted: true, order });
  } catch {
    return NextResponse.json({ accepted: false, reason: "invalid_json" }, { status: 400 });
  }
}
