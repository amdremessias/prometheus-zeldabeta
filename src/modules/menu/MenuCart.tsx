'use client';
import { useState } from 'react';
import { Trash2, ArrowLeftRight, ShoppingBag } from 'lucide-react';
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
} from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { useNavStore } from '@/store/navStore';
import { can, canFecharMesa } from '@/lib/permissions';
import { getProductImage } from '@/shared/lib/utils';
import { formatCurrency } from '@/shared/lib/numberUtils';
import {
    CheckoutCurrentTable,
    ImprimirContaMesa,
    SendCurrentTableOrderKitchen,
    ExcluirItemMesa,
    TransferirItemMesa,
    ListaItensMesa,
} from './menuCartActions';
import { PaymentSplitEditor } from '@/shared/components/PaymentSplitEditor';
import { isPaymentSplitComplete } from '@/shared/lib/payments';

export function Cart() {
    const mesas = useDataStore((state) => state.mesas);
    const mesaSelecionadaId = useDataStore((state) => state.mesaSelecionadaId);
    const setActiveTab = useNavStore((state) => state.setActiveTab);
    const taxRate = useDataStore((state) => state.config.geralData.taxRate);
    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';
    const clientes = useDataStore((state) => state.clientes);
    const role = useAuthStore((state) => state.user?.role);
    const podeFecharMesa = canFecharMesa(role);
    const podeGerenciarItens = can(role, 'mesas');
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pagamentos, setPagamentos] = useState<VendaPagamentoType[]>([]);

    const clientesFiado = clientes.filter((c) => c.carteiraHabilitada);

    const mesaAtual = mesas.find((mesa) => mesa.id == mesaSelecionadaId);

    const productsStandby = mesaAtual?.products.inCart || [];
    const productsProcessing = mesaAtual?.products.inKitchen || [];
    const productsDone = mesaAtual?.products.alreadyEaten || [];

    const subtotalStandby = productsStandby.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const subtotalProcessing = productsProcessing.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const subtotalDone = productsDone.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const subTotal = subtotalDone + subtotalProcessing + subtotalStandby;
    const tax = subTotal * (taxRate / 100);
    const total = subTotal + tax;

    const pagamentoCompleto = isPaymentSplitComplete(total, pagamentos);

    return (
        <div className=" bg-white border-l flex flex-col h-full">
            <div className="p-4 border-b flex justify-between items-center">
                <div>
                    <div className="flex flex-col md:flex-row items-baseline justify-center gap-3">
                        <h2 className="text-xl font-bold">{mesaAtual?.mesaNome}</h2>
                        <span className="text-gray-500">Cliente: {mesaAtual?.clienteNome}</span>
                    </div>
                </div>
                {mesaAtual && (
                    <Button
                        variant="outline"
                        className="border-green-600 text-green-700 hover:bg-green-50"
                        onClick={() => setActiveTab('Cardápio')}
                    >
                        <ShoppingBag className="h-4 w-4 mr-1" />
                        Adicionar produtos
                    </Button>
                )}
            </div>
            <div className="flex-1 overflow-auto p-4">
                {!mesaAtual && (
                    <h2 className="text-xl font-bold text-center">Nenhuma mesa valida ocupada foi selecionada</h2>
                )}
                <div className="space-y-4">
                    {productsStandby.length != 0 ? (
                        <div className="w-full">
                            <h2 className="text-xl font-bold pb-4">Esperando confirmação da ordem</h2>
                            {productsStandby.map((item, index) => (
                                <CartItem
                                    key={index}
                                    item={item}
                                    section="inCart"
                                    index={index}
                                    mesaId={mesaAtual!.id}
                                    podeGerenciar={podeGerenciarItens}
                                />
                            ))}
                            <Button
                                className=" bg-green-600 hover:bg-green-700 text-white h-12 px-26"
                                onClick={() => SendCurrentTableOrderKitchen(productsStandby)}
                            >
                                Enviar pedido para cozinha
                            </Button>
                        </div>
                    ) : (
                        <h2 className="text-xl font-bold pb-4">Nenhum item no carrinho</h2>
                    )}
                    <div className="h-1 bg-zinc-200 my-6" />
                    {productsProcessing.length != 0 ? (
                        <div>
                            <h2 className="text-xl font-bold pb-4">Sendo preparado na cozinha</h2>
                            {productsProcessing.map((item, index) => (
                                <CartItem
                                    key={index}
                                    item={item}
                                    section="inKitchen"
                                    index={index}
                                    mesaId={mesaAtual!.id}
                                    podeGerenciar={podeGerenciarItens}
                                />
                            ))}
                        </div>
                    ) : (
                        <h2 className="text-xl font-bold pb-4">Nenhum item sendo preparado na cozinha</h2>
                    )}
                    <div className="h-1 bg-zinc-200 my-6" />
                    {productsDone.length != 0 ? (
                        <div>
                            <h2 className="text-xl font-bold pb-4">Já foi consumido</h2>
                            {productsDone.map((item, index) => (
                                <CartItem
                                    key={index}
                                    item={item}
                                    section="alreadyEaten"
                                    index={index}
                                    mesaId={mesaAtual!.id}
                                    podeGerenciar={podeGerenciarItens}
                                />
                            ))}
                        </div>
                    ) : (
                        <h2 className="text-xl font-bold pb-4">Nenhum item foi consumido</h2>
                    )}
                </div>
            </div>
            <div className="border-t p-4">
                <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span>R${subTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Taxa de serviço: {taxRate}%</span>
                        <span>R${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>Valor Total</span>
                        <span>R${total.toFixed(2)}</span>
                    </div>
                </div>

                <h3 className="font-bold text-center pb-3">Recebimento</h3>
                <div className="mb-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-600">Valor da conta</span>
                    <span className="font-bold">{formatCurrency(total, currency)}</span>
                </div>
                <Button
                    variant="outline"
                    className="w-full h-12 mb-2 font-bold"
                    onClick={ImprimirContaMesa}
                    disabled={!mesaAtual || subTotal <= 0}
                >
                    Imprimir conta da mesa
                </Button>
                {podeFecharMesa && (
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-12 mt-0 font-bold"
                        onClick={() => {
                            setPagamentos([]);
                            setConfirmOpen(true);
                        }}
                        disabled={productsProcessing.length > 0 || productsStandby.length > 0 || subTotal <= 0}
                    >
                        Fechar conta e liberar mesa
                    </Button>
                )}
            </div>

            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar recebimento</DialogTitle>
                        <DialogDescription>
                            Confirme o recebimento da mesa {mesaAtual?.mesaNome} antes de finalizar a conta. Divida o
                            valor em quantas formas de pagamento forem necessárias (ex.: Pix, Dinheiro, Fiado e
                            Cartão). Essa ação libera a mesa e registra a venda no caixa.
                        </DialogDescription>
                    </DialogHeader>
                    <PaymentSplitEditor
                        total={total}
                        currency={currency}
                        clientesFiado={clientesFiado}
                        onChange={setPagamentos}
                    />
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setConfirmOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            disabled={!pagamentoCompleto}
                            onClick={() => {
                                setConfirmOpen(false);
                                CheckoutCurrentTable(pagamentos);
                            }}
                        >
                            Confirmar recebimento
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CartItem({
    item,
    section,
    index,
    mesaId,
    podeGerenciar,
}: {
    item: FoodCartType;
    section: ListaItensMesa;
    index: number;
    mesaId: number;
    podeGerenciar: boolean;
}) {
    const [modal, setModal] = useState<'excluir' | 'transferir' | null>(null);
    const [senha, setSenha] = useState('');
    const [motivo, setMotivo] = useState('');
    const [destinoId, setDestinoId] = useState<number | ''>('');
    const mesas = useDataStore((state) => state.mesas);
    const image = getProductImage(item.foodId);

    const destinos = mesas.filter((m) => m.id !== mesaId && m.id !== -1 && m.status === 'ocupada');

    const confirmarExclusao = async () => {
        const ok = await ExcluirItemMesa({ mesaId, lista: section, indice: index, password: senha, motivo });
        if (ok) {
            setModal(null);
            setSenha('');
            setMotivo('');
        }
    };

    const confirmarTransferencia = async () => {
        if (destinoId === '') return;
        const ok = await TransferirItemMesa({
            mesaOrigemId: mesaId,
            mesaDestinoId: Number(destinoId),
            lista: section,
            indice: index,
        });
        if (ok) {
            setModal(null);
            setDestinoId('');
        }
    };

    return (
        <div className="flex items-center gap-3 mb-4">
            {image ? (
                <img
                    src={image}
                    alt={item.title}
                    width={500}
                    height={500}
                    className="w-16 h-16 rounded-lg object-cover"
                />
            ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0" />
            )}
            <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-medium">{item.title}</h4>
                    {item.transferOrigin && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium whitespace-nowrap">
                            Origem: {item.transferOrigin}
                        </span>
                    )}
                </div>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-green-600 font-bold">R${item.price.toFixed(2)}</span>
                    <span>{item.quantity}X</span>
                </div>
            </div>
            {podeGerenciar && (
                <div className="flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={() => setModal('transferir')}
                        title="Transferir para outra mesa"
                        className="text-blue-600 hover:bg-blue-50 rounded p-1"
                    >
                        <ArrowLeftRight className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setModal('excluir')}
                        title="Excluir item"
                        className="text-red-600 hover:bg-red-50 rounded p-1"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            )}

            <Dialog open={modal === 'excluir'} onOpenChange={(open) => !open && setModal(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Excluir item</DialogTitle>
                        <DialogDescription>
                            Confirme a exclusão de <strong>{item.title}</strong> (× {item.quantity}). Informe a senha de
                            um usuário com permissão e o motivo da exclusão.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="senha-excluir">Senha do usuário</Label>
                            <Input
                                id="senha-excluir"
                                type="password"
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                placeholder="Senha para confirmar"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="motivo-excluir">Motivo da exclusão</Label>
                            <Input
                                id="motivo-excluir"
                                value={motivo}
                                onChange={(e) => setMotivo(e.target.value)}
                                placeholder="Ex.: item pedido por engano"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 h-11" onClick={() => setModal(null)}>
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 h-11 bg-red-600 hover:bg-red-700 text-white"
                                disabled={!senha || !motivo.trim()}
                                onClick={confirmarExclusao}
                            >
                                Confirmar exclusão
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={modal === 'transferir'} onOpenChange={(open) => !open && setModal(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Transferir item</DialogTitle>
                        <DialogDescription>
                            Transfira <strong>{item.title}</strong> (× {item.quantity}) para outra mesa. O item receberá
                            a tag com a origem da transferência.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                        <div className="space-y-2">
                            <Label htmlFor="destino-select">Mesa de destino</Label>
                            <select
                                id="destino-select"
                                className="w-full border rounded-md p-2 text-sm"
                                value={destinoId}
                                onChange={(e) => setDestinoId(e.target.value === '' ? '' : Number(e.target.value))}
                            >
                                <option value="">Selecione...</option>
                                {destinos.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.mesaNome} - {m.clienteNome || 'Sem cliente'}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" className="flex-1 h-11" onClick={() => setModal(null)}>
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1 h-11 bg-blue-600 hover:bg-blue-700 text-white"
                                disabled={destinoId === ''}
                                onClick={confirmarTransferencia}
                            >
                                Confirmar transferência
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
