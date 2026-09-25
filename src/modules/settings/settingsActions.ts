import { useDataStore } from '@/store/userStore';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';
import { showMessage } from '@/store/popupStore';

/* Recalcula a contagem de itens de cada categoria com base nos produtos atuais.
   Categorias guardam IDs (number[]) em `pratos[].category`; o pseudo-"Todos" (label 'Todos')
   recebe o total de produtos. */
export function recalcCategoriaCounts(cardapio: CardapioType): CardapioType {
    return {
        ...cardapio,
        categorias: cardapio.categorias.map((cat) => ({
            ...cat,
            qtdItems:
                cat.label === 'Todos'
                    ? cardapio.pratos.length
                    : cardapio.pratos.filter((p) => (p.category || []).includes(cat.id)).length,
        })),
    };
}

export function removeEntregador(entregadorId: number) {
    const setConfig = useDataStore.getState().setConfig;
    setConfig((prev) => ({
        ...prev,
        entregadores: prev.entregadores.filter((e) => e.id !== entregadorId),
    }));
}

/* Cadastra um entregador; se já existir com o mesmo telefone, apenas retorna o existente. */
export function createEntregador(nome: string, telefone: string): EntregadorType | null {
    const { config, setConfig } = useDataStore.getState();
    if (!nome.trim()) {
        showMessage('Informe o nome do entregador.', 'error');
        return null;
    }

    const telefoneLimp = telefone.trim();
    const exists = config.entregadores.find((e) => e.nome.toLowerCase() === nome.trim().toLowerCase());
    if (exists) return exists;

    const novo: EntregadorType = {
        id: encontrarMenorIdDisponivel(config.entregadores),
        nome: nome.trim(),
        telefone: telefoneLimp,
    };
    setConfig((prev) => ({
        ...prev,
        entregadores: [...prev.entregadores, novo],
    }));
    showMessage('Entregador cadastrado com sucesso!');
    return novo;
}

export function CadastrarEntregador(nome: string, telefone: string): EntregadorType | null {
    return createEntregador(nome, telefone);
}

export function removeFuncionario(funcionarioId: number) {
    const setConfig = useDataStore.getState().setConfig;
    setConfig((prev) => ({
        ...prev,
        funcionarios: prev.funcionarios.filter((funcionario) => funcionario.id !== funcionarioId),
    }));
}

export function removeProduto(produtoId: number) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) =>
        recalcCategoriaCounts({
            ...prev,
            pratos: prev.pratos.filter((prato) => prato.id !== produtoId),
        })
    );
}

export function removeCategoria(categoriaId: number) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) =>
        recalcCategoriaCounts({
            ...prev,
            categorias: prev.categorias.filter((cat) => cat.id !== categoriaId),
            // Remove o id da categoria excluída dos produtos para não gerar IDs órfãos.
            pratos: prev.pratos.map((p) => ({
                ...p,
                category: (p.category || []).filter((id) => id !== categoriaId),
            })),
        })
    );
}

export function removeMesa(mesaId: number) {
    const setCardapio = useDataStore.getState().setMesas;
    setCardapio((prev) => ({
        ...prev.filter((mesa) => mesa.id !== mesaId),
    }));
}

export function createFuncionario(data: FuncionariosType) {
    const setConfig = useDataStore.getState().setConfig;
    setConfig((prev) => ({
        ...prev,
        funcionarios: [data, ...prev.funcionarios],
    }));
}

export function createProduto(data: CardapioFoodType) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) => recalcCategoriaCounts({ ...prev, pratos: [data, ...prev.pratos] }));
}

export function createCategoria(data: CategoriesType) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) => recalcCategoriaCounts({ ...prev, categorias: [data, ...prev.categorias] }));
}

/* --- Edição (Fase 3) --- */

export function updateMesa(mesaId: number, data: Partial<Pick<TablesType, 'mesaNome'>>) {
    const setMesas = useDataStore.getState().setMesas;
    setMesas((prev) =>
        prev.map((mesa) =>
            mesa.id === mesaId
                ? { ...mesa, ...data, usedAt: new Date().toISOString() }
                : mesa
        )
    );
    showMessage('Mesa atualizada com sucesso');
}

export function updateProduto(produtoId: number, data: Partial<Omit<CardapioFoodType, 'id'>>) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) =>
        recalcCategoriaCounts({
            ...prev,
            pratos: prev.pratos.map((prato) => (prato.id === produtoId ? { ...prato, ...data } : prato)),
        })
    );
    showMessage('Produto atualizado com sucesso');
}

export function updateCategoria(categoriaId: number, data: Partial<Omit<CategoriesType, 'id'>>) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) =>
        recalcCategoriaCounts({
            ...prev,
            categorias: prev.categorias.map((cat) => (cat.id === categoriaId ? { ...cat, ...data } : cat)),
        })
    );
    showMessage('Categoria atualizada com sucesso');
}

export function updateEntregador(entregadorId: number, data: Partial<Omit<EntregadorType, 'id'>>) {
    const setConfig = useDataStore.getState().setConfig;
    setConfig((prev) => ({
        ...prev,
        entregadores: prev.entregadores.map((e) => (e.id === entregadorId ? { ...e, ...data } : e)),
    }));
    showMessage('Entregador atualizado com sucesso');
}

/* --- Adicionais (extras) --- */

export function addAdicional(descricao: string, valor: number) {
    const desc = descricao.trim();
    if (!desc) {
        showMessage('Informe a descrição do adicional.', 'error');
        return;
    }
    if (!Number.isFinite(valor) || valor < 0) {
        showMessage('Informe um valor válido para o adicional.', 'error');
        return;
    }
    const setCardapio = useDataStore.getState().setCardapio;
    const atual = useDataStore.getState().cardapio.adicionais;
    const id = encontrarMenorIdDisponivel(atual);
    setCardapio((prev) => ({
        ...prev,
        adicionais: [...prev.adicionais, { id, descricao: desc, valor }],
    }));
    showMessage('Adicional cadastrado com sucesso!');
}

export function updateAdicional(id: number, data: { descricao?: string; valor?: number }) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) => ({
        ...prev,
        adicionais: prev.adicionais.map((a) =>
            a.id === id
                ? { ...a, descricao: (data.descricao ?? a.descricao).trim(), valor: data.valor ?? a.valor }
                : a
        ),
    }));
    showMessage('Adicional atualizado com sucesso');
}

export function removeAdicional(id: number) {
    const setCardapio = useDataStore.getState().setCardapio;
    setCardapio((prev) => ({
        ...prev,
        adicionais: prev.adicionais.filter((a) => a.id !== id),
        // Remove a referência dos produtos para não ficar id órfão.
        pratos: prev.pratos.map((p) => ({
            ...p,
            adicionaisDisponiveis: (p.adicionaisDisponiveis || []).filter((x) => x !== id),
        })),
    }));
    showMessage('Adicional removido');
}
