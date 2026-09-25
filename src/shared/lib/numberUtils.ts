import { useDataStore } from '@/store/userStore';

export function formatCurrency(value: number | string, currencyCode = 'BRL'): string {
    const num = Number(value);
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currencyCode }).format(num);
    } catch {
        return `${num.toFixed(2)}`;
    }
}

export function formatDateBR(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateTimeBR(date: string | Date): string {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function sumKitckenOrderCost(products: KitchenOrderType) {
    const taxRate = useDataStore.getState().config.geralData.taxRate;
    const productsStandby = products.orderItems;

    const subtotalStandby = productsStandby.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const subTotal = subtotalStandby;
    const tax = subTotal * (taxRate / 100);

    return subTotal + tax;
}

export function sumTableTotalCost(mesa: TablesType) {
    const taxRate = useDataStore.getState().config.geralData.taxRate;

    const productsStandby = mesa.products.inCart || [];
    const productsProcessing = mesa.products.inKitchen || [];
    const productsDone = mesa.products.alreadyEaten || [];

    const subtotalStandby = productsStandby.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const subtotalProcessing = productsProcessing.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const subtotalDone = productsDone.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const subTotal = subtotalDone + subtotalProcessing + subtotalStandby;
    const tax = subTotal * (taxRate / 100);

    return subTotal + tax;
}
