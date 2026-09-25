'use client';
import { OperationalReportPrints } from './OperationalReportPrints';
import { useMemo, useState } from 'react';
import {
    ArrowDownCircle,
    ArrowUpCircle,
    Wallet,
    Users,
    TrendingUp,
    Search,
    Banknote,
    CalendarClock,
    User,
    ListOrdered,
    UtensilsCrossed,
    History,
    Ban,
    Boxes,
    AlertTriangle,
    PackagePlus,
} from 'lucide-react';
import {
    Button,
    Card,
    CardContent,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { can } from '@/lib/permissions';
import { showMessage } from '@/store/popupStore';
import { formatCurrency, formatDateTimeBR } from '@/shared/lib/numberUtils';
import { ClientePaymentDialog } from '@/modules/clientes/ClientePaymentDialog';
import { CancelarVenda } from '@/modules/caixa/vendaActions';
import { AjustarEstoqueManual } from '@/modules/estoque/estoqueActions';
import { Printer, Smartphone, Store, Truck } from 'lucide-react';
import { useEffect } from 'react';

const methodLabel: Record<VendaType['metodo'], string> = {
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    pix: 'Pix',
    fiado: 'Fiado',
};

export function RelatoriosScreen() {
    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';

    return (
        <Tabs defaultValue="caixa" className="w-full">
            <TabsList className="mb-4 flex gap-2 overflow-x-auto pb-1 flex-nowrap">
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="caixa">Caixa</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="movimentacao">Movimentação</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="carteira">Carteira (Fiado)</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="estoque">Estoque</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="cardapio-digital">Cardápio Digital</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="mesa-cartao">Mesa/Cartão</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="chatwpp">ChatWPP</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="impressao-operacional">Impressões</TabsTrigger>
                <TabsTrigger className="shrink-0 whitespace-nowrap" value="entregas">Entregas</TabsTrigger>
            </TabsList>
            <TabsContent value="caixa">
                <CaixaReport currency={currency} />
            </TabsContent>
            <TabsContent value="movimentacao">
                <MovimentacaoReport currency={currency} />
            </TabsContent>
            <TabsContent value="carteira">
                <CarteiraReport currency={currency} />
            </TabsContent>
            <TabsContent value="estoque">
                <EstoqueReport />
            </TabsContent>
            <TabsContent value="cardapio-digital">
                <CardapioDigitalReport currency={currency} />
            </TabsContent>
            <TabsContent value="mesa-cartao">
                <MesaCartaoReport currency={currency} />
            </TabsContent>
            <TabsContent value="chatwpp">
                <div className="rounded-lg border bg-white p-4"><h2 className="text-xl font-semibold">ChatWPP</h2><p className="mt-1 text-sm text-slate-500">Pedidos e atendimentos recebidos pela automação do WhatsApp.</p></div>
            </TabsContent>
            <TabsContent value="impressao-operacional">
                <OperationalReportPrints />
            </TabsContent>
            <TabsContent value="entregas">
                <EntregasReport currency={currency} />
            </TabsContent>
        </Tabs>
    );
}

function CaixaReport({ currency }: { currency: string }) {
    const caixa = useDataStore((state) => state.caixa);
    const transacoes = useDataStore((state) => state.contabilidade.transacoes);
    const vendas = useDataStore((state) => state.vendas);
    const pratos = useDataStore((state) => state.cardapio.pratos);

    const isOpen = caixa.status === 'aberto';

    // Movimento do caixa atual: transações/vendas a partir da abertura.
    const limite = useMemo(() => {
        if (!isOpen || !caixa.openedAt) return null;
        const d = new Date(caixa.openedAt);
        return isNaN(d.getTime()) ? null : d;
    }, [isOpen, caixa.openedAt]);

    const transacoesCaixa = useMemo(() => {
        if (!limite) return [];
        return transacoes.filter((tx) => {
            const d = new Date(tx.date);
            return !isNaN(d.getTime()) && d >= limite;
        });
    }, [limite, transacoes]);

    const vendasCaixa = useMemo(() => {
        if (!limite) return [];
        return vendas.filter((v) => {
            const d = new Date(v.date);
            return !isNaN(d.getTime()) && d >= limite;
        });
    }, [limite, vendas]);

    // Contagem de produtos vendidos no caixa aberto
    const produtosVendidos = useMemo(() => {
const map = new Map<number, number>();
        vendasCaixa.forEach((venda) => {
            venda.items.forEach((item) => {
                const qty = Number(item.quantity);
                if (qty > 0 && typeof item.title === 'string') {
                    map.set(item.foodId, (map.get(item.foodId) || 0) + qty);
                }
            });
        });
        return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    }, [vendasCaixa]);

    const entradas = transacoesCaixa.filter((t) => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
    const saidas = transacoesCaixa.filter((t) => t.type === 'saída').reduce((a, t) => a + t.amount, 0);
    const previsao = caixa.initialAmount + entradas - saidas;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Wallet className={`h-8 w-8 ${isOpen ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                            <p className="text-sm text-gray-500">Status do caixa</p>
                            <p className={`text-xl font-bold ${isOpen ? 'text-green-600' : 'text-red-600'}`}>
                                {isOpen ? 'Aberto' : 'Fechado'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <CalendarClock className="h-8 w-8 text-green-600" />
                        <div className="min-w-0">
                            <p className="text-sm text-gray-500">Abertura</p>
                            <p className="text-sm font-bold">{caixa.openedAt ? formatDateTimeBR(caixa.openedAt) : '-'}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <User className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Aberto por</p>
                            <p className="text-lg font-bold">{caixa.openedBy || '-'}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Valor inicial</p>
                            <p className="text-xl font-bold">{formatCurrency(caixa.initialAmount, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {isOpen ? (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <ArrowUpCircle className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="text-sm text-gray-500">Entradas do caixa</p>
                                    <p className="text-xl font-bold text-green-600">{formatCurrency(entradas, currency)}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <ArrowDownCircle className="h-8 w-8 text-red-600" />
                                <div>
                                    <p className="text-sm text-gray-500">Saídas do caixa</p>
                                    <p className="text-xl font-bold text-red-600">{formatCurrency(saidas, currency)}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 flex items-center gap-3">
                                <TrendingUp className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="text-sm text-gray-500">Previsão no caixa</p>
                                    <p className="text-xl font-bold">{formatCurrency(previsao, currency)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mt-4">
                        <h4 className="font-semibold mb-2">Produtos vendidos no caixa aberto</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="p-3 text-left">Produto</th>
                                        <th className="p-3 text-right">Quantidade</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {produtosVendidos.map(([id, qty]) => {
                                        const p = pratos.find((p) => p.id === id);
                                        return (
<tr key={id} className="border-t">
    <td className="p-3">{pratos.find(p => p.id === id)?.title ?? '—'}</td>
    <td className="p-3 text-right">{qty}</td>
</tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-end mt-2">
                            <Button variant="outline" size="sm" onClick={() => window.print()}>Imprimir relatório</Button>
                        </div>
                    </div>
                </>
            ) : (
                <Card>
                    <CardContent className="p-4 space-y-2 text-sm">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <History className="h-5 w-5" />
                            Último fechamento
                        </h3>
                        {caixa.closedAt ? (
                            <>
                                <p className="text-gray-600">
                                    Fechado em {formatDateTimeBR(caixa.closedAt)} — Esperado{' '}
                                    {formatCurrency(caixa.expectedAmount ?? 0, currency)}, apurado{' '}
                                    {formatCurrency(caixa.finalAmount ?? 0, currency)} (diferença{' '}
                                    {formatCurrency(caixa.difference ?? 0, currency)}).
                                </p>
                                {caixa.notes && <p className="text-gray-500">Obs.: {caixa.notes}</p>}
                                {caixa.detail && (
                                    <MovimentacaoLista
                                        transacoes={caixa.detail.transacoes || []}
                                        vendas={caixa.detail.vendas || []}
                                        currency={currency}
                                    />
                                )}
                            </>
                        ) : (
                            <p className="text-gray-500">Nenhum caixa fechado ainda. Abra um caixa para registrar movimentações.</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

function MovimentacaoLista({
    transacoes,
    vendas,
    currency,
    onCancelarVenda,
}: {
    transacoes: TransactionsType[];
    vendas: VendaType[];
    currency: string;
    onCancelarVenda?: (vendaId: string) => boolean;
}) {
    const [cancelVenda, setCancelVenda] = useState<VendaType | null>(null);
    const totaisPorMetodo = useMemo(() => {
        const map = new Map<VendaPagamentoType['metodo'], number>();
        vendas.forEach((v) => {
            if (v.pagamentos?.length) {
                v.pagamentos.forEach((p) => map.set(p.metodo, (map.get(p.metodo) || 0) + (Number(p.valor) || 0)));
            } else {
                map.set(v.metodo, (map.get(v.metodo) || 0) + v.total);
            }
        });
        return Array.from(map.entries());
    }, [vendas]);

    return (
        <>
            <Card>
                <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                        <ListOrdered className="h-5 w-5" />
                        Movimentações do caixa ({transacoes.length})
                    </h3>
                    {transacoes.length === 0 && (
                        <p className="text-center text-gray-500 py-6">Nenhuma movimentação registrada neste caixa.</p>
                    )}
                    <div className="divide-y">
                        {transacoes.map((tx) => {
                            const d = new Date(tx.date);
                            const isEntrada = tx.type === 'entrada';
                            return (
                                <div key={tx.id} className="flex justify-between items-center py-2.5 gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{tx.description}</p>
                                        <p className="text-xs text-gray-500">
                                            {isNaN(d.getTime()) ? String(tx.date) : formatDateTimeBR(d)}
                                        </p>
                                    </div>
                                    <div className={`font-bold shrink-0 ${isEntrada ? 'text-green-600' : 'text-red-600'}`}>
                                        {isEntrada ? '+' : '-'}
                                        {formatCurrency(tx.amount, currency)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                        <UtensilsCrossed className="h-5 w-5" />
                        Vendas registradas ({vendas.length})
                    </h3>
                    {vendas.length === 0 && (
                        <p className="text-center text-gray-500 py-6">Nenhuma venda registrada neste caixa.</p>
                    )}

                    {totaisPorMetodo.length > 0 && (
                        <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {totaisPorMetodo.map(([metodo, total]) => (
                                <div key={metodo} className="rounded-md border p-2 text-center">
                                    <p className="text-xs text-gray-500">{methodLabel[metodo]}</p>
                                    <p className="font-bold">{formatCurrency(total, currency)}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="divide-y">
                        {vendas.map((venda) => (
                            <div key={venda.id} className="py-2.5">
                                <div className="flex justify-between items-start gap-2">
                                    <div>
                                        <p className="font-medium">
                                            {venda.origem} ·{' '}
                                            {venda.pagamentos?.length
                                                ? venda.pagamentos
                                                      .map(
                                                          (p) =>
                                                              `${methodLabel[p.metodo]} ${formatCurrency(
                                                                  Number(p.valor) || 0,
                                                                  currency
                                                              )}`
                                                      )
                                                      .join(' + ')
                                                : methodLabel[venda.metodo]}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {formatDateTimeBR(venda.date)}
                                            {venda.cliente ? ` · ${venda.cliente}` : ''}
                                        </p>
                                        <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                            {venda.items.map((item) => (
                                                <p key={item.foodId}>
                                                    {item.quantity} x {item.title} —{' '}
                                                    {formatCurrency(item.price * item.quantity, currency)}
                                                </p>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Subtotal {formatCurrency(venda.subtotal, currency)}
                                            {venda.taxa > 0 ? ` · taxa ${formatCurrency(venda.taxa, currency)}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <span className="font-semibold">{formatCurrency(venda.total, currency)}</span>
                                        {onCancelarVenda && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                                                onClick={() => setCancelVenda(venda)}
                                            >
                                                <Ban className="h-3.5 w-3.5" />
                                                Cancelar
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!cancelVenda} onOpenChange={(open) => !open && setCancelVenda(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancelar venda</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja cancelar esta venda?
                            {cancelVenda && (
                                <>
                                    <br />
                                    <strong>
                                        {cancelVenda.origem} · {formatCurrency(cancelVenda.total, currency)}
                                    </strong>
                                </>
                            )}
                            <br />
                            A venda será removida do caixa e o valor estornado (saída) por forma de pagamento. Se havia
                            fiado, o débito da carteira do cliente também é revertido.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setCancelVenda(null)}>
                            Voltar
                        </Button>
                        <Button
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 font-bold"
                            onClick={() => {
                                if (cancelVenda) {
                                    onCancelarVenda?.(cancelVenda.id);
                                    setCancelVenda(null);
                                }
                            }}
                        >
                            <Ban className="h-4 w-4 mr-2" />
                            Cancelar venda
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function MovimentacaoReport({ currency }: { currency: string }) {
    const transacoes = useDataStore((state) => state.contabilidade.transacoes);

    const [tipo, setTipo] = useState<'todas' | 'entrada' | 'saída'>('todas');
    const [search, setSearch] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const filtered = useMemo(() => {
        const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
        const to = toDate ? new Date(toDate + 'T23:59:59') : null;

        return transacoes.filter((tx) => {
            const d = new Date(tx.date);
            if (from && d < from) return false;
            if (to && d > to) return false;
            if (tipo !== 'todas' && tx.type !== tipo) return false;
            if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [transacoes, tipo, search, fromDate, toDate]);

    const totalEntradas = filtered.filter((t) => t.type === 'entrada').reduce((a, t) => a + t.amount, 0);
    const totalSaidas = filtered.filter((t) => t.type === 'saída').reduce((a, t) => a + t.amount, 0);
    const saldo = totalEntradas - totalSaidas;

    const hasFilter = tipo !== 'todas' || search !== '' || fromDate !== '' || toDate !== '';

    const clearFilters = () => {
        setTipo('todas');
        setSearch('');
        setFromDate('');
        setToDate('');
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Período inicial</Label>
                            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Período final</Label>
                            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas</SelectItem>
                                    <SelectItem value="entrada">Entradas</SelectItem>
                                    <SelectItem value="saída">Saídas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="relative flex-1">
                        <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Buscar por descrição..."
                            className="pl-10 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {hasFilter && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Limpar filtros
                        </Button>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <ArrowUpCircle className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Entradas</p>
                            <p className="text-xl font-bold">{formatCurrency(totalEntradas, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <ArrowDownCircle className="h-8 w-8 text-red-600" />
                        <div>
                            <p className="text-sm text-gray-500">Saídas</p>
                            <p className="text-xl font-bold">{formatCurrency(totalSaidas, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Saldo do período</p>
                            <p className={`text-xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(saldo, currency)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-2">Transações ({filtered.length})</h3>
                    {filtered.length === 0 && (
                        <p className="text-center text-gray-500 py-6">Nenhuma transação encontrada com os filtros atuais.</p>
                    )}
                    <div className="divide-y">
                        {filtered.map((tx) => {
                            const d = new Date(tx.date);
                            return (
                                <div key={tx.id} className="flex justify-between items-center py-3 gap-3">
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{tx.description}</p>
                                        <p className="text-sm text-gray-500">
                                            {isNaN(d.getTime()) ? String(tx.date) : formatDateTimeBR(d)}
                                        </p>
                                    </div>
                                    <div
                                        className={`font-bold shrink-0 ${
                                            tx.type === 'entrada' ? 'text-green-600' : 'text-red-600'
                                        }`}
                                    >
                                        {tx.type === 'entrada' ? '+' : '-'}
                                        {formatCurrency(tx.amount, currency)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function CarteiraReport({ currency }: { currency: string }) {
    const clientes = useDataStore((state) => state.clientes);
    const [paymentCliente, setPaymentCliente] = useState<ClienteType | null>(null);
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const comCarteira = clientes.filter((c) => c.carteiraHabilitada);

    const rows = useMemo(() => {
        const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
        const to = toDate ? new Date(toDate + 'T23:59:59') : null;

        return comCarteira.map((cliente) => {
            const movsNoPeriodo = cliente.movimentacoes.filter((mov) => {
                const d = new Date(mov.createdAt);
                if (from && d < from) return false;
                if (to && d > to) return false;
                return true;
            });

            const comprado = movsNoPeriodo.filter((m) => m.tipo === 'debito').reduce((a, m) => a + m.amount, 0);
            const pago = movsNoPeriodo.filter((m) => m.tipo === 'credito').reduce((a, m) => a + Math.abs(m.amount), 0);

            return { cliente, comprado, pago };
        });
    }, [comCarteira, fromDate, toDate]);

    const devendo = rows.filter((r) => r.cliente.saldo > 0);
    const totalAReceber = devendo.reduce((a, r) => a + r.cliente.saldo, 0);
    const maiorDevedor = devendo.sort((a, b) => b.cliente.saldo - a.cliente.saldo)[0];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Total a receber</p>
                            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalAReceber, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Users className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Clientes devendo</p>
                            <p className="text-2xl font-bold">{devendo.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Wallet className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Maior devedor</p>
                            <p className="text-base font-bold truncate">{maiorDevedor?.cliente.nome || '—'}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <h3 className="font-bold text-lg">Consulta de carteira por período</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Período inicial</Label>
                            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Período final</Label>
                            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {comCarteira.length === 0 && (
                <Card>
                    <CardContent className="p-10 text-center">
                        <h2 className="font-bold text-xl">
                            Nenhum cliente com carteira habilitada. Habilite a carteira (fiado) na aba Clientes.
                        </h2>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {rows.map(({ cliente, comprado, pago }) => (
                    <Card key={cliente.id}>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                    <h3 className="font-bold truncate">{cliente.nome}</h3>
                                    <p className="text-sm text-gray-500">{cliente.telefone}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-gray-500">Saldo</p>
                                    <p
                                        className={`font-bold text-lg ${
                                            cliente.saldo > 0 ? 'text-red-600' : 'text-green-600'
                                        }`}
                                    >
                                        {formatCurrency(cliente.saldo, currency)}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-gray-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-500">Comprado no período</p>
                                    <p className="font-bold text-red-600">{formatCurrency(comprado, currency)}</p>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-2 text-center">
                                    <p className="text-xs text-gray-500">Pago no período</p>
                                    <p className="font-bold text-green-600">{formatCurrency(pago, currency)}</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full h-11 gap-2"
                                onClick={() => setPaymentCliente(cliente)}
                                disabled={cliente.saldo <= 0}
                            >
                                <Banknote className="h-4 w-4" />
                                {cliente.saldo > 0 ? 'Registrar pagamento' : 'Saldo em dia'}
                            </Button>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <ClientePaymentDialog
                cliente={paymentCliente}
                onClose={() => setPaymentCliente(null)}
                currency={currency}
            />
        </div>
    );
}

/* Relatório de estoque: quantidade atual por produto, alerta de mínimo, previsão
   de compra (reposição até o mínimo) e ajuste manual de estoque. */
function EstoqueReport() {
    const pratos = useDataStore((state) => state.cardapio.pratos);
    const categorias = useDataStore((state) => state.cardapio.categorias);
    const role = useAuthStore((state) => state.user?.role);
    const podeAjustar = can(role, 'estoque');

    const [situacao, setSituacao] = useState<'todas' | 'repor' | 'zerado'>('todas');
    const [search, setSearch] = useState('');
    const [ajustar, setAjustar] = useState<CardapioFoodType | null>(null);
    const [novaQtd, setNovaQtd] = useState('');

    const comControle = useMemo(() => pratos.filter((p) => typeof p.estoqueAtual === 'number'), [pratos]);
    const semControle = pratos.length - comControle.length;

    const isLow = (p: CardapioFoodType) =>
        typeof p.estoqueMinimo === 'number' && (p.estoqueAtual ?? 0) <= p.estoqueMinimo;
    const isZero = (p: CardapioFoodType) => (p.estoqueAtual ?? 0) <= 0;

    const aRepor = comControle.filter(isLow);
    const zerados = comControle.filter(isZero);
    const totalUn = comControle.reduce((a, p) => a + (p.estoqueAtual ?? 0), 0);

    const filtered = useMemo(
        () =>
            comControle.filter((p) => {
                if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
                if (situacao === 'repor' && !isLow(p)) return false;
                if (situacao === 'zerado' && !isZero(p)) return false;
                return true;
            }),
        [comControle, search, situacao]
    );

    // Previsão de compra: quanto repor para voltar ao estoque mínimo.
    const sugestaoCompra = (p: CardapioFoodType): number | null =>
        typeof p.estoqueMinimo === 'number' && (p.estoqueAtual ?? 0) <= p.estoqueMinimo
            ? Math.max(0, p.estoqueMinimo - (p.estoqueAtual ?? 0))
            : null;

    const confirmarAjuste = () => {
        if (!ajustar) return;
        const qtd = Math.floor(Number(novaQtd));
        if (novaQtd.trim() === '' || !Number.isFinite(qtd)) {
            showMessage('Informe a quantidade contada (inteiro de 0 a 1.000.000).', 'error');
            return;
        }
        AjustarEstoqueManual(ajustar.id, qtd);
        setAjustar(null);
        setNovaQtd('');
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Boxes className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="text-sm text-gray-500">Itens controlados</p>
                            <p className="text-xl font-bold">{comControle.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className={`h-8 w-8 ${aRepor.length ? 'text-orange-500' : 'text-gray-300'}`} />
                        <div>
                            <p className="text-sm text-gray-500">Abaixo do mínimo</p>
                            <p className={`text-xl font-bold ${aRepor.length ? 'text-orange-600' : ''}`}>{aRepor.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className={`h-8 w-8 ${zerados.length ? 'text-red-500' : 'text-gray-300'}`} />
                        <div>
                            <p className="text-sm text-gray-500">Zerados</p>
                            <p className={`text-xl font-bold ${zerados.length ? 'text-red-600' : ''}`}>{zerados.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <PackagePlus className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Total em estoque</p>
                            <p className="text-xl font-bold">{totalUn} un.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search
                                size={20}
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                            />
                            <Input
                                type="text"
                                placeholder="Buscar produto..."
                                className="pl-10 w-full"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className="w-full sm:w-56">
                            <Select value={situacao} onValueChange={(v) => setSituacao(v as typeof situacao)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todos</SelectItem>
                                    <SelectItem value="repor">Abaixo do mínimo</SelectItem>
                                    <SelectItem value="zerado">Zerados</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    {semControle > 0 && (
                        <p className="text-sm text-gray-500">
                            {semControle} produto{semControle > 1 ? 's' : ''} sem controle de estoque (defina o
                            estoque atual/mínimo no cadastro do Cardápio).
                        </p>
                    )}
                </CardContent>
            </Card>

            {comControle.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center">
                        <Boxes className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h2 className="font-bold text-xl">
                            Nenhum produto com controle de estoque. Defina o estoque atual/mínimo no cadastro de
                            produtos.
                        </h2>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-4">
                        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                            <Boxes className="h-5 w-5" />
                            Estoque atual ({filtered.length})
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="text-left p-3">Produto</th>
                                        <th className="text-left p-3">Categoria</th>
                                        <th className="text-center p-3">Estoque atual</th>
                                        <th className="text-center p-3">Mínimo</th>
                                        <th className="text-center p-3">Situação</th>
                                        <th className="text-center p-3">Previsão de compra</th>
                                        <th className="text-right p-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((p) => {
                                        const low = isLow(p);
                                        const zero = isZero(p);
                                        const sugestao = sugestaoCompra(p);
                                        return (
                                            <tr key={p.id} className="border-t">
                                                <td className="p-3 font-medium">{p.title}</td>
                                                <td className="p-3">
                                                    {p.category
                                                        .map((id) => categorias.find((c) => c.id === id)?.label)
                                                        .filter(Boolean)
                                                        .join(', ') || '—'}
                                                </td>
                                                <td
                                                    className={`p-3 text-center font-bold ${
                                                        zero ? 'text-red-600' : low ? 'text-orange-600' : ''
                                                    }`}
                                                >
                                                    {p.estoqueAtual}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {typeof p.estoqueMinimo === 'number' ? p.estoqueMinimo : '—'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span
                                                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                            zero
                                                                ? 'bg-red-100 text-red-600'
                                                                : low
                                                                  ? 'bg-orange-100 text-orange-600'
                                                                  : 'bg-green-100 text-green-600'
                                                        }`}
                                                    >
                                                        {zero ? 'Zerado' : low ? 'Repor' : 'OK'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-medium">
                                                    {sugestao != null ? `${sugestao} un.` : '—'}
                                                </td>
                                                <td className="p-3 text-right">
                                                    {podeAjustar && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1 h-8"
                                                            onClick={() => {
                                                                setAjustar(p);
                                                                setNovaQtd(String(p.estoqueAtual ?? ''));
                                                            }}
                                                        >
                                                            <PackagePlus className="h-3.5 w-3.5" />
                                                            Ajustar
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {filtered.length === 0 && (
                            <p className="text-center text-gray-500 py-6">Nenhum produto com os filtros atuais.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            <Dialog open={!!ajustar} onOpenChange={(open) => !open && setAjustar(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Ajuste manual de estoque</DialogTitle>
                        <DialogDescription>
                            {ajustar && (
                                <>
                                    <strong>{ajustar.title}</strong> — estoque atual:{' '}
                                    <strong>{ajustar.estoqueAtual ?? 0} un.</strong>
                                    <br />
                                    Informe a quantidade real contada. O sistema passa a usar este valor sem baixa
                                    automática.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 pt-2">
                        <Label>Quantidade contada</Label>
                        <Input
                            type="number"
                            min={0}
                            value={novaQtd}
                            onChange={(e) => setNovaQtd(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setAjustar(null)}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white h-12 font-bold"
                            onClick={confirmarAjuste}
                        >
                            <PackagePlus className="h-4 w-4 mr-2" />
                            Confirmar ajuste
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* Relatório de Vendas do Cardápio Digital: lista todos os pedidos recebidos pelo
   cardápio digital (online), com dados do cliente, itens, total, status e data. */
function CardapioDigitalReport({ currency }: { currency: string }) {
    const [pedidos, setPedidos] = useState<PedidoWebType[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'todos' | PedidoWebType['status']>('todos');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const res = await fetch('/api/pedidos-web');
                if (mounted && res.ok) {
                    const data = await res.json();
                    setPedidos(data);
                }
            } catch {
                showMessage('Erro ao carregar pedidos do cardápio digital.', 'error');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const filtered = useMemo(() => {
        const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
        const to = toDate ? new Date(toDate + 'T23:59:59') : null;
        return pedidos.filter((p) => {
            const d = new Date(p.createdAt);
            if (from && d < from) return false;
            if (to && d > to) return false;
            if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
            if (search) {
                const s = search.toLowerCase();
                const match =
                    p.cliente.toLowerCase().includes(s) ||
                    p.telefone.toLowerCase().includes(s) ||
                    p.endereco.toLowerCase().includes(s);
                if (!match) return false;
            }
            return true;
        });
    }, [pedidos, search, statusFilter, fromDate, toDate]);

    const totalGeral = filtered.reduce((acc, p) => acc + p.total, 0);
    const qtdPedidos = filtered.length;
    const statusCounts = useMemo(() => {
        const map = new Map<PedidoWebType['status'], number>();
        filtered.forEach((p) => map.set(p.status, (map.get(p.status) || 0) + 1));
        return map;
    }, [filtered]);

    const statusLabel: Record<PedidoWebType['status'], string> = {
        pendente: 'Pendente',
        em_preparo: 'Em preparo',
        concluido: 'Concluído',
        cancelado: 'Cancelado',
    };

    const statusColor: Record<PedidoWebType['status'], string> = {
        pendente: 'bg-yellow-100 text-yellow-700',
        em_preparo: 'bg-blue-100 text-blue-700',
        concluido: 'bg-green-100 text-green-700',
        cancelado: 'bg-red-100 text-red-700',
    };

    const hasFilter = search !== '' || statusFilter !== 'todos' || fromDate !== '' || toDate !== '';
    const clearFilters = () => {
        setSearch('');
        setStatusFilter('todos');
        setFromDate('');
        setToDate('');
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Smartphone className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="text-sm text-gray-500">Pedidos no período</p>
                            <p className="text-xl font-bold">{qtdPedidos}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Faturamento total</p>
                            <p className="text-xl font-bold">{formatCurrency(totalGeral, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Ticket médio</p>
                            <p className="text-xl font-bold">
                                {formatCurrency(qtdPedidos > 0 ? totalGeral / qtdPedidos : 0, currency)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <ListOrdered className="h-8 w-8 text-orange-600" />
                        <div>
                            <p className="text-sm text-gray-500">Pendentes</p>
                            <p className="text-xl font-bold">{statusCounts.get('pendente') || 0}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Período inicial</Label>
                            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Período final</Label>
                            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={statusFilter}
                                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="em_preparo">Em preparo</SelectItem>
                                    <SelectItem value="concluido">Concluído</SelectItem>
                                    <SelectItem value="cancelado">Cancelado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="relative flex-1">
                        <Search
                            size={20}
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        />
                        <Input
                            type="text"
                            placeholder="Buscar por cliente, telefone ou endereço..."
                            className="pl-10 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {hasFilter && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Limpar filtros
                        </Button>
                    )}
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                            <Printer className="h-4 w-4" />
                            Imprimir relatório
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {loading ? (
                <Card>
                    <CardContent className="p-10 text-center text-gray-500">Carregando pedidos...</CardContent>
                </Card>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center">
                        <Smartphone className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h2 className="font-bold text-xl">Nenhum pedido encontrado com os filtros atuais.</h2>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((p) => (
                        <Card key={p.id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start gap-2 flex-wrap">
                                    <div>
                                        <p className="font-bold text-lg">{p.cliente}</p>
                                        <p className="text-sm text-gray-600">📞 {p.telefone}</p>
                                        <p className="text-sm text-gray-600">📍 {p.endereco}</p>
                                    </div>
                                    <div className="text-right space-y-1">
                                        <span
                                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                statusColor[p.status]
                                            }`}
                                        >
                                            {statusLabel[p.status]}
                                        </span>
                                        <p className="text-xs text-gray-500">
                                            {formatDateTimeBR(p.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                <div className="border-t pt-2">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">Itens do pedido:</p>
                                    {p.itens.map((item: { id: number; title: string; price: number; quantity: number }, idx: number) => (
                                        <div
                                            key={`${item.id}-${idx}`}
                                            className="flex justify-between text-sm py-0.5"
                                        >
                                            <span>
                                                {item.quantity}x {item.title}
                                            </span>
                                            <span className="text-gray-600">
                                                {formatCurrency(item.price * item.quantity, currency)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t pt-2 flex justify-between items-center flex-wrap gap-2">
                                    <div className="text-xs text-gray-500">
                                        <p>Pagamento: {p.pagamento}</p>
                                        {p.taxaEntregaNome && (
                                            <p>
                                                Taxa: {p.taxaEntregaNome} —{' '}
                                                {formatCurrency(p.taxaEntregaValor, currency)}
                                            </p>
                                        )}
                                        <p>Subtotal: {formatCurrency(p.subtotal, currency)}</p>
                                    </div>
                                    <p className="font-bold text-lg">{formatCurrency(p.total, currency)}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

/* Relatório de Vendas Mesa/Cartão: vendas feitas pelo atendimento em mesa ou no
   caixa (PDV/Cartão), com itens, método de pagamento, cliente e valores. */
function MesaCartaoReport({ currency }: { currency: string }) {
    const vendas = useDataStore((state) => state.vendas);
    const [search, setSearch] = useState('');
    const [metodoFilter, setMetodoFilter] = useState<'todos' | VendaType['metodo']>('todos');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const filtered = useMemo(() => {
        const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
        const to = toDate ? new Date(toDate + 'T23:59:59') : null;
        return vendas.filter((v) => {
            // Apenas vendas de mesa ou cartão
            const isMesaOrCartao =
                v.origem.toLowerCase().includes('mesa') ||
                v.origem.toLowerCase().includes('cartao') ||
                v.origem.toLowerCase().includes('cartão') ||
                v.origem.toLowerCase().includes('pdv') ||
                v.tipo === 'mesa' ||
                v.tipo === 'pdv';
            if (!isMesaOrCartao) return false;
            const d = new Date(v.date);
            if (from && d < from) return false;
            if (to && d > to) return false;
            if (metodoFilter !== 'todos') {
                const metodos = v.pagamentos?.length
                    ? v.pagamentos.map((p) => p.metodo)
                    : [v.metodo];
                if (!metodos.includes(metodoFilter)) return false;
            }
            if (search) {
                const s = search.toLowerCase();
                const match =
                    v.origem.toLowerCase().includes(s) ||
                    (v.cliente?.toLowerCase().includes(s) ?? false) ||
                    v.items.some((i) => i.title.toLowerCase().includes(s));
                if (!match) return false;
            }
            return true;
        });
    }, [vendas, search, metodoFilter, fromDate, toDate]);

    const totalGeral = filtered.reduce((acc, v) => acc + v.total, 0);
    const qtdVendas = filtered.length;
    const ticketMedio = qtdVendas > 0 ? totalGeral / qtdVendas : 0;
    const totaisPorMetodo = useMemo(() => {
        const map = new Map<VendaType['metodo'], number>();
        filtered.forEach((v) => {
            if (v.pagamentos?.length) {
                v.pagamentos.forEach((p) =>
                    map.set(p.metodo, (map.get(p.metodo) || 0) + (Number(p.valor) || 0))
                );
            } else {
                map.set(v.metodo, (map.get(v.metodo) || 0) + v.total);
            }
        });
        return Array.from(map.entries());
    }, [filtered]);

    const hasFilter =
        search !== '' || metodoFilter !== 'todos' || fromDate !== '' || toDate !== '';
    const clearFilters = () => {
        setSearch('');
        setMetodoFilter('todos');
        setFromDate('');
        setToDate('');
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Store className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="text-sm text-gray-500">Vendas no período</p>
                            <p className="text-xl font-bold">{qtdVendas}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Faturamento</p>
                            <p className="text-xl font-bold">{formatCurrency(totalGeral, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-orange-600" />
                        <div>
                            <p className="text-sm text-gray-500">Ticket médio</p>
                            <p className="text-xl font-bold">{formatCurrency(ticketMedio, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Período inicial</Label>
                            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Período final</Label>
                            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Método</Label>
                            <Select
                                value={metodoFilter}
                                onValueChange={(v) => setMetodoFilter(v as typeof metodoFilter)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="cartao">Cartão</SelectItem>
                                    <SelectItem value="pix">PIX</SelectItem>
                                    <SelectItem value="fiado">Fiado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="relative flex-1">
                        <Search
                            size={20}
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        />
                        <Input
                            type="text"
                            placeholder="Buscar por mesa, cliente ou item..."
                            className="pl-10 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {hasFilter && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Limpar filtros
                        </Button>
                    )}
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                            <Printer className="h-4 w-4" />
                            Imprimir relatório
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {totaisPorMetodo.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {totaisPorMetodo.map(([metodo, total]) => (
                        <div key={metodo} className="rounded-md border p-2 text-center">
                            <p className="text-xs text-gray-500">{methodLabel[metodo]}</p>
                            <p className="font-bold">{formatCurrency(total, currency)}</p>
                        </div>
                    ))}
                </div>
            )}

            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center">
                        <Store className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h2 className="font-bold text-xl">
                            Nenhuma venda de mesa/cartão encontrada com os filtros atuais.
                        </h2>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((v) => (
                        <Card key={v.id}>
                            <CardContent className="p-4 space-y-3">
                                <div className="flex justify-between items-start gap-2 flex-wrap">
                                    <div>
                                        <p className="font-bold text-lg">{v.origem}</p>
                                        <p className="text-sm text-gray-500">
                                            {formatDateTimeBR(v.date)}
                                            {v.cliente ? ` · ${v.cliente}` : ''}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            Pagamento:{' '}
                                            {v.pagamentos?.length
                                                ? v.pagamentos
                                                      .map(
                                                          (p) =>
                                                              `${methodLabel[p.metodo]} ${formatCurrency(
                                                                  Number(p.valor) || 0,
                                                                  currency
                                                              )}`
                                                      )
                                                      .join(' + ')
                                                : methodLabel[v.metodo]}
                                        </p>
                                    </div>
                                    <p className="font-bold text-lg">{formatCurrency(v.total, currency)}</p>
                                </div>
                                <div className="border-t pt-2">
                                    <p className="text-xs font-semibold text-gray-500 mb-1">Itens vendidos:</p>
                                    {v.items.map((item) => (
                                        <div
                                            key={item.foodId}
                                            className="flex justify-between text-sm py-0.5"
                                        >
                                            <span>
                                                {item.quantity}x {item.title}
                                            </span>
                                            <span className="text-gray-600">
                                                {formatCurrency(item.price * item.quantity, currency)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="border-t pt-2 text-xs text-gray-500 flex justify-between">
                                    <span>
                                        Subtotal: {formatCurrency(v.subtotal, currency)}
                                        {v.taxa > 0
                                            ? ` · Taxa: ${formatCurrency(v.taxa, currency)}`
                                            : ''}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}

/* Relatório de Pedidos de Entrega: lista todas as entregas com dados do cliente,
   endereço, itens, valor, status e entregador atribuído. */
function EntregasReport({ currency }: { currency: string }) {
    const entregas = useDataStore((state) => state.entrega);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<
        'todos' | 'pendente' | 'em_preparo' | 'em_andamento' | 'entregue'
    >('todos');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const getStatus = (e: DeliveryType): 'pendente' | 'em_preparo' | 'em_andamento' | 'entregue' => {
        if (e.deliveredAt) return 'entregue';
        if (e.dispatchedAt) return 'em_andamento';
        if (e.startedAt) return 'em_preparo';
        return 'pendente';
    };

    const filtered = useMemo(() => {
        const from = fromDate ? new Date(fromDate + 'T00:00:00') : null;
        const to = toDate ? new Date(toDate + 'T23:59:59') : null;
        return entregas.filter((e) => {
            const refDate = e.startedAt || e.deliveredAt || e.dispatchedAt || '';
            const d = refDate ? new Date(refDate) : null;
            if (from && d && d < from) return false;
            if (to && d && d > to) return false;
            if (statusFilter !== 'todos' && getStatus(e) !== statusFilter) return false;
            if (search) {
                const s = search.toLowerCase();
                const match =
                    (e.customer?.toLowerCase().includes(s) ?? false) ||
                    (e.phone?.toLowerCase().includes(s) ?? false) ||
                    (e.address?.toLowerCase().includes(s) ?? false) ||
                    (e.deliveryPerson?.toLowerCase().includes(s) ?? false);
                if (!match) return false;
            }
            return true;
        });
    }, [entregas, search, statusFilter, fromDate, toDate]);

    const totalGeral = filtered.reduce((acc, e) => acc + (e.payments?.total || 0), 0);
    const qtdEntregas = filtered.length;
    const ticketMedio = qtdEntregas > 0 ? totalGeral / qtdEntregas : 0;

    const statusLabel: Record<'pendente' | 'em_preparo' | 'em_andamento' | 'entregue', string> = {
        pendente: 'Pendente',
        em_preparo: 'Em preparo',
        em_andamento: 'Em andamento',
        entregue: 'Entregue',
    };

    const statusColor: Record<'pendente' | 'em_preparo' | 'em_andamento' | 'entregue', string> = {
        pendente: 'bg-yellow-100 text-yellow-700',
        em_preparo: 'bg-blue-100 text-blue-700',
        em_andamento: 'bg-orange-100 text-orange-700',
        entregue: 'bg-green-100 text-green-700',
    };

    const hasFilter =
        search !== '' || statusFilter !== 'todos' || fromDate !== '' || toDate !== '';
    const clearFilters = () => {
        setSearch('');
        setStatusFilter('todos');
        setFromDate('');
        setToDate('');
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Truck className="h-8 w-8 text-blue-600" />
                        <div>
                            <p className="text-sm text-gray-500">Entregas no período</p>
                            <p className="text-xl font-bold">{qtdEntregas}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Faturamento</p>
                            <p className="text-xl font-bold">{formatCurrency(totalGeral, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-orange-600" />
                        <div>
                            <p className="text-sm text-gray-500">Ticket médio</p>
                            <p className="text-xl font-bold">{formatCurrency(ticketMedio, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label>Período inicial</Label>
                            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Período final</Label>
                            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={statusFilter}
                                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="pendente">Pendente</SelectItem>
                                    <SelectItem value="em_preparo">Em preparo</SelectItem>
                                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                                    <SelectItem value="entregue">Entregue</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="relative flex-1">
                        <Search
                            size={20}
                            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                        />
                        <Input
                            type="text"
                            placeholder="Buscar por cliente, endereço ou entregador..."
                            className="pl-10 w-full"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {hasFilter && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Limpar filtros
                        </Button>
                    )}
                    <div className="flex justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1">
                            <Printer className="h-4 w-4" />
                            Imprimir relatório
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {filtered.length === 0 ? (
                <Card>
                    <CardContent className="p-10 text-center">
                        <Truck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <h2 className="font-bold text-xl">
                            Nenhuma entrega encontrada com os filtros atuais.
                        </h2>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {filtered.map((e) => {
                        const status = getStatus(e);
                        return (
                            <Card key={e.id}>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start gap-2 flex-wrap">
                                        <div>
                                            <p className="font-bold text-lg">{e.customer || '—'}</p>
                                            <p className="text-sm text-gray-600">📞 {e.phone || '—'}</p>
                                            <p className="text-sm text-gray-600">📍 {e.address || '—'}</p>
                                            {e.deliveryPerson && (
                                                <p className="text-sm text-blue-700 font-medium mt-1">
                                                    🛵 Entregador: {e.deliveryPerson}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right space-y-1">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    statusColor[status]
                                                }`}
                                            >
                                                {statusLabel[status]}
                                            </span>
                                            {e.startedAt && (
                                                <p className="text-xs text-gray-500">
                                                    Criado: {formatDateTimeBR(e.startedAt)}
                                                </p>
                                            )}
                                            {e.deliveredAt && (
                                                <p className="text-xs text-green-600">
                                                    Entregue: {formatDateTimeBR(e.deliveredAt)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {e.items && e.items.length > 0 && (
                                        <div className="border-t pt-2">
                                            <p className="text-xs font-semibold text-gray-500 mb-1">
                                                Itens da entrega:
                                            </p>
                                            {e.items.map((item, idx) => (
                                                <div
                                                    key={`${item.foodId}-${idx}`}
                                                    className="flex justify-between text-sm py-0.5"
                                                >
                                                    <span>
                                                        {item.quantity}x {item.title}
                                                    </span>
                                                    <span className="text-gray-600">
                                                        {formatCurrency(
                                                            item.price * item.quantity,
                                                            currency
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="border-t pt-2 flex justify-between items-center flex-wrap gap-2">
                                        <div className="text-xs text-gray-500">
                                            <p>
                                                Pagamento:{' '}
                                                {(() => {
                                                    const p = e.payments;
                                                    if (!p) return '—';
                                                    const itemsCount = p.items || 0;
                                                    return `${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'} · ${methodLabel[p.type] ?? p.type}`;
                                                })()}
                                            </p>
                                            {e.deliveryPhone && (
                                                <p>Contato entregador: {e.deliveryPhone}</p>
                                            )}
                                        </div>
                                        <p className="font-bold text-lg">
                                            {formatCurrency(e.payments?.total || 0, currency)}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}



