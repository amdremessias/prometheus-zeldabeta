import { ClientDataType } from '@/types/ClientDataType';

export const restaurantVazio: ClientDataType = {
    cardapio: { categorias: [], pratos: [], adicionais: [] },
    mesas: [],
    entrega: [],
    cozinha: [],
    mesaSelecionadaId: undefined,
    deliverySelecionado: {
        inCart: [],
        customer: '',
        phone: '',
        address: '',
        type: 'delivery',
        startedAt: '',
        payments: { items: 0, total: 0, type: 'dinheiro' },
    },
    contabilidade: {
        resumo: [
            {
                title: 'Vendas Totais',
                value: '0',
                change: '0%',
                trend: 'up',
            },
            {
                title: 'Pedidos',
                value: '0',
                change: '0%',
                trend: 'up',
            },
            {
                title: 'Valor Médio por Pedido',
                value: '0',
                change: '0%',
                trend: 'up',
            },
            {
                title: 'Vendas Totais',
                value: '0',
                change: '0%',
                trend: 'up',
            },
        ],

        transacoes: [],
    },
    clientes: [],
    vendas: [],
    caixa: {
        status: 'fechado',
        initialAmount: 0,
    },
    config: {
        geralData: {
            restaurantName: '',
            address: '',
            phone: '',
            email: '',
            taxRate: 0,
            currency: '',
            taxasEntrega: [],
        },
        funcionarios: [],
        entregadores: [],
        cardapioDigitalSlug: undefined,
        branding: {},
    },
};
