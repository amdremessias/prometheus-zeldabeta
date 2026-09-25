// Para Mesas
interface TablesType {
    id: number;
    status: 'ocupada' | 'livre';
    mesaNome: string;
    clienteNome: string;

    usedAt: string;
    guests: number;
    waiter: string;
    hidden?: boolean;

    products: {
        inCart: FoodCartType[];
        inKitchen: FoodCartType[];
        alreadyEaten: FoodCartType[];
    };
}

// Para Cozinha
interface KitchenOrderType {
    id: number;
    type: 'table' | 'delivery' | 'takeout' | 'pdv';
    ownerId: number;
    ownerName: string; // nome do client
    ownerTable: string;

    chef: string;
    orderItems: FoodCartType[];

    createdAt: string; // pedido enviado pra cozinha
    startedAt?: string; // cozinha começou a preparar
    endedAt?: string; // cozinha terminou

    pedidosWebId?: number; // id do pedido em pedidos_web (integração com faturamento)
}

// Para Entregas
interface DeliveryType {
    id: number;
    kitchenOrderId?: number; // único pedido enviado à cozinha

    customer?: string;
    address?: string;
    phone?: string;

    payments: {
        items: number;
        total: number;
        type: 'dinheiro' | 'cartao' | 'pix' | 'fiado';
        clienteId?: number;
        clienteNome?: string;
        // Parcelas quando o recebimento for parcial (preenchidas na confirmação da entrega).
        parts?: VendaPagamentoType[];
    };

    deliveryPerson?: string;
    deliveryPhone?: string;
    items?: FoodCartType[];

    startedAt?: string; // delivery criado (após endedAt da cozinha)
    dispatchedAt?: string; // saiu pra entrega
    deliveredAt?: string; // entregue com sucesso
}

// Para o Cardapio
interface CardapioType {
    categorias: CategoriesType[];
    pratos: CardapioFoodType[];
    adicionais: AdicionalType[];
}

// Adicionais (extras) cadastrados em Configurações (ex.: Ovo, Bacon, Batata Palha)
interface AdicionalType {
    id: number;
    descricao: string;
    valor: number;
    ativo?: boolean;
}

// Adicional selecionado no pedido (resolve o catálogo para exibir/preçar)
interface AdicionalItemType {
    id: number;
    descricao: string;
    valor: number;
}

// Para configuração
interface ConfigType {
    geralData: GeneralDataType;
    funcionarios: FuncionariosType[];
    entregadores: EntregadorType[];
    cardapioDigitalSlug?: string;
    branding?: {
        logo?: string;
        selo?: string;
    };
}

// Pedido recebido pelo Cardápio Digital (persistido na tabela pedidos_web)
interface PedidoWebType {
    id: number;
    slug: string;
    cliente: string;
    telefone: string;
    endereco: string;
    pagamento: string;
    taxaEntregaNome: string;
    taxaEntregaValor: number;
    itens: { id: number; title: string; price: number; quantity: number; notes?: string; adicionais?: AdicionalItemType[] }[];
    subtotal: number;
    total: number;
    status: 'pendente' | 'em_preparo' | 'concluido' | 'cancelado';
    origem?: string;
    faturado?: boolean;
    createdAt: string;
}

// Para contabilidade
interface ContabilidadeType {
    resumo: ResumoAccountingType[];
    transacoes: TransactionsType[];
}

/* Tipos auxiliares  */

interface CardapioFoodType {
    id: number;
    imageBlob: Blob;
    imageURL: string;
    title: string;
    price: number;
    discount?: number;
    category: number[];
    adicionaisDisponiveis: number[];
    status: string;
    // Controle de estoque (opcional: sem os campos, o produto não participa do controle/relatório).
    estoqueAtual?: number;
    estoqueMinimo?: number;
    // Dados fiscais (NFC-e/NF-e) — OPCIONAIS. Sem eles o produto não participa da emissão.
    // Incluídos para compatibilidade com dados legados (cardápio existente não tem estes campos).
    ncm?: string;             // código NCM (máscara 0000.00.00)
    cest?: string;            // código CEST (7 dígitos) quando houver ST
    unidadeComercial?: 'UN' | 'KG' | 'CX' | 'LT';
    origem?: string;          // 0-Nacional, 1-Importada, ... (código SEFAZ)
    csosn?: string;           // CSOSN p/ Simples Nacional (102, 103, 500, ...)
    cst?: string;             // CST p/ Regime Normal quando aplicável
    cfop?: number;            // CFOP (padrão 5102)
    // Código de barras p/ entrada rápida no PDV (leitor de código de barras).
    codigoBarras?: string;
    // Código interno do produto (referência própria da loja).
    codigoInterno?: string;
}

// Para Clientes / Carteira (fiado)
interface ClienteType {
    id: number;
    nome: string;
    telefone: string;
    email: string;
    endereco: string;
    observacao?: string;
    carteiraHabilitada: boolean; // permite comprar fiado
    saldo: number; // > 0 = deve; <= 0 = sem débito
    createdAt: string;
    movimentacoes: CarteiraMovimentacaoType[];
}

interface CarteiraMovimentacaoType {
    id: string;
    createdAt: string;
    description: string;
    amount: number; // > 0 = débito (compra fiado); < 0 = crédito (pagamento)
    tipo: 'debito' | 'credito';
    method?: 'dinheiro' | 'cartao' | 'pix';
}

interface FoodCartType {
    foodId: number;
    orderId?: number;
    title: string;
    price: number;
    quantity: number;
    notes?: string;
    adicionais?: AdicionalItemType[];
    // Origem quando o item foi transferido de outra mesa (ex.: "Mesa 3").
    transferOrigin?: string;
}
