'use client';
import { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from '@/shared/ui';
import { PlusCircle, Edit, Trash, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { showMessage } from '@/store/popupStore';
import { USER_ROLES, UserRole } from '@/lib/permissions';
import {
    UserRow,
    fetchUsers,
    createUser,
    updateUser,
    resetUserPassword,
    changeMyPassword,
} from './usersActions';

export function UsersSettings() {
    const currentUser = useAuthStore((state) => state.user);
    const [users, setUsers] = useState<UserRow[]>([]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<UserRow | null>(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'garcom' as UserRole });

    const [passwordDialog, setPasswordDialog] = useState(false);
    const [passwordTarget, setPasswordTarget] = useState<UserRow | null>(null);
    const [newPassword, setNewPassword] = useState('');

    const [myPasswordDialog, setMyPasswordDialog] = useState(false);
    const [myForm, setMyForm] = useState({ currentPassword: '', newPassword: '' });

    const load = async () => {
        setUsers(await fetchUsers());
    };

    useEffect(() => {
        let active = true;
        fetchUsers().then((list) => {
            if (active) setUsers(list);
        });
        return () => {
            active = false;
        };
    }, []);

    const openNew = () => {
        setEditing(null);
        setForm({ name: '', email: '', password: '', role: 'garcom' });
        setDialogOpen(true);
    };

    const openEdit = (user: UserRow) => {
        setEditing(user);
        setForm({ name: user.name, email: user.email, password: '', role: user.role as UserRole });
        setDialogOpen(true);
    };

    const submit = async () => {
        if (!form.name.trim() || !form.email.trim()) {
            showMessage('Informe nome e e-mail.', 'error');
            return;
        }
        try {
            if (editing) {
                await updateUser(editing.id, {
                    name: form.name,
                    email: form.email,
                    role: form.role,
                });
                showMessage('Usuário atualizado com sucesso!');
            } else {
                if (form.password.length < 6) {
                    showMessage('A senha deve ter no mínimo 6 caracteres.', 'error');
                    return;
                }
                await createUser({
                    name: form.name,
                    email: form.email,
                    password: form.password,
                    role: form.role,
                });
                showMessage('Usuário criado com sucesso!');
            }
            setDialogOpen(false);
            await load();
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao salvar usuário.', 'error');
        }
    };

    const toggleActive = async (user: UserRow) => {
        try {
            await updateUser(user.id, { active: !user.active });
            showMessage(user.active ? 'Usuário desativado.' : 'Usuário ativado.');
            await load();
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao alterar status.', 'error');
        }
    };

    const openReset = (user: UserRow) => {
        setPasswordTarget(user);
        setNewPassword('');
        setPasswordDialog(true);
    };

    const submitReset = async () => {
        if (!passwordTarget) return;
        try {
            await resetUserPassword(passwordTarget.id, newPassword);
            showMessage(`Senha de ${passwordTarget.name} redefinida!`);
            setPasswordDialog(false);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao redefinir senha.', 'error');
        }
    };

    const submitMyPassword = async () => {
        try {
            await changeMyPassword(myForm.currentPassword, myForm.newPassword);
            showMessage('Senha alterada com sucesso!');
            setMyPasswordDialog(false);
            setMyForm({ currentPassword: '', newPassword: '' });
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao trocar a senha.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="text-xl font-bold">Usuários</h2>
                    <p className="text-sm text-gray-500">Quem acessa o sistema (login) e o nível de acesso.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setMyPasswordDialog(true)}>
                        <KeyRound className="h-4 w-4 mr-2" />
                        Trocar minha senha
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700 cursor-pointer" onClick={openNew}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Novo usuário
                    </Button>
                </div>
            </div>

            <div className="border rounded-md overflow-scroll">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-3">Nome</th>
                            <th className="text-left p-3">E-mail</th>
                            <th className="text-left p-3">Papel</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-right p-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id} className="border-t">
                                <td className="p-3">
                                    {user.name}
                                    {currentUser?.id === user.id && (
                                        <span className="ml-2 text-xs text-green-600">(você)</span>
                                    )}
                                </td>
                                <td className="p-3">{user.email}</td>
                                <td className="p-3">
                                    <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs">
                                        {USER_ROLES.find((r) => r.value === user.role)?.label || user.role}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <span
                                        className={`px-2 py-1 rounded-full text-xs ${
                                            user.active
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-red-100 text-red-600'
                                        }`}
                                    >
                                        {user.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <div className="inline-flex flex-row items-center justify-end w-full gap-3">
                                        <KeyRound
                                            size={20}
                                            className="cursor-pointer"
                                            onClick={() => openReset(user)}
                                        />
                                        <Edit size={20} className="cursor-pointer" onClick={() => openEdit(user)} />
                                        <Trash
                                            size={20}
                                            className={`cursor-pointer ${
                                                currentUser?.id === user.id ? 'text-gray-300' : 'text-red-500'
                                            }`}
                                            onClick={() =>
                                                currentUser?.id !== user.id && toggleActive(user)
                                            }
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Novo / editar usuário */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="gap-4 grid w-full">
                            <div className="space-y-2 col-span-full">
                                <Label>Nome</Label>
                                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                            </div>
                            <div className="space-y-2 col-span-full">
                                <Label>E-mail</Label>
                                <Input
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                                />
                            </div>
                            {!editing && (
                                <div className="space-y-2 col-span-full">
                                    <Label>Senha inicial</Label>
                                    <Input
                                        type="password"
                                        value={form.password}
                                        onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                                    />
                                </div>
                            )}
                            <div className="space-y-2 col-span-full">
                                <Label>Papel (nível de acesso)</Label>
                                <select
                                    className="w-full border rounded-md p-2 text-sm"
                                    value={form.role}
                                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                                >
                                    {USER_ROLES.map((role) => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold" onClick={submit}>
                            {editing ? 'Salvar alterações' : 'Criar usuário'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Redefinir senha (admin) */}
            <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Redefinir senha - {passwordTarget?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="space-y-2">
                            <Label>Nova senha</Label>
                            <Input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                            />
                        </div>
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold" onClick={submitReset}>
                            Redefinir
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Trocar minha senha */}
            <Dialog open={myPasswordDialog} onOpenChange={setMyPasswordDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Trocar minha senha</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="space-y-2">
                            <Label>Senha atual</Label>
                            <Input
                                type="password"
                                value={myForm.currentPassword}
                                onChange={(e) => setMyForm((p) => ({ ...p, currentPassword: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Nova senha</Label>
                            <Input
                                type="password"
                                value={myForm.newPassword}
                                onChange={(e) => setMyForm((p) => ({ ...p, newPassword: e.target.value }))}
                            />
                        </div>
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            onClick={submitMyPassword}
                        >
                            Alterar senha
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
