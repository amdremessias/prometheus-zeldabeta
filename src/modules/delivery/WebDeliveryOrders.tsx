'use client';
import { useCallback, useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    Input,
    Label,
} from '@/shared/ui';
import { MapPin, Phone, Clock, Package, User, Bike, CheckCircle2, Store, Printer, Banknote } from 'lucide-react';
import { formatCurrency } from '@/shared/lib/numberUtils';
import { useDataStore } from '@/store/userStore';
import { printReceipt } from '@/shared/lib/printReceipt';
import { PaymentSplitEditor } from '@/shared/components/PaymentSplitEditor';
import { isPaymentSplitComplete, derivePaymentMethod } from '@/shared/lib/payments';

interface WebDeliveryOrder {
    id: number;
    cliente: string;
    telefone: string;
    endereco: string;
    pagamento: string;
    taxa_entrega_nome?: string;
    taxa_entrega_valor?: number;
    itens: { id: number; title: string; price: number; quantity: number }[];
    subtotal: number;
    total: number;
    modo_entrega: 'entrega' | 'retirada';
    status: string;
    status_entrega: string;
    faturado: boolean;
    origem?: string;
    entregador?: string;
    entregador_telefone?: string;
    created_at: string;
}

const methodLabel: Record<string, string> = {
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    pix: 'Pix',
    fiado: 'Fiado',
};

export function WebDeliveryOrders() {
    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';
    const [orders, setOrders] = useState<WebDeliveryOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [driverDialog, setDriverDialog] = useState<number | null>(null);
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [payDialog, setPayDialog] = useState<number | null>(null);
    const [pagamentos, setPagamentos] = useState<VendaPagamentoType[]>([]);
    const [startDialog, setStartDialog] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/entregas`, { cache: 'no-store' });
            if (!res.ok) throw new Error('Falha ao carregar pedidos');
            const data = (await res.json()) as WebDeliveryOrder[];
            setOrders(Array.isArray(data) ? data : []);
        } catch {
            setError('Não foi possível carregar os pedidos de entrega.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const transition = async (
        id: number,
        status_entrega: string,
        extra?: { entregador?: string; entregador_telefone?: string; pagamento?: string }
    ) => {
        setBusy(true);
        setError('');
        try {
            const res = await fetch('/api/entregas', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status_entrega, ...extra }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                setError(body.error || 'Falha ao atualizar o pedido.');
                return;
            }
            await load();
        } catch {
            setError('Erro de conexão ao atualizar o pedido.');
        } finally {
            setBusy(false);
        }
    };

    const prontos = orders.filter((o) => o.status === 'concluido');
    const pendentes = prontos.filter((o) => o.status_entrega === 'aguardando');
    const emAndamento = prontos.filter((o) =>
        ['em_entrega', 'retirada_confirmada', 'entregue'].includes(o.status_entrega)
    );
    const concluidos = prontos.filter((o) => o.status_entrega === 'recebido');

    const printDelivery = (order: WebDeliveryOrder) => {
        const isEntrega = order.modo_entrega === 'entrega';
        const meta: { label: string; value: string }[] = [
            { label: 'Cliente', value: order.cliente },
            { label: 'Telefone', value: order.telefone },
        ];
        if (isEntrega && order.endereco) meta.push({ label: 'Endereço', value: order.endereco });
        meta.push({ label: 'Pagamento', value: methodLabel[order.pagamento] || order.pagamento });
        if (order.status_entrega === 'em_entrega' && order.entregador) {
            meta.push({
                label: 'Entregador',
                value: `${order.entregador}${order.entregador_telefone ? ` - ${order.entregador_telefone}` : ''}`,
            });
        }
        if (order.status_entrega === 'recebido') {
            meta.push({ label: 'Status', value: 'PAGO' });
        }
        printReceipt({
            heading: isEntrega ? 'Pedido de Entrega' : 'Pedido para Retirada',
            restaurantName: useDataStore.getState().config.geralData.restaurantName || 'Restaurante',
            meta,
            items: (order.itens || []).map((i) => ({ title: i.title, quantity: i.quantity, price: i.price })),
            total: order.total,
            footer: order.status_entrega === 'recebido' ? `*** PAGO *** Pedido #${order.id}` : `Pedido #${order.id}`,
        });
    };

    const renderOrder = (order: WebDeliveryOrder) => {
        const isEntrega = order.modo_entrega === 'entrega';
        return (
            <Card key={order.id}>
                <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="text-lg font-bold">{order.cliente}</h3>
                            <p className="text-sm text-gray-600">Pedido #{order.id}</p>
                        </div>
                        <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                                isEntrega ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                            }`}
                        >
                            {isEntrega ? 'Entrega' : 'Retirada'}
                        </span>
                        {order.origem === 'cardapio_digital' && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                Cardápio Digital
                            </span>
                        )}
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => printDelivery(order)}
                            aria-label="Imprimir pedido"
                        >
                            <Printer className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="space-y-2 mb-3">
                        <div className="flex items-center text-sm text-gray-600">
                            <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{order.telefone}</span>
                        </div>
                        {isEntrega && (
                            <div className="flex items-center text-sm text-gray-600">
                                <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>{order.endereco}</span>
                            </div>
                        )}
                        <div className="flex items-center text-sm text-gray-600">
                            <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{new Date(order.created_at).toLocaleString('pt-BR')}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                            <Package className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>
                                {order.itens.reduce((a, i) => a + i.quantity, 0)} itens -{' '}
                                {formatCurrency(order.total, currency)}
                            </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                            <Bike className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{methodLabel[order.pagamento] || order.pagamento}</span>
                        </div>
                        {order.status_entrega === 'em_entrega' && (
                            <div className="flex items-center text-sm text-gray-600">
                                <User className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span>
                                    Entregador: {order.entregador}
                                    {order.entregador_telefone ? ` - ${order.entregador_telefone}` : ''}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {order.status_entrega === 'aguardando' && (
                            <Button
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                disabled={busy}
                                onClick={() => setStartDialog(order.id)}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Dar andamento
                            </Button>
                        )}
                        {order.status_entrega === 'em_entrega' && (
                            <Button
                                className="flex-1 bg-green-600 hover:bg-green-700"
                                disabled={busy}
                                onClick={() => {
                                    setPagamentos([]);
                                    setPayDialog(order.id);
                                }}
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                Confirmar entrega e receber
                            </Button>
                        )}
                        {(order.status_entrega === 'retirada_confirmada' || order.status_entrega === 'entregue') && (
                            <Button
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                disabled={busy}
                                onClick={() => {
                                    setPagamentos([]);
                                    setPayDialog(order.id);
                                }}
                            >
                                <Banknote className="h-4 w-4 mr-2" />
                                Receber pagamento
                            </Button>
                        )}
                        {order.status_entrega === 'recebido' && (
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700"
                                disabled={busy}
                                onClick={() => printDelivery(order)}
                            >
                                <Printer className="h-4 w-4 mr-2" />
                                Imprimir recibo
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="w-full space-y-6">
            <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                    Atualizar
                </Button>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {loading && <p className="text-center text-gray-500 p-6">Carregando pedidos...</p>}

            <section>
                <h2 className="font-bold text-xl mb-3 flex items-center gap-2">
                    Pendentes
                    <span className="text-sm bg-red-100 text-red-600 rounded-full px-2 py-0.5">
                        {pendentes.length}
                    </span>
                </h2>
                {pendentes.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum pedido pronto aguardando entrega/retirada.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {pendentes.map(renderOrder)}
                    </div>
                )}
            </section>

            <section>
                <h2 className="font-bold text-xl mb-3 flex items-center gap-2">
                    Em andamento
                    <span className="text-sm bg-yellow-100 text-yellow-600 rounded-full px-2 py-0.5">
                        {emAndamento.length}
                    </span>
                </h2>
                {emAndamento.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum pedido em andamento.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {emAndamento.map(renderOrder)}
                    </div>
                )}
            </section>

            <section>
                <h2 className="font-bold text-xl mb-3 flex items-center gap-2">
                    Concluídos (recebidos)
                    <span className="text-sm bg-green-100 text-green-600 rounded-full px-2 py-0.5">
                        {concluidos.length}
                    </span>
                </h2>
                {concluidos.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum pedido finalizado.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {concluidos.map(renderOrder)}
                    </div>
                )}
            </section>

            <Dialog open={startDialog !== null} onOpenChange={(o) => !o && setStartDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Dar andamento ao pedido #{startDialog}</DialogTitle>
                        <DialogDescription>
                            Escolha como este pedido será concluído.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            disabled={busy}
                            onClick={() => {
                                const id = startDialog;
                                setStartDialog(null);
                                if (id) {
                                    setDriverName('');
                                    setDriverPhone('');
                                    setDriverDialog(id);
                                }
                            }}
                        >
                            <Bike className="h-4 w-4 mr-2" />
                            Enviar com entregador
                        </Button>
                        <Button
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white h-12 font-bold"
                            disabled={busy}
                            onClick={() => {
                                const id = startDialog;
                                setStartDialog(null);
                                if (id) transition(id, 'retirada_confirmada');
                            }}
                        >
                            <Store className="h-4 w-4 mr-2" />
                            Retirada no balcão
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={driverDialog !== null} onOpenChange={(o) => !o && setDriverDialog(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Designar entregador</DialogTitle>
                        <DialogDescription>
                            Informe quem vai realizar a entrega do pedido #{driverDialog}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-2">
                        <div className="space-y-1">
                            <Label>Nome do entregador</Label>
                            <Input
                                value={driverName}
                                onChange={(e) => setDriverName(e.target.value)}
                                placeholder="Ex.: João"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Telefone (opcional)</Label>
                            <Input
                                value={driverPhone}
                                onChange={(e) => setDriverPhone(e.target.value)}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            disabled={!driverName.trim() || busy}
                            onClick={() => {
                                if (driverDialog)
                                    transition(driverDialog, 'em_entrega', {
                                        entregador: driverName.trim(),
                                        entregador_telefone: driverPhone.trim(),
                                    });
                                setDriverDialog(null);
                            }}
                        >
                            Confirmar e enviar para entrega
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={payDialog !== null} onOpenChange={(o) => !o && setPayDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Receber pagamento - Pedido #{payDialog}</DialogTitle>
                        <DialogDescription>
                            Registre o recebimento antes de finalizar a entrega.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-2">
                        <PaymentSplitEditor
                            total={orders.find((o) => o.id === payDialog)?.total ?? 0}
                            currency={currency}
                            clientesFiado={[]}
                            onChange={setPagamentos}
                        />
                    </div>
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                        disabled={
                            !isPaymentSplitComplete(
                                orders.find((o) => o.id === payDialog)?.total ?? 0,
                                pagamentos
                            ) ||
                            busy
                        }
                        onClick={() => {
                            const ordem = orders.find((o) => o.id === payDialog);
                            const metodo = pagamentos.length
                                ? derivePaymentMethod(pagamentos)
                                : ordem?.pagamento || 'dinheiro';
                            if (payDialog) transition(payDialog, 'recebido', { pagamento: metodo });
                            setPayDialog(null);
                        }}
                    >
                        Confirmar recebimento e finalizar
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
