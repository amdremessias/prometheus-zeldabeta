import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, pool } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/session';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureSchema();
  const status = req.nextUrl.searchParams.get('status');
  const query = status ? 'SELECT * FROM feedback_pedidos_wpp WHERE status = $1 ORDER BY created_at DESC LIMIT 500' : 'SELECT * FROM feedback_pedidos_wpp ORDER BY created_at DESC LIMIT 500';
  const result = await pool.query(query, status ? [status] : []);
  return NextResponse.json({ feedback: result.rows });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const token = process.env.WPP_INBOUND_TOKEN;
  if (!user && (!token || req.headers.get('x-wpp-inbound-token') !== token)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.phone || !body?.message) return NextResponse.json({ error: 'phone e message são obrigatórios' }, { status: 400 });
  await ensureSchema();
  const result = await pool.query('INSERT INTO feedback_pedidos_wpp (phone, customer_name, kind, message, order_number, metadata) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [String(body.phone), String(body.customer_name || ''), String(body.kind || 'elogio'), String(body.message), body.order_number ? String(body.order_number) : null, body.metadata || {}]);
  return NextResponse.json({ feedback: result.rows[0] }, { status: 201 });
}
