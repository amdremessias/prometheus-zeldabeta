'use client';

import { useDataStore } from '@/store/userStore';
import { useAuthStore } from '@/store/authStore';
import { SidebarNav } from '@/shared/components/SidebarNav';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/shared/ui';

interface AppBodyProps {
    children: React.ReactNode;
    demo?: boolean;
}

export default function AppBody({ children, demo = false }: AppBodyProps) {
    const router = useRouter();
    const initialized = useRef(false);
    const authLoaded = useRef(false);

    useEffect(() => {
        if (!initialized.current) {
            useDataStore.getState().loadInitialData(demo);
            initialized.current = true;
        }
    }, [demo]);

    useEffect(() => {
        if (authLoaded.current) return;
        authLoaded.current = true;
        useAuthStore.getState().fetchUser().then(() => {
            const { user } = useAuthStore.getState();
            // Sem sessão válida na aplicação real → volta para o login
            if (!demo && !user) {
                router.replace('/login');
            }
        });
    }, [demo, router]);

    const isLoading = useDataStore((state) => state.loading);
    const userLoading = useAuthStore((state) => state.loading);

    if (isLoading || userLoading) {
        return (
            <div className="flex h-[100dvh] bg-gray-100">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-gray-100">
            <SidebarNav />
            {children}
        </div>
    );
}
