import { getAppStateData } from './db';

export interface MenuPublicoItem {
    id: number;
    title: string;
    price: number;
    discount?: number;
    category: number[];
    adicionaisDisponiveis: number[];
    status: string;
    imageData: string | null;
}

export interface MenuPublico {
    restaurantName: string;
    address: string;
    phone: string;
    currency: string;
    categorias: { id: number; icon: string; label: string }[];
    pratos: MenuPublicoItem[];
    adicionais: { id: number; descricao: string; valor: number }[];
    taxasEntrega: { id: number; nome: string; valor: number }[];
}

type AppStateShape = {
    config?: {
        geralData?: { restaurantName?: string; address?: string; phone?: string; currency?: string; taxasEntrega?: { id: number; nome: string; valor: number }[] };
        cardapioDigitalSlug?: string;
    };
    cardapio?: {
        categorias?: { id: number; icon: string; label: string }[];
        adicionais?: { id: number; descricao: string; valor: number }[];
        pratos?: MenuPublicoItem[];
    };
} | null;

function buildMenu(state: AppStateShape): MenuPublico {
    const pratos = (state?.cardapio?.pratos ?? [])
        .filter((p) => p.status === 'Ativo')
        // Expõe apenas os campos públicos (estoque jamais vaza no cardápio público).
        .map((p) => ({
            id: p.id,
            title: p.title,
            price: p.price,
            discount: p.discount,
            category: p.category,
            adicionaisDisponiveis: p.adicionaisDisponiveis ?? [],
            status: p.status,
            imageData: p.imageData,
        }));
    return {
        restaurantName: state?.config?.geralData?.restaurantName ?? '',
        address: state?.config?.geralData?.address ?? '',
        phone: state?.config?.geralData?.phone ?? '',
        currency: state?.config?.geralData?.currency ?? 'BRL',
        categorias: state?.cardapio?.categorias ?? [],
        pratos,
        adicionais: state?.cardapio?.adicionais ?? [],
        taxasEntrega: state?.config?.geralData?.taxasEntrega ?? [],
    };
}

/* Lê o estado atual diretamente (sem exigir slug) — usado pelo bot WhatsApp. */
export async function loadAppMenu(): Promise<{ ok: boolean; menu?: MenuPublico }> {
    const state = (await getAppStateData()) as AppStateShape;
    if (!state) return { ok: false };
    return { ok: true, menu: buildMenu(state) };
}

/* Lê o cardápio público a partir do app_state (validando o slug). */
export async function loadMenu(slug: string): Promise<{ ok: boolean; menu?: MenuPublico }> {
    const state = (await getAppStateData()) as AppStateShape;
    if (!state || state.config?.cardapioDigitalSlug !== slug) {
        return { ok: false };
    }
    return { ok: true, menu: buildMenu(state) };
}
