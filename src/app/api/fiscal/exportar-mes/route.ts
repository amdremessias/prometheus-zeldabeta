import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';
import { buildZip } from '@/lib/server/zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para exportar notas fiscais' }, { status: 403 });
    }

    const sp = new URL(req.url).searchParams;
    const now = new Date();
    const ano = Number(sp.get('ano') ?? now.getFullYear());
    const mes = Number(sp.get('mes') ?? now.getMonth() + 1);
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        return NextResponse.json({ error: 'Mês/ano inválidos' }, { status: 400 });
    }
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01T00:00:00`;
    const fim = `${ano}-${String(mes).padStart(2, '0')}-31T23:59:59`;

    try {
        await ensureSchema();
        const rows = await pool.query<{
            id: number;
            modelo: string;
            numero: number;
            chave_acesso: string | null;
            xml_envio: string | null;
        }>(
            `SELECT id, modelo, numero, chave_acesso, xml_envio
             FROM fiscal_notes
             WHERE created_at >= $1 AND created_at <= $2
               AND xml_envio IS NOT NULL AND xml_envio <> ''
             ORDER BY created_at ASC, id ASC`,
            [inicio, fim]
        );

        if (!rows.rowCount) {
            return NextResponse.json({ error: 'Nenhum XML disponível para o período' }, { status: 404 });
        }

        const files = rows.rows.map((r) => ({
            name: `NFCe-${r.modelo}-${r.numero}-${r.chave_acesso || r.id}.xml`,
            data: Buffer.from(r.xml_envio as string, 'utf8'),
        }));

        const zip = buildZip(files);
        return new NextResponse(new Uint8Array(zip), {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="notas-${ano}-${String(mes).padStart(2, '0')}.zip"`,
            },
        });
    } catch (error) {
        console.error('Erro ao exportar notas fiscais:', error);
        return NextResponse.json({ error: 'Erro ao exportar notas fiscais' }, { status: 500 });
    }
}
