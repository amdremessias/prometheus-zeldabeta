import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';
import { fiscalEncrypt } from '@/lib/server/fiscalCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROW_ID = 1;
const MAX_PFX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para alterar certificado fiscal' }, { status: 403 });
    }

    let form: FormData;
    try {
        form = await req.formData();
    } catch {
        return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
    }

    const file = form.get('certificado') as File | null;
    const senhaRaw = (form.get('senha') as string | null) ?? '';

    if (!file || !file.name.toLowerCase().endsWith('.pfx')) {
        return NextResponse.json({ error: 'Envie um certificado A1 válido (.pfx)' }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_PFX_BYTES) {
        return NextResponse.json({ error: 'Arquivo inválido ou maior que 5 MB' }, { status: 400 });
    }
    if (!senhaRaw) {
        return NextResponse.json({ error: 'Informe a senha do certificado' }, { status: 400 });
    }

    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const pfxCipher = fiscalEncrypt(Buffer.from(bytes));
        const senhaCipher = fiscalEncrypt(senhaRaw);
        const senhaBuf = senhaCipher;

        await ensureSchema();
        const existing = await pool.query('SELECT id FROM fiscal_config WHERE id = $1', [ROW_ID]);
        if ((existing.rowCount ?? 0) === 0) {
            return NextResponse.json(
                { error: 'Cadastre o emitente (CNPJ/Razão Social) antes de enviar o certificado' },
                { status: 409 }
            );
        }

        await pool.query(
            `UPDATE fiscal_config
             SET certificado_pfx=$2, certificado_nome=$3, certificado_senha=$4, updated_at=now()
             WHERE id=$1`,
            [ROW_ID, pfxCipher, file.name, senhaBuf]
        );

        return NextResponse.json({
            ok: true,
            certificadoNome: file.name,
            certificadoPfxPresente: true,
            certificadoSenhaDefinida: true,
        });
    } catch (error) {
        console.error('Erro ao enviar certificado:', error);
        return NextResponse.json({ error: 'Erro ao salvar o certificado' }, { status: 500 });
    }
}
