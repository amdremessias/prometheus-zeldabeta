import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';

const valid = ['n8n', 'gemini', 'gateway'] as const;
function configuration() {
  return {
    n8n: Boolean(process.env.ZELDAPDV_AI_WEBHOOK_URL),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    gateway: Boolean(process.env.ZELDAPDV_AI_GATEWAY_URL),
  };
}
function settings(data: any) {
  const value = data?.integrations?.ai?.provider;
  const envValue = String(process.env.ZELDAPDV_AI_PROVIDER || 'n8n').toLowerCase();
  const provider = valid.includes(value) ? value : valid.includes(envValue as any) ? envValue : 'n8n';
  return { provider, configured: configuration() };
}
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  try {
    const r = await pool.query('SELECT data FROM app_state WHERE id = $1', [1]);
    return NextResponse.json(settings(r.rows[0]?.data || {}));
  } catch (error) {
    console.error('ai settings GET', error);
    return NextResponse.json({ error: 'Não foi possível carregar a configuração de IA' }, { status: 500 });
  }
}
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!can(user.role, 'integracoes')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  try {
    const body = await request.json();
    if (!valid.includes(body?.provider)) return NextResponse.json({ error: 'provider deve ser n8n, gemini ou gateway' }, { status: 400 });
    const current = await pool.query('SELECT data FROM app_state WHERE id = $1', [1]);
    const data = current.rows[0]?.data && typeof current.rows[0].data === 'object' ? current.rows[0].data : {};
    const next = { ...data, integrations: { ...(data.integrations || {}), ai: { ...(data.integrations?.ai || {}), provider: body.provider } } };
    const saved = await pool.query('INSERT INTO app_state (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now() RETURNING data', [1, JSON.stringify(next)]);
    return NextResponse.json(settings(saved.rows[0]?.data || next));
  } catch (error) {
    console.error('ai settings PUT', error);
    return NextResponse.json({ error: 'Não foi possível salvar a configuração de IA' }, { status: 500 });
  }
}
