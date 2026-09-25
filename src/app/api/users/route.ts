import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSessionUser } from '@/lib/server/session';
import { createUser, findByEmail, listUsers } from '@/lib/server/db';
import { canManageUsers } from '@/lib/permissions';
import { USER_ROLES } from '@/lib/permissions';
import { isValidEmail, isNonEmptyString, MAX_NAME, MAX_PASSWORD } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ROLES = USER_ROLES.map((r) => r.value);

export async function GET() {
    const user = await getSessionUser();
    if (!user || !canManageUsers(user.role)) {
        return NextResponse.json({ error: 'Sem permissão para gerenciar usuários' }, { status: 403 });
    }
    try {
        const users = await listUsers();
        return NextResponse.json({ users });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user || !canManageUsers(user.role)) {
        return NextResponse.json({ error: 'Sem permissão para gerenciar usuários' }, { status: 403 });
    }

    let body: { name?: string; email?: string; password?: string; role?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = String(body.role || '');

    if (!isNonEmptyString(name, MAX_NAME) || !isValidEmail(email) || password.length < 6 || password.length > MAX_PASSWORD) {
        return NextResponse.json(
            { error: 'Nome, e-mail válido e senha (6–128 caracteres) são obrigatórios.' },
            { status: 400 }
        );
    }
    if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
        return NextResponse.json({ error: 'Papel de usuário inválido.' }, { status: 400 });
    }

    try {
        const existing = await findByEmail(email);
        if (existing) {
            return NextResponse.json({ error: 'Já existe um usuário com esse e-mail.' }, { status: 409 });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const created = await createUser({ name, email, passwordHash, role });
        return NextResponse.json({ user: created }, { status: 201 });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);
        return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 });
    }
}
