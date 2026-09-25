'use client';

import { useDataStore } from '@/store/userStore';
import { RecordTransaction } from '@/modules/accounting/accountingActions';
import { LancarFiado } from '@/modules/clientes/clienteActions';

export const paymentMethodLabel: Record<VendaPagamentoType['metodo'], string> = {
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    pix: 'Pix',
    fiado: 'Fiado',
};

export function sumPagamentos(pagamentos: VendaPagamentoType[]): number {
    return pagamentos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
}

export function isPaymentSplitComplete(total: number, pagamentos: VendaPagamentoType[]): boolean {
    if (pagamentos.length === 0) return false;
    // Permite pagamento exato ou com troco (dinheiro acima do total).
    return sumPagamentos(pagamentos) >= total - 0.005;
}

/* Calcula o troco em dinheiro: excesso recebido em dinheiro sobre o que falta
   cobrir com as demais formas de pagamento. */
export function calcularTroco(total: number, pagamentos: VendaPagamentoType[]): number {
    const naoDinheiro = pagamentos
        .filter((p) => p.metodo !== 'dinheiro')
        .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    const necessarioDinheiro = Math.max(0, Math.round((total - naoDinheiro) * 100) / 100);
    const pagoDinheiro = pagamentos
        .filter((p) => p.metodo === 'dinheiro')
        .reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    return Math.max(0, Math.round((pagoDinheiro - necessarioDinheiro) * 100) / 100);
}

/* Deriva um "método principal" para retrocompatibilidade (campo metodo da VendaType).
   Usa o método da maior parcela; se alguma parcela for fiado, prioriza fiado. */
export function derivePaymentMethod(pagamentos: VendaPagamentoType[]): VendaPagamentoType['metodo'] {
    if (!pagamentos || pagamentos.length === 0) return 'dinheiro';
    if (pagamentos.some((p) => p.metodo === 'fiado')) return 'fiado';
    return pagamentos.reduce((a, b) => ((b.valor || 0) > (a.valor || 0) ? b : a)).metodo;
}

/* Registra no caixa (transação de entrada) e na carteira (fiado) cada parcela recebida.
   Cada forma de pagamento vira uma movimentação própria para detalhe nos relatórios. */
export function LancarRecebimentoParcial(pagamentos: VendaPagamentoType[], origem: string): boolean {
    const clientes = useDataStore.getState().clientes;
    let ok = false;

    for (const pag of pagamentos) {
        const valor = Number(pag.valor) || 0;
        if (valor <= 0) continue;

        if (pag.metodo === 'fiado') {
            const cliente = clientes.find((c) => c.id === pag.clienteId);
            if (!cliente || !cliente.carteiraHabilitada) continue;
            LancarFiado(
                cliente.id,
                valor,
                `Compra fiado - ${origem} (${formatNumber(valor)})`
            );
            RecordTransaction({
                description: `Venda - ${origem} (fiado - ${cliente.nome})`,
                amount: valor,
                type: 'entrada',
                date: new Date(),
            });
        } else {
            RecordTransaction({
                description: `Venda - ${origem} (${paymentMethodLabel[pag.metodo]})`,
                amount: valor,
                type: 'entrada',
                date: new Date(),
            });
        }
        ok = true;
    }

    return ok;
}

export function formatNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
