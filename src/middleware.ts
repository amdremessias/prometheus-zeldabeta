import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth-core';
import { evaluateLicenseToken, isLicensingEnabled } from '@/lib/license-verify';
const PUBLIC_API_PREFIXES = ['/api/auth/login','/api/auth/logout','/api/cardapio-digital','/api/integrations/whatsapp/order','/api/whatsapp/inbound','/api/whatsapp/human','/api/whatsapp/order','/api/entregas','/api/whatsapp/feedback','/api/branding/config','/api/branding/presets','/api/branding/logo','/api/branding/selo','/api/v1/crm/chat-status','/api/v1/crm/conversations/check-in','/api/v1/menu-link','/api/v1/orders/status','/api/v1/sac/tickets','/api/v1/handoff'];
// Rotas de licença são sempre públicas (a tela de bloqueio e sua API precisam funcionar mesmo sem sessão/licença).
const LICENSE_API_PREFIXES = ['/api/license'];

/** Retorna true se a licença está bloqueando o acesso. Falha fechado (block) em caso de erro. */
async function licenseBlocks(): Promise<boolean> {
  if (!isLicensingEnabled()) return false;
  try {
    const lic = await evaluateLicenseToken();
    return lic.status === 'blocked';
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (LICENSE_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();

  // A licença tem PRIORIDADE sobre a autenticação: quando o sistema está
  // bloqueado, bloqueia TODOS (autenticados ou não), antes do gate de sessão.
  if (await licenseBlocks()) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Licença inválida ou expirada. Acesse a tela de licença.' },
        { status: 403 }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = '/license';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return NextResponse.next();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    return NextResponse.next();
  }

  if (pathname === '/app' || pathname.startsWith('/app/') || pathname === '/login') {
    if (!user) {
      if (pathname === '/login') return NextResponse.next();
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ['/app/:path*', '/api/:path*', '/login'] };

