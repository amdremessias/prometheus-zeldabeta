'use client';
import { create } from 'zustand';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    role: string;
}

type AuthState = {
    user: AuthUser | null;
    loading: boolean;
    fetchUser: () => Promise<void>;
    setUser: (user: AuthUser | null) => void;
    logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,

    fetchUser: async () => {
        try {
            const res = await fetch('/api/auth/me');
            if (!res.ok) {
                set({ user: null, loading: false });
                return;
            }
            const body = await res.json().catch(() => ({ user: null }));
            set({ user: body.user ?? null, loading: false });
        } catch {
            set({ user: null, loading: false });
        }
    },

    setUser: (user) => set({ user }),

    logout: async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch {
            // segue o fluxo mesmo com falha de rede
        }
        set({ user: null, loading: false });
        window.location.href = '/login';
    },
}));
