import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';
import { fiscalEncrypt, fiscalDecrypt } from '@/lib/server/fiscalCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ConfigRow = {
    id: number;
    habilitado: boolean;
    cnpj: string;
    razao_social: string;
    nome_fantasia: string;
    ie: string;
    crt: string;
    ambiente: number;
    certificado_nome: string;
    certificado_pfx: Buffer | null;
    certificado_senha: Buffer | null;
    csc_token: Buffer | null;
    csc_id: string;
    serie_nfce: number;
    serie_nfe: number;
    proximo_numero_nfce: number;
    proximo_numero_nfe: number;
    codigo_ibge_municipio: string;
    updated_at: Date;
};

const ROW_ID = 1;

function mapRow(row: ConfigRow) {
    return {
        habilitado: Boolean(row.habilitado),
        cnpj: row.cnpj,
        razaoSocial: row.razao_social,
        nomeFantasia: row.nome_fantasia,
        ie: row.ie,
        crt: row.crt,
        ambiente: row.ambiente,
        certificadoNome: row.certificado_nome || '',
        certificadoPfxPresente: Boolean(row.certificado_pfx && (row.certificado_pfx as { length?: number })?.length),
        certificadoSenhaDefinida: Boolean(row.certificado_senha && (row.certificado_senha as { length?: number })?.length),
        cscId: row.csc_id || '',
        cscDefinido: Boolean(row.csc_token && (row.csc_token as { length?: number })?.length),
        serieNfce: row.serie_nfce,
        serieNfe: row.serie_nfe,
        proximoNumeroNfce: row.proximo_numero_nfce,
        proximoNumeroNfe: row.proximo_numero_nfe,
        codigoIbgeMunicipio: row.codigo_ibge_municipio,
        updatedAt: row.updated_at,
    };
}

export async function GET() {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para acessar configurações fiscais' }, { status: 403 });
    }

    try {
        await ensureSchema();
        const res = await pool.query<ConfigRow>(
            'SELECT * FROM fiscal_config WHERE id = $1',
            [ROW_ID]
        );
        if ((res.rowCount ?? 0) === 0) {
            return NextResponse.json({ config: null });
        }
        return NextResponse.json({ config: mapRow(res.rows[0]) });
    } catch (error) {
        console.error('Erro ao ler config fiscal:', error);
        return NextResponse.json({ error: 'Erro ao ler configurações fiscais' }, { status: 500 });
    }
}

type Body = {
    habilitado?: boolean;
    cnpj?: string;
    razaoSocial?: string;
    nomeFantasia?: string;
    ie?: string;
    crt?: string;
    ambiente?: number;
    certificadoSenha?: string;
    cscToken?: string;
    cscId?: string;
    serieNfce?: number;
    serieNfe?: number;
    proximoNumeroNfce?: number;
    proximoNumeroNfe?: number;
    codigoIbgeMunicipio?: string;
};

export async function PUT(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para alterar configurações fiscais' }, { status: 403 });
    }

    let body: Body;
    try {
        body = (await req.json()) as Body;
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    // Validações básicas de negócio (não-destrutivas; campos inválidos falham a gravação).
    if (body.ambiente !== undefined && ![1, 2].includes(Number(body.ambiente))) {
        return NextResponse.json({ error: 'Ambiente inválido (esperado 1 ou 2)' }, { status: 400 });
    }
    if (body.crt !== undefined && !['1', '3'].includes(String(body.crt))) {
        return NextResponse.json({ error: 'CRT inválido (esperado 1 ou 3)' }, { status: 400 });
    }
    if (body.serieNfce !== undefined && (!Number.isInteger(Number(body.serieNfce)) || Number(body.serieNfce) < 0)) {
        return NextResponse.json({ error: 'Série NFC-e inválida' }, { status: 400 });
    }

    try {
        await ensureSchema();
        const existing = await pool.query<ConfigRow>('SELECT * FROM fiscal_config WHERE id = $1', [ROW_ID]);
        const cur = existing.rowCount ? existing.rows[0] : null;
        if (!cur) {
            // Primeira gravação: cria a linha com valor fixo.
            const cnpj = body.cnpj?.replace(/\D/g, '') || '';
            if (!cnpj) {
                return NextResponse.json({ error: 'CNPJ é obrigatório' }, { status: 400 });
            }
            const razao = (body.razaoSocial || '').trim();
            if (!razao) {
                return NextResponse.json({ error: 'Razão Social é obrigatória' }, { status: 400 });
            }
            const senhaBuf = body.certificadoSenha ? fiscalEncrypt(body.certificadoSenha) : null;
            const cscBuf = body.cscToken ? fiscalEncrypt(body.cscToken) : null;
            await pool.query(
                `INSERT INTO fiscal_config
                 (id, habilitado, cnpj, razao_social, nome_fantasia, ie, crt, ambiente,
                  certificado_nome, certificado_senha, csc_token, csc_id,
                  serie_nfce, serie_nfe, proximo_numero_nfce, proximo_numero_nfe, codigo_ibge_municipio)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
                [
                    ROW_ID,
                    Boolean(body.habilitado ?? false),
                    cnpj,
                    razao,
                    (body.nomeFantasia || '').trim(),
                    (body.ie || '').trim(),
                    String(body.crt || '1'),
                    Number(body.ambiente ?? 2),
                    '',
                    senhaBuf,
                    cscBuf,
                    (body.cscId || '').trim(),
                    Number(body.serieNfce ?? 1),
                    Number(body.serieNfe ?? 1),
                    Number(body.proximoNumeroNfce ?? 1),
                    Number(body.proximoNumeroNfe ?? 1),
                    (body.codigoIbgeMunicipio || '').trim(),
                ]
            );
        } else {
            // Atualização parcial — preserva o certificado .pfx e segredos não enviados.
            let senhaBuf = cur.certificado_senha;
            if (body.certificadoSenha !== undefined) {
                senhaBuf = body.certificadoSenha ? fiscalEncrypt(body.certificadoSenha) : null;
            }
            let cscBuf = cur.csc_token;
            if (body.cscToken !== undefined) {
                cscBuf = body.cscToken ? fiscalEncrypt(body.cscToken) : null;
            }
            const cnpj = body.cnpj?.replace(/\D/g, '') || cur.cnpj;
            const razao = (body.razaoSocial || '').trim() || cur.razao_social;
            await pool.query(
                `UPDATE fiscal_config SET
                   habilitado=$2, cnpj=$3, razao_social=$4, nome_fantasia=$5, ie=$6, crt=$7, ambiente=$8,
                   certificado_senha=$9, csc_token=$10, csc_id=$11,
                   serie_nfce=$12, serie_nfe=$13, proximo_numero_nfce=$14, proximo_numero_nfe=$15,
                   codigo_ibge_municipio=$16, updated_at=now()
                 WHERE id=$1`,
                [
                    ROW_ID,
                    body.habilitado !== undefined ? Boolean(body.habilitado) : Boolean(cur.habilitado),
                    cnpj,
                    razao,
                    (body.nomeFantasia ?? cur.nome_fantasia).trim(),
                    (body.ie ?? cur.ie).trim(),
                    String(body.crt ?? cur.crt),
                    Number(body.ambiente ?? cur.ambiente),
                    senhaBuf,
                    cscBuf,
                    (body.cscId ?? cur.csc_id).trim(),
                    Number(body.serieNfce ?? cur.serie_nfce),
                    Number(body.serieNfe ?? cur.serie_nfe),
                    Number(body.proximoNumeroNfce ?? cur.proximo_numero_nfce),
                    Number(body.proximoNumeroNfe ?? cur.proximo_numero_nfe),
                    (body.codigoIbgeMunicipio ?? cur.codigo_ibge_municipio).trim(),
                ]
            );
        }

        const after = await pool.query<ConfigRow>('SELECT * FROM fiscal_config WHERE id = $1', [ROW_ID]);
        return NextResponse.json({ config: mapRow(after.rows[0]) });
    } catch (error) {
        console.error('Erro ao salvar config fiscal:', error);
        return NextResponse.json({ error: 'Erro ao salvar configurações fiscais' }, { status: 500 });
    }
}

/* Helper para uso interno (não rota): descriptografa um segredo armazenado. */
export async function _fiscalConfigSecret(): Promise<{
    cscToken: string | null;
    certificadoSenha: string | null;
} | null> {
    await ensureSchema();
    const res = await pool.query<ConfigRow>(
        'SELECT csc_token, certificado_senha FROM fiscal_config WHERE id = $1',
        [ROW_ID]
    );
    if (!res.rowCount) return null;
    const r = res.rows[0];
    const dec = (buf: Buffer | null): string | null => {
        if (!buf || !buf.length) return null;
        try {
            return fiscalDecrypt(buf).toString('utf8');
        } catch {
            return null;
        }
    };
    return { cscToken: dec(r.csc_token), certificadoSenha: dec(r.certificado_senha) };
}
