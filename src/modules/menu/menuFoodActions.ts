import { useNavStore } from '@/store/navStore';
import { useDataStore } from '@/store/userStore';
import { adicionaisKey } from '@/shared/lib/utils';

export function handleIncrease(
    foodData: CardapioFoodType,
    mesaId: number | undefined,
    notes?: string,
    adicionais?: AdicionalItemType[],
    quantity = 1
) {
    const modoDelivery = useNavStore.getState().modoDelivery;
    const nota = notes?.trim() || '';
    const adds = adicionais && adicionais.length ? adicionais : undefined;
    // O valor dos adicionais é somado ao preço unitário do item.
    const adicionaisValor = adds ? adds.reduce((soma, a) => soma + (Number(a.valor) || 0), 0) : 0;
    const key = `${foodData.id}::${nota}::${adicionaisKey(adds)}`;

    const novoItem: FoodCartType = {
        foodId: foodData.id,
        quantity,
        title: foodData.title,
        price: (Number(foodData.price) || 0) + adicionaisValor,
        notes: nota || undefined,
        adicionais: adds,
    };

    if (modoDelivery) {
        const setDeliverySelecionado = useDataStore.getState().setDeliverySelecionado;
        setDeliverySelecionado((prev) => {
            if (!prev) return prev;

            const existingItem = prev.inCart.find(
                (item) => `${item.foodId}::${item.notes ?? ''}::${adicionaisKey(item.adicionais)}` === key
            );
            if (existingItem) {
                return {
                    ...prev,
                    inCart: prev.inCart.map((item) =>
                        `${item.foodId}::${item.notes ?? ''}::${adicionaisKey(item.adicionais)}` === key
                            ? { ...item, quantity: item.quantity + quantity, notes: nota || item.notes, price: novoItem.price }
                            : item
                    ),
                };
            }
            return { ...prev, inCart: [...prev.inCart, novoItem] };
        });
    } else {
        const setMesas = useDataStore.getState().setMesas;
        setMesas((prev) =>
            prev.map((mesa) => {
                if (mesa.id != mesaId) return mesa;

                const existingItem = mesa.products.inCart.find(
                    (item) => `${item.foodId}::${item.notes ?? ''}::${adicionaisKey(item.adicionais)}` === key
                );
                if (existingItem) {
                    return {
                        ...mesa,
                        products: {
                            ...mesa.products,
                            inCart: mesa.products.inCart.map((item) =>
                                `${item.foodId}::${item.notes ?? ''}::${adicionaisKey(item.adicionais)}` === key
                                    ? { ...item, quantity: item.quantity + quantity, notes: nota || item.notes, price: novoItem.price }
                                    : item
                            ),
                        },
                    };
                }
                return {
                    ...mesa,
                    products: { ...mesa.products, inCart: [...mesa.products.inCart, novoItem] },
                };
            })
        );
    }
}

export function handleDecrease(foodData: CardapioFoodType, mesaId: number | undefined) {
    const modoDelivery = useNavStore.getState().modoDelivery;

    if (modoDelivery) {
        const setDeliverySelecionado = useDataStore.getState().setDeliverySelecionado;
        setDeliverySelecionado((prev) => {
            if (!prev) return prev;

            const existingItem = prev.inCart.find((item) => item.foodId === foodData.id);
            if (!existingItem) return prev;

            if (existingItem.quantity === 1) {
                return {
                    ...prev,
                    inCart: prev.inCart.filter((item) => item.foodId !== foodData.id),
                };
            } else {
                return {
                    ...prev,
                    inCart: prev.inCart.map((item) =>
                        item.foodId === foodData.id ? { ...item, quantity: item.quantity - 1 } : item
                    ),
                };
            }
        });
    } else {
        const setMesas = useDataStore.getState().setMesas;
        setMesas((prev) =>
            prev.map((mesa) => {
                if (mesa.id != mesaId) return mesa;

                const existingItem = mesa.products.inCart.find((item) => item.foodId === foodData.id);
                if (!existingItem) return mesa;

                if (existingItem.quantity === 1) {
                    return {
                        ...mesa,
                        products: {
                            ...mesa.products,
                            inCart: mesa.products.inCart.filter((item) => item.foodId !== foodData.id),
                        },
                    };
                } else {
                    return {
                        ...mesa,
                        products: {
                            ...mesa.products,
                            inCart: mesa.products.inCart.map((item) =>
                                item.foodId === foodData.id ? { ...item, quantity: item.quantity - 1 } : item
                            ),
                        },
                    };
                }
            })
        );
    }
}
