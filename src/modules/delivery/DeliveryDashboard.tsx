import { CreateDeliveryOrder } from './CreateDeliveryOrder';
import { WebDeliveryOrders } from './WebDeliveryOrders';

export function DeliveryDashboard() {
    return (
        <div className="space-y-8">
            <section>
                <h2 className="text-xl font-bold mb-3">Novo pedido de entrega / retirada</h2>
                <CreateDeliveryOrder />
            </section>
            <WebDeliveryOrders />
        </div>
    );
}
