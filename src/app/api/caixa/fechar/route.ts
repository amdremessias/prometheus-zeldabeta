import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { fecharCaixa, getOpenCaixa } from '@/lib/server/caixa';
import { ensureSchema, pool, listPedidosWebConcluidosNaoFaturados, marcarPedidosWebFaturados } from '@/lib/server/db';
import { can } from '@/lib/permissions';
import { isFiniteInRange, MAX_NOTES } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TxRow {
    type?: string;
    amount?: number | string;
    date?: unknown;
    description?: string;
}

interface VendaRow {
    date?: unknown;
}

const startOfDay = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'caixa_abrir_fechar')) {
        return NextResponse.json({ error: 'Sem permissão para abrir/fechar caixa' }, { status: 403 });
    }

    let finalAmount = 0;
    let notes: string | undefined;
    let vendasClient: VendaRow[] = [];
    let transacoesClient: TxRow[] | null = null;
    try {
        const body = await req.json();
        finalAmount = Number(body?.valorFinal) || 0;
        notes = String(body?.observacao || '') || undefined;
        vendasClient = Array.isArray(body?.vendas) ? (body.vendas as VendaRow[]) : [];
        if (Array.isArray(body?.transacoes)) {
            transacoesClient = body.transacoes as TxRow[];
        }
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    if (!isFiniteInRange(finalAmount, 0, 1_000_000)) {
        return NextResponse.json({ error: 'Valor final inválido (0–1.000.000)' }, { status: 400 });
    }
    if (notes && notes.length > MAX_NOTES) {
        return NextResponse.json({ error: `Observação muito longa (máx. ${MAX_NOTES} caracteres)` }, { status: 400 });
    }

    try {
        const caixa = await getOpenCaixa();
        if (!caixa) {
            return NextResponse.json({ error: 'Nenhum caixa aberto para fechar.' }, { status: 409 });
        }

        // Calcula o esperado a partir das transações do dia.
        // Usa as enviadas pelo cliente (mais recentes) ou, como fallback, o snapshot do app_state.
        let transacoes: TxRow[] = transacoesClient ?? [];
        if (!transacoesClient) {
            await ensureSchema();
            const stateRes = await pool.query('SELECT data FROM app_state WHERE id = 1');
            const state = stateRes.rows[0]?.data as { contabilidade?: { transacoes?: TxRow[] } } | undefined;
            transacoes = state?.contabilidade?.transacoes ?? [];
        }

        const today = startOfDay();
        const doDia = transacoes.filter((tx) => {
            const d = new Date(String(tx.date));
            return !isNaN(d.getTime()) && d >= today;
        });

        const vendasDia = vendasClient.filter((venda) => {
            const d = new Date(String(venda.date));
            return !isNaN(d.getTime()) && d >= today;
        });

        // Fatura os pedidos do Cardápio Digital já concluídos na cozinha (status 'concluido', ainda não faturados).
        // Eles entram como venda + transação de entrada no fechamento e são marcados como faturados.
        const pedidosWeb = await listPedidosWebConcluidosNaoFaturados();
        const novasVendasWeb: VendaType[] = [];
        const novasTransacoesWeb: TxRow[] = [];
        const pedidosFaturados: number[] = [];
        for (const pedido of pedidosWeb) {
            const pagamento = pedido.pagamento === 'cartao' ? 'cartao' : pedido.pagamento === 'pix' ? 'pix' : 'dinheiro';
            const methodLabel = pagamento === 'cartao' ? 'Cartão' : pagamento === 'pix' ? 'Pix' : 'Dinheiro';
            const venda: VendaType = {
                id: `web-${pedido.id}-${Date.now()}`,
                date: new Date().toISOString(),
                tipo: pedido.endereco ? 'delivery' : 'retirada',
                origem: 'Cardápio Digital',
                cliente: pedido.cliente,
                items: pedido.itens.map((i) => ({
                    foodId: i.id,
                    title: i.title,
                    price: i.price,
                    quantity: i.quantity,
                })),
                subtotal: Number(pedido.subtotal) || 0,
                taxa: Number(pedido.taxa_entrega_valor) || 0,
                total: Number(pedido.total) || 0,
                metodo: pagamento,
            };
            const tx: TxRow = {
                type: 'entrada',
                amount: Number(pedido.total) || 0,
                date: new Date().toISOString(),
                description: `Venda - Pedido web #${pedido.id} (${methodLabel})`,
            };
            novasVendasWeb.push(venda);
            novasTransacoesWeb.push(tx);
            pedidosFaturados.push(pedido.id);
        }

        const vendasComWeb = [...vendasDia, ...novasVendasWeb];
        const transacoesComWeb = [...doDia, ...novasTransacoesWeb];

        const entradas = transacoesComWeb
            .filter((t) => t.type === 'entrada')
            .reduce((a, t) => a + Number(t.amount), 0);
        const saidas = transacoesComWeb
            .filter((t) => t.type === 'saída')
            .reduce((a, t) => a + Number(t.amount), 0);
        const entradasCount = transacoesComWeb.filter((t) => t.type === 'entrada').length;
        const salesCount = vendasComWeb.length || entradasCount;

        const initial = Number(caixa.initial_amount);
        const expected = Math.round((initial + entradas - saidas) * 100) / 100;

        const detail = {
            vendas: vendasComWeb,
            transacoes: transacoesComWeb,
        };

        // Persiste as vendas/transações dos pedidos web no app_state para refletirem nos relatórios.
        if (pedidosFaturados.length > 0) {
            await ensureSchema();
            const stateRes = await pool.query('SELECT data FROM app_state WHERE id = 1');
            const state = stateRes.rows[0]?.data as {
                vendas?: unknown[];
                contabilidade?: { transacoes?: unknown[] };
                cardapio?: { pratos?: { id: number; estoqueAtual?: number }[] };
            } | null;
            if (state) {
                const novasVendas = [...(Array.isArray(state.vendas) ? state.vendas : []), ...novasVendasWeb];
                const novasTransacoes = [
                    ...(Array.isArray(state.contabilidade?.transacoes) ? state.contabilidade.transacoes : []),
                    ...novasTransacoesWeb,
                ];
                // Baixa de estoque dos itens dos pedidos web faturados (produtos com controle ativo).
                const baixas = new Map<number, number>();
                for (const venda of novasVendasWeb) {
                    for (const item of venda.items) {
                        const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
                        if (qty > 0) baixas.set(item.foodId, (baixas.get(item.foodId) || 0) + qty);
                    }
                }
                if (baixas.size > 0 && state.cardapio) {
                    state.cardapio = {
                        ...state.cardapio,
                        pratos: (state.cardapio.pratos ?? []).map((prato) => {
                            const q = baixas.get(Number(prato.id));
                            if (q && typeof prato.estoqueAtual === 'number') {
                                return { ...prato, estoqueAtual: prato.estoqueAtual - q };
                            }
                            return prato;
                        }),
                    };
                }
                state.vendas = novasVendas;
                state.contabilidade = {
                    ...(state.contabilidade ?? {}),
                    transacoes: novasTransacoes,
                };
                await pool.query('UPDATE app_state SET data = $1, updated_at = now() WHERE id = 1', [
                    JSON.stringify(state),
                ]);
            }
            await marcarPedidosWebFaturados(pedidosFaturados);
        }

        const closed = await fecharCaixa(caixa.id, user.id, expected, finalAmount, salesCount, notes, detail);

        return NextResponse.json({
            caixa: closed,
            resumo: {
                initial,
                entradas,
                saidas,
                expected,
                salesCount,
                pedidosWebFaturados: pedidosFaturados.length,
            },
        });
    } catch (error) {
        console.error('Erro ao fechar caixa:', error);
        return NextResponse.json({ error: 'Erro ao fechar o caixa' }, { status: 500 });
    }
}
