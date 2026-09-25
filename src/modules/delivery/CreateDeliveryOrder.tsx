'use client';
import { useMemo, useState } from 'react';
import { Truck, Store, Plus, Minus, Trash2, Send, Search } from 'lucide-react';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { useDataStore } from '@/store/userStore';
import { useNavStore } from '@/store/navStore';
import { showMessage } from '@/store/popupStore';
import { SendDeliveryOrderToKitchen } from './DeliveryActions';
import { restaurantVazio } from '@/shared/lib/dataState/restauranteVazio';
import { ProdutoOpcoesModal, ProdutoOpcoesResult } from '@/shared/components/ProdutoOpcoesModal';

interface CartItem {
    lineId: string;
    id: number;
    title: string;
    price: number;
    quantity: number;
    notes?: string;
    adicionais?: AdicionalItemType[];
}

let lineSeq = 1;

export function CreateDeliveryOrder() {
    const pratos = useDataStore((s) => s.cardapio.pratos);
    const categorias = useDataStore((s) => s.cardapio.categorias);
    const setDeliverySelecionado = useDataStore((s) => s.setDeliverySelecionado);
    const currency = useDataStore((s) => s.config.geralData.currency) || 'BRL';
    const setActiveTab = useNavStore((s) => s.setActiveTab);

    const [tipo, setTipo] = useState<'entrega' | 'retirada'>('entrega');
    const [cliente, setCliente] = useState('');
    const [telefone, setTelefone] = useState('');
    const [endereco, setEndereco] = useState('');
    const [pagamento, setPagamento] = useState<'dinheiro' | 'cartao' | 'pix' | 'fiado'>('dinheiro');
    const [observacoes, setObservacoes] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [categoria, setCategoria] = useState<string | number>('Todos');
    const [search, setSearch] = useState('');
    const [busy, setBusy] = useState(false);
    const [erro, setErro] = useState('');

    const [opcoesFood, setOpcoesFood] = useState<CardapioFoodType | null>(null);

    const filtrados = useMemo(() => {
        const byCat =
            categoria === 'Todos' ? pratos : pratos.filter((p) => (p.category || []).includes(categoria as number));
        const term = search.trim().toLowerCase();
        return term ? byCat.filter((p) => p.title.toLowerCase().includes(term)) : byCat;
    }, [pratos, categoria, search]);

    const itens = cart;
    const subtotal = itens.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const total = subtotal;

    const addLine = (p: CardapioFoodType, opts: ProdutoOpcoesResult) => {
        const adicionaisValor = (opts.adicionais || []).reduce((s, a) => s + a.valor, 0);
        const line: CartItem = {
            lineId: `l${lineSeq++}`,
            id: p.id,
            title: p.title,
            price: p.price + adicionaisValor,
            quantity: opts.quantity > 0 ? opts.quantity : 1,
            notes: opts.notes || undefined,
            adicionais: opts.adicionais && opts.adicionais.length ? opts.adicionais : undefined,
        };
        setCart((prev) => [...prev, line]);
    };

    const incLine = (lineId: string) =>
        setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l)));
    const decLine = (lineId: string) =>
        setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity: Math.max(0, l.quantity - 1) } : l)).filter((l) => l.quantity > 0));
    const removeItem = (lineId: string) => setCart((prev) => prev.filter((l) => l.lineId !== lineId));

    const criar = async () => {
        setErro('');
        if (!cliente.trim() || !telefone.trim()) {
            setErro('Informe o nome e o telefone do cliente.');
            return;
        }
        if (itens.length === 0) {
            setErro('Adicione ao menos um item ao pedido.');
            return;
        }
        setBusy(true);
        try {
            setDeliverySelecionado({
                ...restaurantVazio.deliverySelecionado,
                customer: cliente.trim(),
                phone: telefone.trim(),
                address: tipo === 'entrega' ? endereco.trim() : '',
                type: tipo === 'entrega' ? 'delivery' : 'takeout',
                payments: {
                    ...restaurantVazio.deliverySelecionado.payments,
                    type: pagamento,
                    items: itens.length,
                    total,
                },
            });
            await SendDeliveryOrderToKitchen(
                itens.map((i) => ({
                    foodId: i.id,
                    title: i.title,
                    price: i.price,
                    quantity: i.quantity,
                    notes: i.notes,
                    adicionais: i.adicionais,
                })),
                total
            );
            showMessage('Pedido enviado para a cozinha!', 'success');
            setCliente('');
            setTelefone('');
            setEndereco('');
            setObservacoes('');
            setCart([]);
            setSearch('');
            setCategoria('Todos');
            setActiveTab('Delivery');
        } catch {
            setErro('Erro ao enviar o pedido para a cozinha.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
                <div className="flex gap-2">
                    <Button
                        type="button"
                        className="flex-1"
                        variant={tipo === 'entrega' ? 'default' : 'outline'}
                        onClick={() => setTipo('entrega')}
                    >
                        <Truck className="h-4 w-4 mr-2" /> Entrega
                    </Button>
                    <Button
                        type="button"
                        className="flex-1"
                        variant={tipo === 'retirada' ? 'default' : 'outline'}
                        onClick={() => setTipo('retirada')}
                    >
                        <Store className="h-4 w-4 mr-2" /> Retirada
                    </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label>Cliente *</Label>
                        <Input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
                    </div>
                    <div className="space-y-1">
                        <Label>Telefone *</Label>
                        <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                    </div>
                </div>

                {tipo === 'entrega' && (
                    <div className="space-y-1">
                        <Label>Endereço de entrega</Label>
                        <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
                    </div>
                )}

                <div className="space-y-1">
                    <Label>Forma de pagamento (prevista)</Label>
                    <Select value={pagamento} onValueChange={(v) => setPagamento(v as any)}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dinheiro">Dinheiro</SelectItem>
                            <SelectItem value="cartao">Cartão</SelectItem>
                            <SelectItem value="pix">Pix</SelectItem>
                            <SelectItem value="fiado">Fiado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label>Observações</Label>
                    <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Ex.: sem cebola" />
                </div>
            </div>

            <div className="space-y-4">
                <div className="space-y-1">
                    <Label>Categoria</Label>
                    <div className="flex gap-3 overflow-x-auto pb-2">
                        <div
                            onClick={() => setCategoria('Todos')}
                            className={`flex flex-col items-center p-3 rounded-xl min-w-[100px] border cursor-pointer hover:bg-green-50 ${
                                categoria === 'Todos' ? 'bg-green-50 text-green-600' : 'bg-white'
                            }`}
                        >
                            <span className="text-sm font-medium">Todos</span>
                            <span className="text-xs text-gray-500">{pratos.length} Itens</span>
                        </div>
                        {categorias.map((category, index) => (
                            <div
                                key={index}
                                onClick={() => setCategoria(category.id)}
                                className={`flex flex-col items-center p-3 rounded-xl min-w-[100px] border cursor-pointer hover:bg-green-50 ${
                                    categoria === category.id ? 'bg-green-50 text-green-600' : 'bg-white'
                                }`}
                            >
                                {category.icon ? (
                                    <img src={category.icon} alt={category.label} className="h-6 w-6 mb-1" />
                                ) : (
                                    <span className="h-6 w-6 mb-1" />
                                )}
                                <span className="text-sm font-medium">{category.label}</span>
                                <span className="text-xs text-gray-500">{category.qtdItems} Itens</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <Label>Buscar produto no cardápio</Label>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Digite para filtrar..." />
                    </div>
                </div>

                <div className="max-h-64 overflow-auto rounded-lg border divide-y">
                    {filtrados.length === 0 && (
                        <p className="p-3 text-sm text-gray-500">Nenhum produto encontrado.</p>
                    )}
                    {filtrados.map((p) => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setOpcoesFood(p)}
                            className="w-full flex justify-between items-center px-3 py-2 hover:bg-gray-50 text-left"
                        >
                            <span className="text-sm font-medium">{p.title}</span>
                            <span className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">{formatCurrency(p.price, currency)}</span>
                                <Plus className="h-4 w-4 text-green-600" />
                            </span>
                        </button>
                    ))}
                </div>

                <div className="rounded-lg border divide-y">
                    {itens.length === 0 && <p className="p-3 text-sm text-gray-500">Carrinho vazio.</p>}
                    {itens.map((i) => (
                        <div key={i.lineId} className="flex justify-between items-center px-3 py-2">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{i.title}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(i.price, currency)}</p>
                                {i.adicionais && i.adicionais.length > 0 && (
                                    <p className="text-xs text-green-600">
                                        + {i.adicionais.map((a) => a.descricao).join(', ')}
                                    </p>
                                )}
                                <Input
                                    className="mt-1 h-8 text-xs"
                                    placeholder="Obs (ex.: sem salada)"
                                    value={i.notes || ''}
                                    onChange={(e) =>
                                        setCart((prev) => prev.map((l) => (l.lineId === i.lineId ? { ...l, notes: e.target.value } : l)))
                                    }
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => decLine(i.lineId)}>
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center text-sm">{i.quantity}</span>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => incLine(i.lineId)}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-7 w-7 text-red-500" onClick={() => removeItem(i.lineId)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-lg bg-gray-50 p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal, currency)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-base">
                        <span>Total</span>
                        <span className="text-green-600">{formatCurrency(total, currency)}</span>
                    </div>
                </div>

                {erro && <p className="text-sm text-red-600">{erro}</p>}

                <Button className="w-full bg-green-600 hover:bg-green-700 h-12 font-bold" disabled={busy} onClick={criar}>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar para cozinha
                </Button>
            </div>

            <ProdutoOpcoesModal
                open={opcoesFood != null}
                onOpenChange={(o) => !o && setOpcoesFood(null)}
                food={opcoesFood}
                onConfirm={(r) => opcoesFood && addLine(opcoesFood, r)}
            />
        </div>
    );
}
