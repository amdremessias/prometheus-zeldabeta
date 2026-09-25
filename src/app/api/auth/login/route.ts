import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { findByEmail, ensureDefaultUser, DEFAULT_ADMIN_EMAIL } from '@/lib/server/db';
import { SESSION_COOKIE, createSessionToken } from '@/lib/auth-core';
import { checkRateLimit, clientIp } from '@/lib/server/rateLimit';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const rate = checkRateLimit('login:' + clientIp(req), { max: 5, windowMs: 60000 });
    if (!rate.allowed) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    await ensureDefaultUser();
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const user = await findByEmail(email);
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    const token = await createSessionToken({ id: user.id, name: user.name, email: user.email, role: user.role });
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    response.cookies.set({ name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === 'production' && process.env.SESSION_SECURE !== 'false', sameSite: 'lax', path: '/', maxAge: 604800 });
    return response;
  } catch (error) { console.error('Erro no login:', error); return NextResponse.json({ error: 'Erro interno ao efetuar login' }, { status: 500 }); }
}
export async function GET() { return NextResponse.json({ defaultUser: { email: DEFAULT_ADMIN_EMAIL } }); }
