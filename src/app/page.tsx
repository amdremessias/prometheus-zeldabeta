import Link from 'next/link';
import type { Metadata } from 'next';
import { brand } from '@/shared/lib/branding';

export const metadata: Metadata = {
    title: brand.name,
    description: brand.description,
};

export default async function ClientApp() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <main className="container mx-auto px-4 py-16 max-w-5xl">
                <div className="text-center mb-10">
                    <div className="flex justify-center mb-4">
                        <img src={brand.logo} alt={brand.name} className="h-16 w-16" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">{brand.name}</h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">Selecione uma versão para usar</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Demo Card */}
                    <Link
                        href="demo"
                        className="relative h-90 rounded-xl shadow-lg transition-all duration-300 overflow-hidden group hover:scale-105"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-green-600 p-6 flex flex-col justify-between">
                            <div className="text-left">
                                <h2 className="text-3xl font-bold text-white mb-2">Demonstração</h2>
                                <p className="text-white/90">
                                    Experimente a plataforma com dados ficticios e veja todas as funcionalidades
                                </p>
                            </div>
                            <div className="bg-white/20 p-4 rounded-lg text-white text-left mt-3">
                                <p className="font-medium">Inclui:</p>
                                <ul className="mt-2 space-y-1">
                                    <li>• Dados prontos para visualizar o dashboard</li>
                                    <li>• Alterações não são salvas</li>
                                </ul>
                            </div>
                        </div>
                    </Link>

                    {/* Aplicação real Card */}
                    <Link
                        href="login"
                        className="relative h-90 rounded-xl shadow-lg transition-all duration-300 overflow-hidden group hover:scale-105"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-green-700 to-green-900 p-6 flex flex-col justify-between">
                            <div className="text-left">
                                <h2 className="text-3xl font-bold text-white mb-2">Aplicação real</h2>
                                <p className="text-white/90">Acesse a Gestão do seu Negocio</p>
                            </div>
                            <div className="bg-white/20 p-4 rounded-lg text-white text-left mt-3">
                                <p className="font-medium">Inclui:</p>
                                <ul className="mt-2 space-y-1">
                                    <li>• Sua Frente de Caixa para Venda Rápida</li>
                                    <li>• Mesas ou Comandas para organizar seus cliente</li>
                                    <li>• Area de Delivery para pedidos de entrega vinculado ao Entregador</li>
                                    <li>• Cardapio Digital para Pedido pela Web [em desenvolvimento]</li>
                                </ul>
                            </div>
                        </div>
                    </Link>
                </div>
            </main>

            <footer className="py-6 text-center text-gray-500">
                <p>
                    © 2027 {brand.name}. Todos direitos reservados. | MCinfraTI
                </p>
            </footer>
        </div>
    );
}
