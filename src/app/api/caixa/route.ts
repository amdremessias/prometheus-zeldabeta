import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { abrirCaixa, getOpenCaixa } from '@/lib/server/caixa';
import { can } from '@/lib/permissions';
import { isFiniteInRange } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    try {
        const open = await getOpenCaixa();
        return NextResponse.json({ caixa: open });
    } catch (error) {
        console.error('Erro ao consultar caixa:', error);
        return NextResponse.json({ error: 'Erro ao consultar o caixa' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'caixa_abrir_fechar')) {
        return NextResponse.json({ error: 'Sem permissão para abrir/fechar caixa' }, { status: 403 });
    }

    let initialAmount = 0;
    try {
        const body = await req.json();
        initialAmount = Number(body?.valorInicial) || 0;
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    if (!isFiniteInRange(initialAmount, 0, 1_000_000)) {
        return NextResponse.json({ error: 'Valor inicial inválido (0–1.000.000)' }, { status: 400 });
    }

    try {
        const existing = await getOpenCaixa();
        if (existing) {
            return NextResponse.json(
                { error: 'Já existe um caixa aberto. Feche o caixa atual antes de abrir um novo.' },
                { status: 409 }
            );
        }

        const caixa = await abrirCaixa(user.id, initialAmount);
        return NextResponse.json({ caixa });
    } catch (error) {
        console.error('Erro ao abrir caixa:', error);
        return NextResponse.json({ error: 'Erro ao abrir o caixa' }, { status: 500 });
    }
}
