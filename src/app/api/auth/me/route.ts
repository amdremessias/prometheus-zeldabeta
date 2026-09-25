import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { getUserById } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getSessionUser();
        if (!session) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        // Revalida papel/status no banco (não confiar apenas no JWT)
        const user = await getUserById(session.id);
        if (!user || !user.active) {
            return NextResponse.json({ error: 'Usuário desativado' }, { status: 401 });
        }

        return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        console.error('Erro ao consultar sessão:', error);
        return NextResponse.json({ error: 'Erro ao consultar a sessão' }, { status: 500 });
    }
}