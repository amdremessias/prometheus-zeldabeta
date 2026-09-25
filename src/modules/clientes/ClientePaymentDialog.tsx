'use client';
import { useState } from 'react';
import { Banknote, CreditCard, QrCode } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, Input, Label } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { RegistrarPagamentoCliente } from './clienteActions';

export function ClientePaymentDialog({
    cliente,
    onClose,
    currency,
}: {
    cliente: ClienteType | null;
    onClose: () => void;
    currency: string;
}) {
    const [valor, setValor] = useState('');
    const [method, setMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');

    const valorNum = parseFloat(valor.replace(',', '.')) || 0;
    const saldo = cliente?.saldo || 0;

    const handleSubmit = () => {
        if (!cliente || valorNum <= 0) return;
        RegistrarPagamentoCliente(cliente.id, valorNum, method);
        onClose();
        setValor('');
    };

    return (
        <Dialog open={!!cliente} onOpenChange={(open) => !open && onClose()}>
            <DialogTrigger asChild>
                <span className="hidden" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Registrar pagamento - {cliente?.nome}</DialogTitle>
                    <DialogDescription>
                        Saldo atual em carteira: {formatCurrency(saldo, currency)}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="pag-valor">Valor do pagamento</Label>
                        <Input
                            id="pag-valor"
                            type="number"
                            min={0}
                            step="0.01"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            placeholder="0,00"
                        />
                        {valorNum > saldo && (
                            <p className="text-xs text-red-500">
                                Valor maior que o saldo. Será considerado {formatCurrency(saldo, currency)}.
                            </p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>Método de pagamento</Label>
                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                variant="outline"
                                size="lg"
                                className={`flex flex-col items-center gap-1 h-16 ${
                                    method === 'dinheiro' && 'bg-green-600 hover:bg-green-600 text-white hover:text-white'
                                }`}
                                onClick={() => setMethod('dinheiro')}
                            >
                                <Banknote className="h-5 w-5" />
                                <span className="text-xs">Dinheiro</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className={`flex flex-col items-center gap-1 h-16 ${
                                    method === 'cartao' && 'bg-green-600 hover:bg-green-600 text-white hover:text-white'
                                }`}
                                onClick={() => setMethod('cartao')}
                            >
                                <CreditCard className="h-5 w-5" />
                                <span className="text-xs">Cartão</span>
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                className={`flex flex-col items-center gap-1 h-16 ${
                                    method === 'pix' && 'bg-green-600 hover:bg-green-600 text-white hover:text-white'
                                }`}
                                onClick={() => setMethod('pix')}
                            >
                                <QrCode className="h-5 w-5" />
                                <span className="text-xs">Pix</span>
                            </Button>
                        </div>
                    </div>
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                        onClick={handleSubmit}
                        disabled={valorNum <= 0}
                    >
                        Confirmar pagamento
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}