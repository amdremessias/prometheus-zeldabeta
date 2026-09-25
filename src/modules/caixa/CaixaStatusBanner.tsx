'use client';
import { AlertTriangle } from 'lucide-react';
import { useDataStore } from '@/store/userStore';
import { useNavStore } from '@/store/navStore';

/* Aviso fixo mostrado quando o caixa está fechado — vendas são bloqueadas. */
export function CaixaStatusBanner() {
    const isDemo = useDataStore((state) => state.isDemo);
    const caixa = useDataStore((state) => state.caixa);
    const setActiveTab = useNavStore((state) => state.setActiveTab);

    if (isDemo || caixa.status === 'aberto') return null;

    return (
        <button
            onClick={() => setActiveTab('Caixa')}
            className="w-full bg-red-50 border-b border-red-200 text-red-700 text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
        >
            <AlertTriangle className="h-4 w-4" />
            Caixa fechado — abra o caixa para registrar vendas (PDV, mesas ou delivery).
        </button>
    );
}