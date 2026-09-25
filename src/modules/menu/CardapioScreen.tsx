'use client';
import { useMemo, useState } from 'react';
import { Search, Minus, Package, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import { Button, Input, Label, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { useDataStore } from '@/store/userStore';
import { useNavStore } from '@/store/navStore';
import { handleIncrease, handleDecrease } from '@/modules/menu/menuFoodActions';
import { SendCurrentTableOrderKitchen } from '@/modules/menu/menuCartActions';
import { SendDeliveryOrderToKitchen } from '@/modules/delivery/DeliveryActions';
import { ProdutoOpcoesModal, ProdutoOpcoesResult } from '@/shared/components/ProdutoOpcoesModal';

function CategoryCard({
    label,
    icon,
    qtd,
    active,
    onClick,
}: {
    label: string;
    icon?: string;
    qtd: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <div
            onClick={onClick}
            className={`flex flex-col items-center p-3 rounded-xl min-w-[100px] border cursor-pointer hover:bg-green-50 ${
                active ? 'bg-green-50 text-green-600' : 'bg-white'
            }`}
        >
            {icon ? <img src={icon} alt={label} className="h-6 w-6 mb-1" /> : <Package className="h-6 w-6 mb-1 text-gray-400" />}
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-gray-500">{qtd} Itens</span>
        </div>
    );
}

export function CardapioScreen() {
    const pratos = useDataStore((s) => s.cardapio.pratos);
    const categorias = useDataStore((s) => s.cardapio.categorias);
    const currency = useDataStore((s) => s.config.geralData.currency) || 'BRL';

    const mesas = useDataStore((s) => s.mesas);
    const mesaSelecionadaId = useDataStore((s) => s.mesaSelecionadaId);
    const deliverySelecionado = useDataStore((s) => s.deliverySelecionado);
    const modoDelivery = useNavStore((s) => s.modoDelivery);

    const mesaAtual = mesas.find((mesa) => mesa.id == mesaSelecionadaId);

    const [opcoesFood, setOpcoesFood] = useState<CardapioFoodType | null>(null);

    const carrinho = modoDelivery ? deliverySelecionado?.inCart : mesaAtual?.products?.inCart;
    const itensCarrinho = carrinho ?? [];
    const qtdCarrinho = itensCarrinho.reduce((acc, i) => acc + i.quantity, 0);
    const totalCarrinho = itensCarrinho.reduce((acc, i) => acc + i.price * i.quantity, 0);

    const searchItem = useNavStore((s) => s.searchItem);
    const setSearchItem = useNavStore((s) => s.setSearchItem);

    const [categoria, setCategoria] = useState('Todos');

    const filtrados = useMemo(() => {
        const term = searchItem.trim().toLowerCase();
        if (term) {
            return pratos.filter(
                (p) =>
                    p.title.toLowerCase().includes(term) ||
                    (p.codigoInterno && p.codigoInterno.toLowerCase().includes(term))
            );
        }
        if (categoria === 'Todos') return pratos;
        const cat = categorias.find((c) => c.label === categoria);
        if (!cat) return pratos;
        return pratos.filter((p) => (p.category || []).includes(cat.id));
    }, [pratos, categorias, categoria, searchItem]);

    const confirmarOpcoes = (result: ProdutoOpcoesResult) => {
        if (!opcoesFood) return;
        handleIncrease(opcoesFood, mesaAtual?.id, result.notes, result.adicionais, result.quantity);
        setOpcoesFood(null);
    };

    const enviarCozinha = () => {
        if (itensCarrinho.length === 0) return;
        if (modoDelivery) {
            SendDeliveryOrderToKitchen(deliverySelecionado!.inCart, totalCarrinho);
        } else if (mesaAtual) {
            SendCurrentTableOrderKitchen(mesaAtual.products.inCart);
        }
    };

    return (
        <div className="space-y-4 pb-24">
            {!modoDelivery && mesaSelecionadaId != null && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    Adicionando itens para a mesa: <strong>{mesaAtual?.mesaNome || 'selecionada'}</strong>
                </div>
            )}

            <div className="flex gap-3 overflow-x-auto pb-2">
                <CategoryCard label="Todos" qtd={pratos.length} active={categoria === 'Todos'} onClick={() => setCategoria('Todos')} />
                {categorias.map((category, index) => {
                    const qtd = pratos.filter((p) => (p.category || []).includes(category.id)).length;
                    return (
                        <CategoryCard
                            key={index}
                            label={category.label}
                            icon={category.icon}
                            qtd={qtd}
                            active={categoria === category.label}
                            onClick={() => setCategoria(category.label)}
                        />
                    );
                })}
            </div>

            <div className="space-y-1 max-w-md">
                <Label>Buscar produto (todas as categorias)</Label>
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        className="pl-8"
                        value={searchItem}
                        onChange={(e) => setSearchItem(e.target.value)}
                        placeholder="Digite o nome do produto..."
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filtrados.length === 0 && (
                    <p className="col-span-full text-center text-gray-500 p-10">
                        {searchItem.trim() ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.'}
                    </p>
                )}
                {filtrados.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3 flex flex-col">
                        {p.imageURL && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageURL} alt={p.title} className="w-full h-28 object-cover rounded-md mb-2" />
                        )}
                        <div className="flex justify-between items-start gap-2">
                            <span className="font-medium">{p.title}</span>
                            <span className="text-green-600 font-semibold whitespace-nowrap">
                                {formatCurrency(p.price, currency)}
                            </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleDecrease(p, mesaAtual?.id)}>
                                <Minus className="h-4 w-4" />
                            </Button>
                            <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => setOpcoesFood(p)}>
                                <ShoppingBag className="h-4 w-4 mr-1" />
                                Adicionar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>

            {itensCarrinho.length > 0 && (
                <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg p-3 z-40">
                    <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                            <UtensilsCrossed className="h-5 w-5 text-green-700" />
                            <span className="font-semibold">
                                {qtdCarrinho} {qtdCarrinho === 1 ? 'item' : 'itens'}
                            </span>
                            <span className="text-gray-500">·</span>
                            <span className="font-bold">{formatCurrency(totalCarrinho, currency)}</span>
                        </div>
                        <Button className="bg-green-700 hover:bg-green-800 text-white font-bold px-6" onClick={enviarCozinha}>
                            Enviar para cozinha
                        </Button>
                    </div>
                </div>
            )}

            <ProdutoOpcoesModal
                open={opcoesFood != null}
                onOpenChange={(o) => !o && setOpcoesFood(null)}
                food={opcoesFood}
                onConfirm={confirmarOpcoes}
            />
        </div>
    );
}
