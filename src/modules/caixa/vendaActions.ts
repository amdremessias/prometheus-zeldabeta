import { useDataStore } from '@/store/userStore';
import { showMessage } from '@/store/popupStore';
import { isCaixaAberto } from './caixaActions';
import { RecordTransaction } from '../accounting/accountingActions';
import { paymentMethodLabel, formatNumber } from '@/shared/lib/payments';

/* --- Controle de estoque --- */

function somarQuantidadesPorProduto(items: { foodId: number; quantity: number }[]): Map<number, number> {
    const map = new Map<number, number>();
    for (const item of items) {
        const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
        if (qty > 0 && Number.isFinite(Number(item.foodId))) {
            map.set(item.foodId, (map.get(item.foodId) || 0) + qty);
        }
    }
    return map;
}

/* Aplica variação de estoque nos produtos com controle ativo (estoqueAtual definido):
   delta -1 = baixa (venda); delta +1 = estorno (cancelamento). */
function AjustarEstoquePorVenda(items: { foodId: number; quantity: number }[], delta: -1 | 1): void {
    const quantidades = somarQuantidadesPorProduto(items);
    if (quantidades.size === 0) return;
    const { setCardapio } = useDataStore.getState();
    setCardapio((prev) => {
        const touched = prev.pratos.some((p) => typeof p.estoqueAtual === 'number' && (quantidades.get(p.id) || 0) > 0);
        if (!touched) return prev;
        return {
            ...prev,
            pratos: prev.pratos.map((p) => {
                const q = quantidades.get(p.id) || 0;
                if (q <= 0 || typeof p.estoqueAtual !== 'number') return p;
                return { ...p, estoqueAtual: p.estoqueAtual + q * delta };
            }),
        };
    });
}

/* Registra uma venda no relatório de fechamento de caixa (estado persistido). */
export function RegistrarVenda(
    tipo: VendaType['tipo'],
    origem: string,
    items: FoodCartType[],
    total: number,
    metodo: VendaType['metodo'],
    info?: { cliente?: string; subtotal?: number; taxa?: number; pagamentos?: VendaPagamentoType[]; consumidorCpfCnpj?: string }
): boolean {
    if (items.length === 0 || total <= 0) return false;

    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).', 'error');
        return false;
    }

    const vendaItems: VendaItemType[] = items.map((item) => ({
        foodId: item.foodId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
    }));

    const subtotal = info?.subtotal ?? items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const taxa = info?.taxa ?? Math.max(0, total - subtotal);

    const venda: VendaType = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        tipo,
        origem,
        cliente: info?.cliente,
        items: vendaItems,
        subtotal,
        taxa,
        total,
        metodo,
        pagamentos: info?.pagamentos?.length ? info.pagamentos : undefined,
        consumidorCpfCnpj: info?.consumidorCpfCnpj?.trim() || undefined,
    };

    useDataStore.getState().setVendas((prev) => [venda, ...prev]);

    // Baixa de estoque dos itens vendidos (produtos com controle ativo).
    AjustarEstoquePorVenda(items, -1);
    return true;
}

/* Cancela uma venda já registrada (PDV, mesa, delivery, retirada) com o caixa aberto.
   Remove a venda da lista e estorna o caixa: uma saída por forma de pagamento (parcela)
   e, quando houver fiado, reverte o débito da carteira do cliente. */
export function CancelarVenda(vendaId: string): boolean {
    const { vendas, setVendas, clientes, setClientes } = useDataStore.getState();

    const venda = vendas.find((v) => v.id === vendaId);
    if (!venda) {
        showMessage('Venda não encontrada.', 'error');
        return false;
    }

    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa para cancelar vendas.', 'error');
        return false;
    }

    const parts: VendaPagamentoType[] = venda.pagamentos?.length
        ? venda.pagamentos
        : [{ metodo: venda.metodo, valor: venda.total }];

    for (const part of parts) {
        const valor = Number(part.valor) || 0;
        if (valor <= 0) continue;

        // Reverte o débito da carteira (fiado) lançado na venda cancelada.
        if (part.metodo === 'fiado' && part.clienteId != null) {
            const cliente = clientes.find((c) => c.id === part.clienteId);
            if (cliente) {
                setClientes((prev) =>
                    prev.map((c) =>
                        c.id === cliente.id
                            ? {
                                  ...c,
                                  saldo: Math.max(0, c.saldo - valor),
                                  movimentacoes: [
                                      {
                                          id: crypto.randomUUID(),
                                          createdAt: new Date().toISOString(),
                                          description: `Cancelamento de venda - ${venda.origem}`,
                                          amount: -valor,
                                          tipo: 'credito' as const,
                                      },
                                      ...c.movimentacoes,
                                  ],
                              }
                            : c
                    )
                );
            }
        }

        RecordTransaction({
            description: `Cancelamento de venda - ${venda.origem} (${paymentMethodLabel[part.metodo]})`,
            amount: valor,
            type: 'saída',
            date: new Date(),
        });
    }

    setVendas((prev) => prev.filter((v) => v.id !== vendaId));

    // Estorna o estoque dos itens da venda cancelada.
    AjustarEstoquePorVenda(venda.items, 1);

    showMessage(`Venda cancelada. Estorno de ${formatNumber(venda.total)} lançado no caixa.`);
    return true;
}
