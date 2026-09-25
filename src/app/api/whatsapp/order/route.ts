import { NextRequest, NextResponse } from 'next/server';
import { createPedidoWeb, ensureSchema } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  const token = process.env.WPP_INBOUND_TOKEN || process.env.CRM_WEBHOOK_SECRET;
  const header = req.headers.get('x-wpp-inbound-token');
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(token && (header === token || bearer === token));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'NÃ£o autorizado' }, { status: 401 });
  try {
    const body = await req.json();
    const cliente = String(body?.cliente ?? body?.name ?? '').trim();
    const telefone = String(body?.telefone ?? body?.phone ?? '').trim();
    const endereco = String(body?.endereco ?? body?.address ?? '').trim();
    const pagamento = String(body?.pagamento ?? body?.payment ?? '').trim().toLowerCase();
    const mode = String(body?.mode ?? 'takeout').toLowerCase();
    const itens = Array.isArray(body?.itens ?? body?.items) ? (body.itens ?? body.items) : [];
    if (!cliente || !telefone || !pagamento || !itens.length) {
      return NextResponse.json({ error: 'cliente, telefone, pagamento e itens sÃ£o obrigatÃ³rios' }, { status: 400 });
    }
    if (mode === 'delivery' && !endereco) return NextResponse.json({ error: 'endereco Ã© obrigatÃ³rio para entrega' }, { status: 400 });
    const normalized = itens.map((item: any) => ({
      id: Number(item.id), title: String(item.title ?? '').trim(),
      price: Number(item.price), quantity: Math.min(Math.max(Number(item.quantity) || 1, 1), 20),
    })).filter((item: any) => item.id > 0 && item.title && Number.isFinite(item.price) && item.price >= 0);
    if (!normalized.length) return NextResponse.json({ error: 'itens invÃ¡lidos' }, { status: 400 });
    const subtotal = normalized.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
    const taxaEntregaValor = mode === 'delivery' ? Math.max(0, Number(body?.taxaEntregaValor ?? body?.delivery_fee ?? 0)) : 0;
    const taxaEntregaNome = mode === 'delivery' ? String(body?.taxaEntregaNome ?? body?.delivery_fee_name ?? 'Taxa de entrega').trim() : '';
    const total = subtotal + taxaEntregaValor;
    await ensureSchema();
    const pedido = await createPedidoWeb({
      slug: String(body?.slug ?? 'sandbox').trim() || 'sandbox', cliente, telefone,
      endereco: mode === 'delivery' ? endereco : 'Retirada no local', pagamento,
      taxaEntregaNome, taxaEntregaValor, itens: normalized, subtotal, total, observacoes: String(body?.observacoes ?? body?.notes ?? '').trim(), modoEntrega: mode, carteiraFiado: pagamento === 'fiado' || pagamento === 'carteira',
    });
    return NextResponse.json({ accepted: true, pedido: { id: pedido.id, numero: pedido.id, status: pedido.status ?? 'pendente', subtotal, taxaEntregaValor, total } }, { status: 201 });
  } catch (error) {
    console.error('[whatsapp-order-create]', error);
    return NextResponse.json({ error: 'NÃ£o foi possÃ­vel criar o pedido' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ service: 'whatsapp-order-create', status: 'ready' });
}

// n8n integration endpoint; authentication is enforced by WPP_INBOUND_TOKEN.
// The order remains pending until an operator approves it in the CRM.

