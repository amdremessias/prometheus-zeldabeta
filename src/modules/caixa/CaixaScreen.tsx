'use client';
import { useEffect, useMemo, useState } from 'react';
import {
    Wallet,
    Banknote,
    Printer,
    LockOpen,
    Lock,
    CalendarClock,
    User,
    History,
    ListOrdered,
    UtensilsCrossed,
    ArrowDownCircle,
    ArrowUpCircle,
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Button,
    Input,
    Label,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { showMessage } from '@/store/popupStore';
import { formatCurrency, formatDateTimeBR } from '@/shared/lib/numberUtils';
import { AbrirCaixa, FecharCaixa, ConsultarHistoricoCaixas } from './caixaActions';
import { RecordTransaction } from '../accounting/accountingActions';
import { printReceipt } from '@/shared/lib/printReceipt';
import { computeCaixaReport, buildCaixaReportHTML, buildCaixaReportLines } from '@/shared/lib/caixaReportPrint';

const methodLabel: Record<VendaType['metodo'], string> = {
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    pix: 'Pix',
    fiado: 'Fiado',
};

export function CaixaScreen() {
    const caixa = useDataStore((state) => state.caixa);
    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';
    const [valorInicial, setValorInicial] = useState('0');
    const [finalAmount, setFinalAmount] = useState('');
    const [obs, setObs] = useState('');
    const [historico, setHistorico] = useState<CaixaRowLike[]>([]);
    const [caixaSelecionado, setCaixaSelecionado] = useState<CaixaRowLike | null>(null);
    const [sangriaValor, setSangriaValor] = useState('');
    const [sangriaMotivo, setSangriaMotivo] = useState('');
    const [suprimentoValor, setSuprimentoValor] = useState('');
    const [suprimentoMotivo, setSuprimentoMotivo] = useState('');

    const isOpen = caixa.status === 'aberto';

    useEffect(() => {
        ConsultarHistoricoCaixas().then((rows) => setHistorico(rows));
    }, [caixa.closedAt]);

    const vendasHoje = useDataStore((state) =>
        state.contabilidade.transacoes.filter((tx) => {
            const d = new Date(tx.date);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        })
    );

    const entradas = vendasHoje.filter((tx) => tx.type === 'entrada').reduce((a, t) => a + t.amount, 0);
    const saidas = vendasHoje.filter((tx) => tx.type === 'saída').reduce((a, t) => a + t.amount, 0);
    const previsao = caixa.initialAmount + entradas - saidas;

    const handleAbrir = async () => {
        const valor = parseFloat(valorInicial.replace(/\./g, '').replace(',', '.')) || 0;
        if (valor < 0) return;
        if (await AbrirCaixa(valor)) {
            setValorInicial('0');
        }
    };

    const handleFechar = async () => {
        const valor = parseFloat(finalAmount.replace(/\./g, '').replace(',', '.')) || 0;
        if (valor < 0) return;
        if (await FecharCaixa(valor, obs.trim() || undefined)) {
            setFinalAmount('');
            setObs('');
        }
    };

    const handleImprimir = () => {
        if (!isOpen) return;
        printReceipt({
            heading: 'Movimento de Caixa',
            restaurantName: useDataStore.getState().config.geralData.restaurantName || 'Restaurante',
            restaurantMeta: [
                { label: 'Aberto em', value: caixa.openedAt ? formatDateTimeBR(caixa.openedAt) : '-' },
                { label: 'Aberto por', value: caixa.openedBy || '-' },
            ],
            meta: [
                { label: 'Valor inicial', value: formatCurrency(caixa.initialAmount, currency) },
                { label: 'Vendas do dia', value: formatCurrency(entradas, currency) },
                { label: 'Saídas do dia', value: formatCurrency(saidas, currency) },
                { label: 'Previsão no caixa', value: formatCurrency(previsao, currency) },
                { label: 'Vendas (quantidade)', value: String(vendasHoje.filter((t) => t.type === 'entrada').length) },
            ],
            footer: 'Impresso para conferência do caixa.',
        });
    };

    const handleImprimirCaixa = (row: CaixaRowLike) => {
        const detail = row.detail as CaixaReportType | undefined;
        if (!detail) {
            showMessage('Este caixa não possui relatório detalhado para imprimir.', 'error');
            return;
        }
        printReceipt({
            heading: 'Relatório de Caixa',
            restaurantName: useDataStore.getState().config.geralData.restaurantName || 'Restaurante',
            restaurantMeta: [
                { label: 'Aberto em', value: row.opened_at ? formatDateTimeBR(row.opened_at) : '-' },
                { label: 'Fechado em', value: row.closed_at ? formatDateTimeBR(row.closed_at) : '-' },
            ],
            meta: [
                { label: 'Esperado', value: formatCurrency(Number(row.expected_amount) || 0, currency) },
                { label: 'Apurado', value: formatCurrency(Number(row.final_amount) || 0, currency) },
                { label: 'Diferença', value: formatCurrency(Number(row.difference) || 0, currency) },
            ],
            footer: 'Impresso para conferência do fechamento de caixa.',
            paper: 'a4',
            bodyLines: buildCaixaReportLines(detail, currency),
            bodyHTML: buildCaixaReportHTML(detail, currency),
        });
    };

    const parseValor = (value: string): number => parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0;

    const handleSangria = () => {
        const valor = parseValor(sangriaValor);
        if (valor <= 0 || !sangriaMotivo.trim()) {
            showMessage('Informe o valor (maior que zero) e o motivo da sangria.', 'error');
            return;
        }
        const ok = RecordTransaction({
            description: `Sangria - ${sangriaMotivo.trim()}`,
            amount: valor,
            type: 'saída',
            date: new Date(),
        });
        if (ok) {
            showMessage(`Sangria de ${formatCurrency(valor, currency)} registrada.`);
            setSangriaValor('');
            setSangriaMotivo('');
        }
    };

    const handleSuprimento = () => {
        const valor = parseValor(suprimentoValor);
        if (valor <= 0 || !suprimentoMotivo.trim()) {
            showMessage('Informe o valor (maior que zero) e o motivo do suprimento.', 'error');
            return;
        }
        const ok = RecordTransaction({
            description: `Suprimento - ${suprimentoMotivo.trim()}`,
            amount: valor,
            type: 'entrada',
            date: new Date(),
        });
        if (ok) {
            showMessage(`Suprimento de ${formatCurrency(valor, currency)} registrado.`);
            setSuprimentoValor('');
            setSuprimentoMotivo('');
        }
    };

    return (
        <div className="w-full space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Wallet className={`h-8 w-8 ${isOpen ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                            <p className="text-sm text-gray-500">Status do caixa</p>
                            <p className={`text-2xl font-bold ${isOpen ? 'text-green-600' : 'text-red-600'}`}>
                                {isOpen ? 'Aberto' : 'Fechado'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <CalendarClock className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Abertura</p>
                            <p className="text-lg font-bold">
                                {caixa.openedAt ? formatDateTimeBR(caixa.openedAt) : '-'}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Valor inicial / Previsão</p>
                            <p className="text-lg font-bold">
                                {formatCurrency(caixa.initialAmount, currency)}
                                {isOpen && (
                                    <span className="text-sm text-gray-500 font-normal">
                                        {' '}
                                        → {formatCurrency(previsao, currency)}
                                    </span>
                                )}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {isOpen && (
                <Card>
                    <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <p className="text-sm text-gray-500">Vendas do dia (entradas)</p>
                            <p className="text-xl font-bold text-green-600">{formatCurrency(entradas, currency)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Saídas do dia</p>
                            <p className="text-xl font-bold text-red-600">{formatCurrency(saidas, currency)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Previsão no caixa</p>
                            <p className="text-xl font-bold">{formatCurrency(previsao, currency)}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isOpen && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowDownCircle className="h-5 w-5 text-red-500" />
                            Movimentações de caixa
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sangria */}
                        <div className="space-y-3 rounded-lg border border-red-200 p-4">
                            <div className="flex items-center gap-2">
                                <ArrowDownCircle className="h-5 w-5 text-red-500" />
                                <h3 className="font-bold text-red-600">Sangria (retirada)</h3>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sangria-valor">Valor (R$)</Label>
                                <Input
                                    id="sangria-valor"
                                    type="text"
                                    inputMode="numeric"
                                    value={sangriaValor}
                                    onChange={(e) => setSangriaValor(e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sangria-motivo">Motivo</Label>
                                <Input
                                    id="sangria-motivo"
                                    value={sangriaMotivo}
                                    onChange={(e) => setSangriaMotivo(e.target.value)}
                                    placeholder="Ex.: pagamento de fornecedor"
                                />
                            </div>
                            <Button
                                className="w-full bg-red-600 hover:bg-red-700 text-white h-12 font-bold"
                                onClick={handleSangria}
                            >
                                Registrar sangria
                            </Button>
                        </div>

                        {/* Suprimento */}
                        <div className="space-y-3 rounded-lg border border-green-200 p-4">
                            <div className="flex items-center gap-2">
                                <ArrowUpCircle className="h-5 w-5 text-green-600" />
                                <h3 className="font-bold text-green-600">Suprimento (entrada)</h3>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="suprimento-valor">Valor (R$)</Label>
                                <Input
                                    id="suprimento-valor"
                                    type="text"
                                    inputMode="numeric"
                                    value={suprimentoValor}
                                    onChange={(e) => setSuprimentoValor(e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="suprimento-motivo">Motivo</Label>
                                <Input
                                    id="suprimento-motivo"
                                    value={suprimentoMotivo}
                                    onChange={(e) => setSuprimentoMotivo(e.target.value)}
                                    placeholder="Ex.: reposição de troco"
                                />
                            </div>
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                                onClick={handleSuprimento}
                            >
                                Registrar suprimento
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>{isOpen ? 'Fechar caixa' : 'Abrir caixa'}</CardTitle>
                </CardHeader>
                <CardContent>
                    {!isOpen ? (
                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="space-y-2 flex-1">
                                <Label htmlFor="valor-inicial">Valor inicial em dinheiro (R$)</Label>
                                <Input
                                    id="valor-inicial"
                                    type="text"
                                    inputMode="numeric"
                                    value={valorInicial}
                                    onChange={(e) => setValorInicial(e.target.value)}
                                    placeholder="0,00"
                                />
                            </div>
                            <Button
                                className="bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                                onClick={handleAbrir}
                            >
                                <LockOpen className="h-5 w-5 mr-2" />
                                Abrir caixa
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Para fechar, informe o valor em dinheiro apurado no caixa (incluindo o valor inicial). O
                                sistema calculará a diferença em relação ao esperado.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="valor-final">Valor final em dinheiro (R$)</Label>
                                    <Input
                                        id="valor-final"
                                        type="text"
                                        inputMode="numeric"
                                        value={finalAmount}
                                        onChange={(e) => setFinalAmount(e.target.value)}
                                        placeholder="0,00"
                                    />
                                </div>
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="obs">Observação (opcional)</Label>
                                    <Input
                                        id="obs"
                                        value={obs}
                                        onChange={(e) => setObs(e.target.value)}
                                        placeholder="Ex.: sangria, pagamentos de fornecedores..."
                                    />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button variant="outline" className="h-12 font-bold gap-2" onClick={handleImprimir}>
                                    <Printer className="h-5 w-5" />
                                    Imprimir movimento
                                </Button>
                                <FecharDialog onConfirm={handleFechar} />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {caixa.status === 'fechado' && caixa.closedAt && (
                <Card>
                    <CardContent className="p-4 space-y-1 text-sm">
                        <p className="font-bold">Último fechamento</p>
                        <div className="flex items-center gap-2 text-gray-600">
                            <User className="h-4 w-4" /> {caixa.openedBy || '-'}
                        </div>
                        <p className="text-gray-600">
                            Fechado em {caixa.closedAt ? formatDateTimeBR(caixa.closedAt) : '-'} — Esperado{' '}
                            {formatCurrency(caixa.expectedAmount ?? 0, currency)}, apurado{' '}
                            {formatCurrency(caixa.finalAmount ?? 0, currency)} (diferença{' '}
                            {formatCurrency(caixa.difference ?? 0, currency)}).
                        </p>
                        {caixa.notes && <p className="text-gray-500">Obs.: {caixa.notes}</p>}
                        {caixa.detail && <CaixaReportView detail={caixa.detail} />}
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Histórico de caixas
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {historico.length === 0 ? (
                        <p className="text-sm text-gray-500">
                            Nenhum fechamento de caixa ainda. Ao fechar, o relatório detalhado fica disponível aqui.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="text-left p-2">Fechado em</th>
                                        <th className="text-right p-2">Esperado</th>
                                        <th className="text-right p-2">Apurado</th>
                                        <th className="text-right p-2">Diferença</th>
                                        <th className="text-center p-2">Vendas</th>
                                        <th className="text-right p-2">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {historico.map((row) => (
                                        <tr key={row.id} className="border-t">
                                            <td className="p-2">
                                                {row.closed_at ? formatDateTimeBR(row.closed_at) : '-'}
                                            </td>
                                            <td className="p-2 text-right">
                                                {formatCurrency(Number(row.expected_amount) || 0, currency)}
                                            </td>
                                            <td className="p-2 text-right">
                                                {formatCurrency(Number(row.final_amount) || 0, currency)}
                                            </td>
                                            <td
                                                className={`p-2 text-right ${
                                                    Number(row.difference) !== 0 ? 'text-red-600 font-semibold' : ''
                                                }`}
                                            >
                                                {formatCurrency(Number(row.difference) || 0, currency)}
                                            </td>
                                            <td className="p-2 text-center">{row.sales_count ?? 0}</td>
                                            <td className="p-2 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="gap-1"
                                                        onClick={() => handleImprimirCaixa(row)}
                                                    >
                                                        <Printer className="h-3.5 w-3.5" />
                                                        Imprimir
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setCaixaSelecionado(row)}
                                                    >
                                                        Ver relatório
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!caixaSelecionado} onOpenChange={(open) => !open && setCaixaSelecionado(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Relatório do caixa{' '}
                            {caixaSelecionado?.closed_at ? formatDateTimeBR(caixaSelecionado.closed_at) : ''}
                        </DialogTitle>
                        <DialogDescription>
                            {caixaSelecionado ? (
                                <>
                                    Esperado {formatCurrency(Number(caixaSelecionado.expected_amount) || 0, currency)} ·{' '}
                                    Apurado {formatCurrency(Number(caixaSelecionado.final_amount) || 0, currency)} ·
                                    Diferença{' '}
                                    {formatCurrency(Number(caixaSelecionado.difference) || 0, currency)} ·{' '}
                                    {caixaSelecionado.sales_count ?? 0} venda(s)
                                </>
                            ) : (
                                ''
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {caixaSelecionado?.detail ? (
                        <CaixaReportView detail={caixaSelecionado.detail as CaixaReportType} />
                    ) : null}
                    {caixaSelecionado?.detail ? (
                        <div className="pt-4 flex justify-end">
                            <Button
                                className="gap-2"
                                onClick={() => caixaSelecionado && handleImprimirCaixa(caixaSelecionado)}
                            >
                                <Printer className="h-4 w-4" />
                                Imprimir relatório
                            </Button>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CaixaReportView({ detail }: { detail: CaixaReportType }) {
    const summary = useMemo(() => computeCaixaReport(detail), [detail]);
    const { vendas, porMetodo, porOrigem, porCliente, porItem, totalReceita, totalFiado, transacoesCount } = summary;
    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';

    return (
        <div className="space-y-4 pt-2 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Vendas" value={String(vendas.length)} />
                <Stat label="Receita" value={formatCurrency(totalReceita, currency)} />
                <Stat label="Fiado" value={formatCurrency(totalFiado, currency)} warn={totalFiado > 0} />
                <Stat label="Transações" value={String(transacoesCount)} />
            </div>

            {porMetodo.length > 0 && (
                <div>
                    <h4 className="font-bold mb-1">Por método de pagamento</h4>
                    <div className="space-y-1">
                        {porMetodo.map(([metodo, total]) => (
                            <div key={metodo} className="flex justify-between">
                                <span>{methodLabel[metodo]}</span>
                                <span>{formatCurrency(total, currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {porOrigem.length > 0 && (
                <div>
                    <h4 className="font-bold mb-1">Por mesa / origem</h4>
                    <div className="space-y-1">
                        {porOrigem.map(([origem, total]) => (
                            <div key={origem} className="flex justify-between">
                                <span>{origem}</span>
                                <span>{formatCurrency(total, currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {porCliente.length > 0 && (
                <div>
                    <h4 className="font-bold mb-1">Por cliente</h4>
                    <div className="space-y-1">
                        {porCliente.map(([cliente, total]) => (
                            <div key={cliente} className="flex justify-between">
                                <span>{cliente}</span>
                                <span>{formatCurrency(total, currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {porItem.length > 0 && (
                <div>
                    <h4 className="font-bold mb-1">Itens vendidos</h4>
                    <div className="space-y-1">
                        {porItem.map((item) => (
                            <div key={item.title} className="flex justify-between">
                                <span>
                                    {item.title} <span className="text-gray-500">× {item.quantity}</span>
                                </span>
                                <span>{formatCurrency(item.total, currency)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {vendas.length === 0 && (
                <p className="text-gray-500">
                    <ListOrdered className="inline h-4 w-4 mr-1" />
                    Nenhuma venda registrada neste fechamento.
                </p>
            )}

            <div>
                <h4 className="font-bold mb-1">
                    <UtensilsCrossed className="inline h-4 w-4 mr-1" />
                    Vendas individuais
                </h4>
                <div className="divide-y">
                    {vendas.map((venda) => (
                        <div key={venda.id} className="py-2">
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
                                    <p className="text-gray-500 text-xs">
                                        {formatDateTimeBR(venda.date)}
                                        {venda.cliente ? ` · ${venda.cliente}` : ''}
                                        {venda.taxa > 0 ? ` · taxa ${formatCurrency(venda.taxa, currency)}` : ''}
                                    </p>
                                    {venda.items.length > 0 && (
                                        <p className="text-gray-500 text-xs mt-0.5">
                                            {venda.items
                                                .map((item) => `${item.quantity}× ${item.title}`)
                                                .join(', ')}
                                        </p>
                                    )}
                                </div>
                                <span className="font-semibold">{formatCurrency(venda.total, currency)}</span>
                            </div>
                            {venda.pagamentos?.length ? (
                                <div className="mt-1 grid grid-cols-1 gap-0.5 text-xs">
                                    {venda.pagamentos.map((p, i) => (
                                        <div key={i} className="flex justify-between text-gray-600">
                                            <span>
                                                {methodLabel[p.metodo]}
                                                {p.clienteNome ? ` (${p.clienteNome})` : ''}
                                            </span>
                                            <span>{formatCurrency(Number(p.valor) || 0, currency)}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
    return (
        <div className={`rounded-md border p-2 ${warn ? 'border-red-200 bg-red-50' : ''}`}>
            <p className="text-gray-500 text-xs">{label}</p>
            <p className={`font-bold ${warn ? 'text-red-600' : ''}`}>{value}</p>
        </div>
    );
}

function FecharDialog({ onConfirm }: { onConfirm: () => void }) {
    const [open, setOpen] = useState(false);
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-red-600 hover:bg-red-700 text-white h-12 font-bold">
                    <Lock className="h-5 w-5 mr-2" />
                    Fechar caixa
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Confirmar fechamento</DialogTitle>
                    <DialogDescription>
                        Após fechar o caixa, vendas (PDV, mesas e delivery) ficam bloqueadas até uma nova abertura. Essa
                        ação não pode ser desfeita.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-3 pt-2">
                    <Button
                        onClick={() => {
                            setOpen(false);
                            onConfirm();
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white"
                    >
                        Confirmar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
