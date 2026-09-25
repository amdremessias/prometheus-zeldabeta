import { create } from 'zustand';

export type possibleTabs =
    | 'PDV'
    | 'Clientes'
    | 'Cardápio'
    | 'Serviços de Mesa'
    | 'Cozinha'
    | 'Entregas'
    | 'Relatórios'
    | 'Contabilidade'
    | 'Caixa'
    | 'Configurações'
    | 'Integrações'
    | 'Fiscal'
    | 'ChatWPP'
    | 'Carrinho'
    | 'Criar Delivery/Retirada'
    | 'Delivery'
    | 'Como usar?';

type NavState = {
    mobileMenu: boolean;
    searchItem: string;
    activeTab: possibleTabs;
    modoDelivery: boolean;
};

type NavActions = {
    toggleMobileMenu: () => void;
    setSearchItem: (item: string) => void;
    setActiveTab: (tab: possibleTabs, keepModoDelivery?: boolean) => void;
    resetNav: () => void;
};

const initialState: NavState = {
    mobileMenu: false,
    searchItem: '',
    activeTab: 'Cardápio',
    modoDelivery: false,
};

// Cria o store
export const useNavStore = create<NavState & NavActions>((set) => ({
    ...initialState,

    toggleMobileMenu: () => set((state) => ({ mobileMenu: !state.mobileMenu })),

    setSearchItem: (item) => set({ searchItem: item }),

    setActiveTab: (tab, keepModoDelivery = false) =>
        set(() => ({
            activeTab: tab,
            modoDelivery: keepModoDelivery,
        })),

    resetNav: () => set(initialState),
}));

