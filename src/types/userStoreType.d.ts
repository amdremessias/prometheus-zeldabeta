import { ClientDataType } from '@/types/ClientDataType';

export type Updater<T> = T | ((prev: T) => T);

export type StoreState = ClientDataType & {
    loading: boolean;
    isDemo: boolean;
};

export type StoreActions = {
    loadInitialData: (demo?: boolean) => Promise<void>;
    setMesaSelecionadaId: (updater: Updater<ClientDataType['mesaSelecionada']>) => void;
    setDeliverySelecionado: (updater: Updater<ClientDataType['deliverySelecionado']>) => void;
    setMesas: (updater: Updater<ClientDataType['mesas']>) => void;
    setConfig: (updater: Updater<ClientDataType['config']>) => void;
    setCardapio: (updater: Updater<ClientDataType['cardapio']>) => void;
    setContabilidade: (updater: Updater<ClientDataType['contabilidade']>) => void;
    setCozinha: (updater: Updater<ClientDataType['cozinha']>) => void;
    setEntrega: (updater: Updater<ClientDataType['entrega']>) => void;
    setClientes: (updater: Updater<ClientDataType['clientes']>) => void;
    setVendas: (updater: Updater<ClientDataType['vendas']>) => void;
    setCaixa: (updater: Updater<ClientDataType['caixa']>) => void;
};
