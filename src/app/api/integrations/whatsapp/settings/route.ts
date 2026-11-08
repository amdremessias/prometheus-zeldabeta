import { NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';

const PATH = '/api/integrations/whatsapp/waha/webhook';
const envProvider = () => process.env.WHATSAPP_PROVIDER === 'meta' ? 'meta' : 'waha';
function configuration() {
  const waha = Boolean(process.env.WAHA_API_URL && process.env.WAHA_WEBHOOK_HMAC_KEY);
  const meta = Boolean(
    (process.env.WHATSAPP_CLOUD_PHONE_ID || process.env.META_WA_PHONE_NUMBER_ID || process.env.META_PHONE_ID) &&
    (process.env.WHATSAPP_CLOUD_ACCESS_TOKEN || process.env.META_WA_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN) &&
    (process.env.WHATSAPP_CLOUD_VERIFY_TOKEN || process.env.META_WA_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN) &&
    (process.env.WHATSAPP_CLOUD_APP_SECRET || process.env.META_WA_APP_SECRET || process.env.META_APP_SECRET)
  );
  return { waha, meta };
}
function settings(data: any) {
  const w = data?.integrations?.whatsapp || {};
  const provider = w.provider === 'meta' || w.provider === 'waha' ? w.provider : envProvider();
  return { enabled: w.enabled === true, provider, webhookPath: w.webhookPath || PATH, configured: configuration() };
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
    const currentProvider = data?.integrations?.whatsapp?.provider || envProvider();
    const provider = body.provider === undefined ? currentProvider : body.provider;
    if (provider !== 'waha' && provider !== 'meta') return NextResponse.json({ error: 'provider deve ser waha ou meta' }, { status: 400 });
    const configured = configuration();
    if (body.enabled && !configured[provider]) return NextResponse.json({ error: 'Configure os segredos e credenciais do provedor antes de ativá-lo', configured }, { status: 400 });
    const next = { ...data, integrations: { ...(data.integrations || {}), whatsapp: { ...(data.integrations?.whatsapp || {}), enabled: body.enabled, provider, webhookPath: provider === 'meta' ? '/api/integrations/whatsapp/official/webhook' : PATH } } };
    const saved = await pool.query('INSERT INTO app_state (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now() RETURNING data', [1, JSON.stringify(next)]);
    return NextResponse.json(settings(saved.rows[0]?.data || next));
  } catch (error) {
    console.error('whatsapp settings PUT', error);
    return NextResponse.json({ error: 'Não foi possível salvar a integração' }, { status: 500 });
  }
}
