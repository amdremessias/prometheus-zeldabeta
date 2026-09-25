import { cookies } from 'next/headers';
import { SESSION_COOKIE, SessionUser, verifySessionToken } from '@/lib/auth-core';

export async function getSessionUser(): Promise<SessionUser | null> {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return verifySessionToken(token);
}