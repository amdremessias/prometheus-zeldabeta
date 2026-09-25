'use client';
import { useState } from 'react';
import {
    UserPlus,
    Search,
    Pencil,
    Trash2,
    Wallet,
    History,
    Banknote,
    Phone,
    Mail,
    MapPin,
    Users,
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
    DialogTrigger,
    Input,
    Label,
    Switch,
} from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { formatCurrency, formatDateTimeBR } from '@/shared/lib/numberUtils';
import {
    ClienteInput,
    RemoverCliente,
    SalvarCliente,
    ToggleCarteiraCliente,
} from './clienteActions';
import { ClientePaymentDialog } from './ClientePaymentDialog';

export function ClientesScreen() {
    const clientes = useDataStore((state) => state.clientes);
    const currency = useDataStore((state) => state.config.geralData.currency) || 'BRL';
    const [search, setSearch] = useState('');
    const [editingCliente, setEditingCliente] = useState<ClienteType | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [paymentCliente, setPaymentCliente] = useState<ClienteType | null>(null);
    const [historyCliente, setHistoryCliente] = useState<ClienteType | null>(null);

    const filtered = clientes.filter(
        (c) =>
            c.nome.toLowerCase().includes(search.toLowerCase()) ||
            c.telefone.includes(search) ||
            c.email.toLowerCase().includes(search.toLowerCase())
    );

    const totalClientes = clientes.length;
    const carteirasAtivas = clientes.filter((c) => c.carteiraHabilitada).length;
    const totalAReceber = clientes.reduce((acc, c) => acc + Math.max(0, c.saldo), 0);

    const openNew = () => {
        setEditingCliente(null);
        setIsFormOpen(true);
    };

    const openEdit = (cliente: ClienteType) => {
        setEditingCliente(cliente);
        setIsFormOpen(true);
    };

    return (
        <div className="w-full space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Users className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Clientes</p>
                            <p className="text-2xl font-bold">{totalClientes}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Wallet className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Carteiras ativas</p>
                            <p className="text-2xl font-bold">{carteirasAtivas}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-3">
                        <Banknote className="h-8 w-8 text-green-600" />
                        <div>
                            <p className="text-sm text-gray-500">Total a receber (fiado)</p>
                            <p className="text-2xl font-bold text-red-600">
                                {formatCurrency(totalAReceber, currency)}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                        type="text"
                        placeholder="Buscar cliente por nome, telefone ou email..."
                        className="pl-10 w-full"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button
                    className="bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                    onClick={openNew}
                >
                    <UserPlus className="h-5 w-5 mr-2" />
                    Novo Cliente
                </Button>
            </div>

            {filtered.length === 0 && (
                <Card>
                    <CardContent className="p-10 text-center">
                        <h2 className="font-bold text-2xl">
                            {clientes.length === 0
                                ? 'Nenhum cliente cadastrado. Cadastre um novo cliente para começar.'
                                : 'Nenhum cliente encontrado com o filtro atual.'}
                        </h2>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((cliente) => (
                    <ClienteCard
                        key={cliente.id}
                        cliente={cliente}
                        currency={currency}
                        onEdit={() => openEdit(cliente)}
                        onToggleCarteira={() => ToggleCarteiraCliente(cliente.id)}
                        onPayment={() => setPaymentCliente(cliente)}
                        onHistory={() => setHistoryCliente(cliente)}
                    />
                ))}
            </div>

            <ClienteFormDialog
                open={isFormOpen}
                onOpenChange={setIsFormOpen}
                cliente={editingCliente}
            />

            <ClientePaymentDialog
                cliente={paymentCliente}
                onClose={() => setPaymentCliente(null)}
                currency={currency}
            />

            <HistoryDialog
                cliente={historyCliente}
                onClose={() => setHistoryCliente(null)}
                currency={currency}
            />
        </div>
    );
}

function ClienteCard({
    cliente,
    currency,
    onEdit,
    onToggleCarteira,
    onPayment,
    onHistory,
}: {
    cliente: ClienteType;
    currency: string;
    onEdit: () => void;
    onToggleCarteira: () => void;
    onPayment: () => void;
    onHistory: () => void;
}) {
    const temSaldo = cliente.saldo > 0;
    const podeDesabilitar = !(cliente.carteiraHabilitada && temSaldo);

    return (
        <Card className="flex flex-col">
            <CardContent className="p-4 flex flex-col gap-3 flex-1">
                <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                        <h3 className="font-bold text-lg truncate">{cliente.nome}</h3>
                        <div className="flex flex-col gap-1 text-sm text-gray-500 mt-1">
                            {cliente.telefone && (
                                <span className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5 shrink-0" /> {cliente.telefone}
                                </span>
                            )}
                            {cliente.email && (
                                <span className="flex items-center gap-2 truncate">
                                    <Mail className="h-3.5 w-3.5 shrink-0" /> {cliente.email}
                                </span>
                            )}
                            {cliente.endereco && (
                                <span className="flex items-center gap-2 truncate">
                                    <MapPin className="h-3.5 w-3.5 shrink-0" /> {cliente.endereco}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div>
                        <p className="text-xs text-gray-500">Saldo em carteira</p>
                        <p className={`text-xl font-bold ${temSaldo ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(cliente.saldo, currency)}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-green-600" />
                            <Switch checked={cliente.carteiraHabilitada} onCheckedChange={onToggleCarteira} disabled={!podeDesabilitar} />
                        </div>
                        <span className="text-xs text-gray-500">
                            {cliente.carteiraHabilitada ? 'Fiado habilitado' : 'Fiado desabilitado'}
                        </span>
                    </div>
                </div>

                {cliente.carteiraHabilitada && (
                    <Button
                        variant="outline"
                        className="w-full h-11 gap-2"
                        onClick={onPayment}
                        disabled={!temSaldo}
                    >
                        <Banknote className="h-4 w-4" />
                        {temSaldo ? 'Registrar pagamento' : 'Saldo em dia'}
                    </Button>
                )}

                <div className="flex items-center gap-2 mt-auto pt-1">
                    <Button variant="ghost" className="flex-1 h-11 gap-2" onClick={onHistory}>
                        <History className="h-4 w-4" /> Extrato
                    </Button>
                    <Button variant="ghost" size="icon" className="h-11 w-11" onClick={onEdit}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-red-600"
                        onClick={() => {
                            if (window.confirm(`Excluir o cliente "${cliente.nome}"?`)) {
                                RemoverCliente(cliente.id);
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

function ClienteFormDialog({
    open,
    onOpenChange,
    cliente,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    cliente: ClienteType | null;
}) {
    const isEdit = !!cliente;
    const [form, setForm] = useState<ClienteInput>({
        nome: '',
        telefone: '',
        email: '',
        endereco: '',
        observacao: '',
        carteiraHabilitada: false,
    });

    // Sincroniza o formulário quando abre o dialog
    const handleOpenChange = (next: boolean) => {
        if (next && cliente) {
            setForm({
                nome: cliente.nome,
                telefone: cliente.telefone,
                email: cliente.email,
                endereco: cliente.endereco,
                observacao: cliente.observacao || '',
                carteiraHabilitada: cliente.carteiraHabilitada,
            });
        }
        if (next && !cliente) {
            setForm({ nome: '', telefone: '', email: '', endereco: '', observacao: '', carteiraHabilitada: false });
        }
        onOpenChange(next);
    };

    const handleSubmit = () => {
        if (!form.nome.trim()) return;
        SalvarCliente({ id: cliente?.id, ...form });
        onOpenChange(false);
    };

    const setField = (field: keyof ClienteInput, value: string | boolean) =>
        setForm((prev) => ({ ...prev, [field]: value }));

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <span className="hidden" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? 'Altere as informações do cliente. Alterações são salvas automaticamente.'
                            : 'Preencha os dados para cadastrar um novo cliente.'}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="cliente-nome" className="required">
                            Nome *
                        </Label>
                        <Input
                            id="cliente-nome"
                            value={form.nome}
                            onChange={(e) => setField('nome', e.target.value)}
                            placeholder="Nome do cliente"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cliente-tel">Telefone</Label>
                            <Input
                                id="cliente-tel"
                                value={form.telefone}
                                onChange={(e) => setField('telefone', e.target.value)}
                                placeholder="(00) 00000-0000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cliente-email">E-mail</Label>
                            <Input
                                id="cliente-email"
                                type="email"
                                value={form.email}
                                onChange={(e) => setField('email', e.target.value)}
                                placeholder="email@exemplo.com"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cliente-end">Endereço</Label>
                        <Input
                            id="cliente-end"
                            value={form.endereco}
                            onChange={(e) => setField('endereco', e.target.value)}
                            placeholder="Endereço do cliente"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="cliente-obs">Observação</Label>
                        <Input
                            id="cliente-obs"
                            value={form.observacao}
                            onChange={(e) => setField('observacao', e.target.value)}
                            placeholder="Anotações sobre o cliente (opcional)"
                        />
                    </div>
                    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                        <div>
                            <p className="font-semibold text-sm">Carteira (fiado)</p>
                            <p className="text-xs text-gray-500">
                                Permite que este cliente compre fiado e tenha saldo em carteira.
                            </p>
                        </div>
                        <Switch checked={form.carteiraHabilitada} onCheckedChange={(v) => setField('carteiraHabilitada', v)} />
                    </div>
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                        onClick={handleSubmit}
                        disabled={!form.nome.trim()}
                    >
                        {isEdit ? 'Salvar alterações' : 'Cadastrar cliente'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function HistoryDialog({
    cliente,
    onClose,
    currency,
}: {
    cliente: ClienteType | null;
    onClose: () => void;
    currency: string;
}) {
    return (
        <Dialog open={!!cliente} onOpenChange={(open) => !open && onClose()}>
            <DialogTrigger asChild>
                <span className="hidden" />
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Extrato - {cliente?.nome}</DialogTitle>
                    <DialogDescription>
                        Saldo atual: {formatCurrency(cliente?.saldo || 0, currency)}
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[50vh] overflow-y-auto space-y-2 pt-2">
                    {cliente?.movimentacoes.length === 0 && (
                        <p className="text-center text-gray-500 py-6">Nenhuma movimentação registrada.</p>
                    )}
                    {cliente?.movimentacoes.map((mov) => (
                        <div
                            key={mov.id}
                            className="flex justify-between items-center border-b pb-2 last:border-0"
                        >
                            <div>
                                <p className="font-medium text-sm">{mov.description}</p>
                                <p className="text-xs text-gray-500">{formatDateTimeBR(mov.createdAt)}</p>
                            </div>
                            <span
                                className={`font-bold ${
                                    mov.tipo === 'debito' ? 'text-red-600' : 'text-green-600'
                                }`}
                            >
                                {mov.tipo === 'debito' ? '+' : '-'}
                                {formatCurrency(Math.abs(mov.amount), currency)}
                            </span>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}