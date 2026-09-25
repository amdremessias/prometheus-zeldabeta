'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDateTimeBR } from '@/shared/lib/numberUtils';
import { useDataStore } from '@/store/userStore';
import { printReceipt } from '@/shared/lib/printReceipt';

type PedidoWeb = PedidoWebType;

function PaymentLabel(pagamento: string): string {
    if (pagamento === 'dinheiro') return 'Dinheiro';
    if (pagamento === 'cartao') return 'Cartão';
    return 'Pix';
}

export function PedidosWeb() {
    const [pedidos, setPedidos] = useState<PedidoWeb[]>([]);
    const [carregando, setCarregando] = useState(true);

    const carregar = async () => {
        try {
            const [resPend, resPrep] = await Promise.all([
                fetch('/api/pedidos-web?status=pendente'),
                fetch('/api/pedidos-web?status=em_preparo'),
            ]);
            let lista: PedidoWeb[] = [];
            if (resPend.ok) lista = lista.concat((await resPend.json()) as PedidoWeb[]);
            if (resPrep.ok) lista = lista.concat((await resPrep.json()) as PedidoWeb[]);
            lista.sort((a, b) => Number(a.id) - Number(b.id));
            setPedidos(lista);
        } catch {
            // silencioso
        } finally {
            setCarregando(false);
        }
    };

    useEffect(() => {
        carregar();
    }, []);

    // Atualiza o status e recarrega a lista para manter visíveis os pedidos em preparo
    // até que sejam concluídos (e só então sigam para a aba de Entregas/Retirada).
    const atualizarStatus = async (
        id: number,
        status: 'pendente' | 'em_preparo' | 'concluido' | 'cancelado'
    ) => {
        const res = await fetch(`/api/pedidos-web/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (res.ok) {
            await carregar();
        }
    };

    if (carregando) return null;
    if (pedidos.length === 0) return null;

    /* Imprime o ticket do pedido do cardápio digital (adicionais + observações). */
    const imprimirPedidoWeb = (pedido: PedidoWeb) => {
        const restaurantName = useDataStore.getState().config.geralData.restaurantName || 'Restaurante';
        const tipo = pedido.endereco ? 'Entrega' : 'Retirada';
        printReceipt({
            heading: 'Pedido de Cozinha',
            restaurantName,
            restaurantMeta: [
                { label: 'Origem', value: 'Cardápio Digital' },
                { label: 'Cliente', value: pedido.cliente || '-' },
                { label: 'Telefone', value: pedido.telefone || '-' },
                { label: 'Tipo', value: tipo },
                ...(pedido.endereco ? [{ label: 'Endereço', value: pedido.endereco }] : []),
            ],
            items: pedido.itens.map((i) => ({
                title: i.title,
                quantity: i.quantity,
                price: i.price,
                note: i.notes || undefined,
                addons:
                    i.adicionais && i.adicionais.length
                        ? i.adicionais.map((a) => ({ descricao: a.descricao, valor: a.valor }))
                        : undefined,
            })),
            footer: 'Impresso para a cozinha.',
        });
    };

    return (
        <div className="space-y-4">
            <h2 className="font-bold text-2xl">Pedidos do Cardápio Digital</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {pedidos.map((pedido) => {
                    const emPreparo = pedido.status === 'em_preparo';
                    return (
                    <div key={pedido.id} className="border rounded-xl overflow-hidden bg-white shadow-sm">
                        <div className="bg-green-700 text-white px-4 py-2 flex justify-between items-center">
                            <span className="font-bold">Pedido #{pedido.id}</span>
                            <span className="flex items-center gap-1">
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                                    Cardápio Digital
                                </span>
                                {emPreparo && (
                                    <span className="text-xs bg-yellow-400 text-black px-2 py-0.5 rounded-full font-medium">
                                        Em preparo
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <p className="font-semibold">{pedido.cliente}</p>
                                <p className="text-sm text-gray-500">{pedido.telefone}</p>
                                {pedido.endereco && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        <strong>Entrega:</strong> {pedido.endereco}
                                    </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                    {formatDateTimeBR(pedido.createdAt)}
                                </p>
                            </div>

                            <div className="border-t pt-2 space-y-1">
                                {pedido.itens.map((item) => (
                                    <div key={item.id} className="text-sm flex justify-between gap-2">
                                        <span>
                                            {item.quantity} x {item.title}
                                            {item.adicionais && item.adicionais.length > 0 && (
                                                <span className="block text-xs text-green-700 font-medium">
                                                    + {item.adicionais.map((a) => a.descricao).join(', ')}
                                                </span>
                                            )}
                                            {item.notes ? (
                                                <span className="block text-xs text-gray-500 italic">Obs: {item.notes}</span>
                                            ) : null}
                                        </span>
                                        <span>{formatCurrency(item.price * item.quantity, 'BRL')}</span>
                                    </div>
                                ))}
                                <p className="text-sm flex justify-between gap-2 text-gray-600">
                                    <span>Taxa de entrega</span>
                                    <span>{formatCurrency(pedido.taxaEntregaValor, 'BRL')}</span>
                                </p>
                                <p className="text-sm font-bold flex justify-between gap-2 border-t pt-1">
                                    <span>Total</span>
                                    <span>{formatCurrency(pedido.total, 'BRL')}</span>
                                </p>
                            </div>

                            <p className="text-sm font-medium">
                                Pagamento: <span className="capitalize">{PaymentLabel(pedido.pagamento)}</span>
                            </p>

                            <div className="flex gap-2">
                                <button
                                    className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-semibold py-2 rounded-lg"
                                    onClick={() => imprimirPedidoWeb(pedido)}
                                >
                                    Imprimir
                                </button>
                                {!emPreparo && (
                                    <button
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-lg"
                                        onClick={() => atualizarStatus(pedido.id, 'em_preparo')}
                                    >
                                        Iniciar preparo
                                    </button>
                                )}
                                <button
                                    className={`flex-1 text-white text-sm font-semibold py-2 rounded-lg ${
                                        emPreparo
                                            ? 'bg-green-700 hover:bg-green-800 w-full'
                                            : 'bg-gray-800 hover:bg-gray-900'
                                    }`}
                                    onClick={() => atualizarStatus(pedido.id, 'concluido')}
                                >
                                    Concluir
                                </button>
                            </div>
                            {emPreparo && (
                                <button
                                    className="w-full mt-2 border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-semibold py-2 rounded-lg"
                                    onClick={() => atualizarStatus(pedido.id, 'pendente')}
                                >
                                    Voltar a pendente
                                </button>
                            )}
                            {!pedido.faturado ? (
                                <button
                                    className="w-full border border-red-200 text-red-600 hover:bg-red-50 text-sm font-semibold py-2 rounded-lg"
                                    onClick={() => atualizarStatus(pedido.id, 'cancelado')}
                                >
                                    Cancelar pedido
                                </button>
                            ) : (
                                <p className="text-xs text-gray-400 text-center">Já faturado no caixa — cancele pela venda nos relatórios.</p>
                            )}
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>
    );
}
