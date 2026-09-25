import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
const SKIP_DIRS = new Set(['.next', 'node_modules', 'IMAGES-DEMO', 'branding']);
const MAX_RESULTS = 200;

async function walk(dir: string, rel: string, out: string[]): Promise<void> {
    if (out.length >= MAX_RESULTS) return;
    let entries: import('fs').Dirent[];
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (out.length >= MAX_RESULTS) return;
        const name = entry.name;
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(name)) continue;
            await walk(path.join(dir, name), `${rel}/${name}`, out);
        } else if (entry.isFile()) {
            const ext = name.split('.').pop()?.toLowerCase() ?? '';
            if (IMAGE_EXTS.has(ext)) out.push(`${rel}/${name}`);
        }
    }
}

export async function GET(_req: NextRequest) {
    const out: string[] = [];
    await walk(PUBLIC_DIR, '', out);
    return NextResponse.json({ presets: out });
}
