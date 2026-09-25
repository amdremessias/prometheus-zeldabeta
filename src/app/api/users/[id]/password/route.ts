import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser } from '@/lib/server/session';
import { getUserById, updateUserPassword } from '@/lib/server/db';
import { canManageUsers } from '@/lib/permissions';
import { checkRateLimit, clientIp } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Admin redefine a senha de outro usuário. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    // Rate limit: 5 tentativas/minuto por IP.
    const rl = checkRateLimit(`pwd:admin:${clientIp(req)}`, { max: 5, windowMs: 60_000 });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Muitas tentativas. Aguarde um minuto.' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
        );
    }

    const actor = await getSessionUser();
    if (!actor || !canManageUsers(actor.role)) {
        return NextResponse.json({ error: 'Sem permissão para gerenciar usuários' }, { status: 403 });
    }

    const { id } = await params;
    const targetId = Number(id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 });
    }

    let body: { password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    const password = String(body.password || '');
    if (password.length < 6 || password.length > 128) {
        return NextResponse.json({ error: 'A nova senha deve ter entre 6 e 128 caracteres.' }, { status: 400 });
    }

    const target = await getUserById(targetId);
    if (!target) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    try {
        const passwordHash = await bcrypt.hash(password, 10);
        await updateUserPassword(targetId, passwordHash);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Erro ao alterar senha do usuário:', error);
        return NextResponse.json({ error: 'Erro ao alterar senha do usuário' }, { status: 500 });
    }
}
