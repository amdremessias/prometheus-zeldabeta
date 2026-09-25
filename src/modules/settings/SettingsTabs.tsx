import { Tabs, TabsContent, TabsList, TabsTrigger, Card, CardContent } from '@/shared/ui';
import { GeneralSettings } from './SettingsGeneral';
import { UsersSettings } from './SettingsUsuarios';
import { DeliverySettings } from './SettingsEntregadores';
import { MenuSettings } from './SettingsMenu';
import { EstastisticaSettings } from './SettingsStatistics';
import SettingsTables from './SettingsTables';
import { CardapioDigitalSettings } from './SettingsCardapioDigital';
import { BackupSettings } from './SettingsBackup';
import { SettingsBranding } from './SettingsBranding';
import { SettingsFiscal } from './SettingsFiscal';
import { SettingsImportProdutos } from './SettingsImportProdutos';
import { useAuthStore } from '@/store/authStore';
import { can } from '@/lib/permissions';

export function SettingsTabs() {
    const role = useAuthStore((state) => state.user?.role);
    const showFiscal = can(role, 'fiscal');
    return (
        <Tabs defaultValue="general" className="w-full">
            <TabsList className="mb-4 flex gap-2 overflow-x-auto pb-1 flex-nowrap">
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="general">Geral</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="users">Usuários</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="entregadores">Entregadores</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="mesas">Mesas</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="menu">Cardápio</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="importar">Importar Produtos</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="cardapiodigital">Cardápio Digital</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="estastistica">Estastistica</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="marca">Marca</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="backup">Backup</TabsTrigger>
                {showFiscal && (
                    <TabsTrigger className="shrink-0 whitespace-nowrap" value="fiscal">Fiscal</TabsTrigger>
                )}
            </TabsList>

            <TabsContent value="general">
                <Card>
                    <CardContent className="p-4">
                        <GeneralSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="mesas">
                <Card>
                    <CardContent className="p-4">
                        <SettingsTables />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="users">
                <Card>
                    <CardContent className="p-4">
                        <UsersSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="entregadores">
                <Card>
                    <CardContent className="p-4">
                        <DeliverySettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="menu">
                <Card>
                    <CardContent className="p-4">
                        <MenuSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="importar">
                <Card>
                    <CardContent className="p-4">
                        <SettingsImportProdutos />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="cardapiodigital">
                <Card>
                    <CardContent className="p-4">
                        <CardapioDigitalSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="estastistica">
                <Card>
                    <CardContent className="p-4">
                        <EstastisticaSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="backup">
                <Card>
                    <CardContent className="p-4">
                        <BackupSettings />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="marca">
                <Card>
                    <CardContent className="p-4">
                        <SettingsBranding />
                    </CardContent>
                </Card>
            </TabsContent>

            {showFiscal && (
                <TabsContent value="fiscal">
                    <Card>
                        <CardContent className="p-4">
                            <SettingsFiscal />
                        </CardContent>
                    </Card>
                </TabsContent>
            )}
        </Tabs>
    );
}
