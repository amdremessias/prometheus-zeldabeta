import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { requireAdmin, BACKUP_DIR, sanitizeBackupName, ensureBackupDir } from '@/lib/server/backup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function rawBodyToBuffer(request: Request): Promise<Buffer> {
    return request.arrayBuffer().then((ab) => Buffer.from(ab));
}

/** Salva um .dump enviado pelo usuário em /backups para uso no restore. */
export async function POST(request: Request) {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;

    const rawName = request.headers.get('x-backup-filename') || request.headers.get('x-filename') || '';

    if (!rawName.trim()) {
        return NextResponse.json({ error: 'Envie um arquivo .dump (nome sem espaços ou caracteres especiais)' }, { status: 400 });
    }

    let name = sanitizeBackupName(rawName);
    if (!name.toLowerCase().endsWith('.dump')) {
        return NextResponse.json({ error: 'Envie um arquivo .dump (nome sem espaços ou caracteres especiais)' }, { status: 400 });
    }

    await ensureBackupDir();
    let target = path.join(BACKUP_DIR, name);
    let stats = await fs.stat(target).catch(() => null);
    if (stats?.isFile()) {
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
        const suffixed = name.replace(/\.dump$/i, `_${stamp}.dump`);
        target = path.join(BACKUP_DIR, suffixed);
        stats = await fs.stat(target).catch(() => null);
        if (stats?.isFile()) {
            return NextResponse.json({ error: `Já existe um backup chamado ${name}. Renomeie o arquivo.` }, { status: 409 });
        }
        name = suffixed;
    }

    try {
        const buffer = await rawBodyToBuffer(request);
        if (!buffer.length) return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 });
        await fs.writeFile(target, buffer);
        return NextResponse.json({ ok: true, name, size: buffer.length });
    } catch (error: unknown) {
        await fs.unlink(target).catch(() => undefined);
        console.error('backup import error', error);
        return NextResponse.json(
            { error: 'Falha ao salvar backup importado: ' + String((error as Error)?.message ?? error) },
            { status: 500 }
        );
    }
}

export async function GET() {
    const forbidden = await requireAdmin();
    if (forbidden) return forbidden;
    return NextResponse.json({ error: 'Use POST para importar um arquivo .dump' }, { status: 405 });
}