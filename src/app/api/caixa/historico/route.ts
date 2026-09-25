import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { getCaixasHistorico } from '@/lib/server/caixa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    try {
        const historico = await getCaixasHistorico(100);
        return NextResponse.json({ historico });
    } catch (error) {
        console.error('Erro ao consultar histórico de caixas:', error);
        return NextResponse.json({ error: 'Erro ao consultar o histórico de caixas' }, { status: 500 });
    }
}