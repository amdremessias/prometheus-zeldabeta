interface ResumoAccountingType {
    title: 'Vendas Totais' | 'Pedidos' | 'Valor Médio por Pedido' | 'Despesas';
    value: string;
    change: string;
    trend: 'up' | 'down';
}

interface TransactionsType {
    id: string;
    description: string;
    amount: number;
    type: 'entrada' | 'saída';
    date: Date;
}

interface CategoriesType {
    id: number;
    icon: string;
    label: string;
    qtdItems: number;
}

interface FuncionariosType {
    id: number;
    name: string;
    role: string;
    status: 'Ativo' | 'Inativo';
}

interface GeneralDataType {
    restaurantName: string;
    address: string;
    phone: string;
    email: string;
    taxRate: number;
    currency: string;
    taxasEntrega: TaxaEntregaType[];
}

// Taxa de entrega do cardápio digital (cadastrada em Configurações)
interface TaxaEntregaType {
    id: number;
    nome: string;
    valor: number;
}

// Entregador (cadastrado em Configurações e usado nas entregas)
interface EntregadorType {
    id: number;
    nome: string;
    telefone: string;
}

// Item vendido (para o relatório de fechamento de caixa)
interface VendaItemType {
    foodId: number;
    title: string;
    price: number;
    quantity: number;
    notes?: string;
    adicionais?: { id: number; descricao: string; valor: number }[];
}

// Parcela de pagamento de uma venda (recebimento parcial).
// Ex.: conta de R$ 225 → 50 Pix + 100 Dinheiro + 50 Fiado + 25 Cartão.
interface VendaPagamentoType {
    metodo: 'dinheiro' | 'cartao' | 'pix' | 'fiado';
    valor: number;
    clienteId?: number;
    clienteNome?: string;
}

// Venda registrada (relatório de fechamento de caixa)
interface VendaType {
    id: string;
    date: string; // ISO
    tipo: 'mesa' | 'delivery' | 'retirada' | 'pdv' | 'pagamento_carteira';
    origem: string; // nome da mesa, "Delivery", "Retirada", "PDV", "Carteira"
    cliente?: string;
    items: VendaItemType[];
    subtotal: number;
    taxa: number;
    total: number;
    metodo: 'dinheiro' | 'cartao' | 'pix' | 'fiado';
    // Detalhamento do recebimento quando a venda foi paga em partes.
    pagamentos?: VendaPagamentoType[];
    // CPF/CNPJ do consumidor informado no cupom (NFC-e) — opcional.
    consumidorCpfCnpj?: string;
}

// Relatório completo de um fechamento de caixa (persistido no banco)
interface CaixaReportType {
    vendas: VendaType[];
    transacoes: TransactionsType[];
}

// Caixa (abertura/fechamento obrigatório para registrar vendas)
interface CaixaType {
    status: 'fechado' | 'aberto';
    openedAt?: string;
    openedBy?: string;
    initialAmount: number;
    closedAt?: string;
    expectedAmount?: number;
    finalAmount?: number;
    difference?: number;
    salesCount?: number;
    notes?: string;
    detail?: CaixaReportType;
}

// Linha do caixa retornada pelo backend (colunas snake_case)
interface CaixaRowLike {
    id?: number;
    status: string;
    opened_at?: string | null;
    opened_by?: number | null;
    initial_amount?: number | string | null;
    closed_at?: string | null;
    closed_by?: number | null;
    expected_amount?: number | string | null;
    final_amount?: number | string | null;
    difference?: number | string | null;
    sales_count?: number | null;
    notes?: string | null;
    detail?: unknown;
}
