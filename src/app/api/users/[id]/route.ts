import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { getUserById, updateUser } from '@/lib/server/db';
import { canManageUsers, USER_ROLES } from '@/lib/permissions';
import { isValidEmail, isNonEmptyString, MAX_NAME } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ROLES = USER_ROLES.map((r) => r.value);

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSessionUser();
    if (!actor || !canManageUsers(actor.role)) {
        return NextResponse.json({ error: 'Sem permissão para gerenciar usuários' }, { status: 403 });
    }

    const { id } = await params;
    const targetId = Number(id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 });
    }

    let body: { name?: string; email?: string; role?: string; active?: boolean };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    const target = await getUserById(targetId);
    if (!target) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const name = body.name !== undefined ? String(body.name).trim() : undefined;
    const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
    const role = body.role !== undefined ? String(body.role) : undefined;
    // active: aceita apenas true/false explícito (não valores "truthy")
    const active = body.active !== undefined ? body.active === true : undefined;

    if (name !== undefined && !isNonEmptyString(name, MAX_NAME)) {
        return NextResponse.json({ error: `Nome deve ter 1–${MAX_NAME} caracteres.` }, { status: 400 });
    }
    if (email !== undefined && !isValidEmail(email)) {
        return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 });
    }
    if (role !== undefined && !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
        return NextResponse.json({ error: 'Papel de usuário inválido.' }, { status: 400 });
    }

    // Proteções: não permitir desativar/abaixar o próprio admin sem remanescente
    if (target.id === actor.id) {
        if (active === false) {
            return NextResponse.json({ error: 'Você não pode desativar a si mesmo.' }, { status: 400 });
        }
        if (role !== undefined && role !== actor.role) {
            return NextResponse.json({ error: 'Você não pode alterar o próprio papel.' }, { status: 400 });
        }
    }

    try {
        const updated = await updateUser(targetId, { name, email, role, active });
        return NextResponse.json({ user: updated });
    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSessionUser();
    if (!actor || !canManageUsers(actor.role)) {
        return NextResponse.json({ error: 'Sem permissão para gerenciar usuários' }, { status: 403 });
    }

    const { id } = await params;
    const targetId = Number(id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        return NextResponse.json({ error: 'Usuário inválido' }, { status: 400 });
    }

    const target = await getUserById(targetId);
    if (!target) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    if (target.id === actor.id) {
        return NextResponse.json({ error: 'Você não pode excluir a si mesmo.' }, { status: 400 });
    }

    // Impede excluir o último admin ativo
    if (target.role === 'admin' && target.active) {
        const { listUsers } = await import('@/lib/server/db');
        const admins = (await listUsers()).filter((u) => u.role === 'admin' && u.active);
        if (admins.length <= 1) {
            return NextResponse.json(
                { error: 'Não é possível excluir o último administrador ativo.' },
                { status: 400 }
            );
        }
    }

    try {
        // Exclusão = desativação (mantém integridade de FK no histórico)
        await updateUser(targetId, { active: false });
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Erro ao desativar usuário:', error);
        return NextResponse.json({ error: 'Erro ao desativar usuário' }, { status: 500 });
    }
}
