import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { Edit, Trash, Plus } from 'lucide-react';
import { removeMesa, updateMesa } from './settingsActions';
import { useState } from 'react';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';
import { showMessage } from '@/store/popupStore';

export default function SettingsTables() {
    const mesas = useDataStore((state) => state.mesas);
    const setMesas = useDataStore((state) => state.setMesas);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [tempMesa, setTempMesa] = useState({
        mesaNome: '',
    });
    const [editandoId, setEditandoId] = useState<number | null>(null);
    const [nomeEditado, setNomeEditado] = useState('');

    function AddMesa() {
        setMesas((prev) => [
            ...prev,
            {
                id: encontrarMenorIdDisponivel(prev),
                mesaNome: tempMesa.mesaNome,
                status: 'livre',
                guests: 0,
                usedAt: '',
                waiter: '',
                clienteNome: '',
                products: { inCart: [], inKitchen: [], alreadyEaten: [] },
            },
        ]);
        setDialogOpen(false);
        showMessage('Mesa adicionada com sucesso');
    }

    function StartEdit(mesa: TablesType) {
        setEditandoId(mesa.id);
        setNomeEditado(mesa.mesaNome);
    }

    function SaveEdit() {
        if (editandoId == null) return;
        if (!nomeEditado.trim()) {
            showMessage('Informe o nome da mesa.', 'error');
            return;
        }
        updateMesa(editandoId, { mesaNome: nomeEditado.trim() });
        setEditandoId(null);
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Mesas</h2>
                <Button className="bg-green-600 hover:bg-green-700 cursor-pointer" onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Mesas
                </Button>
            </div>

            <div className="border rounded-md overflow-scroll">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-3">Nome da mesa</th>
                            <th className="text-left p-3">Estado</th>
                            <th className="text-left p-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mesas.map((user) => (
                            <tr key={user.id} className="border-t">
                                <td className="p-3">{user.mesaNome}</td>
                                <td className="p-3 capitalize">
                                    <span
                                        className={`px-2 py-1 rounded-full ${
                                            user.status === 'livre'
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-red-100 text-red-600'
                                        }`}
                                    >
                                        {user.status}
                                    </span>
                                </td>
                                <td className="p-3 inline-flex flex-row items-start justify-start w-full gap-3">
                                    <Edit
                                        size={25}
                                        className="cursor-pointer"
                                        onClick={() => StartEdit(user)}
                                    />
                                    <Trash
                                        size={25}
                                        className="text-red-500 cursor-pointer"
                                        onClick={() => removeMesa(user.id)}
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicione uma mesa nova</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>
                                        Nome da mesa{' '}
                                        <span className="italic">(Exemplo: Mesa 1 ou Mesa Especial 2)</span>
                                    </Label>
                                    <Input
                                        onChange={(e) => setTempMesa((prev) => ({ ...prev, mesaNome: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            onClick={AddMesa}
                        >
                            Adicionar agora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={editandoId != null} onOpenChange={(open) => !open && setEditandoId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar mesa</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Nome da mesa</Label>
                                    <Input
                                        value={nomeEditado}
                                        onChange={(e) => setNomeEditado(e.target.value)}
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
