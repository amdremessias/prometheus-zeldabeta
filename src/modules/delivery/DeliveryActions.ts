'use client';
import { restaurantVazio } from '@/shared/lib/dataState/restauranteVazio';
import { encontrarMenorIdDisponivel, getHours } from '@/shared/lib/utils';
import { useDataStore } from '@/store/userStore';
import { isCaixaAberto } from '../caixa/caixaActions';
import { RegistrarVenda } from '../caixa/vendaActions';
import { derivePaymentMethod, LancarRecebimentoParcial } from '@/shared/lib/payments';
import { showMessage } from '@/store/popupStore';

export async function SendDeliveryOrderToKitchen(products: FoodCartType[], total: number) {
    const { deliverySelecionado, setDeliverySelecionado, setCozinha, cozinha } = useDataStore.getState();

    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).', 'error');
        return;
    }

    const itens = products.map((item) => ({
        id: item.foodId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
        adicionais: item.adicionais,
    }));
    const subtotal = products.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const res = await fetch('/api/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cliente: deliverySelecionado.customer,
            telefone: deliverySelecionado.phone,
            endereco: deliverySelecionado.address,
            modo_entrega: 'entrega',
            pagamento: deliverySelecionado.payments.type,
            taxa_entrega_valor: 0,
            subtotal,
            total,
            itens,
            paraCozinha: true,
        }),
    });
    if (!res.ok) {
        showMessage('Falha ao criar o pedido de entrega.', 'error');
        return;
    }
    const created = await res.json();

    const cozinhaId = encontrarMenorIdDisponivel(cozinha);
    setCozinha((prev) => [
        ...prev,
        {
            id: cozinhaId,
            type: 'delivery',
            ownerId: Number(created.id),
            ownerTable: 'PedidoWeb',
            ownerName: deliverySelecionado.customer || 'Desconhecido',
            chef: 'João',
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            orderItems: itens.map((i) => ({
                foodId: i.id,
                title: i.title,
                price: i.price,
                quantity: i.quantity,
                notes: i.notes,
                adicionais: i.adicionais,
            })),
            pedidosWebId: Number(created.id),
        },
    ]);
    setDeliverySelecionado(restaurantVazio.deliverySelecionado);
}

export async function SendTakeOutOrderToKitchen(products: FoodCartType[]) {
    const { deliverySelecionado, setDeliverySelecionado, setCozinha, cozinha } = useDataStore.getState();

    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).', 'error');
        return;
    }

    const itens = products.map((item) => ({
        id: item.foodId,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes,
        adicionais: item.adicionais,
    }));
    const subtotal = products.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const taxa = subtotal * (useDataStore.getState().config.geralData.taxRate / 100);

    const res = await fetch('/api/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            cliente: deliverySelecionado.customer,
            telefone: deliverySelecionado.phone,
            endereco: deliverySelecionado.address,
            modo_entrega: 'retirada',
            pagamento: deliverySelecionado.payments.type,
            taxa_entrega_valor: 0,
            subtotal,
            total: subtotal + taxa,
            itens,
            paraCozinha: true,
        }),
    });
    if (!res.ok) {
        showMessage('Falha ao criar o pedido de retirada.', 'error');
        return;
    }
    const created = await res.json();

    const cozinhaId = encontrarMenorIdDisponivel(cozinha);
    setCozinha((prev) => [
        ...prev,
        {
            id: cozinhaId,
            type: 'takeout',
            ownerId: Number(created.id),
            ownerTable: 'PedidoWeb',
            ownerName: deliverySelecionado.customer || 'Desconhecido',
            chef: 'João',
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            orderItems: itens.map((i) => ({ foodId: i.id, title: i.title, price: i.price, quantity: i.quantity, notes: i.notes, adicionais: i.adicionais })),
            pedidosWebId: Number(created.id),
        },
    ]);
    setDeliverySelecionado(restaurantVazio.deliverySelecionado);
}

export async function StartingDelivery(deliveryId: number, nome?: string, telefone?: string) {
    const { setEntrega } = useDataStore.getState();
    const entregadorNome = nome || 'Entregador';
    setEntrega((prev) =>
        prev.map((entrega) => {
            if (entrega.id != deliveryId) return entrega;
            return {
                ...entrega,
                deliveryPerson: entregadorNome,
                deliveryPhone: telefone,
                dispatchedAt: getHours(),
            };
        })
    );
}

export async function EndDelivery(deliveryId: number, pagamentos?: VendaPagamentoType[]) {
    const { setEntrega } = useDataStore.getState();

    setEntrega((prev) =>
        prev.filter((entrega) => {
            if (entrega.id != deliveryId) return true;

            const items = entrega.items || [];
            const subtotal = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
            const taxRate = useDataStore.getState().config.geralData.taxRate;
            const taxa = subtotal * (taxRate / 100);
            const total = entrega.payments.total;

            // Parcelas informadas na confirmação ou, como fallback, o método único escolhido no pedido.
            const parts: VendaPagamentoType[] =
                pagamentos && pagamentos.length
                    ? pagamentos
                    : [
                          {
                              metodo: entrega.payments.type,
                              valor: total,
                              clienteId: entrega.payments.clienteId,
                              clienteNome: entrega.payments.clienteNome,
                          },
                      ];

            const fiadoSemCliente = parts.find((p) => p.metodo === 'fiado' && !p.clienteId);
            if (fiadoSemCliente) {
                showMessage('Entrega fiado sem cliente selecionado. A venda não foi lançada no caixa.', 'error');
                return true;
            }

            const lancou = LancarRecebimentoParcial(parts, 'Delivery');
            if (!lancou) {
                showMessage('Nenhum recebimento válido. A venda não foi lançada no caixa.', 'error');
                return true;
            }

            RegistrarVenda('delivery', 'Delivery', items, total, derivePaymentMethod(parts), {
                cliente: entrega.customer,
                subtotal,
                taxa,
                pagamentos: parts.length > 1 ? parts : undefined,
            });
            return false;
        })
    );
}

/* Cancela uma entrega (pendente ou em andamento) sem impacto financeiro:
   remove a entrega da lista e o respectivo pedido da cozinha, se ainda existir.
   Só tem efeito se ainda não foi recebida (nenhum pagamento lançado no caixa). */
export async function CancelarDelivery(deliveryId: number) {
    const { setEntrega, entrega, setCozinha } = useDataStore.getState();

    const alvo = entrega.find((e) => e.id == deliveryId);
    if (!alvo) {
        showMessage('Entrega não encontrada.', 'error');
        return false;
    }
    if (alvo.deliveredAt) {
        showMessage('Esta entrega já foi finalizada. Para cancelar, use o cancelamento de venda no caixa.', 'error');
        return false;
    }

    setEntrega((prev) => prev.filter((e) => e.id != deliveryId));
    if (alvo.kitchenOrderId) {
        setCozinha((prev) => prev.filter((c) => c.id != alvo.kitchenOrderId));
    }
    showMessage('Entrega cancelada.');
    return true;
}
