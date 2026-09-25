import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANCELAVEIS = ['pendente', 'autorizada'];

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para cancelar notas fiscais' }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    let motivo = '';
    try {
        const body = await req.json();
        motivo = typeof body?.motivo === 'string' ? body.motivo.trim().slice(0, 500) : '';
    } catch {
        /* motivo opcional */
    }

    try {
        await ensureSchema();
        const res = await pool.query<{ status: string }>('SELECT status FROM fiscal_notes WHERE id = $1', [id]);
        if (!res.rowCount) {
            return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 });
        }
        const current = res.rows[0].status;
        if (!CANCELAVEIS.includes(current)) {
            return NextResponse.json({ error: `Nota com status "${current}" não pode ser cancelada` }, { status: 409 });
        }

        await pool.query(
            'UPDATE fiscal_notes SET status = $2, motivo_rejeicao = $3, updated_at = now() WHERE id = $1',
            [id, 'cancelada', motivo || 'Cancelamento manual']
        );

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Erro ao cancelar nota fiscal:', error);
        return NextResponse.json({ error: 'Erro ao cancelar nota fiscal' }, { status: 500 });
    }
}
