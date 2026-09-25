'use client';
import { LucideShoppingCart, Menu, Search } from 'lucide-react';
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { useNavStore } from '@/store/navStore';

export function MenuHeader() {
    const mesas = useDataStore((state) => state.mesas);
    const mesaSelecionadaId = useDataStore((state) => state.mesaSelecionadaId);
    const setMesaSelecionadaId = useDataStore((state) => state.setMesaSelecionadaId);
    const deliverySelecionado = useDataStore((state) => state.deliverySelecionado);

    const setActiveTab = useNavStore((state) => state.setActiveTab);
    const activeTab = useNavStore((state) => state.activeTab);
    const setSearchItem = useNavStore((state) => state.setSearchItem);
    const toggleMobileMenu = useNavStore((state) => state.toggleMobileMenu);
    const modoDelivery = useNavStore((state) => state.modoDelivery);

    const mesasOcupadas = mesas.filter((mesa) => mesa.status == 'ocupada');
    const mesaAtual = mesas.find((mesa) => mesa.id == mesaSelecionadaId);

    return (
        <div className="bg-white p-4 flex flex-col md:flex-row items-center gap-3 border-b">
            {/* Botão flutuante para telas pequenas */}
            <div className="flex items-center justify-between md:justify-start gap-5 flex-1 w-full">
                <div className="flex flex-row gap-5">
                    <div className="lg:hidden flex items-center shrink-0">
                        <button onClick={toggleMobileMenu} className="rounded-full">
                            <Menu size={25} className="w-full h-full" />
                        </button>
                    </div>
                    <div
                        className="relative cursor-pointer"
                        onClick={() => {
                            if (modoDelivery) {
                                setActiveTab('Criar Delivery/Retirada');
                                return;
                            }
                            setActiveTab(activeTab == 'Cardápio' ? 'Carrinho' : 'Cardápio');
                        }}
                    >
                        <LucideShoppingCart className="w-7 h-7" />
                        {mesaAtual && mesaAtual.products.inCart.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                                {modoDelivery ? deliverySelecionado.inCart.length : mesaAtual.products.inCart.length}
                            </span>
                        )}
                    </div>
                </div>
                {!modoDelivery ? (
                    <Select
                        value={mesaAtual?.id ? String(mesaAtual?.id) : undefined}
                        onValueChange={(mesaId) => {
                            setMesaSelecionadaId(Number(mesaId));
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue
                                placeholder={mesasOcupadas.length === 0 ? 'Nenhuma mesa ocupada' : 'Selecione uma mesa'}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {mesasOcupadas.map((mesa) => (
                                <SelectItem key={mesa.mesaNome} value={String(mesa.id)} className="text-sm">
                                    {mesa.mesaNome} - {mesa.clienteNome}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="font-semibold text-lg px-4">Modo delivery</div>
                )}
            </div>
            {activeTab === 'Cardápio' && (
                <div className="flex-1 relative w-full">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Buscar produto aqui..."
                        className="pl-10 w-full text-sm"
                        onChange={(e) => setSearchItem(e.target.value)}
                    />
                </div>
            )}
        </div>
    );
}
