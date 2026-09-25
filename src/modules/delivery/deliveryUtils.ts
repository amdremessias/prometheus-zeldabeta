export function getDeliveryStatus({ startedAt, dispatchedAt }: { startedAt?: string; dispatchedAt?: string }) {
    if (!startedAt) return ''; // Ainda está na cozinha (pedido não ficou pronto)
    if (dispatchedAt) return 'em andamento'; // Entregador já saiu para a entrega
    return 'pendente'; // Pronto, esperando atribuição de entregador
}
