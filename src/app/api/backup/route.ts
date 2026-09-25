import { NextResponse } from 'next/server';
import { requireAdmin, listBackups, createBackup, ensureBackupDir } from '@/lib/server/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;
    try {
        const files = await listBackups();
        return NextResponse.json({ backups: files });
    } catch (error) {
        console.error('backup list error', error);
        return NextResponse.json({ error: 'Não foi possível listar os backups' }, { status: 500 });
    }
}

export async function POST() {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;
    try {
        await ensureBackupDir();
        const name = await createBackup();
        return NextResponse.json({ ok: true, name });
    } catch (error) {
        console.error('backup create error', error);
        return NextResponse.json({ error: 'Não foi possível gerar o backup' }, { status: 500 });
    }
}