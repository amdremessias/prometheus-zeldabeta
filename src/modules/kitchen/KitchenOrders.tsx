import { OrderCard } from './KitchenCard';
import { useDataStore } from '@/store/userStore';
import { PedidosWeb } from './PedidosWeb';

export function OrderGrid() {
    const Cozinha = useDataStore((state) => state.cozinha);

    return (
        <div className="space-y-6">
            <PedidosWeb />

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {Cozinha.length == 0 && (
                    <h2 className="font-bold text-2xl text-center p-10 w-full col-span-full">
                        Nenhum pedido pendente
                    </h2>
                )}

                {Cozinha.map((order, index) => (
                    <OrderCard key={index} order={order} />
                ))}
            </div>
        </div>
    );
}
