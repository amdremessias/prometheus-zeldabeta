import { showMessage } from '@/store/popupStore';
import { isCaixaAberto } from '../caixa/caixaActions';
import { RegistrarVenda } from '../caixa/vendaActions';
import { derivePaymentMethod, LancarRecebimentoParcial } from '@/shared/lib/payments';
import { useDataStore } from '@/store/userStore';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';

export type PDVMethod = 'dinheiro' | 'cartao' | 'pix' | 'fiado';

export function FinalizarVendaPDV(items: FoodCartType[], valorTotal: number, pagamentos: VendaPagamentoType[], consumidorCpfCnpj?: string): boolean {
    if (items.length === 0 || valorTotal <= 0) return false;

    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).', 'error');
        return false;
    }

    if (!pagamentos.length) return false;

    const lancou = LancarRecebimentoParcial(pagamentos, 'PDV');
    if (!lancou) {
        showMessage('Nenhum recebimento válido foi informado. Verifique as parcelas.', 'error');
        return false;
    }

    const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const taxa = Math.max(0, valorTotal - subtotal);
    const fiadoCliente = pagamentos.find((p) => p.metodo === 'fiado')?.clienteNome;

    RegistrarVenda('pdv', 'PDV', items, valorTotal, derivePaymentMethod(pagamentos), {
        cliente: fiadoCliente,
        subtotal,
        taxa,
        pagamentos,
        consumidorCpfCnpj,
    });

    // PDV também envia os itens para a cozinha (fluxo PDV -> Cozinha),
    // preservando as observações por item.
    enviarPedidoPDVParaCozinha(items, derivePaymentMethod(pagamentos));

    showMessage('Venda finalizada com sucesso!');
    return true;
}

function enviarPedidoPDVParaCozinha(items: FoodCartType[], formaPagamento: string) {
    const { setCozinha, cozinha } = useDataStore.getState();
    const orderId = encontrarMenorIdDisponivel(cozinha);

    const orderItems = items.map((item) => ({
        orderId,
        foodId: item.foodId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
        adicionais: item.adicionais,
    }));

    const pedidoCozinha: KitchenOrderType = {
        id: orderId,
        type: 'pdv',
        ownerId: 0,
        ownerName: formaPagamento,
        ownerTable: 'PDV',
        chef: 'Cozinha',
        createdAt: new Date().toISOString(),
        orderItems,
    };

    setCozinha((prev) => [...prev, pedidoCozinha]);
}
