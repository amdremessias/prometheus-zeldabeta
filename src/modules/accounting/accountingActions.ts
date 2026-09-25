import { useDataStore } from '@/store/userStore';
import { showMessage } from '@/store/popupStore';
import { isCaixaAberto } from '@/modules/caixa/caixaActions';

/* É importado em outros modulos para gravar transações */
export function RecordTransaction(data: Omit<TransactionsType, 'id'>) {
    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).', 'error');
        return false;
    }

    const { setContabilidade } = useDataStore.getState();

    setContabilidade((prev) => ({
        resumo: prev.resumo,
        transacoes: [{ id: crypto.randomUUID(), ...data }, ...prev.transacoes],
    }));

    return true;
}

/* Usado somente como side effect quando adicionar um transaçao nova dentro do userStore, */
export function CalculateResumo(transactions: TransactionsType[]): ResumoAccountingType[] {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevYear = prevMonthDate.getFullYear();

    const filterBy = (tx: TransactionsType, month: number, year: number) => {
        const d = new Date(tx.date);
        return d.getMonth() === month && d.getFullYear() === year;
    };

    const sumByType = (arr: TransactionsType[], type: 'entrada' | 'saída') =>
        arr.filter((tx) => tx.type === type).reduce((acc, tx) => acc + tx.amount, 0);

    const thisMonthTx = transactions.filter((tx) => filterBy(tx, thisMonth, thisYear));
    const prevMonthTx = transactions.filter((tx) => filterBy(tx, prevMonth, prevYear));

    const thisRevenue = sumByType(thisMonthTx, 'entrada');
    const prevRevenue = sumByType(prevMonthTx, 'entrada');

    const thisExpenses = sumByType(thisMonthTx, 'saída');
    const prevExpenses = sumByType(prevMonthTx, 'saída');

    const thisOrders = thisMonthTx.filter((tx) => tx.type === 'entrada').length;
    const prevOrders = prevMonthTx.filter((tx) => tx.type === 'entrada').length;

    const thisAvg = thisOrders > 0 ? thisRevenue / thisOrders : 0;
    const prevAvg = prevOrders > 0 ? prevRevenue / prevOrders : 0;

    const calcChange = (current: number, previous: number) => {
        if (previous === 0) return { change: '100%', trend: 'up' as const };
        const diff = current - previous;
        const pct = (diff / previous) * 100;
        return {
            change: `${Math.abs(pct).toFixed(2)}%`,
            trend: pct >= 0 ? ('up' as const) : ('down' as const),
        };
    };

    const revDelta = calcChange(thisRevenue, prevRevenue);
    const ordersDelta = calcChange(thisOrders, prevOrders);
    const avgDelta = calcChange(thisAvg, prevAvg);
    const expDelta = calcChange(thisExpenses, prevExpenses);

    const fmt = (n: number) => n.toFixed(2);

    return [
        {
            title: 'Vendas Totais',
            value: fmt(thisRevenue),
            ...revDelta,
        },
        {
            title: 'Pedidos',
            value: thisOrders.toString(),
            ...ordersDelta,
        },
        {
            title: 'Valor Médio por Pedido',
            value: fmt(thisAvg),
            ...avgDelta,
        },
        {
            title: 'Despesas',
            value: fmt(thisExpenses),
            ...expDelta,
        },
    ];
}
