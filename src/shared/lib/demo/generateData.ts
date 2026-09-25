import { faker } from '@faker-js/faker/locale/pt_BR';
import { LoadDemoPratos } from './demoPratos';
import { ClientDataType } from '@/types/ClientDataType';
import { restaurantVazio } from '../dataState/restauranteVazio';
import { availableIcons } from '../availableIcons';

// -------------------------
// Variáveis globais (visíveis a todas as funções)
// -------------------------

let config: ConfigType;
let cardapio: CardapioType;
let mesas: TablesType[];
let cozinha: KitchenOrderType[];
let entrega: DeliveryType[];
let contabilidade: ContabilidadeType;
let clientes: ClienteType[];
let orderId = 1;

export default async function gerarDadosRestauranteFake(): Promise<ClientDataType> {
    generateConfig();
    await generateCardapio();
    generateMesas(9);
    generateKitchenOrders();
    generateDeliveries(2);
    generateContabilidade(30);
    generateClientes(8);

    return {
        cardapio,
        mesas,
        cozinha,
        entrega,
        config,
        contabilidade,
        clientes,
        vendas: [],
        caixa: {
            status: 'aberto',
            initialAmount: 100,
            openedAt: new Date().toISOString(),
        },
        mesaSelecionadaId: mesas.filter((mesa) => mesa.status == 'ocupada')[0].id,
        deliverySelecionado: restaurantVazio.deliverySelecionado,
    };
}

// Retorna um item aleatório de uma lista
const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

// --- FUNÇÕES DE GERAÇÃO PARA CADA TIPO ---

const generateCardapio = async () => {
    const demoPratos = await LoadDemoPratos();

    const nomesCategorias = [...new Set(demoPratos.flatMap((p) => p.category))];

    const categorias: CardapioType['categorias'] = nomesCategorias.map((catLabel, index) => ({
        id: index + 2, // ID começa em 2, pois 1 é reservado para "Todos"
        label: catLabel,
        qtdItems: 0,
        icon: randomItem(availableIcons),
    }));

    // Mapa rótulo -> id para converter as categorias (labels) dos pratos demo em IDs.
    const labelToId = new Map(categorias.map((c) => [c.label, c.id]));

    const pratos: CardapioType['pratos'] = demoPratos.map((pratoDefinido, index) => ({
        id: index + 1,
        title: pratoDefinido.title,
        imageBlob: pratoDefinido.image,
        imageURL: URL.createObjectURL(pratoDefinido.image),
        category: pratoDefinido.category
            .map((label) => labelToId.get(label))
            .filter((id): id is number => typeof id === 'number'),

        price: parseFloat(faker.commerce.price({ min: 15, max: 90 })),
        discount: faker.helpers.maybe(() => faker.number.int({ min: 5, max: 20 }), { probability: 0.3 }),
        adicionaisDisponiveis: [],
        status: 'Ativo',
        // Controle de estoque (alguns itens ficam abaixo do mínimo p/ demonstrar a previsão de compra).
        estoqueAtual: faker.number.int({ min: 0, max: 40 }),
        estoqueMinimo: faker.number.int({ min: 5, max: 15 }),
    }));

    // Atualiza a contagem de itens para cada categoria
    categorias.forEach((cat) => {
        const count = pratos.filter((p) => p.category.includes(cat.id)).length;
        cat.qtdItems = count;
    });

    // Adiciona a categoria "Todos" no início da lista
    categorias.unshift({
        id: 1,
        label: 'Todos',
        qtdItems: pratos.length,
        icon: '/icons/grid.svg',
    });

    cardapio = { categorias, pratos, adicionais: [] };
};

const generateMesas = (count: number) => {
    const servidoresAtivos = config.funcionarios.filter((f) => f.status === 'Ativo').map((f) => f.name);
    mesas = [];

    for (let i = 1; i <= count; i++) {
        const status = faker.helpers.arrayElement(['ocupada', 'livre'] as const);
        const isLivre = status === 'livre';

        mesas.push({
            id: i,
            mesaNome: `Mesa ${i}`,
            status: status,
            guests: isLivre ? 0 : faker.number.int({ min: 1, max: 8 }),
            usedAt: isLivre
                ? ''
                : new Date(
                      0,
                      0,
                      0,
                      faker.number.int({ min: 8, max: 21 }),
                      faker.number.int({ min: 0, max: 59 })
                  ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            waiter: isLivre ? '' : randomItem(servidoresAtivos),
            clienteNome: isLivre ? '' : faker.person.fullName(),
            products: { inCart: [], inKitchen: [], alreadyEaten: [] },
        });
    }
};

const generateKitchenOrders = () => {
    cozinha = [];
    const mesasOcupadas = mesas.filter((m) => m.status === 'ocupada');

    for (const mesa of mesasOcupadas) {
        // Apenas algumas mesas ocupadas vão gerar pedido (ex: 60% de chance)
        if (faker.number.int({ min: 1, max: 100 }) > 60) continue;

        const currentOrderId = Number(String(orderId++).padStart(3, '0'));

        const orderItems: FoodCartType[] = Array.from({ length: faker.number.int({ min: 1, max: 4 }) }).map(() => {
            const prato = randomItem(cardapio.pratos);
            return {
                foodId: prato.id,
                title: prato.title,
                price: prato.price,
                quantity: faker.number.int({ min: 1, max: 2 }),
                notes: faker.helpers.maybe(() => faker.lorem.sentence(3), { probability: 0.4 }),
                orderId: currentOrderId,
            };
        });

        mesa.products.inKitchen.push(...orderItems);

        cozinha.push({
            id: currentOrderId,
            type: 'table',
            ownerId: mesa.id,
            ownerTable: mesa.mesaNome,
            ownerName: mesa.clienteNome,
            chef: mesa.waiter,
            createdAt: faker.date
                .between({ from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), to: new Date() })
                .toISOString(),
            orderItems,
        });
    }
};

const generateDeliveries = (count: number) => {
    entrega = [];
    const cozinhaDelivery: KitchenOrderType[] = [];

    for (let i = 1; i <= count; i++) {
        const deliveryId = Number(String(i).padStart(3, '0'));
        const kitchenOrderId = Number(String(orderId++).padStart(3, '0'));
        const prato = randomItem(cardapio.pratos);

        const orderItems: FoodCartType[] = Array.from({ length: faker.number.int({ min: 1, max: 5 }) }).map(() => ({
            foodId: prato.id,
            orderId: kitchenOrderId,
            title: prato.title,
            price: prato.price,
            quantity: faker.number.int({ min: 1, max: 3 }),
            notes: faker.helpers.maybe(() => faker.lorem.sentence(2), { probability: 0.4 }),
        }));

        cozinhaDelivery.push({
            id: kitchenOrderId,
            type: 'delivery',
            ownerId: deliveryId,
            ownerName: faker.person.fullName(),
            ownerTable: 'Entrega',
            chef: randomItem(config.funcionarios.map((f) => f.name)),
            orderItems,
            createdAt: faker.date.between({ from: Date.now() - 3 * 24 * 60 * 60 * 1000, to: Date.now() }).toISOString(),
        });

        const total = orderItems.reduce(
            (sum, it) => sum + it.quantity * cardapio.pratos.find((p) => p.id === it.foodId)!.price,
            0
        );
        const itemsCount = orderItems.reduce((sum, it) => sum + it.quantity, 0);

        entrega.push({
            id: deliveryId,
            kitchenOrderId,
            customer: cozinhaDelivery[cozinhaDelivery.length - 1].ownerName,
            address: faker.location.streetAddress(),
            phone: faker.phone.number(),
            payments: {
                items: itemsCount,
                total,
                type: faker.helpers.arrayElement(['pix', 'dinheiro', 'cartao']),
            },
            items: orderItems,
        });
    }
    cozinha = [...cozinha, ...cozinhaDelivery];
};

const generateContabilidade = (count: number) => {
    const resumo: ResumoAccountingType[] = [
        {
            title: 'Vendas Totais',
            value: faker.finance.amount({ min: 10000, max: 20000, dec: 2 }),
            change: `+${faker.number.float({ min: 1, max: 15, fractionDigits: 1 })}%`,
            trend: 'up',
        },
        {
            title: 'Pedidos',
            value: faker.number.int({ min: 300, max: 900 }).toString(),
            change: `+${faker.number.float({ min: 1, max: 10, fractionDigits: 1 })}%`,
            trend: 'up',
        },
        {
            title: 'Valor Médio por Pedido',
            value: faker.finance.amount({ min: 25, max: 60, dec: 2 }),
            change: `+${faker.number.float({ min: 1, max: 5, fractionDigits: 1 })}%`,
            trend: 'up',
        },
        {
            title: 'Despesas',
            value: faker.finance.amount({ min: 4000, max: 9000, dec: 2 }),
            change: `-${faker.number.float({ min: 1, max: 5, fractionDigits: 1 })}%`,
            trend: 'down',
        },
    ];

    const transacoes: TransactionsType[] = [];
    for (let i = 1; i <= count; i++) {
        const type = faker.helpers.arrayElement(['entrada', 'saída'] as const);
        transacoes.push({
            id: `TX${String(i).padStart(3, '0')}`,
            description:
                type === 'entrada'
                    ? `Venda - Mesa ${faker.number.int({ min: 1, max: 10 })}`
                    : `Pagamento ${faker.commerce.department()}`,
            amount: parseFloat(faker.finance.amount({ min: 20, max: 1500 })),
            type,
            date: new Date(),
        });
    }
    contabilidade = { resumo, transacoes };
};

const generateConfig = () => {
    const geralData: GeneralDataType = {
        restaurantName: `${faker.company.name()} Restaurante`,
        address: faker.location.streetAddress(true),
        phone: faker.phone.number(),
        email: faker.internet.email(),
        taxRate: faker.number.int({ min: 5, max: 15 }),
        currency: 'BRL',
        taxasEntrega: [
            { id: 1, nome: 'Bairro Centro', valor: 5 },
            { id: 2, nome: 'Bairro Zona Sul', valor: 8 },
            { id: 3, nome: 'Demais regiões', valor: 12 },
        ],
    };
    const funcionarios: FuncionariosType[] = [
        { id: 1, name: faker.person.fullName(), role: 'Administrador', status: 'Ativo' },
        { id: 2, name: faker.person.fullName(), role: 'Atendente', status: 'Ativo' },
        { id: 3, name: faker.person.fullName(), role: 'Cozinheiro', status: 'Ativo' },
        { id: 4, name: faker.person.fullName(), role: 'Entregador', status: 'Ativo' },
    ];
    const entregadores: EntregadorType[] = Array.from({ length: 2 }).map((_, i) => ({
        id: i + 1,
        nome: faker.person.fullName(),
        telefone: faker.phone.number(),
    }));
    config = { geralData, funcionarios, entregadores, cardapioDigitalSlug: undefined };
};

const generateClientes = (count: number) => {
    clientes = [];
    const pratos = cardapio.pratos;

    for (let i = 1; i <= count; i++) {
        const carteiraHabilitada = faker.helpers.maybe(() => true, { probability: 0.6 }) ?? false;
        const movimentacoes: CarteiraMovimentacaoType[] = [];
        let saldo = 0;

        const comprasFiado = carteiraHabilitada ? faker.number.int({ min: 1, max: 5 }) : 0;

        for (let c = 0; c < comprasFiado; c++) {
            const prato = randomItem(pratos);
            const amount = parseFloat(
                (prato.price * faker.number.int({ min: 1, max: 3 }) * (1 + config.geralData.taxRate / 100)).toFixed(2)
            );
            saldo += amount;
            movimentacoes.push({
                id: `CL${i}M${c}`,
                createdAt: faker.date.recent({ days: 30 }).toISOString(),
                description: `Compra fiado - ${prato.title}`,
                amount,
                tipo: 'debito',
            });
        }

        if (carteiraHabilitada && saldo > 0 && faker.number.int({ min: 1, max: 10 }) > 6) {
            const pagamento = parseFloat((saldo / 2).toFixed(2));
            saldo -= pagamento;
            movimentacoes.push({
                id: `CL${i}PAG`,
                createdAt: faker.date.recent({ days: 15 }).toISOString(),
                description: 'Pagamento de carteira',
                amount: -pagamento,
                tipo: 'credito',
                method: faker.helpers.arrayElement(['dinheiro', 'cartao', 'pix']),
            });
        }

        clientes.push({
            id: i,
            nome: faker.person.fullName(),
            telefone: faker.phone.number(),
            email: faker.internet.email(),
            endereco: faker.location.streetAddress(),
            observacao: faker.helpers.maybe(() => faker.lorem.sentence(4), { probability: 0.3 }),
            carteiraHabilitada,
            saldo,
            createdAt: faker.date.past({ years: 1 }).toISOString(),
            movimentacoes,
        });
    }
};
