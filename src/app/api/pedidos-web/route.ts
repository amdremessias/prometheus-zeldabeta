import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { listPedidosWeb } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toPedidoWeb(row: {
    id: number;
    slug: string;
    cliente: string;
    telefone: string;
    endereco: string;
    pagamento: string;
    taxa_entrega_nome: string;
    taxa_entrega_valor: number | string;
    itens: { id: number; title: string; price: number; quantity: number; notes?: string }[];
    subtotal: number | string;
    total: number | string;
    status: string;
    faturado: boolean;
    created_at: Date;
}): PedidoWebType {
    return {
        id: row.id,
        slug: row.slug,
        cliente: row.cliente,
        telefone: row.telefone,
        endereco: row.endereco,
        pagamento: row.pagamento,
        taxaEntregaNome: row.taxa_entrega_nome,
        taxaEntregaValor: Number(row.taxa_entrega_valor) || 0,
        itens: Array.isArray(row.itens) ? row.itens : [],
        subtotal: Number(row.subtotal) || 0,
        total: Number(row.total) || 0,
        status: (row.status as PedidoWebType['status']) ?? 'pendente',
        faturado: Boolean(row.faturado),
        createdAt: row.created_at.toISOString(),
    };
}

export async function GET(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    // Qualquer usuário autenticado pode listar pedidos (visualização na cozinha).
    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? undefined;
    const rows = await listPedidosWeb(status);
    return NextResponse.json(rows.map(toPedidoWeb));
}
