import { CreditCard, QrCode, Banknote, Truck, MapPinned, HandCoins } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, Input, Label } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { getProductImage } from '@/shared/lib/utils';
import { useNavStore } from '@/store/navStore';
import { SendDeliveryOrderToKitchen, SendTakeOutOrderToKitchen } from './DeliveryActions';
import { useState } from 'react';

export function DeliveryCart() {
    const deliverySelecionado = useDataStore((state) => state.deliverySelecionado);
    const setDeliverySelecionado = useDataStore((state) => state.setDeliverySelecionado);

    const setActiveTab = useNavStore((state) => state.setActiveTab);
    const [dialogOpen, setDialogOpen] = useState(false);
    const taxRate = useDataStore((state) => state.config.geralData.taxRate);
    const clientes = useDataStore((state) => state.clientes);

    const clientesFiado = clientes.filter((c) => c.carteiraHabilitada);

    const productsStandby = deliverySelecionado?.inCart || [];
    const subtotalStandby = productsStandby.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const subTotal = subtotalStandby;
    const tax = subTotal * (taxRate / 100);
    const total = subTotal + tax;

    const sendKitchen = () =>
        deliverySelecionado.type == 'delivery'
            ? SendDeliveryOrderToKitchen(productsStandby, total)
            : SendTakeOutOrderToKitchen(productsStandby);

    const isDisabled =
        productsStandby.length == 0 ||
        !deliverySelecionado.customer ||
        !deliverySelecionado.phone ||
        (deliverySelecionado.payments.type == 'fiado' && !deliverySelecionado.payments.clienteId);

    return (
        <div className="bg-white border-l flex flex-col h-full">
            <div className="flex-1 overflow-auto p-0">
                <div className="space-y-4">
                    <button
                        onClick={() => setActiveTab('Cardápio', true)}
                        className="bg-green-600 text-white font-bold text-xl text-center p-4 w-full cursor-pointer"
                    >
                        Clique aqui para ir no Cardápio no modo delivery
                    </button>
                    {productsStandby.length != 0 ? (
                        <div className="w-full p-6">
                            <h2 className="text-xl font-bold pb-4">Esperando confirmação da ordem</h2>
                            {productsStandby.map((item, index) => (
                                <CartItem key={index} {...item} />
                            ))}
                        </div>
                    ) : (
                        <h2 className="text-2xl font-bold p-6 text-center">Carrinho está vazio no momento</h2>
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
                        <span className="text-gray-600">Taxa 5%</span>
                        <span>R${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                        <span>Valor Total</span>
                        <span>R${total.toFixed(2)}</span>
                    </div>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            className="flex-1 w-full bg-green-600 hover:bg-green-700 hover:text-white text-white h-12 font-bold"
                        >
                            Preencher dados e fechar o pedido
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Preencha esses dados para enviar o pedido</DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-4 pt-5">
                            <div className="flex justify-start items-start flex-col">
                                <div className="gap-4 grid w-full">
                                    <div className="space-y-2 col-span-full md:col-span-1">
                                        <Label htmlFor="customer-name">Nome do Cliente</Label>
                                        <Input
                                            id="customer-name"
                                            defaultValue={deliverySelecionado.customer}
                                            onChange={(e) =>
                                                setDeliverySelecionado((prev) => {
                                                    return { ...prev, customer: e.target.value };
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 col-span-full md:col-span-1">
                                        <Label htmlFor="server">Telefone</Label>
                                        <Input
                                            id="server"
                                            defaultValue={deliverySelecionado.phone}
                                            onChange={(e) =>
                                                setDeliverySelecionado((prev) => {
                                                    return { ...prev, phone: e.target.value };
                                                })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2 w-full col-span-full md:col-span-2">
                                        <Label htmlFor="server">Endereco</Label>
                                        <Input
                                            id="server"
                                            defaultValue={deliverySelecionado.address}
                                            onChange={(e) =>
                                                setDeliverySelecionado((prev) => {
                                                    return { ...prev, address: e.target.value };
                                                })
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center items-start flex-col ">
                                <h3 className="font-bold pb-4">Tipo de recibemento</h3>
                                <div className="flex flex-col md:flex-row justify-center  gap-2 w-full">
                                    <Button
                                        size={'lg'}
                                        variant="outline"
                                        className={`flex flex-row items-center py-2 flex-1 ${
                                            deliverySelecionado.type == 'delivery' &&
                                            'bg-green-600 hover:bg-green-600 hover:text-white text-white'
                                        }`}
                                        onClick={() =>
                                            setDeliverySelecionado((prev) => {
                                                return { ...prev, type: 'delivery' };
                                            })
                                        }
                                    >
                                        <Truck className="h-5 w-5" />
                                        <span>Entregar</span>
                                    </Button>
                                    <Button
                                        size={'lg'}
                                        variant="outline"
                                        className={`flex flex-row items-center py-2 flex-1 ${
                                            deliverySelecionado.type == 'takeout' &&
                                            'bg-green-600 hover:bg-green-600 hover:text-white text-white'
                                        }`}
                                        onClick={() =>
                                            setDeliverySelecionado((prev) => {
                                                return { ...prev, type: 'takeout' };
                                            })
                                        }
                                    >
                                        <MapPinned className="h-5 w-5" />
                                        <span>Retirar</span>
                                    </Button>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-bold text-left pb-3">Metodo de pagamento</h3>
                                <div className="grid md:grid-cols-2 gap-2 mb-4">
                                    <Button
                                        variant="outline"
                                        size={'lg'}
                                        className={`flex flex-row items-center py-2  ${
                                            deliverySelecionado.payments.type == 'dinheiro' &&
                                            'bg-green-600 hover:bg-green-600 hover:text-white text-white'
                                        }`}
                                        onClick={() =>
                                            setDeliverySelecionado((prev) => {
                                                return {
                                                    ...prev,
                                                    payments: { ...prev.payments, type: 'dinheiro' },
                                                };
                                            })
                                        }
                                    >
                                        <Banknote className="h-5 w-5" />
                                        <span>Dinheiro</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size={'lg'}
                                        className={`flex flex-row items-center py-2  ${
                                            deliverySelecionado.payments.type == 'cartao' &&
                                            'bg-green-600 hover:bg-green-600 hover:text-white text-white'
                                        }`}
                                        onClick={() =>
                                            setDeliverySelecionado((prev) => {
                                                return { ...prev, payments: { ...prev.payments, type: 'cartao' } };
                                            })
                                        }
                                    >
                                        <CreditCard className="h-5 w-5" />
                                        <span>Cartão</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size={'lg'}
                                        className={`flex flex-row items-center py-2  ${
                                            deliverySelecionado.payments.type == 'pix' &&
                                            'bg-green-600 hover:bg-green-600 hover:text-white text-white'
                                        }`}
                                        onClick={() =>
                                            setDeliverySelecionado((prev) => {
                                                return { ...prev, payments: { ...prev.payments, type: 'pix' } };
                                            })
                                        }
                                    >
                                        <QrCode className="h-5 w-5" />
                                        <span>Pix</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size={'lg'}
                                        className={`flex flex-row items-center py-2  ${
                                            deliverySelecionado.payments.type == 'fiado' &&
                                            'bg-green-600 hover:bg-green-600 hover:text-white text-white'
                                        }`}
                                        onClick={() =>
                                            setDeliverySelecionado((prev) => {
                                                return { ...prev, payments: { ...prev.payments, type: 'fiado' } };
                                            })
                                        }
                                    >
                                        <HandCoins className="h-5 w-5" />
                                        <span>Fiado</span>
                                    </Button>
                                </div>
                                {deliverySelecionado.payments.type == 'fiado' && (
                                    <div className="mb-4">
                                        <label className="text-sm text-gray-600 block mb-1">
                                            Cliente (carteira habilitada)
                                        </label>
                                        <select
                                            className="w-full border rounded-md p-2 text-sm"
                                            value={deliverySelecionado.payments.clienteId ?? ''}
                                            onChange={(e) => {
                                                const cid = e.target.value ? Number(e.target.value) : undefined;
                                                const cliente = clientesFiado.find((c) => c.id === cid);
                                                setDeliverySelecionado((prev) => ({
                                                    ...prev,
                                                    payments: {
                                                        ...prev.payments,
                                                        clienteId: cid,
                                                        clienteNome: cliente?.nome,
                                                    },
                                                }));
                                            }}
                                        >
                                            <option value="">Selecione o cliente...</option>
                                            {clientesFiado.map((cliente) => (
                                                <option key={cliente.id} value={cliente.id}>
                                                    {cliente.nome}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                                onClick={() => {
                                    sendKitchen();
                                    setDialogOpen(false);
                                }}
                                disabled={isDisabled}
                            >
                                Fechar pedido e enviar para cozinha
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}

function CartItem(item: FoodCartType) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <img
                src={getProductImage(item.foodId) || ''}
                alt={item.title}
                width={500}
                height={500}
                className="w-16 h-16 rounded-lg object-cover"
            />
            <div className="flex-1">
                <h4 className="text-sm font-medium">{item.title}</h4>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-green-600 font-bold">R${item.price.toFixed(2)}</span>
                    <span>{item.quantity}X</span>
                </div>
            </div>
        </div>
    );
}
