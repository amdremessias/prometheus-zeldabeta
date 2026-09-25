import { NextResponse } from 'next/server';
import { ensureSchema, pool } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Retorna apenas logo/selo selecionados em Configurações. É público de propósito:
// as imagens já estão na pasta public e não expõem dados sensíveis. Usado pela
// tela de login (que não tem o store hidratado).
export async function GET() {
    try {
        await ensureSchema();
        const res = await pool.query('SELECT data FROM app_state WHERE id = 1');
        if ((res.rowCount ?? 0) === 0) return NextResponse.json({ logo: undefined, selo: undefined });
        const data = (res.rows[0].data ?? {}) as { config?: { branding?: { logo?: string; selo?: string } } };
        const branding = data.config?.branding ?? {};
        return NextResponse.json({ logo: branding.logo ?? undefined, selo: branding.selo ?? undefined });
    } catch (error) {
        console.error('Erro ao ler marca:', error);
        return NextResponse.json({ logo: undefined, selo: undefined });
    }
}
