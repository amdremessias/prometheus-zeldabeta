import { useState } from 'react';
import { Button, Card, CardContent, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, Label } from '@/shared/ui';
import { MapPin, Phone, Clock, Package, User, HandCoins, Ban } from 'lucide-react';
import { useDataStore } from '@/store/userStore';
import { StartingDelivery, EndDelivery, CancelarDelivery } from './DeliveryActions';
import { createEntregador } from '../settings/settingsActions';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { PaymentSplitEditor } from '@/shared/components/PaymentSplitEditor';
import { isPaymentSplitComplete, paymentMethodLabel } from '@/shared/lib/payments';

const statusMap = {
    pendente: {
        color: 'bg-red-100 text-red-600',
    },
    'em andamento': {
        color: 'bg-yellow-100 text-yellow-600',
    },
};

export function DeliveryOrderCard({ order, status }: { order: DeliveryType; status: 'pendente' | 'em andamento' }) {
    const { color } = statusMap[status];

    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';
    const entregadores = useDataStore((state) => state.config.entregadores);
    const clientes = useDataStore((state) => state.clientes);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [confirmEntrega, setConfirmEntrega] = useState(false);
    const [selectedId, setSelectedId] = useState<number | 'novo' | ''>('');
    const [novoNome, setNovoNome] = useState('');
    const [novoTelefone, setNovoTelefone] = useState('');
    const [pagamentos, setPagamentos] = useState<VendaPagamentoType[]>([]);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

    const clientesFiado = clientes.filter((c) => c.carteiraHabilitada);
    const pagamentoCompleto = isPaymentSplitComplete(order.payments.total, pagamentos);

    const confirmarEntregador = async () => {
        if (selectedId === 'novo') {
            if (!novoNome.trim()) return;
            const cadastrado = createEntregador(novoNome, novoTelefone);
            if (cadastrado) await StartingDelivery(order.id, cadastrado.nome, cadastrado.telefone);
        } else if (selectedId !== '') {
            const ent = entregadores.find((e) => e.id === selectedId);
            if (ent) await StartingDelivery(order.id, ent.nome, ent.telefone);
        }
        setDialogOpen(false);
    };

    return (
        <Card>
            <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                    <div>
                        <h3 className="text-lg font-bold">{order.customer}</h3>
                        <p className="text-sm text-gray-600">Pedido: {order.id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${color}`}>{status}</span>
                </div>

                <div className="space-y-2 mb-3">
                    <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>{order.address}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>{order.phone}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>Horário: {order.startedAt}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                        <Package className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>
                            {order.payments.items} itens - R${order.payments.total.toFixed(2)}
                        </span>
                    </div>
                    {order.payments.type === 'fiado' && (
                        <div className="flex items-center text-sm text-gray-600">
                            <HandCoins className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>Fiado ({order.payments.clienteNome || 'sem cliente'})</span>
                        </div>
                    )}
                    {status == 'em andamento' && (
                        <div className="flex items-center text-sm text-gray-600">
                            <User className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>
                                Entregador: {order.deliveryPerson}
                                {order.deliveryPhone ? ` - ${order.deliveryPhone}` : ''}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex">
                    {status === 'pendente' && (
                        <>
                            <Button
                                variant="default"
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                onClick={() => setDialogOpen(true)}
                            >
                                Atribuir Entregador
                            </Button>
                            <Button
                                variant="outline"
                                className="ml-2 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setCancelDialogOpen(true)}
                            >
                                <Ban className="h-4 w-4" />
                                Cancelar
                            </Button>
                        </>
                    )}

                    {status === 'em andamento' && (
                        <>
                            <div className="flex-1">
                                <p className="text-xs text-amber-600 font-medium mb-1">
                                    Aguardando recebimento do entregador. Confirme quando ele retornar com o
                                    dinheiro/pagamento.
                                </p>
                                <Button
                                    variant="default"
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    onClick={() => {
                                        setPagamentos([]);
                                        setConfirmEntrega(true);
                                    }}
                                >
                                    Confirmar Entrega
                                </Button>
                            </div>
                            <Button
                                variant="outline"
                                className="ml-2 gap-1 text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => setCancelDialogOpen(true)}
                            >
                                <Ban className="h-4 w-4" />
                                Cancelar
                            </Button>
                        </>
                    )}
                </div>
            </CardContent>

            <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancelar entrega</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja cancelar a entrega de <strong>{order.customer}</strong>? O pedido
                            será removido da cozinha e da lista de entregas. Nenhum valor é lançado no caixa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setCancelDialogOpen(false)}>
                            Voltar
                        </Button>
                        <Button
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 font-bold"
                            onClick={() => {
                                setCancelDialogOpen(false);
                                CancelarDelivery(order.id);
                            }}
                        >
                            <Ban className="h-4 w-4 mr-2" />
                            Cancelar entrega
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmEntrega} onOpenChange={setConfirmEntrega}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar recebimento</DialogTitle>
                        <DialogDescription>
                            Confirme o recebimento do pedido de <strong>{order.customer}</strong>. Você pode dividir o
                            valor em várias formas de pagamento (Pix, Dinheiro, Fiado, Cartão). A venda será registrada
                            no caixa e a entrega encerrada.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
                            <span className="font-semibold">Valor total</span>
                            <span className="text-2xl font-bold text-green-600">
                                {formatCurrency(order.payments.total, currency)}
                            </span>
                        </div>
                        {pagamentos.length === 0 && (
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Forma de pagamento do pedido</span>
                                <span className="font-medium text-gray-800">
                                    {paymentMethodLabel[order.payments.type]}
                                </span>
                            </div>
                        )}
                        {pagamentos.length === 0 && order.payments.type === 'fiado' && (
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Cliente (carteira)</span>
                                <span className="font-medium text-gray-800">{order.payments.clienteNome || '-'}</span>
                            </div>
                        )}
                    </div>
                    <PaymentSplitEditor
                        total={order.payments.total}
                        currency={currency}
                        clientesFiado={clientesFiado}
                        onChange={setPagamentos}
                    />
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setConfirmEntrega(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            disabled={pagamentos.length > 0 && !pagamentoCompleto}
                            onClick={() => {
                                setConfirmEntrega(false);
                                EndDelivery(order.id, pagamentos);
                            }}
                        >
                            Confirmar recebimento
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Atribuir entregador</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="space-y-2">
                            <Label htmlFor="entregador-select">Entregador cadastrado</Label>
                            <select
                                id="entregador-select"
                                className="w-full border rounded-md p-2 text-sm"
                                value={selectedId}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    setSelectedId(v === '' ? '' : v === 'novo' ? 'novo' : Number(v));
                                }}
                            >
                                <option value="">Selecione...</option>
                                {entregadores.map((ent) => (
                                    <option key={ent.id} value={ent.id}>
                                        {ent.nome} {ent.telefone ? ` - ${ent.telefone}` : ''}
                                    </option>
                                ))}
                                <option value="novo">Cadastrar novo entregador...</option>
                            </select>
                        </div>

                        {selectedId === 'novo' && (
                            <div className="space-y-2">
                                <div className="space-y-1">
                                    <Label>Nome</Label>
                                    <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <Label>Telefone</Label>
                                    <Input value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} />
                                </div>
                            </div>
                        )}

                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            disabled={selectedId === '' || (selectedId === 'novo' && !novoNome.trim())}
                            onClick={confirmarEntregador}
                        >
                            Confirmar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}