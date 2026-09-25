'use client';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';
import { useNavStore } from '@/store/navStore';
import { showMessage } from '@/store/popupStore';
import { useDataStore } from '@/store/userStore';
import { isCaixaAberto } from '../caixa/caixaActions';
import { RegistrarVenda } from '../caixa/vendaActions';
import { useAuthStore } from '@/store/authStore';
import { can, canFecharMesa } from '@/lib/permissions';
import { printReceipt } from '@/shared/lib/printReceipt';
import { derivePaymentMethod, LancarRecebimentoParcial } from '@/shared/lib/payments';

export type ListaItensMesa = 'inCart' | 'inKitchen' | 'alreadyEaten';

/* Valida a senha do usuário logado no servidor (endpoint com rate limit). */
export async function ValidarSenhaUsuario(password: string): Promise<boolean> {
    try {
        const res = await fetch('/api/auth/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (res.status === 429) {
            showMessage('Muitas tentativas. Aguarde um minuto.', 'error');
            return false;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            showMessage(body.error || 'Não foi possível validar a senha.', 'error');
            return false;
        }
        return true;
    } catch {
        showMessage('Erro de rede ao validar a senha.', 'error');
        return false;
    }
}

/* Remove de um pedido da cozinha (tipo mesa) o item que foi excluído/transferido da mesa,
   para não gerar cobrança em duplicidade quando o pedido for concluído. */
function removerItemDaCozinha(mesaId: number, item: FoodCartType) {
    const { setCozinha } = useDataStore.getState();
    setCozinha((prev) =>
        prev.map((order) => {
            if (order.type !== 'table' || order.ownerId !== mesaId) return order;
            const idx = order.orderItems.findIndex(
                (o) =>
                    o.foodId === item.foodId &&
                    o.title === item.title &&
                    o.price === item.price &&
                    o.quantity === item.quantity
            );
            if (idx === -1) return order;
            return { ...order, orderItems: order.orderItems.filter((_, i) => i !== idx) };
        })
    );
}

/* Exclui um item já lançado na mesa/cartão. Exige senha do usuário logado (com permissão de mesas)
   e motivo da exclusão. */
export async function ExcluirItemMesa(params: {
    mesaId: number;
    lista: ListaItensMesa;
    indice: number;
    password: string;
    motivo: string;
}): Promise<boolean> {
    const role = useAuthStore.getState().user?.role;
    if (!can(role, 'mesas')) {
        showMessage('Você não tem permissão para excluir itens de mesa.', 'error');
        return false;
    }
    const motivo = params.motivo.trim();
    if (!motivo) {
        showMessage('Informe o motivo da exclusão.', 'error');
        return false;
    }

    const senhaOk = await ValidarSenhaUsuario(params.password);
    if (!senhaOk) return false;

    const { mesas, setMesas } = useDataStore.getState();
    const mesa = mesas.find((m) => m.id === params.mesaId);
    if (!mesa) {
        showMessage('Mesa não encontrada.', 'error');
        return false;
    }
    const item = mesa.products[params.lista]?.[params.indice];
    if (!item) {
        showMessage('Item não encontrado.', 'error');
        return false;
    }

    const nomeMesa = mesa.mesaNome;
    setMesas((prev) =>
        prev.map((m) => {
            if (m.id !== params.mesaId) return m;
            return {
                ...m,
                products: {
                    ...m.products,
                    [params.lista]: m.products[params.lista].filter((_, i) => i !== params.indice),
                },
            };
        })
    );

    if (params.lista === 'inKitchen') removerItemDaCozinha(params.mesaId, item);

    showMessage(`Item excluído da ${nomeMesa}: ${item.title}. Motivo: ${motivo}`);
    return true;
}

/* Transfere um item de uma mesa/cartão para outra. O item transferido recebe a tag
   transferOrigin (origem da transferência). inCart/inKitchen → inCart do destino
   (para ser enviado à cozinha corretamente); alreadyEaten → alreadyEaten do destino. */
export async function TransferirItemMesa(params: {
    mesaOrigemId: number;
    mesaDestinoId: number;
    lista: ListaItensMesa;
    indice: number;
}): Promise<boolean> {
    const role = useAuthStore.getState().user?.role;
    if (!can(role, 'mesas')) {
        showMessage('Você não tem permissão para transferir itens de mesa.', 'error');
        return false;
    }
    if (params.mesaOrigemId === params.mesaDestinoId) {
        showMessage('Escolha uma mesa de destino diferente da origem.', 'error');
        return false;
    }

    const { mesas, setMesas } = useDataStore.getState();
    const origem = mesas.find((m) => m.id === params.mesaOrigemId);
    const destino = mesas.find((m) => m.id === params.mesaDestinoId);
    if (!origem || !destino) {
        showMessage('Mesa de origem ou destino não encontrada.', 'error');
        return false;
    }
    const item = origem.products[params.lista]?.[params.indice];
    if (!item) {
        showMessage('Item não encontrado.', 'error');
        return false;
    }

    const origemNome = origem.mesaNome;
    const destinoNome = destino.mesaNome;
    const itemTransferido: FoodCartType = { ...item, transferOrigin: origemNome };
    const listaDestino: ListaItensMesa = params.lista === 'alreadyEaten' ? 'alreadyEaten' : 'inCart';

    setMesas((prev) =>
        prev.map((m) => {
            if (m.id === origem.id) {
                return {
                    ...m,
                    products: {
                        ...m.products,
                        [params.lista]: m.products[params.lista].filter((_, i) => i !== params.indice),
                    },
                };
            }
            if (m.id === destino.id) {
                return {
                    ...m,
                    products: {
                        ...m.products,
                        [listaDestino]: [...m.products[listaDestino], itemTransferido],
                    },
                };
            }
            return m;
        })
    );

    if (params.lista === 'inKitchen') removerItemDaCozinha(origem.id, item);

    showMessage(`Item transferido de ${origemNome} para ${destinoNome}.`);
    return true;
}

/* Imprime a conta corrente da mesa (itens no carrinho, em preparo e já consumidos). */
export function ImprimirContaMesa() {
    const { mesaSelecionadaId, mesas } = useDataStore.getState();

    const mesaAtual = mesas.find((mesa) => mesa.id == mesaSelecionadaId);

    if (!mesaAtual) return;

    const allItems = [
        ...mesaAtual.products.inCart,
        ...mesaAtual.products.inKitchen,
        ...mesaAtual.products.alreadyEaten,
    ];

    const items = allItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        price: item.price,
    }));

    const subtotal = allItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const taxRate = useDataStore.getState().config.geralData.taxRate;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    printReceipt({
        heading: 'Conta da Mesa',
        restaurantName: useDataStore.getState().config.geralData.restaurantName || 'Restaurante',
        restaurantMeta: [
            { label: 'Mesa', value: mesaAtual.mesaNome },
            { label: 'Cliente', value: mesaAtual.clienteNome || '-' },
            { label: 'Garçon', value: mesaAtual.waiter || '-' },
        ],
        items,
        subtotal,
        taxLabel: `Taxa de serviço ${taxRate}%`,
        tax,
        total,
        note: 'Conta parcial - sujeita a alterações.',
        footer: 'Obrigado pela preferência!',
    });
}

export async function CheckoutCurrentTable(pagamentos: VendaPagamentoType[]) {
    const { mesaSelecionadaId, setMesaSelecionadaId, setMesas, mesas } = useDataStore.getState();
    const { setActiveTab } = useNavStore.getState();

    const mesaAtual = mesas.find((mesa) => mesa.id == mesaSelecionadaId);

    if (!mesaAtual) return;

    if (!canFecharMesa(useAuthStore.getState().user?.role)) {
        showMessage('Você não tem permissão para fechar/faturar a mesa.', 'error');
        return;
    }

    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).', 'error');
        return;
    }

    if (!pagamentos.length) return;

    const allItems = [
        ...mesaAtual.products.inCart,
        ...mesaAtual.products.inKitchen,
        ...mesaAtual.products.alreadyEaten,
    ];
    const subtotal = allItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const taxRate = useDataStore.getState().config.geralData.taxRate;
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;

    const lancou = LancarRecebimentoParcial(pagamentos, mesaAtual.mesaNome);
    if (!lancou) {
        showMessage('Nenhum recebimento válido foi informado. Verifique as parcelas.', 'error');
        return;
    }

    RegistrarVenda('mesa', mesaAtual.mesaNome, allItems, total, derivePaymentMethod(pagamentos), {
        cliente: mesaAtual.clienteNome,
        subtotal,
        taxa: tax,
        pagamentos,
    });

    const empty: TablesType = {
        ...mesaAtual,
        status: 'livre',
        guests: 0,
        products: { inCart: [], inKitchen: [], alreadyEaten: [] },
        usedAt: '',
        clienteNome: '',
        waiter: '',
    };

    setMesas((prev) => prev.map((table) => (table.id !== mesaAtual.id ? table : empty)));

    setMesaSelecionadaId(undefined);
    setActiveTab('Serviços de Mesa');
    showMessage('Pagamento realizado com sucesso, limpando mesa...');
}

export async function SendCurrentTableOrderKitchen(products: FoodCartType[]) {
    const { mesaSelecionadaId, mesas, setMesas, setCozinha, cozinha } = useDataStore.getState();

    if (!isCaixaAberto()) {
        showMessage('Caixa fechado. Abra o caixa antes de registrar vendas (PDV, mesas ou delivery).', 'error');
        return;
    }

    const mesaAtual = mesas.find((mesa) => mesa.id == mesaSelecionadaId);

    if (!mesaAtual) return;

    const orderId = encontrarMenorIdDisponivel(cozinha);

    const orderItems = products.map((item) => {
        return {
            orderId: orderId,
            foodId: item.foodId,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            notes: item.notes,
            adicionais: item.adicionais,
        };
    });

    const novoPedido: KitchenOrderType = {
        id: orderId,
        type: 'table',
        ownerId: mesaAtual.id,
        ownerTable: mesaAtual.mesaNome,
        ownerName: mesaAtual.clienteNome,
        chef: 'João',
        createdAt: new Date().toISOString(),
        orderItems,
    };
    setCozinha((prev) => [...prev, novoPedido]);

    setMesas((prev) =>
        prev.map((mesa) => {
            if (mesa.id != mesaAtual.id) return mesa;

            return {
                ...mesa,
                products: {
                    inCart: [],
                    inKitchen: [...mesa.products.inKitchen, ...orderItems],
                    alreadyEaten: mesa.products.alreadyEaten,
                },
            };
        })
    );

    showMessage('Pedido enviado à cozinha');
}
