import { useDataStore } from '@/store/userStore';
import { showMessage } from '@/store/popupStore';

export function isCaixaAberto(): boolean {
    return useDataStore.getState().caixa.status === 'aberto';
}

function caixaFromRow(row: CaixaRowLike | null): CaixaType {
    if (!row) {
        return { status: 'fechado', initialAmount: 0 };
    }
    return {
        status: row.status === 'aberto' ? ('aberto' as const) : ('fechado' as const),
        openedAt: row.opened_at ?? undefined,
        openedBy: row.opened_by ? String(row.opened_by) : undefined,
        initialAmount: Number(row.initial_amount) || 0,
        closedAt: row.closed_at ?? undefined,
        expectedAmount: row.expected_amount != null ? Number(row.expected_amount) : undefined,
        finalAmount: row.final_amount != null ? Number(row.final_amount) : undefined,
        difference: row.difference != null ? Number(row.difference) : undefined,
        salesCount: row.sales_count ?? undefined,
        notes: row.notes ?? undefined,
        detail: (row.detail as CaixaReportType | null | undefined) ?? undefined,
    };
}

/* Abre o caixa com um valor inicial. */
export async function AbrirCaixa(valorInicial: number): Promise<boolean> {
    try {
        const res = await fetch('/api/caixa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valorInicial }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            showMessage(body.error || 'Falha ao abrir o caixa.', 'error');
            return false;
        }
        useDataStore.getState().setCaixa(caixaFromRow(body.caixa));
        showMessage('Caixa aberto com sucesso!');
        return true;
    } catch (error) {
        console.error('Erro ao abrir caixa:', error);
        showMessage('Erro de conexão ao abrir o caixa.', 'error');
        return false;
    }
}

/* Fecha o caixa, registrando o valor em dinheiro apurado. */
export async function FecharCaixa(valorFinal: number, observacao?: string): Promise<boolean> {
    try {
        const { vendas, contabilidade } = useDataStore.getState();
        const res = await fetch('/api/caixa/fechar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ valorFinal, observacao, vendas, transacoes: contabilidade.transacoes }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            showMessage(body.error || 'Falha ao fechar o caixa.', 'error');
            return false;
        }
        useDataStore.getState().setCaixa(caixaFromRow(body.caixa));
        const expected = body.caixa?.expected_amount;
        const diff = body.caixa?.difference;
        const diffLabel = diff != null && diff !== 0 ? ` Diferença: ${formatCurrency(diff)}.` : ' Sem diferença.';
        showMessage(
            `Caixa fechado. Esperado: ${formatCurrency(expected ?? 0)}.${diffLabel}`,
            'success'
        );
        return true;
    } catch (error) {
        console.error('Erro ao fechar caixa:', error);
        showMessage('Erro de conexão ao fechar o caixa.', 'error');
        return false;
    }
}

function formatCurrency(value: number): string {
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    } catch {
        return `R$ ${value.toFixed(2)}`;
    }
}

/* Consulta caixas já fechados (histórico) no backend. */
export async function ConsultarHistoricoCaixas(): Promise<CaixaRowLike[]> {
    try {
        const res = await fetch('/api/caixa/historico');
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            showMessage(body.error || 'Falha ao consultar o histórico de caixas.', 'error');
            return [];
        }
        return Array.isArray(body.historico) ? body.historico : [];
    } catch (error) {
        console.error('Erro ao consultar histórico de caixas:', error);
        return [];
    }
}
