import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type NoteRow = {
    id: number;
    pedido_id: number | null;
    venda_id: string;
    modelo: string;
    serie: number;
    numero: number;
    chave_acesso: string | null;
    status: string;
    ambiente: number;
    protocolo: string | null;
    motivo_rejeicao: string | null;
    payload_venda: unknown;
    created_at: Date;
    updated_at: Date;
};

const VALID_STATUS = ['pendente', 'autorizada', 'rejeitada', 'cancelada', 'contingencia'];

export async function GET(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para acessar notas fiscais' }, { status: 403 });
    }

    const sp = new URL(req.url).searchParams;
    const modelo = sp.get('modelo');
    const status = sp.get('status');
    const dataInicio = sp.get('dataInicio');
    const dataFim = sp.get('dataFim');
    const limitRaw = Number(sp.get('limit') ?? 100);
    const offsetRaw = Number(sp.get('offset') ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 500) : 100;
    const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

    const where: string[] = [];
    const params: unknown[] = [];
    if (modelo && ['55', '65'].includes(String(modelo))) {
        params.push(String(modelo));
        where.push(`modelo = $${params.length}`);
    }
    if (status && VALID_STATUS.includes(String(status))) {
        params.push(String(status));
        where.push(`status = $${params.length}`);
    }
    if (dataInicio) {
        params.push(String(dataInicio));
        where.push(`created_at >= $${params.length}`);
    }
    if (dataFim) {
        params.push(String(dataFim));
        where.push(`created_at <= $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    try {
        await ensureSchema();
        const count = await pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM fiscal_notes ${whereSql}`, params);
        const total = Number(count.rows[0]?.total ?? 0);

        params.push(limit, offset);
        const rows = await pool.query<NoteRow>(
            `SELECT id, pedido_id, venda_id, modelo, serie, numero, chave_acesso, status,
                    ambiente, protocolo, motivo_rejeicao, payload_venda, created_at, updated_at
             FROM fiscal_notes ${whereSql}
             ORDER BY created_at DESC, id DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const notes = rows.rows.map((r) => ({
            id: r.id,
            pedidoId: r.pedido_id,
            vendaId: r.venda_id,
            modelo: r.modelo,
            serie: r.serie,
            numero: r.numero,
            chaveAcesso: r.chave_acesso,
            status: r.status,
            ambiente: r.ambiente,
            protocolo: r.protocolo,
            motivoRejeicao: r.motivo_rejeicao,
            payloadVenda: r.payload_venda,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));

        return NextResponse.json({ notes, total, limit, offset });
    } catch (error) {
        console.error('Erro ao listar notas fiscais:', error);
        return NextResponse.json({ error: 'Erro ao listar notas fiscais' }, { status: 500 });
    }
}
