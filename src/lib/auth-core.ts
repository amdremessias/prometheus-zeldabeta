import { SignJWT, jwtVerify } from 'jose';
export const SESSION_COOKIE = 'zpdv_session';
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET é obrigatório em produção.');
    }
    return new TextEncoder().encode('dev-secret-zeldapdv-food');
  }
  return new TextEncoder().encode(secret);
}
export interface SessionUser { id: number; name: string; email: string; role: string; }
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, role: user.role }).setProtectedHeader({ alg: 'HS256' }).setSubject(String(user.id)).setIssuedAt().setExpirationTime('7d').sign(getSecret());
}
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try { const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] }); const role = typeof payload.role === 'string' && payload.role ? payload.role : ''; return { id: Number(payload.sub), name: String(payload.name || ''), email: String(payload.email || ''), role }; } catch { return null; }
}
