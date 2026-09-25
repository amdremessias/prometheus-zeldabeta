import { showMessage } from '@/store/popupStore';
import { useDataStore } from '@/store/userStore';
import { RecordTransaction } from '../accounting/accountingActions';
import { sumKitckenOrderCost } from '@/shared/lib/numberUtils';
import { mergeFoodItems } from './kitchenUtils';
import { formatarHoraMinuto } from '@/shared/lib/utils';
import { printReceipt } from '@/shared/lib/printReceipt';

/* Imprime o pedido da cozinha (ticket) — mesa, delivery ou retirada. */
export function ImprimirPedidoCozinha(order: KitchenOrderType) {
    const restaurantName = useDataStore.getState().config.geralData.restaurantName || 'Restaurante';
    const taxRate = useDataStore.getState().config.geralData.taxRate;

    const tipoLabel =
        order.type === 'table' ? 'Mesa' : order.type === 'delivery' ? 'Delivery' : order.type === 'pdv' ? 'PDV' : 'Retirada';
    const items = order.orderItems.map((i) => ({
        title: i.title,
        quantity: i.quantity,
        price: i.price,
        note: i.notes || undefined,
        addons: i.adicionais && i.adicionais.length ? i.adicionais.map((a) => ({ descricao: a.descricao, valor: a.valor })) : undefined,
    }));
    const subtotal = order.orderItems.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const tax = subtotal * (taxRate / 100);

    printReceipt({
        heading: 'Pedido de Cozinha',
        restaurantName,
        restaurantMeta: [
            { label: 'Tipo', value: tipoLabel },
            {
                label: order.type === 'table' ? 'Mesa' : 'Cliente',
                value: order.type === 'table' ? order.ownerTable : order.ownerName || '-',
            },
            { label: 'Cozinheiro', value: order.chef || '-' },
            { label: 'Hora', value: formatarHoraMinuto(order.createdAt) },
        ],
        items,
        subtotal,
        taxLabel: `Taxa de serviço ${taxRate}%`,
        tax,
        total: subtotal + tax,
        footer: 'Impresso para a cozinha.',
    });
}

export function MakePDVOrderReady(order: KitchenOrderType) {
    const { setCozinha } = useDataStore.getState();
    setCozinha((prev) => prev.filter((coz) => coz.id != order.id));
    showMessage('Pedido PDV concluído');
}

export function MakeTableOrderReady(order: KitchenOrderType) {
    const { setCozinha, setMesas } = useDataStore.getState();

    setMesas((prev) =>
        prev.map((mesa) => {
            if (mesa.id !== order.ownerId) return mesa;

            // separa os itens do pedido atual
            const itemsDoPedido = mesa.products.inKitchen.filter((item) => item.orderId === order.id);

            // mantém os outros
            const restantes = mesa.products.inKitchen.filter((item) => item.orderId !== order.id);

            return {
                ...mesa,
                products: {
                    ...mesa.products,
                    inKitchen: restantes,
                    alreadyEaten: mergeFoodItems(mesa.products.alreadyEaten, itemsDoPedido),
                },
            };
        })
    );

    setCozinha((prev) => prev.filter((coz) => coz.id != order.id));
    showMessage('Pedido foi enviado para a mesa');
}

export async function MakeDeliveryOrderReady(order: KitchenOrderType) {
    const { setCozinha } = useDataStore.getState();
    setCozinha((prev) => prev.filter((coz) => coz.id != order.id));
    showMessage('Pedido pronto para entrega, aguardando entregador...');
    if (order.pedidosWebId) {
        await fetch(`/api/pedidos-web/${order.pedidosWebId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'concluido' }),
        }).catch(() => {});
    }
}

export async function MakeTakeOutOrderReady(order: KitchenOrderType) {
    const { setCozinha } = useDataStore.getState();

    if (!order.pedidosWebId) {
        RecordTransaction({
            description: 'Venda - Retirada',
            amount: sumKitckenOrderCost(order),
            date: new Date(),
            type: 'entrada',
        });
    }

    setCozinha((prev) => prev.filter((coz) => coz.id != order.id));
    showMessage('Enviando pedido para o cliente fazer retirada');
    if (order.pedidosWebId) {
        await fetch(`/api/pedidos-web/${order.pedidosWebId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'concluido' }),
        }).catch(() => {});
    }
}
