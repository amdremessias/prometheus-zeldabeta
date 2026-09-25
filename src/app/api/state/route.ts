import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';
import { getOpenCaixa } from '@/lib/server/caixa';
import { isValidImageDataUrl, MAX_STATE_BYTES } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StoredState = { data: Record<string, unknown> | null; updatedAt: string | null };

const countTransacoes = (data: Record<string, unknown> | null | undefined): number => {
    const contabilidade = data?.contabilidade as { transacoes?: unknown[] } | undefined;
    return contabilidade?.transacoes?.length ?? 0;
};

/* Valida imageData em pratos (data:image/(png|jpeg|webp|gif);base64, ≤ 2.5 MB).
   String vazia/null = sem imagem (válido). */
function validateImageDataInState(data: Record<string, unknown>): boolean {
    const cardapio = (data as { cardapio?: { pratos?: unknown[] } }).cardapio;
    const pratos = Array.isArray(cardapio?.pratos) ? cardapio.pratos : [];
    for (const prato of pratos) {
        const img = (prato as { imageData?: unknown }).imageData;
        if (typeof img === 'string' && img.length === 0) continue;
        if (img !== undefined && img !== null) {
            if (typeof img !== 'string' || !isValidImageDataUrl(img)) {
                return false;
            }
        }
    }
    return true;
}

/* Valida estoque: quando presente, inteiro não-negativo até 1.000.000. */
function validateEstoqueInState(data: Record<string, unknown>): boolean {
    const cardapio = (data as { cardapio?: { pratos?: unknown[] } }).cardapio;
    const pratos = Array.isArray(cardapio?.pratos) ? cardapio.pratos : [];
    for (const prato of pratos) {
        for (const key of ['estoqueAtual', 'estoqueMinimo'] as const) {
            const val = (prato as Record<string, unknown>)[key];
            if (val === undefined || val === null) continue;
            const num = Number(val);
            if (!Number.isInteger(num) || num < 0 || num > 1_000_000) {
                return false;
            }
        }
    }
    return true;
}

async function readState(): Promise<StoredState> {
    const res = await pool.query('SELECT data, updated_at FROM app_state WHERE id = 1');
    if ((res.rowCount ?? 0) === 0) return { data: null, updatedAt: null };
    return { data: res.rows[0].data, updatedAt: res.rows[0].updated_at ? new Date(res.rows[0].updated_at).toISOString() : null };
}

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    try {
        await ensureSchema();
        const state = await readState();
        return NextResponse.json({ data: state.data, updatedAt: state.updatedAt });
    } catch (error) {
        console.error('Erro ao ler estado:', error);
        return NextResponse.json({ error: 'Erro ao ler estado do servidor' }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'config')) {
        return NextResponse.json({ error: 'Sem permissão para alterar configurações' }, { status: 403 });
    }

    // Verifica tamanho do body antes de parsear (content-length + serializado).
    const cl = req.headers.get('content-length');
    if (cl && Number(cl) > MAX_STATE_BYTES) {
        return NextResponse.json({ error: 'Payload muito grande (máx. 25 MB)' }, { status: 413 });
    }

    let data: Record<string, unknown> | null = null;
    let clientUpdatedAt: string | undefined;
    try {
        const body = await req.json();
        data = (body?.data ?? null) as Record<string, unknown> | null;
        clientUpdatedAt = body?.updatedAt;
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    if (!data) {
        return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Valida tamanho serializado (após parse).
    if (JSON.stringify(data).length > MAX_STATE_BYTES) {
        return NextResponse.json({ error: 'Estado muito grande (máx. 25 MB)' }, { status: 413 });
    }

    // Valida imageData (tipo de arquivo + tamanho).
    if (!validateImageDataInState(data)) {
        return NextResponse.json(
            { error: 'Imagem inválida: use PNG/JPEG/WebP/GIF, máx. 2.5 MB por imagem.' },
            { status: 400 }
        );
    }

    // Valida estoque (inteiro não-negativo, máx. 1.000.000).
    if (!validateEstoqueInState(data)) {
        return NextResponse.json(
            { error: 'Estoque inválido: use inteiros de 0 a 1.000.000.' },
            { status: 400 }
        );
    }

    try {
        await ensureSchema();

        const pre = await readState();

        // Se o cliente enviou um updatedAt (token de concorrência), exige que ele
        // ainda corresponda ao estado atual. Evita que uma aba com estado obsoleto
        // sobrescreva dados de um restore/backup recém-restaurado.
        if (clientUpdatedAt !== undefined && pre.updatedAt !== null && clientUpdatedAt !== pre.updatedAt) {
            return NextResponse.json(
                { error: 'Estado alterado em outra aba ou por um restore. Recarregue para sincronizar.', updatedAt: pre.updatedAt },
                { status: 409 }
            );
        }

        const prevCount = countTransacoes(pre.data);
        const nextCount = countTransacoes(data);

        // Caixa aberto é obrigatório para registrar novas transações (vendas/pagamentos)
        if (nextCount > prevCount) {
            const caixa = await getOpenCaixa();
            if (!caixa) {
                return NextResponse.json(
                    {
                        error: 'Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).',
                    },
                    { status: 403 }
                );
            }
        }

        const saved = await pool.query(
            `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1, now())
             ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
             RETURNING updated_at`,
            [JSON.stringify(data)]
        );
        const savedAt = saved.rows[0]?.updated_at ? new Date(saved.rows[0].updated_at).toISOString() : new Date().toISOString();

        return NextResponse.json({ ok: true, updatedAt: savedAt });
    } catch (error) {
        console.error('Erro ao salvar estado:', error);
        return NextResponse.json({ error: 'Erro ao salvar estado no servidor' }, { status: 500 });
    }
}
