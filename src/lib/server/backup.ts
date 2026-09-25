import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import {
    NextResponse,
} from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { getUserById } from '@/lib/server/db';

const execFileAsync = promisify(execFile);

export const BACKUP_DIR = process.env.BACKUP_DIR || '/backups';

function getDatabaseUrl(): string {
    const url = process.env.DATABASE_URL || 'postgresql://zelda:zelda@localhost:5432/zeldapdv';
    return url.replace(/^postgres:\/\//, 'postgresql://');
}

export function safeBackupName(name: string): boolean {
    if (typeof name !== 'string' || name.length === 0) return false;
    if (!/^[\w.-]+$/.test(name)) return false;
    if (name && (name.includes('..') || path.basename(name) !== name)) return false;
    return true;
}

/* Converte um nome de arquivo livre (ex.: "Backup da empresa 15-09.dump") em um
   nome seguro e único para salvar em /backups (sem espaços e sem caracteres especiais). */
export function sanitizeBackupName(name: string): string {
    if (typeof name !== 'string') return 'backup.dump';
    const base = path.basename(name).replace(/\.dump$/i, '');
    const safe = base
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/\.{2,}/g, '.')
        .replace(/^[.\-_]+|[.\-_]+$/g, '')
        .slice(0, 80);
    const finalName = `${safe || 'backup'}.dump`;
    return safeBackupName(finalName) ? finalName : 'backup.dump';
}

export async function ensureBackupDir(): Promise<void> {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
}

export async function listBackups(): Promise<{ name: string; size: number; mtime: string }[]> {
    await ensureBackupDir();
    const entries = await fs.readdir(BACKUP_DIR);
    const files: { name: string; size: number; mtime: string }[] = [];
    for (const name of entries) {
        if (!name.endsWith('.dump')) continue;
        const full = path.join(BACKUP_DIR, name);
        const st = await fs.stat(full).catch(() => null);
        if (st?.isFile()) {
            files.push({ name, size: st.size, mtime: st.mtime.toISOString() });
        }
    }
    files.sort((a, b) => (a.mtime < b.mtime ? 1 : -1));
    return files;
}

export async function createBackup(): Promise<string> {
    await ensureBackupDir();
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
    const fileName = `zelda_pdv_${stamp}.dump`;
    const target = path.join(BACKUP_DIR, fileName);
    const dbUrl = getDatabaseUrl();
    await execFileAsync('pg_dump', ['--no-owner', '--no-privileges', '--format=custom', '--file', target, dbUrl], {
        timeout: 120_000,
    });
    return fileName;
}

export async function downloadBackup(name: string): Promise<Buffer | null> {
    if (!safeBackupName(name)) return null;
    const full = path.join(BACKUP_DIR, name);
    const st = await fs.stat(full).catch(() => null);
    if (!st?.isFile()) return null;
    return fs.readFile(full);
}

export async function restoreBackup(name: string): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    if (!safeBackupName(name)) throw new Error('nome de arquivo inválido');
    const full = path.join(BACKUP_DIR, name);
    const st = await fs.stat(full).catch(() => null);
    if (!st?.isFile()) throw new Error('arquivo não encontrado');
    const dbUrl = getDatabaseUrl();
    try {
        const { stdout, stderr } = await execFileAsync('pg_restore', ['--no-owner', '--no-privileges', '--clean', '--if-exists', '--dbname', dbUrl, full], {
            timeout: 300_000,
        });
        return { ok: true, stdout, stderr };
    } catch (error: unknown) {
        const stderr = (error as { stderr?: unknown })?.stderr;
        if (stderr && /errors ignored on restore/i.test(String(stderr))) {
            return { ok: true, stdout: String((error as { stdout?: unknown })?.stdout ?? ''), stderr: String(stderr) };
        }
        throw error;
    }
}

export async function requireAdmin(): Promise<NextResponse | null> {
    const session = await getSessionUser();
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    const user = await getUserById(session.id);
    if (!user || !user.active) return NextResponse.json({ error: 'Usuário desativado' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ error: 'Acesso restrito ao administrador' }, { status: 403 });
    return null;
}