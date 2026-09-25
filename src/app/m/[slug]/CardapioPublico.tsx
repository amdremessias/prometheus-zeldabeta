'use client';

import { useMemo, useState } from 'react';
import { ShoppingBag, Minus, Plus, MapPin, Phone, CheckCircle2, Loader2 } from 'lucide-react';
import type { MenuPublico, MenuPublicoItem } from '@/lib/server/cardapioDigital';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { PublicBrandingImage } from '@/shared/components/PublicBrandingImage';
import { ProdutoOpcoesModal, ProdutoOpcoesResult } from '@/shared/components/ProdutoOpcoesModal';

type AdicionalSelecionado = { id: number; descricao: string; valor: number };
type CartLine = {
    lineId: string;
    id: number;
    title: string;
    price: number;
    quantity: number;
    notes?: string;
    adicionais?: AdicionalSelecionado[];
};

let lineSeq = 1;

export function CardapioPublico({ slug, menu }: { slug: string; menu: MenuPublico }) {
    const currency = menu.currency || 'BRL';
    const [categoria, setCategoria] = useState<string | number>('todos');
    const [cart, setCart] = useState<CartLine[]>([]);
    const [abrirCarrinho, setAbrirCarrinho] = useState(false);

    const [opcoesPrato, setOpcoesPrato] = useState<MenuPublicoItem | null>(null);

    const [cliente, setCliente] = useState('');
    const [telefone, setTelefone] = useState('');
    const [endereco, setEndereco] = useState('');
    const [taxaId, setTaxaId] = useState<number | undefined>(undefined);
    const [pagamento, setPagamento] = useState<'dinheiro' | 'cartao' | 'pix'>('pix');

    const [aceitePrivacidade, setAceitePrivacidade] = useState(false);
    const [cadastroCliente, setCadastroCliente] = useState<'' | 'sim' | 'nao' | 'existente'>('');

    const [enviando, setEnviando] = useState(false);
    const [erro, setErro] = useState('');
    const [sucesso, setSucesso] = useState(false);

    const pratos = useMemo(
        () =>
            categoria === 'todos'
                ? menu.pratos
                : menu.pratos.filter((p) => p.category.includes(categoria as unknown as number)),
        [categoria, menu.pratos]
    );

    const quantidade = (id: number) => cart.filter((c) => c.id === id).reduce((s, c) => s + c.quantity, 0);

    const abrirOpcoes = (prato: MenuPublicoItem) => {
        setOpcoesPrato(prato);
    };

    const confirmarOpcoes = (result: ProdutoOpcoesResult) => {
        if (!opcoesPrato) return;
        const adicionais = result.adicionais;
        const adicionaisValor = adicionais.reduce((s, a) => s + a.valor, 0);
        setCart((prev) => [
            ...prev,
            {
                lineId: `l${lineSeq++}`,
                id: opcoesPrato.id,
                title: opcoesPrato.title,
                price: opcoesPrato.price + adicionaisValor,
                quantity: result.quantity,
                notes: result.notes || undefined,
                adicionais: adicionais.length ? adicionais : undefined,
            },
        ]);
        setOpcoesPrato(null);
    };

    const incLine = (lineId: string) =>
        setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + 1 } : l)));
    const decLine = (lineId: string) =>
        setCart((prev) =>
            prev
                .map((l) => (l.lineId === lineId ? { ...l, quantity: Math.max(0, l.quantity - 1) } : l))
                .filter((l) => l.quantity > 0)
        );
    const setLineNotes = (lineId: string, notes: string) =>
        setCart((prev) => prev.map((l) => (l.lineId === lineId ? { ...l, notes } : l)));

    const subtotal = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);
    const taxa = menu.taxasEntrega.find((t) => t.id === taxaId);
    const taxaValor = taxa ? taxa.valor : 0;
    const total = subtotal + taxaValor;

    const finalizar = async () => {
        setErro('');
        if (cart.length === 0) {
            setErro('Seu carrinho está vazio.');
            return;
        }
        if (!cliente.trim() || !telefone.trim()) {
            setErro('Informe seu nome e telefone para o pedido.');
            return;
        }
        if (!aceitePrivacidade) {
            setErro('É necessário aceitar as políticas de privacidade.');
            return;
        }
        if (taxaId && !endereco.trim()) {
            setErro('Informe o endereço de entrega para pedidos com taxa de entrega.');
            return;
        }
        if (!cadastroCliente) {
            setErro('Selecione uma opção sobre o cadastro dos seus dados.');
            return;
        }

        setEnviando(true);
        try {
            const res = await fetch(`/api/cardapio-digital/${slug}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cliente,
                    telefone,
                    endereco,
                    pagamento,
                    taxaEntregaId: taxaId,
                    modoEntrega: taxaId ? 'entrega' : 'retirada',
                    itens: cart.map((c) => ({
                        id: c.id,
                        quantity: c.quantity,
                        notes: c.notes || '',
                        adicionais: c.adicionais ? c.adicionais.map((a) => ({ id: a.id })) : undefined,
                    })),
                    aceitePrivacidade,
                    cadastroCliente,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setErro(data.error ?? 'Não foi possível enviar o pedido.');
                return;
            }
            setSucesso(true);
            setCart([]);
        } catch {
            setErro('Falha de conexão. Tente novamente.');
        } finally {
            setEnviando(false);
        }
    };

    if (sucesso) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-gray-50">
                <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
                <h1 className="text-2xl font-bold text-gray-800">Pedido enviado!</h1>
                <p className="text-gray-600 mt-2 max-w-md">
                    Seu pedido foi recebido. Aguarde a confirmação do restaurante pelo telefone informado.
                </p>
                <button
                    className="mt-6 bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg"
                    onClick={() => setSucesso(false)}
                >
                    Fazer novo pedido
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-28">
            {/* Cabeçalho */}
            <header className="bg-green-700 text-white">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
                    <PublicBrandingImage
                        kind="logo"
                        fallback="/logo.svg"
                        alt={menu.restaurantName || 'Logo'}
                        className="h-12 w-12 object-contain bg-white rounded-lg p-1"
                    />
                    <div>
                        <h1 className="text-2xl font-bold leading-tight">{menu.restaurantName || 'Cardápio Digital'}</h1>
                        {menu.address && (
                            <p className="text-green-100 text-sm mt-0.5 flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {menu.address}
                            </p>
                        )}
                        {menu.phone && (
                            <p className="text-green-100 text-sm mt-0.5 flex items-center gap-1">
                                <Phone className="h-3 w-3" /> {menu.phone}
                            </p>
                        )}
                    </div>
                </div>
            </header>

            {/* Categorias */}
            <div className="sticky top-0 bg-gray-50 z-10 border-b">
                <div className="max-w-4xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto">
                    <button
                        className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                            categoria === 'todos' ? 'bg-green-700 text-white' : 'bg-white border text-gray-700'
                        }`}
                        onClick={() => setCategoria('todos')}
                    >
                        Todos
                    </button>
                    {menu.categorias.map((cat) => (
                        <button
                            key={cat.id}
                            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                                categoria === cat.id ? 'bg-green-700 text-white' : 'bg-white border text-gray-700'
                            }`}
                            onClick={() => setCategoria(cat.id)}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Produtos */}
            <main className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                {pratos.map((prato) => {
                    const qtd = quantidade(prato.id);
                    return (
                        <div key={prato.id} className="bg-white rounded-xl overflow-hidden shadow-sm border">
                            <div className="relative">
                                {prato.imageData ? (
                                    <img
                                        src={prato.imageData}
                                        alt={prato.title}
                                        className="w-full h-36 object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-36 bg-gray-200 flex items-center justify-center text-gray-400">
                                        Sem imagem
                                    </div>
                                )}
                                {prato.discount ? (
                                    <span className="absolute top-2 left-2 bg-yellow-400 text-black px-2 py-1 rounded-md text-xs font-medium">
                                        {prato.discount}% off
                                    </span>
                                ) : null}
                            </div>
                            <div className="p-3">
                                <h3 className="text-sm font-semibold text-gray-800">{prato.title}</h3>
                                <p className="text-green-700 font-bold mt-1">
                                    {formatCurrency(prato.price, currency)}
                                </p>
                                <div className="flex items-center justify-between mt-3">
                                    <button
                                        className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-semibold py-2 rounded-lg flex items-center justify-center gap-1"
                                        onClick={() => abrirOpcoes(prato)}
                                    >
                                        {qtd > 0 && <span className="text-xs bg-white/25 rounded-full px-1.5">{qtd}</span>}
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {pratos.length === 0 && (
                    <p className="col-span-full text-center text-gray-500 py-10">
                        Nenhum item nesta categoria.
                    </p>
                )}
            </main>

            {/* Selo de segurança (parte inferior da tela) */}
            <footer className="max-w-4xl mx-auto px-4 py-8 flex flex-col items-center text-center">
                <PublicBrandingImage
                    kind="selo"
                    fallback="/csi2_selo_seguranca_transparente.png"
                    alt="Selo de Segurança do Sistema"
                    className="h-20 w-20 object-contain"
                />
                <p className="mt-2 text-xs text-gray-500 max-w-xs">
                    Ambiente seguro. Seus dados são tratados conforme a Política de Privacidade.
                </p>
            </footer>

            {/* Botão flutuante do carrinho */}
            <div className="fixed bottom-0 inset-x-0 bg-white border-t p-3">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                    <button
                        className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                        onClick={() => setAbrirCarrinho(true)}
                    >
                        <ShoppingBag className="h-5 w-5" />
                        Ver carrinho ({cart.reduce((s, c) => s + c.quantity, 0)})
                    </button>
                    <span className="font-bold text-gray-800">{formatCurrency(total, currency)}</span>
                </div>
            </div>

            {/* Drawer do carrinho */}
            {abrirCarrinho && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
                    <div className="bg-white w-full max-w-md h-full overflow-y-auto flex flex-col">
                        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white">
                            <h2 className="font-bold text-lg">Seu pedido</h2>
                            <button onClick={() => setAbrirCarrinho(false)} className="text-gray-500 font-bold px-2">
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 p-4 space-y-3">
                            {cart.length === 0 && (
                                <p className="text-gray-500 text-center py-8">Seu carrinho está vazio.</p>
                            )}
                            {cart.map((item) => (
                                <div key={item.lineId} className="border rounded-lg p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-sm">{item.title}</p>
                                            <p className="text-gray-500 text-xs">
                                                {item.quantity} x {formatCurrency(item.price, currency)}
                                            </p>
                                            {item.adicionais && item.adicionais.length > 0 && (
                                                <p className="text-green-700 text-xs mt-0.5">
                                                    + {item.adicionais.map((a) => a.descricao).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => decLine(item.lineId)} className="text-gray-500">
                                                <Minus className="h-4 w-4" />
                                            </button>
                                            <span className="font-semibold text-sm">{item.quantity}</span>
                                            <button onClick={() => incLine(item.lineId)} className="text-gray-500">
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        className="mt-2 w-full border rounded-lg px-3 py-2 text-sm"
                                        placeholder="Observação (ex.: sem cebola)"
                                        value={item.notes || ''}
                                        onChange={(e) => setLineNotes(item.lineId, e.target.value)}
                                    />
                                </div>
                            ))}

                            {cart.length > 0 && (
                                <>
                                    <div className="pt-3 space-y-2 border-t">
                                        <Label>Seu nome *</Label>
                                        <input
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                            value={cliente}
                                            onChange={(e) => setCliente(e.target.value)}
                                            placeholder="Ex.: João da Silva"
                                        />
                                        <Label>Telefone *</Label>
                                        <input
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                            value={telefone}
                                            onChange={(e) => setTelefone(e.target.value)}
                                            placeholder="(11) 99999-9999"
                                        />
                                        <Label>Endereço de entrega</Label>
                                        <input
                                            className="w-full border rounded-lg px-3 py-2 text-sm"
                                            value={endereco}
                                            onChange={(e) => setEndereco(e.target.value)}
                                            placeholder="Rua, número, bairro..."
                                        />
                                        <Label>Taxa de entrega</Label>
                                        <select
                                            className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
                                            value={taxaId ?? ''}
                                            onChange={(e) => setTaxaId(e.target.value ? Number(e.target.value) : undefined)}
                                        >
                                            <option value="">Retirada no local (sem taxa)</option>
                                            {menu.taxasEntrega.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.nome} — {formatCurrency(t.valor, currency)}
                                                </option>
                                            ))}
                                        </select>
                                        <Label>Pagamento</Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['dinheiro', 'cartao', 'pix'] as const).map((m) => (
                                                <button
                                                    key={m}
                                                    className={`border rounded-lg py-2 text-sm font-medium capitalize ${
                                                        pagamento === m ? 'bg-green-700 text-white border-green-700' : 'text-gray-700'
                                                    }`}
                                                    onClick={() => setPagamento(m)}
                                                >
                                                    {m === 'cartao' ? 'Cartão' : m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="border-t pt-3 space-y-1 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Subtotal</span>
                                            <span>{formatCurrency(subtotal, currency)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-500">Taxa de entrega</span>
                                            <span>{formatCurrency(taxaValor, currency)}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-base">
                                            <span>Total</span>
                                            <span>{formatCurrency(total, currency)}</span>
                                        </div>
                                    </div>

                                    {/* Consentimento e cadastro de cliente */}
                                    <div className="border-t pt-3 space-y-3">
                                        <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="mt-0.5 h-4 w-4 accent-green-700"
                                                checked={aceitePrivacidade}
                                                onChange={(e) => setAceitePrivacidade(e.target.checked)}
                                            />
                                            <span>
                                                Li e aceito a <span className="font-semibold">Política de Privacidade</span> e
                                                o tratamento dos meus dados para este pedido.
                                            </span>
                                        </label>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-600 mb-2">
                                                Deseja que seus dados sejam armazenados no cadastro de clientes?
                                            </p>
                                            <div className="grid grid-cols-1 gap-2">
                                                {(
                                                    [
                                                        { value: 'sim', label: 'Sim, quero me cadastrar', desc: 'Seus dados serão salvos como Novo Cliente - Cardápio Digital.' },
                                                        { value: 'nao', label: 'Não desejo cadastrar', desc: 'Seus dados não serão armazenados.' },
                                                        { value: 'existente', label: 'Já sou cliente', desc: 'Não será criado um novo cadastro.' },
                                                    ] as const
                                                ).map((opt) => (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setCadastroCliente(opt.value)}
                                                        className={`text-left border rounded-lg px-3 py-2 transition-colors ${
                                                            cadastroCliente === opt.value
                                                                ? 'border-green-700 bg-green-50 ring-1 ring-green-700'
                                                                : 'border-gray-200 bg-white hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                                                            <span
                                                                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                                                    cadastroCliente === opt.value ? 'border-green-700' : 'border-gray-300'
                                                                }`}
                                                            >
                                                                {cadastroCliente === opt.value && (
                                                                    <span className="h-2 w-2 rounded-full bg-green-700" />
                                                                )}
                                                            </span>
                                                            {opt.label}
                                                        </span>
                                                        <span className="block text-xs text-gray-500 mt-0.5 pl-6">{opt.desc}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {erro && <p className="text-red-600 text-sm">{erro}</p>}

                                    <button
                                        className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
                                        onClick={finalizar}
                                        disabled={enviando}
                                    >
                                        {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                                        Finalizar pedido
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de opções do produto (quantidade, observação e adicionais) — reutiliza o modal padrão */}
            {opcoesPrato && (
                <ProdutoOpcoesModal
                    open={!!opcoesPrato}
                    onOpenChange={(o) => {
                        if (!o) setOpcoesPrato(null);
                    }}
                    food={{
                        id: opcoesPrato.id,
                        title: opcoesPrato.title,
                        imageURL: opcoesPrato.imageData ?? undefined,
                        adicionaisDisponiveis: opcoesPrato.adicionaisDisponiveis ?? [],
                    }}
                    adicionais={menu.adicionais}
                    onConfirm={confirmarOpcoes}
                />
            )}
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return <label className="block text-xs font-semibold text-gray-600 mb-1">{children}</label>;
}
