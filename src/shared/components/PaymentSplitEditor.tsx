'use client';
import { useState } from 'react';
import { Banknote, CreditCard, QrCode, HandCoins, Trash2, Plus } from 'lucide-react';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { paymentMethodLabel, sumPagamentos, calcularTroco } from '@/shared/lib/payments';

/* Editor de recebimento parcial: permite dividir o total em várias formas de pagamento.
   Ex.: conta de R$ 225 → 50 Pix + 100 Dinheiro + 50 Fiado (cliente) + 25 Cartão. */
export function PaymentSplitEditor({
    total,
    currency,
    clientesFiado,
    onChange,
    consumidorCpfCnpj,
    onConsumidorChange,
    showConsumidor,
}: {
    total: number;
    currency: string;
    clientesFiado: ClienteType[];
    onChange: (pagamentos: VendaPagamentoType[]) => void;
    consumidorCpfCnpj?: string;
    onConsumidorChange?: (value: string) => void;
    showConsumidor?: boolean;
}) {
    const [pagamentos, setPagamentos] = useState<VendaPagamentoType[]>([]);
    const [metodo, setMetodo] = useState<VendaPagamentoType['metodo']>('dinheiro');
    const [valor, setValor] = useState('');
    const [clienteId, setClienteId] = useState<string>('');
    const [erro, setErro] = useState('');

    const pago = sumPagamentos(pagamentos);
    const restante = Math.max(0, Math.round((total - pago) * 100) / 100);
    const valorNum = parseFloat(valor.replace(',', '.')) || 0;
    const completo = pago >= total - 0.005;
    const troco = calcularTroco(total, pagamentos);

    const resetMetodo = (m: VendaPagamentoType['metodo']) => {
        setMetodo(m);
        setErro('');
        if (m !== 'fiado') setClienteId('');
    };

    const addPart = () => {
        if (valorNum <= 0) {
            setErro('Informe um valor maior que zero.');
            return;
        }
        // Dinheiro pode exceder o restante (virada de troco); demais formas não.
        if (metodo !== 'dinheiro' && valorNum > restante + 0.005) {
            setErro(`O valor não pode ser maior que o restante (${formatCurrency(restante, currency)}).`);
            return;
        }
        let novo: VendaPagamentoType;
        if (metodo === 'fiado') {
            const cliente = clientesFiado.find((c) => String(c.id) === String(clienteId));
            if (!cliente) {
                setErro('Selecione um cliente com carteira habilitada para vender fiado.');
                return;
            }
            novo = { metodo, valor: Math.round(valorNum * 100) / 100, clienteId: cliente.id, clienteNome: cliente.nome };
            setClienteId('');
        } else {
            novo = { metodo, valor: Math.round(valorNum * 100) / 100 };
        }
        const novaLista = [...pagamentos, novo];
        setPagamentos(novaLista);
        onChange(novaLista);
        setValor('');
        setErro('');
    };

    const removePart = (index: number) => {
        const novaLista = pagamentos.filter((_, i) => i !== index);
        setPagamentos(novaLista);
        onChange(novaLista);
        setErro('');
    };

    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                <span className="text-sm font-semibold">Valor total</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(total, currency)}</span>
            </div>

            {showConsumidor && onConsumidorChange && (
                <div className="space-y-1">
                    <Label className="text-xs">CPF/CNPJ do consumidor (opcional)</Label>
                    <Input
                        type="text"
                        inputMode="numeric"
                        value={consumidorCpfCnpj ?? ''}
                        onChange={(e) => onConsumidorChange(e.target.value)}
                        placeholder="Somente números"
                        maxLength={14}
                    />
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MethodBtn active={metodo === 'dinheiro'} onClick={() => resetMetodo('dinheiro')} icon={<Banknote className="h-4 w-4" />} label="Dinheiro" />
                <MethodBtn active={metodo === 'cartao'} onClick={() => resetMetodo('cartao')} icon={<CreditCard className="h-4 w-4" />} label="Cartão" />
                <MethodBtn active={metodo === 'pix'} onClick={() => resetMetodo('pix')} icon={<QrCode className="h-4 w-4" />} label="Pix" />
                <MethodBtn active={metodo === 'fiado'} onClick={() => resetMetodo('fiado')} icon={<HandCoins className="h-4 w-4" />} label="Fiado" />
            </div>

            <div className="space-y-1">
                <Label className="text-xs">Valor da parcela (restante: {formatCurrency(restante, currency)})</Label>
                <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder={formatCurrency(restante, currency)}
                />
            </div>

            {metodo === 'fiado' && (
                <div className="space-y-1">
                    <Label className="text-xs">Cliente (carteira habilitada)</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {clientesFiado.length === 0 && (
                                <p className="p-2 text-sm text-red-500">
                                    Nenhum cliente com carteira habilitada. Cadastre/habilite em Clientes.
                                </p>
                            )}
                            {clientesFiado.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                    {c.nome}
                                    {c.saldo > 0 ? ` (deve ${formatCurrency(c.saldo, currency)})` : ''}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            <Button type="button" className="w-full" variant="outline" onClick={addPart} disabled={valorNum <= 0}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar parcela
            </Button>

            {erro && <p className="text-sm text-red-500">{erro}</p>}

            {pagamentos.length > 0 && (
                <div className="rounded-lg border divide-y">
                    {pagamentos.map((pag, i) => (
                        <div key={i} className="flex justify-between items-center px-3 py-2 gap-2">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">
                                    {paymentMethodLabel[pag.metodo]}
                                    {pag.clienteNome ? ` · ${pag.clienteNome}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-bold">{formatCurrency(pag.valor, currency)}</span>
                                <button
                                    type="button"
                                    onClick={() => removePart(i)}
                                    className="text-gray-400 hover:text-red-500"
                                    aria-label="Remover parcela"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex justify-between items-center text-sm">
                <span className="text-gray-600">
                    Pago: <strong>{formatCurrency(pago, currency)}</strong>
                </span>
                <span className={completo ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
                    {completo ? 'Valor total coberto' : `Restante: ${formatCurrency(restante, currency)}`}
                </span>
            </div>

            {troco > 0 && (
                <div className="flex justify-between items-center text-sm bg-blue-50 rounded-lg px-3 py-2">
                    <span className="text-blue-700 font-medium">Troco (dinheiro)</span>
                    <span className="text-blue-700 font-bold">{formatCurrency(troco, currency)}</span>
                </div>
            )}
        </div>
    );
}

function MethodBtn({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}) {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className={`flex flex-col items-center gap-0.5 h-16 py-1 ${
                active ? '!bg-green-600 !text-white !border-green-600 hover:!bg-green-700' : ''
            }`}
            onClick={onClick}
        >
            {icon}
            <span className="text-xs leading-tight">{label}</span>
        </Button>
    );
}
