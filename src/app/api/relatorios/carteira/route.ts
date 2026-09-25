import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { ensureSchema, pool } from '@/lib/server/db';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  if (!(await getSessionUser())) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureSchema();
  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');
  const result = await pool.query(`SELECT cliente, telefone, tipo, valor, observacao, criado_em, recebido, recebido_em, pedido_id FROM carteira_fiado_movimentos WHERE ($1::timestamptz IS NULL OR criado_em >= $1) AND ($2::timestamptz IS NULL OR criado_em < ($2::timestamptz + interval '1 day')) ORDER BY criado_em DESC`, [from ? `${from}T00:00:00` : null, to ? `${to}T00:00:00` : null]);
  return NextResponse.json(result.rows);
}
