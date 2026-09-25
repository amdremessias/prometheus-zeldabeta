import { adicionaisKey } from '@/shared/lib/utils';

export function mergeFoodItems(existing: FoodCartType[], incoming: FoodCartType[]): FoodCartType[] {
    // Chave composta por id + observação + adicionais: combinações diferentes
    // (ex.: "X-Burger c/ Bacon" vs "X-Burger c/ Ovo") não devem ser mescladas.
    const keyOf = (item: FoodCartType) => `${item.foodId}::${item.notes ?? ''}::${adicionaisKey(item.adicionais)}`;
    const map = new Map<string, FoodCartType>();

    // Adiciona os existentes
    for (const item of existing) {
        map.set(keyOf(item), { ...item });
    }

    // Mescla os novos
    for (const item of incoming) {
        const key = keyOf(item);
        if (map.has(key)) {
            const existingItem = map.get(key)!;
            map.set(key, {
                ...existingItem,
                quantity: existingItem.quantity + item.quantity,
            });
        } else {
            map.set(key, { ...item });
        }
    }

    return Array.from(map.values());
}
