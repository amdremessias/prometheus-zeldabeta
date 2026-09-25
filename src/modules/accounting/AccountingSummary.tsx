import { Card, CardContent } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { DollarSign, ShoppingBag, TrendingDown, TrendingUp } from 'lucide-react';

export function FinancialSummary() {
    const Resumo = useDataStore((state) => state.contabilidade.resumo);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Resumo.map((item, index) => (
                <Card key={index}>
                    <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-gray-500">{item.title}</p>
                                <h3 className="text-2xl font-bold mt-1">R${item.value}</h3>
                            </div>
                            {item.title == 'Vendas Totais' && (
                                <div className={`p-2 rounded-full bg-green-100 text-green-600`}>
                                    <DollarSign className="h-5 w-5" />
                                </div>
                            )}
                            {item.title == 'Pedidos' && (
                                <div className={`p-2 rounded-full bg-blue-100 text-blue-600`}>
                                    <ShoppingBag className="h-5 w-5" />
                                </div>
                            )}
                            {item.title == 'Valor Médio por Pedido' && (
                                <div className={`p-2 rounded-full bg-purple-100 text-purple-600`}>
                                    <DollarSign className="h-5 w-5" />
                                </div>
                            )}
                            {item.title == 'Despesas' && (
                                <div className={`p-2 rounded-full bg-orange-100 text-orange-600`}>
                                    <TrendingDown className="h-5 w-5" />
                                </div>
                            )}
                        </div>
                        <div className="mt-2 flex items-center">
                            {item.trend === 'up' ? (
                                <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                            ) : (
                                <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                            )}
                            <span className={item.trend === 'up' ? 'text-green-600' : 'text-red-600'}>
                                {item.change} em relação ao mês anterior
                            </span>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
