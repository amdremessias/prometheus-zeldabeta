import { NextResponse } from 'next/server';
import { requireAdmin, downloadBackup } from '@/lib/server/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    if (typeof name !== 'string' || !name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 });
    try {
        const data = await downloadBackup(name);
        if (!data) return NextResponse.json({ error: 'arquivo não encontrado' }, { status: 404 });
        return new NextResponse(data, {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${name}"`,
            },
        });
    } catch (error) {
        console.error('backup download error', error);
        return NextResponse.json({ error: 'Não foi possível baixar o backup' }, { status: 500 });
    }
}