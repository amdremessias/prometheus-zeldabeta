'use client';

import { createWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { devtools, persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { restaurantVazio } from '@/shared/lib/dataState/restauranteVazio';
import { localDatabase } from '@/shared/lib/dataState/localDatabase';
import { StoreState, StoreActions } from '@/types/userStoreType';
import { CalculateResumo } from '@/modules/accounting/accountingActions';
import { deserializeStateFromServer, serializeStateForServer } from '@/shared/lib/stateSerializer';
import { showMessage } from '@/store/popupStore';

// Indica se a sessão atual está em modo demo (não persiste no servidor)
let demoMode = false;

// Token de concorrência: último updatedAt recebido do servidor. Se outra aba
// (ou um restore) alterar o estado, o PUT é rejeitado com 409 e a aba faz reload.
let serverUpdatedAt: string | null = null;

// Debounce do salvamento: agrupa múltiplas alterações e envia o snapshot para o Postgres
let saveTimer: ReturnType<typeof setTimeout> | null = null;

// Cancela o salvamento pendente (usado após restaurar backup).
let inFlightSave = false;

const apiStorage: StateStorage = {
    getItem: async () => null, // hidratação manual via loadInitialData
    setItem: async (_name: string, value: string): Promise<void> => {
        let parsedState: StoreState;
        try {
            // O createJSONStorage serializa como { state, version }
            parsedState = (JSON.parse(value) as { state: StoreState }).state;
        } catch {
            return;
        }
        if (demoMode || parsedState.isDemo) return;

        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
            if (inFlightSave) return;
            inFlightSave = true;
            try {
                // Usa o estado vivo em memória (não o clone JSON do persist), pois o
                // JSON.stringify destrói Blobs de imagem antes de chegarem aqui.
                const serialized = await serializeStateForServer(useDataStore.getState());
                const res = await fetch('/api/state', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: serialized, updatedAt: serverUpdatedAt }),
                });
                if (res.status === 409) {
                    // Estado mudou em outra aba ou houve restore. Relê do servidor
                    // para não sobrescrever o backup recém-restaurado.
                    showMessage('Estado atualizado em outra aba ou por um restore. Sincronizando...', 'error');
                    await useDataStore.getState().loadInitialData(demoMode);
                } else if (res.status === 403) {
                    const body = await res.json().catch(() => ({}));
                    showMessage(body.error || 'Caixa fechado. Abra o caixa para registrar vendas.', 'error');
                } else if (!res.ok) {
                    console.error('Erro ao salvar estado no servidor:', res.status);
                } else {
                    const body = await res.json().catch(() => null);
                    if (body?.updatedAt) serverUpdatedAt = body.updatedAt;
                }
            } catch (error) {
                console.error('Erro ao salvar estado no servidor:', error);
            } finally {
                inFlightSave = false;
            }
        }, 600);
    },
    removeItem: (): void => {},
};

function caixaFromRow(row: CaixaRowLike | null): StoreState['caixa'] {
    if (!row) {
        return { status: 'fechado', initialAmount: 0 };
    }
    return {
        status: row.status === 'aberto' ? ('aberto' as const) : ('fechado' as const),
        openedAt: row.opened_at ?? undefined,
        openedBy: row.opened_by ? String(row.opened_by) : undefined,
        initialAmount: Number(row.initial_amount) || 0,
        closedAt: row.closed_at ?? undefined,
        expectedAmount: row.expected_amount != null ? Number(row.expected_amount) : undefined,
        finalAmount: row.final_amount != null ? Number(row.final_amount) : undefined,
        difference: row.difference != null ? Number(row.difference) : undefined,
        salesCount: row.sales_count ?? undefined,
        notes: row.notes ?? undefined,
        detail: (row.detail as CaixaReportType | null | undefined) ?? undefined,
    };
}

export const useDataStore = createWithEqualityFn<StoreState & StoreActions>()(
    devtools(
        persist(
            (set) => ({
                ...restaurantVazio,
                loading: true,
                isDemo: false,

                setContabilidade: (updater) =>
                    set((state) => {
                        const updated = typeof updater === 'function' ? updater(state.contabilidade) : updater;

                        const newResumo = CalculateResumo(updated.transacoes);

                        return {
                            contabilidade: {
                                ...updated,
                                resumo: newResumo,
                            },
                        };
                    }),

                setConfig: (updater) =>
                    set((state) => ({
                        config: typeof updater === 'function' ? updater(state.config) : updater,
                    })),

                setCardapio: (updater) =>
                    set((state) => ({
                        cardapio: typeof updater === 'function' ? updater(state.cardapio) : updater,
                    })),

                setCozinha: (updater) =>
                    set((state) => ({
                        cozinha: typeof updater === 'function' ? updater(state.cozinha) : updater,
                    })),

                setEntrega: (updater) =>
                    set((state) => ({
                        entrega: typeof updater === 'function' ? updater(state.entrega) : updater,
                    })),

                setMesas: (updater) =>
                    set((state) => ({
                        mesas: typeof updater === 'function' ? updater(state.mesas) : updater,
                    })),

                setMesaSelecionadaId: (updater) =>
                    set((state) => ({
                        mesaSelecionadaId: typeof updater === 'function' ? updater(state.mesaSelecionadaId) : updater,
                    })),

                setDeliverySelecionado: (updater) =>
                    set((state) => ({
                        deliverySelecionado:
                            typeof updater === 'function' ? updater(state.deliverySelecionado) : updater,
                    })),

                setClientes: (updater) =>
                    set((state) => ({
                        clientes: typeof updater === 'function' ? updater(state.clientes) : updater,
                    })),

                setCaixa: (updater) =>
                    set((state) => ({
                        caixa: typeof updater === 'function' ? updater(state.caixa) : updater,
                    })),

                setVendas: (updater) =>
                    set((state) => ({
                        vendas: typeof updater === 'function' ? updater(state.vendas) : updater,
                    })),

                loadInitialData: async (demo = false) => {
                    set({ loading: true, isDemo: demo });
                    demoMode = demo;
                    try {
                        if (demo) {
                            const data = await localDatabase.carregarDemo();
                            set({ ...data, loading: false, isDemo: true });
                            return;
                        }

                        const [stateRes, caixaRes] = await Promise.all([
                            fetch('/api/state')
                                .then((r) => (r.ok ? r.json() : Promise.resolve({ data: null, updatedAt: null })))
                                .catch(() => ({ data: null, updatedAt: null })),
                            fetch('/api/caixa')
                                .then((r) => (r.ok ? r.json() : Promise.resolve({ caixa: null })))
                                .catch(() => ({ caixa: null })),
                        ]);

                        serverUpdatedAt = stateRes.updatedAt ?? null;
                        const data = stateRes.data ? await deserializeStateFromServer(stateRes.data) : restaurantVazio;
                        set({
                            ...data,
                            caixa: caixaFromRow(caixaRes.caixa),
                            loading: false,
                            isDemo: false,
                        });
                    } catch (error) {
                        console.error('Zustand - Erro carregando dados:', error);
                    } finally {
                        set({ loading: false });
                    }
                },
            }),

            {
                name: 'zelda-pdv-storage',
                storage: createJSONStorage(() => apiStorage),
                skipHydration: true,
            }
        ),
        { name: 'useDataStore' } // nome visível no Redux DevTools
    ),

    shallow
);
