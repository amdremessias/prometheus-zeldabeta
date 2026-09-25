import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para acessar notas fiscais' }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
    }

    try {
        await ensureSchema();
        const res = await pool.query<{ xml_envio: string | null; modelo: string; numero: number }>(
            'SELECT xml_envio, modelo, numero FROM fiscal_notes WHERE id = $1',
            [id]
        );
        if (!res.rowCount) {
            return NextResponse.json({ error: 'Nota não encontrada' }, { status: 404 });
        }
        const row = res.rows[0];
        if (!row.xml_envio) {
            return NextResponse.json({ error: 'Nota sem XML de envio' }, { status: 404 });
        }

        return new NextResponse(row.xml_envio, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Content-Disposition': `attachment; filename="NFe-${row.modelo}-${row.numero}.xml"`,
            },
        });
    } catch (error) {
        console.error('Erro ao baixar XML da nota:', error);
        return NextResponse.json({ error: 'Erro ao baixar XML da nota' }, { status: 500 });
    }
}
