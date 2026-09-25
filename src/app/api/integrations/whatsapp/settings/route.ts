import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';

const PATH = '/api/whatsapp/inbound';
function settings(data: any) {
  const w = data?.integrations?.whatsapp || {};
  return { enabled: w.enabled === true, webhookPath: w.webhookPath || PATH };
}
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const r = await pool.query('SELECT data FROM app_state WHERE id = $1', [1]);
    return NextResponse.json(settings(r.rows[0]?.data || {}));
  } catch (error) {
    console.error('whatsapp settings GET', error);
    return NextResponse.json({ error: 'Não foi possível carregar a integração' }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!can(user.role, 'integracoes')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  try {
    const body = await request.json();
    if (typeof body.enabled !== 'boolean') return NextResponse.json({ error: 'enabled deve ser boolean' }, { status: 400 });
    const current = await pool.query('SELECT data FROM app_state WHERE id = $1', [1]);
    const data = current.rows[0]?.data && typeof current.rows[0].data === 'object' ? current.rows[0].data : {};
    const next = { ...data, integrations: { ...(data.integrations || {}), whatsapp: { ...(data.integrations?.whatsapp || {}), enabled: body.enabled, webhookPath: body.webhookPath || PATH } } };
    const saved = await pool.query('INSERT INTO app_state (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now() RETURNING data', [1, JSON.stringify(next)]);
    return NextResponse.json(settings(saved.rows[0]?.data || next));
  } catch (error) {
    console.error('whatsapp settings PUT', error);
    return NextResponse.json({ error: 'Nao foi possivel salvar a integracao' }, { status: 500 });
  }
}

