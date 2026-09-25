import { useDataStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { can } from '@/lib/permissions';
import { showMessage } from '@/store/popupStore';

/* Usuário autorizado a ajustar estoque (permissão 'estoque': admin/gerente). */
export function podeAjustarEstoque(): boolean {
    return can(useAuthStore.getState().user?.role, 'estoque');
}

/* Ajuste manual de estoque com base na contagem real (sem baixa automática).
   Zera nada além do estoqueAtual do produto informado. */
export function AjustarEstoqueManual(produtoId: number, novaQuantidade: number): boolean {
    if (!podeAjustarEstoque()) {
        showMessage('Você não tem permissão para ajustar estoque.', 'error');
        return false;
    }
    if (!Number.isInteger(novaQuantidade) || novaQuantidade < 0 || novaQuantidade > 1_000_000) {
        showMessage('Quantidade inválida: use um inteiro de 0 a 1.000.000.', 'error');
        return false;
    }

    const { cardapio, setCardapio } = useDataStore.getState();
    const prato = cardapio.pratos.find((p) => p.id === produtoId);
    if (!prato) {
        showMessage('Produto não encontrado.', 'error');
        return false;
    }

    setCardapio((prev) => ({
        ...prev,
        pratos: prev.pratos.map((p) => (p.id === produtoId ? { ...p, estoqueAtual: novaQuantidade } : p)),
    }));

    showMessage(`Estoque de "${prato.title}" ajustado para ${novaQuantidade} unidades.`);
    return true;
}