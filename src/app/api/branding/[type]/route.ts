import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIR = path.join(process.cwd(), 'public', 'branding');
const ALLOWED = new Set(['logo', 'selo']);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
    const { type } = await params;
    if (!ALLOWED.has(type)) return new NextResponse('Not found', { status: 404 });

    const exts = ['png', 'jpg', 'jpeg', 'webp'];
    for (const ext of exts) {
        const filePath = path.join(DIR, `${type}.${ext}`);
        try {
            const buf = await fs.readFile(filePath);
            const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
            return new NextResponse(buf, {
                headers: { 'Content-Type': contentType, 'Cache-Control': 'no-cache' },
            });
        } catch {
            // tenta a próxima extensão
        }
    }
    return new NextResponse('Not found', { status: 404 });
}
