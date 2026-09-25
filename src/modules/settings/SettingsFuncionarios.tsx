import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { PlusCircle, Edit, Trash } from 'lucide-react';
import { removeFuncionario } from './settingsActions';
import { useState } from 'react';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';
import { showMessage } from '@/store/popupStore';

export function UserSettings() {
    const funcionarios = useDataStore((state) => state.config.funcionarios);
    const setConfig = useDataStore((state) => state.setConfig);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [tempFucionario, setTempFucionario] = useState({
        name: '',
        role: '',
    });

    function AddFunctionario() {
        setConfig((prev) => ({
            ...prev,
            funcionarios: [
                ...prev.funcionarios,
                {
                    id: encontrarMenorIdDisponivel(prev.funcionarios),
                    name: tempFucionario.name,
                    role: tempFucionario.role,
                    status: 'Ativo',
                },
            ],
        }));
        setDialogOpen(false);
        showMessage('Funcionario adicionado com sucesso');
        setTempFucionario({
            name: '',
            role: '',
        });
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Funcionarios</h2>
                <Button className="bg-green-600 hover:bg-green-700 cursor-pointer" onClick={() => setDialogOpen(true)}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Funcionarios
                </Button>
            </div>

            <div className="border rounded-md overflow-scroll">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-3">Nome</th>
                            <th className="text-left p-3">Função</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-right p-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {funcionarios.map((user) => (
                            <tr key={user.id} className="border-t">
                                <td className="p-3">{user.name}</td>
                                <td className="p-3">{user.role}</td>
                                <td className="p-3">
                                    <span
                                        className={`px-2 py-1 rounded-full ${
                                            user.status === 'Ativo'
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-red-100 text-red-600'
                                        }`}
                                    >
                                        {user.status}
                                    </span>
                                </td>
                                <td className="p-3 inline-flex flex-row items-end justify-end w-full gap-3">
                                    <Edit size={25} className="cursor-pointer" />
                                    <Trash
                                        size={25}
                                        className="text-red-500 cursor-pointer"
                                        onClick={() => removeFuncionario(user.id)}
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
                        <DialogTitle>Adicione um funcionario</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label htmlFor="customer-name">Nome do funcionario</Label>
                                    <Input
                                        onChange={(e) =>
                                            setTempFucionario((prev) => ({ ...prev, name: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label htmlFor="customer-name">Função</Label>
                                    <Input
                                        onChange={(e) =>
                                            setTempFucionario((prev) => ({ ...prev, role: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            onClick={AddFunctionario}
                        >
                            Adicionar agora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
