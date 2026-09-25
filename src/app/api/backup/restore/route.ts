import { NextResponse } from 'next/server';
import { requireAdmin, restoreBackup } from '@/lib/server/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;
    try {
        const body = await request.json().catch(() => null);
        const name = body?.name;
        if (typeof name !== 'string' || !name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
        const result = await restoreBackup(name);
        return NextResponse.json({ ok: true, name, stdout: result.stdout, stderr: result.stderr });
    } catch (error: unknown) {
        console.error('backup restore error', error);
        return NextResponse.json(
            { error: 'Não foi possível restaurar: ' + String((error as Error)?.message ?? error) },
            { status: 500 }
        );
    }
}