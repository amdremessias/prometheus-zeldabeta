import { ClientDataType } from '@/types/ClientDataType';
import { restaurantVazio } from './dataState/restauranteVazio';

function blobToDataURL(blob: Blob | null | undefined): Promise<string> {
    // Snapshot antigos podem conter imageBlob como {} (Blob serializado) ou outro valor não-Blob.
    // Blob vazio (size 0) = produto sem imagem.
    if (!blob || typeof blob !== 'object' || !(blob instanceof Blob) || blob.size === 0) {
        return Promise.resolve('');
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Falha ao ler imagem'));
        reader.readAsDataURL(blob);
    });
}

async function dataURLToBlob(dataURL: string): Promise<Blob> {
    const res = await fetch(dataURL);
    return res.blob();
}

/* Converte o campo `category` (que pode vir como label string, array de labels,
   ou já como IDs numéricos — dependendo da versão que persistiu os dados) em
   `number[]` de IDs de categorias, usando o mapa label->id disponível no estado.
   Valores que não encontram correspondência são descartados (produto fica sem
   categoria) em vez de virarem NaN. */
function normalizeCategoriaIds(raw: unknown, labelToId: Map<string, number>): number[] {
    const arr = Array.isArray(raw) ? raw : raw == null || raw === '' ? [] : [raw];
    const out: number[] = [];
    for (const v of arr) {
        if (typeof v === 'number' && Number.isFinite(v)) {
            out.push(v);
        } else if (typeof v === 'string' && v.trim() !== '') {
            const id = labelToId.get(v.trim().toLowerCase());
            if (id != null) out.push(id);
        }
    }
    return out;
}

/* Converte o estado da aplicação em JSON puro (sem Blob/objectURL) para envio ao backend.
   Imagens ficam como dataURL no campo imageData. */
export async function serializeStateForServer(state: ClientDataType): Promise<unknown> {
    const pratos = await Promise.all(
        state.cardapio.pratos.map(async (p) => {
            let imageData: string | null = null;
            if (p.imageBlob) {
                imageData = await blobToDataURL(p.imageBlob);
            }
            return {
                id: p.id,
                title: p.title,
                price: p.price,
                discount: p.discount,
                category: Array.isArray(p.category) ? p.category.map(Number).filter((n) => Number.isFinite(n)) : [],
                adicionaisDisponiveis: Array.isArray(p.adicionaisDisponiveis)
                    ? p.adicionaisDisponiveis.map(Number).filter((n) => Number.isFinite(n))
                    : [],
                status: p.status,
                imageData,
                estoqueAtual: typeof p.estoqueAtual === 'number' ? p.estoqueAtual : undefined,
                estoqueMinimo: typeof p.estoqueMinimo === 'number' ? p.estoqueMinimo : undefined,
                ncm: p.ncm || undefined,
                cest: p.cest || undefined,
                unidadeComercial: p.unidadeComercial || undefined,
                origem: p.origem || undefined,
                csosn: p.csosn || undefined,
                cst: p.cst || undefined,
                cfop: typeof p.cfop === 'number' ? p.cfop : undefined,
                codigoBarras: p.codigoBarras || undefined,
                codigoInterno: p.codigoInterno || undefined,
            };
        })
    );

    return {
        ...state,
        cardapio: { ...state.cardapio, pratos },
    };
}

/* Converte o JSON vindo do backend de volta para o estado com Blob + objectURL de imagem. */
export async function deserializeStateFromServer(raw: unknown): Promise<ClientDataType> {
    type ServerPrato = {
        id?: number;
        title?: string;
        price?: number;
        discount?: number;
        category?: string[];
        adicionaisDisponiveis?: number[];
        status?: string;
        imageData?: string | null;
        estoqueAtual?: number | null;
        estoqueMinimo?: number | null;
        ncm?: string | null;
        cest?: string | null;
        unidadeComercial?: string | null;
        origem?: string | null;
        csosn?: string | null;
        cst?: string | null;
        cfop?: number | null;
        codigoBarras?: string | null;
        codigoInterno?: string | null;
    };

    const source = (raw as Partial<ClientDataType> | null) ?? {};
    const rawPratos = ((source as { cardapio?: { pratos?: ServerPrato[] } })?.cardapio?.pratos ?? []) as ServerPrato[];

    // Mapa label (minúsculo/trim) -> id, para migrar dados legados que ainda
    // guardam a categoria como string de rótulo em vez de número (id).
    const categorias = (source.cardapio?.categorias ?? []) as { id: number; label?: string }[];
    const labelToId = new Map<string, number>();
    for (const c of categorias) {
        if (c && c.label) labelToId.set(String(c.label).trim().toLowerCase(), c.id);
    }

    const pratos: CardapioFoodType[] = await Promise.all(
        rawPratos.map(async (p) => {
            let imageBlob: Blob | null = null;
            let imageURL = '';
            if (p.imageData) {
                try {
                    imageBlob = await dataURLToBlob(p.imageData);
                    imageURL = URL.createObjectURL(imageBlob);
                } catch {
                    imageBlob = null;
                }
            }
            return {
                id: Number(p.id) || 0,
                title: String(p.title ?? ''),
                price: Number(p.price) || 0,
                discount: p.discount != null ? Number(p.discount) : undefined,
                category: normalizeCategoriaIds(p.category, labelToId),
                adicionaisDisponiveis: Array.isArray(p.adicionaisDisponiveis)
                    ? p.adicionaisDisponiveis.map(Number).filter((n) => Number.isFinite(n))
                    : [],
                status: String(p.status ?? 'ativo'),
                imageBlob: imageBlob ?? new Blob([]),
                imageURL,
                estoqueAtual:
                    p.estoqueAtual != null && Number.isFinite(Number(p.estoqueAtual))
                        ? Math.max(0, Math.floor(Number(p.estoqueAtual)))
                        : undefined,
                estoqueMinimo:
                    p.estoqueMinimo != null && Number.isFinite(Number(p.estoqueMinimo))
                        ? Math.max(0, Math.floor(Number(p.estoqueMinimo)))
                        : undefined,
                ncm: typeof p.ncm === 'string' && p.ncm.trim() ? p.ncm.trim() : undefined,
                cest: typeof p.cest === 'string' && p.cest.trim() ? p.cest.trim() : undefined,
                unidadeComercial: ['UN', 'KG', 'CX', 'LT'].includes(p.unidadeComercial as string)
                    ? (p.unidadeComercial as CardapioFoodType['unidadeComercial'])
                    : undefined,
                origem: typeof p.origem === 'string' && p.origem.trim() ? p.origem.trim() : undefined,
                csosn: typeof p.csosn === 'string' && p.csosn.trim() ? p.csosn.trim() : undefined,
                cst: typeof p.cst === 'string' && p.cst.trim() ? p.cst.trim() : undefined,
                cfop: p.cfop != null && Number.isFinite(Number(p.cfop)) ? Number(p.cfop) : undefined,
                codigoBarras: typeof p.codigoBarras === 'string' && p.codigoBarras.trim()
                    ? p.codigoBarras.trim()
                    : undefined,
                codigoInterno: typeof p.codigoInterno === 'string' && p.codigoInterno.trim()
                    ? p.codigoInterno.trim()
                    : undefined,
            };
        })
    );

    return {
        ...restaurantVazio,
        ...source,
        cardapio: {
            ...(source.cardapio ?? restaurantVazio.cardapio),
            pratos,
            // Garante que o catálogo de adicionais exista mesmo em estados legados
            // (anteriores a esta feature), evitando .map de undefined na UI.
            adicionais:
                source.cardapio?.adicionais ?? restaurantVazio.cardapio.adicionais ?? [],
        },
        // Mescla o config do servidor sobre os defaults, preservando campos ausentes
        // (ex.: entregadores, funcionarios) quebravam telas de Configurações.
        // O geralData é mesclado em profundidade para não perder taxRate/currency.
        config: {
            ...restaurantVazio.config,
            ...(source.config ?? {}),
            geralData: {
                ...restaurantVazio.config.geralData,
                ...(source.config?.geralData ?? {}),
            },
        },
    };
}