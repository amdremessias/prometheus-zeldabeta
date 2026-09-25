'use client';
import { showMessage } from '@/store/popupStore';
import { UserRole } from '@/lib/permissions';

export interface UserRow {
    id: number;
    name: string;
    email: string;
    role: string;
    active: boolean;
    created_at: string;
}

async function parseRes(res: Response) {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(body.error || `Falha na requisição (${res.status})`);
    }
    return body;
}

export async function fetchUsers(): Promise<UserRow[]> {
    try {
        const res = await fetch('/api/users');
        const body = await parseRes(res);
        return Array.isArray(body.users) ? body.users : [];
    } catch (error) {
        showMessage(error instanceof Error ? error.message : 'Falha ao listar usuários.', 'error');
        return [];
    }
}

export async function createUser(data: { name: string; email: string; password: string; role: UserRole }) {
    const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    await parseRes(res);
}

export async function updateUser(
    id: number,
    data: { name?: string; email?: string; role?: UserRole; active?: boolean }
) {
    const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    await parseRes(res);
}

export async function deactivateUser(id: number) {
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    await parseRes(res);
}

export async function resetUserPassword(id: number, password: string) {
    const res = await fetch(`/api/users/${id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    await parseRes(res);
}

export async function changeMyPassword(currentPassword: string, newPassword: string) {
    const res = await fetch('/api/users/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
    });
    await parseRes(res);
}
