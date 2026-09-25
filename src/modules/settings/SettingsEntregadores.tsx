import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { PlusCircle, Trash, Phone, Edit } from 'lucide-react';
import { removeEntregador, createEntregador, updateEntregador } from './settingsActions';
import { useState } from 'react';
import { showMessage } from '@/store/popupStore';

export function DeliverySettings() {
    const entregadores = useDataStore((state) => state.config.entregadores);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [tempEntregador, setTempEntregador] = useState({ nome: '', telefone: '' });
    const [editandoId, setEditandoId] = useState<number | null>(null);
    const [editando, setEditando] = useState({ nome: '', telefone: '' });

    function AddEntregador() {
        const cadastrado = createEntregador(tempEntregador.nome, tempEntregador.telefone);
        if (!cadastrado) return;
        setDialogOpen(false);
        setTempEntregador({ nome: '', telefone: '' });
    }

    function StartEdit(entregador: EntregadorType) {
        setEditandoId(entregador.id);
        setEditando({ nome: entregador.nome, telefone: entregador.telefone });
    }

    function SaveEdit() {
        if (editandoId == null) return;
        if (!editando.nome.trim()) {
            showMessage('Informe o nome do entregador.', 'error');
            return;
        }
        updateEntregador(editandoId, { nome: editando.nome.trim(), telefone: editando.telefone.trim() });
        setEditandoId(null);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Entregadores</h2>
                <Button className="bg-green-600 hover:bg-green-700 cursor-pointer" onClick={() => setDialogOpen(true)}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Entregador
                </Button>
            </div>

            <div className="border rounded-md overflow-scroll">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-3">Nome</th>
                            <th className="text-left p-3">Telefone</th>
                            <th className="text-right p-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {entregadores.map((entregador) => (
                            <tr key={entregador.id} className="border-t">
                                <td className="p-3">{entregador.nome}</td>
                                <td className="p-3">{entregador.telefone || '-'}</td>
                                <td className="p-3 inline-flex flex-row items-end justify-end w-full gap-3">
                                    <Edit
                                        size={25}
                                        className="cursor-pointer"
                                        onClick={() => StartEdit(entregador)}
                                    />
                                    <Trash
                                        size={25}
                                        className="text-red-500 cursor-pointer"
                                        onClick={() => removeEntregador(entregador.id)}
                                    />
                                </td>
                            </tr>
                        ))}
                        {entregadores.length === 0 && (
                            <tr>
                                <td className="p-3 text-gray-500" colSpan={3}>
                                    Nenhum entregador cadastrado. Adicione entregadores ou cadastre automaticamente ao
                                    atribuir uma entrega.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicione um entregador</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Nome do entregador</Label>
                                    <Input
                                        value={tempEntregador.nome}
                                        onChange={(e) =>
                                            setTempEntregador((prev) => ({ ...prev, nome: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>
                                        <Phone className="inline h-3 w-3 mr-1" />
                                        Telefone
                                    </Label>
                                    <Input
                                        value={tempEntregador.telefone}
                                        onChange={(e) =>
                                            setTempEntregador((prev) => ({ ...prev, telefone: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            onClick={AddEntregador}
                        >
                            Adicionar agora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={editandoId != null} onOpenChange={(open) => !open && setEditandoId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar entregador</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Nome do entregador</Label>
                                    <Input
                                        value={editando.nome}
                                        onChange={(e) => setEditando((prev) => ({ ...prev, nome: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>
                                        <Phone className="inline h-3 w-3 mr-1" />
                                        Telefone
                                    </Label>
                                    <Input
                                        value={editando.telefone}
                                        onChange={(e) => setEditando((prev) => ({ ...prev, telefone: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 font-bold"
                            onClick={SaveEdit}
                        >
                            Salvar alterações
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}