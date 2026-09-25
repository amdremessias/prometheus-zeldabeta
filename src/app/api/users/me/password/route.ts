import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser } from '@/lib/server/session';
import { getPasswordHashById, updateUserPassword } from '@/lib/server/db';
import { checkRateLimit, clientIp } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Usuário logado troca a própria senha (senha atual + nova). */
export async function POST(req: NextRequest) {
    // Rate limit: 5 tentativas/minuto por IP.
    const rl = checkRateLimit(`pwd:me:${clientIp(req)}`, { max: 5, windowMs: 60_000 });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Muitas tentativas. Aguarde um minuto.' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
        );
    }

    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body: { currentPassword?: string; newPassword?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 6 || newPassword.length > 128) {
        return NextResponse.json({ error: 'A nova senha deve ter entre 6 e 128 caracteres.' }, { status: 400 });
    }
    if (currentPassword.length > 128) {
        return NextResponse.json({ error: 'Senha atual muito longa' }, { status: 400 });
    }

    try {
        const hash = await getPasswordHashById(user.id);
        if (!hash) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
        }
        const valid = await bcrypt.compare(currentPassword, hash);
        if (!valid) {
            return NextResponse.json({ error: 'Senha atual incorreta.' }, { status: 401 });
        }

        const newHash = await bcrypt.hash(newPassword, 10);
        await updateUserPassword(user.id, newHash);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Erro ao trocar senha:', error);
        return NextResponse.json({ error: 'Erro ao trocar a senha' }, { status: 500 });
    }
}
