'use client';
import {
    Clock,
    User,
    HandPlatter,
    Edit2,
    ShoppingBag,
    Smile,
    UserPlus,
    ChefHat,
    ShoppingCart,
    DollarSign,
} from 'lucide-react';
import {
    DialogHeader,
    Input,
    Label,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
    Card,
    CardContent,
} from '@/shared/ui';
import { useState } from 'react';
import { useNavStore } from '@/store/navStore';
import { useDataStore } from '@/store/userStore';
import { getHours } from '@/shared/lib/utils';
import { showMessage } from '@/store/popupStore';
import { sumTableTotalCost } from '@/shared/lib/numberUtils';

const statusColors = {
    livre: 'bg-green-100 text-green-600',
    ocupada: 'bg-red-100 text-red-600',
    reservada: 'bg-yellow-100 text-yellow-600',
};

export default function TableCard(mesa: TablesType) {
    const setActiveTab = useNavStore((state) => state.setActiveTab);

    const setMesaSelecionadaId = useDataStore((state) => state.setMesaSelecionadaId);
    const setMesas = useDataStore((state) => state.setMesas);

    const [tempCustomer, setTempCustomer] = useState(mesa);
    const [dialogOpen, setDialogOpen] = useState(false);

    async function EditClient() {
        setMesas((prev) =>
            prev.map((mesaX) => {
                if (mesaX.id != mesa.id) return mesaX;

                return {
                    ...tempCustomer,
                    status: 'ocupada',
                    usedAt: tempCustomer.usedAt || getHours(),
                };
            })
        );
        setDialogOpen(false);
        showMessage('Mesa editada com sucesso');
    }

    async function SeeDetails() {
        setMesaSelecionadaId(mesa.id);
        setActiveTab('Carrinho');
    }

    return (
        <Card key={mesa.id} className="overflow-hidden h-full min-h-[300px]">
            <CardContent className="p-4 py-1 h-full flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-bold">{mesa.mesaNome}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[mesa.status]}`}>
                        {mesa.status.charAt(0).toUpperCase() + mesa.status.slice(1)}
                    </span>
                </div>

                {mesa.status !== 'livre' && (
                    <div className="space-y-2 mb-3">
                        <div className="flex items-center text-sm text-gray-600">
                            <User className="h-4 w-4 mr-2" />
                            <span>
                                {mesa.clienteNome} + {mesa.guests} pessoas
                            </span>
                        </div>
                        {mesa.usedAt && (
                            <div className="flex items-center text-sm text-gray-600">
                                <Clock className="h-4 w-4 mr-2" />
                                <span>{mesa.usedAt}</span>
                            </div>
                        )}
                        {mesa.waiter && (
                            <div className="flex items-center text-sm text-gray-600">
                                <HandPlatter className="h-4 w-4 mr-2" />
                                <span>Garçon: {mesa.waiter}</span>
                            </div>
                        )}

                        <div className="flex items-center text-sm text-gray-600">
                            <DollarSign className="h-4 w-4 mr-2" />
                            <span>
                                Total gasto: <span className="text-green-600">R$ {sumTableTotalCost(mesa)}</span>
                            </span>
                        </div>

                        {mesa.products.inKitchen.length === 0 && mesa.products.inCart.length === 0 ? (
                            <div className="flex items-center text-sm text-green-500">
                                <Smile className="h-4 w-4 mr-2" />
                                <span>Sem produtos pendentes</span>
                            </div>
                        ) : mesa.products.inKitchen.length > 0 ? (
                            <div className="flex items-center text-sm text-yellow-500">
                                <ChefHat className="h-4 w-4 mr-2" />
                                <span>Há produtos em preparo na cozinha</span>
                            </div>
                        ) : (
                            <div className="flex items-center text-sm text-orange-500">
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                <span>Há produtos no carrinho</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex flex-wrap gap-2 mt-auto">
                    {mesa.status !== 'livre' ? (
                        <>
                            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline" className="flex-1">
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        Editar cliente
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Editando informações sobre o cliente</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="customer-name">Nome do Cliente</Label>
                                            <Input
                                                id="customer-name"
                                                value={tempCustomer.clienteNome}
                                                onChange={(e) =>
                                                    setTempCustomer({ ...tempCustomer, clienteNome: e.target.value })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="total-guests">Total de pessoas</Label>
                                            <Input
                                                id="total-guests"
                                                type="number"
                                                value={tempCustomer.guests}
                                                onChange={(e) =>
                                                    setTempCustomer({ ...tempCustomer, guests: Number(e.target.value) })
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="server">Garçon responsavel sobre a mesa</Label>
                                            <Input
                                                id="server"
                                                value={tempCustomer.waiter}
                                                onChange={(e) =>
                                                    setTempCustomer({ ...tempCustomer, waiter: e.target.value })
                                                }
                                            />
                                        </div>
                                        <Button onClick={EditClient} className="w-full">
                                            Salvar
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                            <Button variant="outline" className="flex-1 " onClick={SeeDetails}>
                                <ShoppingBag /> Ver carrinho
                            </Button>
                        </>
                    ) : (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="flex-1 bg-blue-500 text-white hover:bg-blue-500/80 hover:text-white"
                                >
                                    <UserPlus />
                                    Ocupar mesa
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Forneca informações sobre o cliente</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="customer-name">Qual o nome do cliente?</Label>
                                        <Input
                                            id="customer-name"
                                            value={tempCustomer.clienteNome}
                                            onChange={(e) =>
                                                setTempCustomer({ ...tempCustomer, clienteNome: e.target.value })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="total-guests">Quantas convidados irão ter?</Label>
                                        <Input
                                            id="total-guests"
                                            type="number"
                                            value={tempCustomer.guests}
                                            onChange={(e) =>
                                                setTempCustomer({ ...tempCustomer, guests: Number(e.target.value) })
                                            }
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="server">Qual será o garçon responsavel para essa mesa?</Label>
                                        <Input
                                            id="server"
                                            value={tempCustomer.waiter}
                                            onChange={(e) =>
                                                setTempCustomer({ ...tempCustomer, waiter: e.target.value })
                                            }
                                        />
                                    </div>
                                    <Button onClick={EditClient} className="w-full">
                                        Salvar
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
