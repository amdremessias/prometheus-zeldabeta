import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser } from '@/lib/server/session';
import { getPasswordHashById } from '@/lib/server/db';
import { checkRateLimit, clientIp } from '@/lib/server/rateLimit';

export const runtime = 'nodejs';

/* Valida a senha do usuário logado (usada para ações sensíveis, ex.: excluir item de mesa).
   Rate limit: 5 tentativas/minuto por IP. */
export async function POST(req: NextRequest) {
    try {
        const rl = checkRateLimit(`verify:${clientIp(req)}`, { max: 5, windowMs: 60_000 });
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Muitas tentativas. Aguarde um minuto.' },
                { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
            );
        }

        const sess = await getSessionUser();
        if (!sess) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
        }

        const body = await req.json().catch(() => null);
        const password = String(body?.password || '');
        if (!password) {
            return NextResponse.json({ error: 'Informe a senha para confirmar.' }, { status: 400 });
        }
        if (password.length > 128) {
            return NextResponse.json({ error: 'Senha muito longa.' }, { status: 400 });
        }

        const hash = await getPasswordHashById(sess.id);
        if (!hash) {
            return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
        }

        const ok = await bcrypt.compare(password, hash);
        if (!ok) {
            return NextResponse.json({ error: 'Senha incorreta.' }, { status: 401 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Erro ao validar senha:', error);
        return NextResponse.json({ error: 'Erro interno ao validar senha.' }, { status: 500 });
    }
}
