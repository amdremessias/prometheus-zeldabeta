import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { updatePedidoWebStatus } from '@/lib/server/db';
import { can } from '@/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUS = ['pendente', 'em_preparo', 'concluido', 'cancelado'];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    // Permissão de cozinha (admin, gerente, caixa, garcom, cozinha).
    if (!can(user.role, 'cozinha')) {
        return NextResponse.json({ error: 'Sem permissão para alterar pedidos da cozinha' }, { status: 403 });
    }

    const { id } = await params;
    const targetId = Number(id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        return NextResponse.json({ error: 'Pedido inválido' }, { status: 400 });
    }

    let status: string;
    try {
        const body = await req.json();
        status = String(body?.status ?? '');
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    const ok = await updatePedidoWebStatus(targetId, status as 'pendente' | 'em_preparo' | 'concluido' | 'cancelado');
    if (!ok) {
        return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
