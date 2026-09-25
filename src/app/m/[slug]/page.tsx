import { loadMenu } from '@/lib/server/cardapioDigital';
import { CardapioPublico } from './CardapioPublico';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function PublicMenuPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const result = await loadMenu(slug);

    if (!result.ok) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-2xl font-bold text-gray-700">Cardápio não encontrado</h1>
                <p className="text-gray-500 mt-2">
                    O link pode estar incorreto ou o restaurante ainda não ativou o cardápio digital.
                </p>
            </div>
        );
    }

    return <CardapioPublico slug={slug} menu={result.menu!} />;
}
