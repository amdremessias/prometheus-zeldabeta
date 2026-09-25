'use client';

import { useNavStore } from '@/store/navStore';
import { useAuthStore } from '@/store/authStore';
import { useDataStore } from '@/store/userStore';
import { canAccessTab } from '@/lib/permissions';
import { CreateDeliveryOrder } from '@/modules/delivery/CreateDeliveryOrder';
import { DeliveryDashboard } from '@/modules/delivery/DeliveryDashboard';
import { CardapioScreen } from '@/modules/menu/CardapioScreen';
import { FinancialSummary } from '@/modules/accounting/AccountingSummary';
import { IntegracoesScreen } from '@/modules/integracoes/IntegracoesScreen';
import { ChatWppTickets } from '@/modules/chatwpp/ChatWppTickets';
import { RecentTransactions } from '@/modules/accounting/AccountingTransactions';
import { DeliveryOrders } from '@/modules/delivery/DeliveryOrders';
import { OrderGrid } from '@/modules/kitchen/KitchenOrders';
import { Cart } from '@/modules/menu/MenuCart';
import { SettingsTabs } from '@/modules/settings/SettingsTabs';
import { FiscalNotesScreen } from '@/modules/fiscal/FiscalNotesScreen';
import { TableGrid } from '@/modules/tables/TableOrders';
import { MenuHeader } from '@/shared/components/MenuHeader';
import { SimpleHeader } from '@/shared/components/SimpleHeader';
import { Popup } from './PopupStack';
import HowToUse from '@/modules/howtouse/howtouse';
import { PDVScreen } from '@/modules/pdv/PDVScreen';
import { ClientesScreen } from '@/modules/clientes/ClientesScreen';
import { RelatoriosScreen } from '@/modules/relatorios/RelatoriosScreen';
import { CaixaScreen } from '@/modules/caixa/CaixaScreen';
import { CaixaStatusBanner } from '@/modules/caixa/CaixaStatusBanner';

export default function MenuPage() {
    const activeTab = useNavStore((state) => state.activeTab);
    const role = useAuthStore((state) => state.user?.role);
    const isDemo = useDataStore((state) => state.isDemo);

    if (!isDemo && !canAccessTab(role, activeTab)) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8">
                <h2 className="text-2xl font-bold text-gray-700">Acesso negado</h2>
                <p className="text-gray-500 mt-2">
                    Seu nível de acesso não permite visualizar esta área. Fale com o administrador.
                </p>
            </div>
        );
    }

    const ActiveTab = tabComponents[activeTab] || Cart;
    const isMenu = activeTab === 'Cardápio' || activeTab === 'Carrinho';
    const isFullHeight = activeTab === 'PDV';

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {isMenu ? <MenuHeader /> : <SimpleHeader title={activeTab} />}
            <CaixaStatusBanner />
            <div
                className={
                    isFullHeight
                        ? 'flex-1 min-h-0 p-2 overflow-hidden'
                        : 'flex-1 flex flex-col overflow-auto space-y-4 p-3'
                }
            >
                <ActiveTab />
            </div>
            <Popup />
        </div>
    );
}

const tabComponents: Record<string, React.ComponentType> = {
    PDV: () => <PDVScreen />,
    Clientes: () => <ClientesScreen />,
    'Serviços de Mesa': () => <TableGrid />,
    'Cardápio': () => <CardapioScreen />,
    Contabilidade: () => (
        <>
            <FinancialSummary />
            <RecentTransactions />
        </>
    ),
    Cozinha: () => <OrderGrid />,
    Entregas: () => <DeliveryOrders />,
    Relatórios: () => <RelatoriosScreen />,
    'Integrações': () => <IntegracoesScreen />,
    'Fiscal': () => <FiscalNotesScreen />,
'ChatWPP': () => <ChatWppTickets />, 
    Caixa: () => <CaixaScreen />,
    Configurações: () => <SettingsTabs />,
    'Criar Delivery/Retirada': () => <CreateDeliveryOrder />,
    'Delivery': () => <DeliveryDashboard />,
    Carrinho: () => <Cart />,
    'Como usar?': () => <HowToUse />,
};


