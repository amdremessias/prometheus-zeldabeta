'use client';

import { Button } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { showMessage } from '@/store/popupStore';
import { Link2, Copy, Globe, RefreshCw } from 'lucide-react';
import { useState } from 'react';

function slugify(text: string): string {
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

function gerarSlugUnico(base: string): string {
    const sufixo = Math.random().toString(36).slice(2, 6);
    return `${slugify(base) || 'cardapio'}-${sufixo}`;
}

export function CardapioDigitalSettings() {
    const geralData = useDataStore((state) => state.config.geralData);
    const slug = useDataStore((state) => state.config.cardapioDigitalSlug);
    const setConfig = useDataStore((state) => state.setConfig);

    const [copiado, setCopiado] = useState(false);

    const link = slug ? `${window.location.origin}/m/${slug}` : null;

    const gerarLink = () => {
        const novo = gerarSlugUnico(geralData.restaurantName || 'cardapio');
        setConfig((prev) => ({ ...prev, cardapioDigitalSlug: novo }));
        showMessage('Link do cardápio gerado com sucesso!');
    };

    const copiar = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            showMessage('Link copiado para a área de transferência!');
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            showMessage('Não foi possível copiar o link.', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">Cardápio Digital</h2>
            <p className="text-sm text-gray-600 max-w-xl">
                Gere um link público para que seus clientes façam pedidos pelo celular. O cardápio usa os produtos e
                categorias cadastrados e as taxas de entrega definidas em &quot;Geral&quot;.
            </p>

            {link ? (
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border rounded-lg p-3 bg-gray-50 break-all">
                        <Globe className="h-4 w-4 text-green-600 shrink-0" />
                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                            {link}
                        </a>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button className="bg-green-600 hover:bg-green-700" onClick={copiar}>
                            {copiado ? 'Copiado!' : (
                                <>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copiar link
                                </>
                            )}
                        </Button>
                        <Button variant="outline" onClick={gerarLink}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Gerar novo link
                        </Button>
                    </div>
                    <p className="text-xs text-gray-500">
                        Atenção: gerar um novo link invalida o link anterior.
                    </p>
                </div>
            ) : (
                <Button className="bg-green-600 hover:bg-green-700" onClick={gerarLink}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Gerar link do cardápio
                </Button>
            )}
        </div>
    );
}
