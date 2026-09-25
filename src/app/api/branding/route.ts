import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DIR = path.join(process.cwd(), 'public', 'branding');
const MAX_BYTES = 2.5 * 1024 * 1024; // 2.5 MB

function isValidImageDataUrl(value: string): boolean {
    return /^data:image\/(png|jpeg|jpg|webp|gif);base64,/.test(value);
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    if (!can(user.role, 'config')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });

    let body: { type?: string; dataUrl?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });
    }

    const type = String(body?.type || '');
    const dataUrl = String(body?.dataUrl || '');
    if (type !== 'logo' && type !== 'selo') return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    if (!isValidImageDataUrl(dataUrl)) return NextResponse.json({ error: 'Imagem inválida' }, { status: 400 });

    const base64 = dataUrl.split(',')[1] || '';
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
        return NextResponse.json({ error: 'Imagem muito grande (máx. 2.5 MB)' }, { status: 413 });
    }

    const ext = dataUrl.includes('image/png')
        ? 'png'
        : dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')
          ? 'jpg'
          : dataUrl.includes('image/webp')
            ? 'webp'
            : 'png';

    try {
        await fs.mkdir(DIR, { recursive: true });
        const filePath = path.join(DIR, `${type}.${ext}`);
        await fs.writeFile(filePath, buffer);
        return NextResponse.json({ ok: true, url: `/branding/${type}.${ext}` });
    } catch (error) {
        console.error('Erro ao salvar imagem de marca:', error);
        return NextResponse.json({ error: 'Erro ao salvar imagem' }, { status: 500 });
    }
}
