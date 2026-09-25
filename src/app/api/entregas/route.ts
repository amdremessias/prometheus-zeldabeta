import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { ensureSchema, pool, createPedidoWeb } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function allowed(req: NextRequest) {
  const token = process.env.WPP_INBOUND_TOKEN;
  const internal = req.headers.get('x-wpp-inbound-token');
  if (token && internal === token) return true;
  return Boolean(await getSessionUser());
}

const transitions: Record<string, string[]> = {
  concluido: ['aguardando'],
  aguardando: ['retirada_confirmada', 'em_entrega'],
  retirada_confirmada: ['recebido'],
  em_entrega: ['entregue', 'recebido'],
  entregue: ['recebido'],
};

export async function GET(req: NextRequest) {
  if (!(await allowed(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureSchema();
  const status = req.nextUrl.searchParams.get('status');
  const result = await pool.query(`SELECT * FROM pedidos_web WHERE ($1::text IS NULL OR status_entrega = $1) ORDER BY id DESC`, [status]);
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  if (!(await allowed(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureSchema();
  const body = await req.json();
  const cliente = String(body?.cliente ?? '').trim();
  const telefone = String(body?.telefone ?? '').trim();
  if (!cliente || !telefone) return NextResponse.json({ error: 'cliente e telefone são obrigatórios' }, { status: 400 });

  const modo = body?.modo_entrega === 'entrega' ? 'entrega' : 'retirada';
  const rawItens = Array.isArray(body?.itens) ? body.itens : [];
  const itens = rawItens.map((i: any) => ({
    id: Number(i.id) || 0,
    title: String(i.title ?? ''),
    price: Number(i.price) || 0,
    quantity: Math.max(1, Number(i.quantity) || 1),
    notes: i.notes ? String(i.notes) : undefined,
    adicionais: Array.isArray(i.adicionais) ? i.adicionais : undefined,
  }));
  if (!itens.length) return NextResponse.json({ error: 'Informe ao menos um item' }, { status: 400 });

  const subtotal = Number(body?.subtotal) || itens.reduce((acc: number, i: any) => acc + i.price * i.quantity, 0);
  const taxaEntregaValor = Number(body?.taxa_entrega_valor) || 0;
  const total = Number(body?.total) || subtotal + taxaEntregaValor;
  const pagamento = String(body?.pagamento ?? 'dinheiro');

  const created = await createPedidoWeb({
    slug: '',
    cliente,
    telefone,
    endereco: String(body?.endereco ?? '').trim(),
    observacoes: String(body?.observacoes ?? '').trim(),
    modoEntrega: modo,
    pagamento,
    taxaEntregaNome: '',
    taxaEntregaValor,
    itens,
    subtotal,
    total,
  });
  // Se for enviado para a cozinha, nasce como 'pendente' e segue o fluxo
  // cozinha -> pronto (concluido) -> entrega/retirada -> recebimento -> faturamento.
  if (!body?.paraCozinha) {
    await pool.query('UPDATE pedidos_web SET status = $2 WHERE id = $1', [created.id, 'concluido']);
    return NextResponse.json({ ...created, status: 'concluido' }, { status: 201 });
  }
  return NextResponse.json({ ...created, status: 'pendente' }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  if (!(await allowed(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureSchema();
  const body = await req.json();
  const id = Number(body?.id);
  const next = String(body?.status_entrega ?? '').trim();
  if (!id || !next) return NextResponse.json({ error: 'id e status_entrega são obrigatórios' }, { status: 400 });
  const current = await pool.query('SELECT * FROM pedidos_web WHERE id = $1', [id]);
  if (!current.rowCount) return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
  const row = current.rows[0];
  const from = String(row.status_entrega || (row.status === 'concluido' ? 'aguardando' : ''));
  if (!transitions[from]?.includes(next)) return NextResponse.json({ error: `Transição inválida: ${from} -> ${next}` }, { status: 409 });
  if (next === 'em_entrega' && !String(body?.entregador ?? '').trim()) return NextResponse.json({ error: 'Entregador obrigatório' }, { status: 400 });
  if (next === 'recebido' && row.carteira_fiado) {
    const credit = await pool.query('SELECT habilitado, limite, COALESCE((SELECT SUM(CASE WHEN tipo = \'debito\' THEN valor ELSE -valor END) FROM carteira_fiado_movimentos m WHERE m.telefone = $1 AND m.recebido = FALSE),0) AS saldo FROM clientes_carteira_fiado WHERE telefone = $1', [row.telefone]);
    if (!credit.rowCount || !credit.rows[0].habilitado) return NextResponse.json({ error: 'Cliente não habilitado para Carteira/Fiado' }, { status: 422 });
  }

  const setClauses = ['status_entrega = $1', 'updated_at = now()'];
  const params: any[] = [next, id];
  const tsMap: Record<string, string> = {
    retirada_confirmada: 'retirada_confirmada_at = now()',
    em_entrega: 'saiu_entrega_at = now()',
    entregue: 'entregue_at = now()',
    recebido: 'recebido = TRUE, recebido_at = now()',
  };
  if (tsMap[next]) setClauses.push(tsMap[next]);
  if (next === 'em_entrega') {
    setClauses.push('entregador = $3', 'entregador_telefone = $4');
    params.push(String(body.entregador).trim(), String(body.entregador_telefone ?? '').trim());
  }
  if (body?.pagamento) {
    setClauses.push(`pagamento = $${params.length + 1}`);
    params.push(String(body.pagamento));
  }
  const updated = await pool.query(`UPDATE pedidos_web SET ${setClauses.join(', ')} WHERE id = $2 RETURNING *`, params);
  if (next === 'recebido' && row.carteira_fiado) await pool.query('INSERT INTO carteira_fiado_movimentos (pedido_id, cliente, telefone, tipo, valor, observacao) VALUES ($1,$2,$3,\'debito\',$4,$5)', [id, row.cliente, row.telefone, row.total, `Pedido #${id}`]);
  return NextResponse.json(updated.rows[0]);
}
