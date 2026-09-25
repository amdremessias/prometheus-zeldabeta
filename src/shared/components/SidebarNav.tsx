'use client';
import { Menu, TableIcon as TableBar, Truck, Calculator, Settings, LogOut, ChefHat, X, HelpCircle, Store, Users, ClipboardList, Wallet, Zap, MessageCircle, ReceiptText } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { possibleTabs, useNavStore } from "@/store/navStore";
import { useAuthStore } from "@/store/authStore";
import { can } from "@/lib/permissions";
import { brand, defaultLogo, defaultSelo } from "@/shared/lib/branding";
import { BrandingImage } from "@/shared/components/BrandingImage";
import { useDataStore } from "@/store/userStore";

const navItems: Array<{ icon: typeof Menu; label: possibleTabs; permission?: Parameters<typeof can>[1] }> = [
  { icon: Store, label: "PDV", permission: "pdv" },
  { icon: Menu, label: "Cardápio", permission: "cardapio" },
  { icon: TableBar, label: "Serviços de Mesa", permission: "mesas" },
  { icon: ChefHat, label: "Cozinha", permission: "cozinha" },
  { icon: Truck, label: "Entregas", permission: "entregas" },
  { icon: Truck, label: "Delivery", permission: "entregas" },
  { icon: Users, label: "Clientes", permission: "clientes" },
  { icon: Wallet, label: "Caixa", permission: "caixa_abrir_fechar" },
  { icon: ClipboardList, label: "Relatórios", permission: "relatorios" },
  { icon: Calculator, label: "Contabilidade", permission: "financeiro" },
  { icon: Settings, label: "Configurações", permission: "config" },
  { icon: Zap, label: "Integrações", permission: "integracoes" },
  { icon: ReceiptText, label: "Fiscal", permission: "fiscal" },
  { icon: MessageCircle, label: "ChatWPP" },
  { icon: HelpCircle, label: "Como usar?", permission: "como_usar" },
];

export function SidebarNav() {
  const setActiveTab = useNavStore((state) => state.setActiveTab);
  const activeTab = useNavStore((state) => state.activeTab);
  const mobileMenu = useNavStore((state) => state.mobileMenu);
  const toggleMobileMenu = useNavStore((state) => state.toggleMobileMenu);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isDemo = useDataStore((state) => state.isDemo);
  // No modo demonstração todas as opções ficam visíveis no menu lateral,
  // independentemente do perfil (o acesso já é liberado no AppRouter).
  const visibleItems = isDemo
    ? navItems
    : navItems.filter((item) => !item.permission || can(user?.role, item.permission));
  const content = <div className="flex h-full flex-col bg-white/95 px-3 py-4 shadow-sm dark:bg-gray-950/95">
    <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-100"><BrandingImage kind="logo" fallback={defaultLogo} alt={brand.name} className="h-9 w-9 object-contain" /><span>Zelda PDV</span></div><Button variant="ghost" size="icon" className="md:hidden" onClick={toggleMobileMenu} aria-label="Fechar menu"><X className="h-5 w-5" /></Button></div>
    <nav className="flex-1 space-y-1 overflow-y-auto">{visibleItems.map((item) => <Button key={item.label} variant="ghost" onClick={() => { setActiveTab(item.label); if (mobileMenu) toggleMobileMenu(); }} className={`w-full justify-start ${activeTab === item.label ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-green-50"}`}><item.icon className="mr-2 h-4 w-4" />{item.label}</Button>)}</nav>
    <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800"><Button variant="ghost" className="w-full justify-start text-gray-600 hover:bg-green-50" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
      <div className="mt-5 flex flex-col items-center justify-center text-center"><BrandingImage kind="selo" fallback={defaultSelo} alt="CSI — Selo de Segurança do Sistema" className="h-24 w-24 object-contain sm:h-28 sm:w-28" /><span className="mt-1 text-[10px] font-medium leading-tight text-gray-500">Selo de Segurança do Sistema</span></div>
    </div>
  </div>;
  return <><aside className="hidden h-screen w-64 shrink-0 border-r border-gray-200 md:block">{content}</aside>{mobileMenu && <div className="fixed inset-0 z-50 md:hidden"><button className="absolute inset-0 bg-black/40" aria-label="Fechar menu" onClick={toggleMobileMenu} /><aside className="relative h-full w-72">{content}</aside></div>}<Button variant="ghost" size="icon" className="fixed left-3 top-3 z-40 md:hidden" onClick={toggleMobileMenu} aria-label="Abrir menu"><Menu className="h-5 w-5" /></Button></>;
}
