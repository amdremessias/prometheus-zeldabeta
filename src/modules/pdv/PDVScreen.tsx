'use client';
import { useMemo, useState } from 'react';
import {
    ShoppingCart,
    Plus,
    Minus,
    Search,
    Trash2,
    X,
    CheckCircle2,
    Package,
    LayoutGrid,
} from 'lucide-react';
import { Button, Card, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { FinalizarVendaPDV } from './pdvActions';
import { PaymentSplitEditor } from '@/shared/components/PaymentSplitEditor';
import { isPaymentSplitComplete, sumPagamentos, calcularTroco, paymentMethodLabel } from '@/shared/lib/payments';
import { printReceipt } from '@/shared/lib/printReceipt';
import { ProdutoOpcoesModal, ProdutoOpcoesResult } from '@/shared/components/ProdutoOpcoesModal';

type PDVCartLine = {
    lineId: string;
    foodId: number;
    title: string;
    price: number;
    quantity: number;
    imageURL?: string;
    notes?: string;
    adicionais?: { id: number; descricao: string; valor: number }[];
};

let pdvLineSeq = 1;

export function PDVScreen() {
    const cardapio = useDataStore((state) => state.cardapio);
    const taxRate = useDataStore((state) => state.config.geralData.taxRate) || 0;
    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';

    const [activeCategory, setActiveCategory] = useState('Todos');
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<PDVCartLine[]>([]);
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [mobileCartOpen, setMobileCartOpen] = useState(false);
    const [recebimentoConfirmado, setRecebimentoConfirmado] = useState(false);
    const [ultimosPagamentos, setUltimosPagamentos] = useState<VendaPagamentoType[]>([]);

    const [opcoesFood, setOpcoesFood] = useState<CardapioFoodType | null>(null);

    const products = useMemo(() => {
        const term = search.trim().toLowerCase();
        let list = cardapio.pratos;
        // Produtos guardam o ID da categoria em `category` (number[]); filtramos pelo id.
        if (activeCategory !== 'Todos') {
            const cat = cardapio.categorias.find((c) => c.label === activeCategory);
            list = cat ? list.filter((p) => p.category.includes(cat.id)) : [];
        }
        if (term) {
            list = list.filter(
                (p) =>
                    p.title.toLowerCase().includes(term) ||
                    (p.codigoBarras && p.codigoBarras.toLowerCase().includes(term)) ||
                    (p.codigoInterno && p.codigoInterno.toLowerCase().includes(term))
            );
        }
        return list;
    }, [cardapio.pratos, cardapio.categorias, activeCategory, search]);

    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    const quantidade = (id: number) => cart.filter((c) => c.foodId === id).reduce((s, c) => s + c.quantity, 0);

    const addLine = (item: CardapioFoodType, opts: ProdutoOpcoesResult) => {
        const adicionaisValor = (opts.adicionais || []).reduce((s, a) => s + a.valor, 0);
        setCart((prev) => [
            ...prev,
            {
                lineId: `pl${pdvLineSeq++}`,
                foodId: item.id,
                title: item.title,
                price: item.price + adicionaisValor,
                quantity: opts.quantity > 0 ? opts.quantity : 1,
                imageURL: item.imageURL || '',
                notes: opts.notes || undefined,
                adicionais: opts.adicionais && opts.adicionais.length ? opts.adicionais : undefined,
            },
        ]);
    };

    const setLineNotes = (lineId: string, notes: string) => {
        setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, notes } : c)));
    };

    const decreaseLine = (lineId: string) => {
        setCart((prev) =>
            prev
                .map((c) => (c.lineId === lineId ? { ...c, quantity: Math.max(0, c.quantity - 1) } : c))
                .filter((c) => c.quantity > 0)
        );
    };

    const removeLine = (lineId: string) => {
        setCart((prev) => prev.filter((c) => c.lineId !== lineId));
    };

    // Decrementa a última linha daquele produto (usado pelo botão "−" no card do produto).
    const decreaseItem = (foodId: number) => {
        setCart((prev) => {
            let targetIdx = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].foodId === foodId) {
                    targetIdx = i;
                    break;
                }
            }
            if (targetIdx === -1) return prev;
            const next = prev.slice();
            const t = next[targetIdx];
            if (t.quantity <= 1) next.splice(targetIdx, 1);
            else next[targetIdx] = { ...t, quantity: t.quantity - 1 };
            return next;
        });
    };

    const clearCart = () => {
        setCart([]);
        setCheckoutOpen(false);
        setMobileCartOpen(false);
    };

    const finish = (pagamentos: VendaPagamentoType[], consumidorCpfCnpj?: string) => {
        const ok = FinalizarVendaPDV(
            cart.map((i) => ({
                foodId: i.foodId,
                title: i.title,
                price: i.price,
                quantity: i.quantity,
                notes: i.notes,
                adicionais: i.adicionais,
            })),
            total,
            pagamentos,
            consumidorCpfCnpj
        );
        if (ok) {
            setUltimosPagamentos(pagamentos);
            setCheckoutOpen(false);
            setRecebimentoConfirmado(true);
        }
    };

    return (
        <div className="flex h-full min-h-0 flex-col gap-2 lg:flex-row lg:gap-3">
            {/* Grid de produtos */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
                <div className="relative">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Buscar produto para venda rápida..."
                        className="pl-10 w-full h-12"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && products.length > 0) {
                                const term = search.trim().toLowerCase();
                                const first =
                                    products.find(
                                        (p) => p.codigoInterno && p.codigoInterno.toLowerCase() === term
                                    ) ??
                                    products.find(
                                        (p) => p.codigoBarras && p.codigoBarras.toLowerCase() === term
                                    ) ??
                                    products[0];
                                const disponiveis = cardapio.adicionais.filter((a) =>
                                    (first.adicionaisDisponiveis || []).includes(a.id)
                                );
                                if (disponiveis.length === 0) {
                                    addLine(first, { quantity: 1, notes: '', adicionais: [] });
                                    setSearch('');
                                } else {
                                    setOpcoesFood(first);
                                }
                            }
                        }}
                    />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                    <button
                        key="todos"
                        onClick={() => setActiveCategory('Todos')}
                        className={`flex flex-col items-center p-3 rounded-xl min-w-[100px] border cursor-pointer transition-colors ${
                            activeCategory === 'Todos'
                                ? 'bg-green-50 text-green-600 border-green-200'
                                : 'bg-white hover:bg-green-50'
                        }`}
                    >
                        <LayoutGrid className="h-6 w-6 mb-1 text-gray-400" />
                        <span className="text-sm font-medium">Todos</span>
                        <span className="text-xs text-gray-500">{cardapio.pratos.length} itens</span>
                    </button>
                    {cardapio.categorias.map((category) => {
                        const qtd = cardapio.pratos.filter((p) => p.category.includes(category.id)).length;
                        return (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.label)}
                                className={`flex flex-col items-center p-3 rounded-xl min-w-[100px] border cursor-pointer transition-colors ${
                                    category.label === activeCategory
                                        ? 'bg-green-50 text-green-600 border-green-200'
                                        : 'bg-white hover:bg-green-50'
                                }`}
                            >
                                {category.icon ? (
                                    <img src={category.icon} alt={category.label} className="h-6 w-6 mb-1" />
                                ) : (
                                    <Package className="h-6 w-6 mb-1 text-gray-400" />
                                )}
                                <span className="text-sm font-medium">{category.label}</span>
                                <span className="text-xs text-gray-500">{qtd} itens</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-24 lg:pb-0">
                    {products.length === 0 && (
                        <h2 className="font-bold text-xl text-center p-10">
                            {cardapio.pratos.length === 0
                                ? 'Nenhum produto cadastrado. Cadastre produtos em Configurações > Cardápio.'
                                : 'Nenhum produto encontrado com o filtro atual.'}
                        </h2>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {products.map((item) => {
                            const qtd = quantidade(item.id);
                            return (
                                <Card key={item.id} className="overflow-hidden pt-0">
                                    <button
                                        onClick={() => setOpcoesFood(item)}
                                        className="w-full text-left cursor-pointer"
                                    >
                                        <div className="relative">
                                            <img
                                                src={item.imageURL || '/placeholder.svg'}
                                                alt={item.title}
                                                className="w-full h-32 object-cover"
                                            />
                                            {qtd > 0 && (
                                                <span className="absolute top-2 right-2 bg-green-600 text-white text-sm font-bold w-8 h-8 flex items-center justify-center rounded-full">
                                                    {qtd}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <h3 className="text-sm font-medium leading-tight mb-1 line-clamp-1">
                                                {item.title}
                                            </h3>
                                            <span className="text-green-600 font-bold">
                                                {formatCurrency(item.price, currency)}
                                            </span>
                                        </div>
                                    </button>
                                    <div className="px-3 pb-3 flex items-center justify-between">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="rounded-full h-11 w-11"
                                            onClick={() => decreaseItem(item.id)}
                                            disabled={qtd === 0}
                                        >
                                            <Minus className="h-5 w-5" />
                                        </Button>
                                        <span className="font-bold">{qtd}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="rounded-full h-11 w-11"
                                            onClick={() => setOpcoesFood(item)}
                                        >
                                            <Plus className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Carrinho desktop */}
            <CartSidebar
                cart={cart}
                subtotal={subtotal}
                tax={tax}
                total={total}
                totalItems={totalItems}
                currency={currency}
                taxRate={taxRate}
                onDecreaseLine={decreaseLine}
                onRemoveLine={removeLine}
                onNotesLine={setLineNotes}
                onClear={clearCart}
                onCheckout={() => setCheckoutOpen(true)}
            />

            {/* Barra fixa do carrinho no mobile */}
            {totalItems > 0 && (
                <div className="fixed bottom-0 left-0 right-0 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white border-t lg:hidden z-40">
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-14 font-bold text-lg"
                        onClick={() => setMobileCartOpen(true)}
                    >
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Ver carrinho ({totalItems}) - {formatCurrency(total, currency)}
                    </Button>
                </div>
            )}

            {/* Carrinho mobile (drawer) */}
            <Dialog open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
<DialogContent className="sm:max-w-md max-h-[85dvh] sm:max-h-none">
                    <DialogHeader>
                        <DialogTitle>Venda Rápida - Carrinho</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
                        {cart.length === 0 && <p className="text-center text-gray-500 py-6">Carrinho vazio.</p>}
                        {cart.map((item) => (
                            <div key={item.lineId} className="flex items-center gap-3 border-b pb-2">
                                {item.imageURL && (
                                    <img src={item.imageURL} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{item.title}</p>
                                    <p className="text-green-600 font-bold text-sm">
                                        {formatCurrency(item.price, currency)} x{item.quantity}
                                    </p>
                                    {item.adicionais && item.adicionais.length > 0 && (
                                        <p className="text-green-700 text-xs">+ {item.adicionais.map((a) => a.descricao).join(', ')}</p>
                                    )}
                                    <Input
                                        className="mt-1 h-8 text-xs"
                                        placeholder="Obs (ex.: sem salada)"
                                        value={item.notes || ''}
                                        onChange={(e) => setLineNotes(item.lineId, e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => decreaseLine(item.lineId)}>
                                        <Minus className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => removeLine(item.lineId)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center border-t pt-3">
                        <span className="font-bold">Total</span>
                        <span className="font-bold text-lg">{formatCurrency(total, currency)}</span>
                    </div>
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-14 font-bold"
                        onClick={() => {
                            setMobileCartOpen(false);
                            setCheckoutOpen(true);
                        }}
                        disabled={cart.length === 0}
                    >
                        Finalizar venda
                    </Button>
                </DialogContent>
            </Dialog>

            <CheckoutDialog
                open={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                total={total}
                currency={currency}
                onFinish={finish}
            />

            {/* Confirmação do recebimento */}
            <Dialog open={recebimentoConfirmado} onOpenChange={setRecebimentoConfirmado}>
                <DialogContent className="sm:max-w-sm">
                    <div className="flex flex-col items-center text-center gap-2">
                        <CheckCircle2 className="h-14 w-14 text-green-600" />
                        <DialogHeader>
                            <DialogTitle>Recebimento confirmado</DialogTitle>
                        </DialogHeader>
                        <p className="text-gray-600">Venda registrada no caixa com sucesso.</p>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(total, currency)}</p>
                        {calcularTroco(total, ultimosPagamentos) > 0 && (
                            <p className="text-sm text-blue-700 bg-blue-50 w-full rounded-lg py-2 px-3">
                                Troco: <strong>{formatCurrency(calcularTroco(total, ultimosPagamentos), currency)}</strong>
                            </p>
                        )}
                        <Button
                            variant="outline"
                            className="w-full h-12 font-bold mt-1"
                            onClick={() =>
                                printReceipt({
                                    heading: 'Comprovante de Venda - PDV',
                                    restaurantName: useDataStore.getState().config.geralData.restaurantName || 'Restaurante',
                                    meta: [
                                        {
                                            label: 'Forma(s)',
                                            value: ultimosPagamentos
                                                .map(
                                                    (p) =>
                                                        `${paymentMethodLabel[p.metodo]}${
                                                            p.clienteNome ? ` (${p.clienteNome})` : ''
                                                        }`
                                                )
                                                .join(' + '),
                                        },
                                    ],
                                    items: cart.map((i) => ({
                                        title: i.title,
                                        quantity: i.quantity,
                                        price: i.price,
                                        note: i.notes,
                                        addons:
                                            i.adicionais && i.adicionais.length
                                                ? i.adicionais.map((a) => ({ descricao: a.descricao, valor: a.valor }))
                                                : undefined,
                                    })),
                                    subtotal,
                                    taxLabel: `Taxa de serviço: ${taxRate}%`,
                                    tax,
                                    total,
                                    payment: {
                                        label: 'Pago',
                                        paid: sumPagamentos(ultimosPagamentos),
                                        change: calcularTroco(total, ultimosPagamentos),
                                    },
                                    footer: 'Obrigado pela preferência!',
                                })
                            }
                        >
                            Imprimir recibo
                        </Button>
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold mt-2"
                            onClick={() => {
                                setRecebimentoConfirmado(false);
                                clearCart();
                            }}
                        >
                            OK
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ProdutoOpcoesModal
                open={opcoesFood != null}
                onOpenChange={(o) => !o && setOpcoesFood(null)}
                food={opcoesFood}
                onConfirm={(r) => opcoesFood && addLine(opcoesFood, r)}
            />
        </div>
    );
}

function CartSidebar({
    cart,
    subtotal,
    tax,
    total,
    totalItems,
    currency,
    taxRate,
    onDecreaseLine,
    onRemoveLine,
    onNotesLine,
    onClear,
    onCheckout,
}: {
    cart: PDVCartLine[];
    subtotal: number;
    tax: number;
    total: number;
    totalItems: number;
    currency: string;
    taxRate: number;
    onDecreaseLine: (lineId: string) => void;
    onRemoveLine: (lineId: string) => void;
    onNotesLine: (lineId: string, notes: string) => void;
    onClear: () => void;
    onCheckout: () => void;
}) {
    return (
        <div className="hidden lg:flex w-96 shrink-0 bg-white border rounded-lg flex-col h-full">
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-green-600" />
                    Carrinho
                </h2>
                <Button variant="ghost" size="icon" onClick={onClear} disabled={cart.length === 0}>
                    <Trash2 className="h-5 w-5 text-red-600" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 && (
                    <p className="text-center text-gray-500 py-10">
                        Carrinho vazio.
                        <br />
                        Toque nos produtos para adicionar.
                    </p>
                )}
                {cart.map((item) => (
                    <div key={item.lineId} className="flex items-center gap-3">
                        {item.imageURL && (
                            <img src={item.imageURL} alt="" className="w-14 h-14 rounded-lg object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-green-600 font-bold text-sm">
                                {formatCurrency(item.price, currency)}
                            </p>
                            {item.adicionais && item.adicionais.length > 0 && (
                                <p className="text-green-700 text-xs">+ {item.adicionais.map((a) => a.descricao).join(', ')}</p>
                            )}
                            <Input
                                className="mt-1 h-8 text-xs"
                                placeholder="Obs (ex.: sem salada)"
                                value={item.notes || ''}
                                onChange={(e) => onNotesLine(item.lineId, e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => onDecreaseLine(item.lineId)}>
                                <Minus className="h-4 w-4" />
                            </Button>
                            <span className="font-bold w-7 text-center">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => onRemoveLine(item.lineId)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="border-t p-4 space-y-2">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span>{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Taxa de serviço: {taxRate}%</span>
                    <span>{formatCurrency(tax, currency)}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total, currency)}</span>
                </div>
                <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 font-bold text-lg"
                    onClick={onCheckout}
                    disabled={cart.length === 0}
                >
                    Finalizar venda ({totalItems})
                </Button>
            </div>
        </div>
    );
}

function CheckoutDialog({
    open,
    onOpenChange,
    total,
    currency,
    onFinish,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    total: number;
    currency: string;
    onFinish: (pagamentos: VendaPagamentoType[], consumidorCpfCnpj?: string) => void;
}) {
    const clientes = useDataStore((state) => state.clientes);
    const [pagamentos, setPagamentos] = useState<VendaPagamentoType[]>([]);
    const [consumidorCpfCnpj, setConsumidorCpfCnpj] = useState('');

    const clientesCarteira = clientes.filter((c) => c.carteiraHabilitada);
    const pagamentoCompleto = isPaymentSplitComplete(total, pagamentos);

    const handleFinish = () => {
        if (!pagamentoCompleto) return;
        onFinish(pagamentos, consumidorCpfCnpj.trim() || undefined);
        setPagamentos([]);
        setConsumidorCpfCnpj('');
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                onOpenChange(next);
                if (next) {
                    setPagamentos([]);
                    setConsumidorCpfCnpj('');
                }
            }}
        >
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Finalizar venda</DialogTitle>
                </DialogHeader>
                <PaymentSplitEditor
                    total={total}
                    currency={currency}
                    clientesFiado={clientesCarteira}
                    onChange={setPagamentos}
                    showConsumidor
                    consumidorCpfCnpj={consumidorCpfCnpj}
                    onConsumidorChange={setConsumidorCpfCnpj}
                />
                {calcularTroco(total, pagamentos) > 0 && (
                    <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                        Troco: <strong>{formatCurrency(calcularTroco(total, pagamentos), currency)}</strong>
                    </p>
                )}
                <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 font-bold text-lg"
                    onClick={handleFinish}
                    disabled={!pagamentoCompleto}
                >
                    Confirmar recebimento
                </Button>
            </DialogContent>
        </Dialog>
    );
}
