import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useDataStore } from '@/store/userStore';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function parseNumberBR(valor: string): number {
    return Number(valor.replace(/\./g, '').replace(',', '.'));
}

export function getHours() {
    return new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function formatarHoraMinuto(isoDate: string): string {
    const data = new Date(isoDate);
    const horas = data.getHours().toString().padStart(2, '0');
    const minutos = data.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
}

export function getProductImage(id: number) {
    const pratos = useDataStore.getState().cardapio.pratos;

    const imageUrl = pratos.find((prato) => prato.id === id)?.imageURL;

    return imageUrl;
}

export function encontrarMenorIdDisponivel<T extends { id: string | number }>(items: T[]): number {
    const usados = new Set(
        items.map((item) => Number(item.id)).filter((id) => !isNaN(id) && Number.isInteger(id) && id > 0)
    );

    let i = 1;
    while (usados.has(i)) i++;
    return i;
}

/* Chave estável para comparar conjuntos de adicionais (ids ordenados).
   Usada para decidir se dois itens do carrinho devem ser mesclados. */
export function adicionaisKey(adicionais?: { id: number }[]): string {
    return (adicionais ?? [])
        .map((a) => a.id)
        .slice()
        .sort((a, b) => a - b)
        .join(',');
}
