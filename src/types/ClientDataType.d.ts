export interface ClientDataType {
    cardapio: CardapioType;
    mesas: TablesType[];
    cozinha: KitchenOrderType[];
    entrega: DeliveryType[];
    config: ConfigType;
    contabilidade: ContabilidadeType;
    clientes: ClienteType[];
    vendas: VendaType[];
    caixa: CaixaType;
    mesaSelecionadaId: number | undefined;
    // Não pode ser undefined, mas pode ser valores vazios pois ele é o unico, n tem outros para selecionar;
    deliverySelecionado: Omit<DeliveryType, 'id'> & { inCart: FoodCartType[]; type: 'delivery' | 'takeout' };
}

export type ClientDataKeys = keyof ClientDataType;
