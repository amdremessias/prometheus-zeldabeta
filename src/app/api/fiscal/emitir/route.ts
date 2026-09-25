import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/server/session';
import { can } from '@/lib/permissions';
import { ensureSchema, pool } from '@/lib/server/db';
import { fiscalDecrypt } from '@/lib/server/fiscalCrypto';
import { metodoToTPag } from '@/shared/lib/sefaZ';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROW_ID = 1;

type ConfigRow = {
    id: number;
    habilitado: boolean;
    cnpj: string;
    razao_social: string;
    crt: string;
    ambiente: number;
    serie_nfce: number;
    serie_nfe: number;
    proximo_numero_nfce: number;
    proximo_numero_nfe: number;
    codigo_ibge_municipio: string;
    csc_token: Buffer | null;
};

function checksumDV(chave44: string): number {
    let peso = 2;
    let soma = 0;
    for (let i = chave44.length - 1; i >= 0; i--) {
        soma += Number(chave44[i]) * peso;
        peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
}

function buildChave(cUf: string, modelo: string, cnpj: string, serie: number, numero: number, tpEmis: string, cNf: string): string {
    const now = new Date();
    const aamm = String(now.getFullYear() % 100).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0');
    const base =
        String(cUf).padStart(2, '0') +
        aamm +
        String(cnpj).padStart(14, '0') +
        String(modelo).padStart(2, '0') +
        String(serie).padStart(3, '0') +
        String(numero).padStart(9, '0') +
        String(tpEmis).padStart(1, '0') +
        String(cNf).padStart(8, '0');
    const dv = checksumDV(base);
    return base + String(dv);
}

export async function POST(req: NextRequest) {
    const user = await getSessionUser();
    if (!user) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (!can(user.role, 'fiscal')) {
        return NextResponse.json({ error: 'Sem permissão para emitir notas fiscais' }, { status: 403 });
    }

    let body: { venda?: unknown; modelo?: string; pedidoId?: number };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
    }

    if (!body.venda || typeof body.venda !== 'object') {
        return NextResponse.json({ error: 'Payload de venda ausente' }, { status: 400 });
    }
    const venda = body.venda as Record<string, unknown> & {
        items?: Array<{ title?: string; quantity?: number; price?: number }>;
        pagamentos?: Array<{ metodo?: string; valor?: number }>;
    };

    try {
        await ensureSchema();
        const res = await pool.query<ConfigRow>('SELECT * FROM fiscal_config WHERE id = $1', [ROW_ID]);
        if (!res.rowCount) {
            return NextResponse.json({ emitido: false, motivo: 'sem_config', error: 'Configuração fiscal não cadastrada' });
        }
        const cfg = res.rows[0];

        // Módulo desligado: NÃO bloqueia o PDV — apenas registra que não houve emissão.
        if (!cfg.habilitado) {
            return NextResponse.json({ emitido: false, motivo: 'desativado', error: 'Módulo fiscal desativado nas configurações' });
        }
        if (!cfg.cnpj || !cfg.razao_social) {
            return NextResponse.json({ emitido: false, motivo: 'config_incompleta', error: 'Emitente (CNPJ/Razão Social) incompleto' });
        }

        const modelo = body.modelo === '55' ? '55' : '65'; // NFC-e por padrão
        const serie = modelo === '55' ? cfg.serie_nfe : cfg.serie_nfce;
        const numero = modelo === '55' ? cfg.proximo_numero_nfe : cfg.proximo_numero_nfce;

        // cUF extraído do IBGE (2 primeiros dígitos) do município cadastrado; fallback SP=35 (homologação).
        const cUf = (cfg.codigo_ibge_municipio || '35').replace(/\D/g, '').slice(0, 2).padStart(2, '0') || '35';
        const cNf = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
        const chave = buildChave(cUf, modelo, cfg.cnpj, serie, numero, '1', cNf);

        const items = (venda.items || []).map((it) => ({
            titulo: it.title ?? '',
            quantidade: it.quantity ?? 0,
            valor: it.price ?? 0,
        }));

        const pagamentos = (venda.pagamentos || []).map((p) => ({
            metodo: p.metodo ?? 'dinheiro',
            valor: p.valor ?? 0,
            tPag: metodoToTPag((p.metodo as VendaPagamentoType['metodo']) ?? 'dinheiro'),
        }));

        const payload: Record<string, unknown> = {
            venda: {
                id: venda.id,
                tipo: venda.tipo,
                origem: venda.origem,
                total: venda.total,
                consumidorCpfCnpj: venda.consumidorCpfCnpj ?? '',
                items,
                pagamentos,
            },
            emitente: {
                cnpj: cfg.cnpj,
                razaoSocial: cfg.razao_social,
                crt: cfg.crt,
                codigoIbgeMunicipio: cfg.codigo_ibge_municipio,
            },
        };

        // Emissão simulada: sem transmissão real à SEFAZ nesta fase.
        // O job real consumiria csc_token via _fiscalConfigSecret() e o container NFePHP (/emitir stub).
        let cscToken = null;
        if (cfg.csc_token && cfg.csc_token.length) {
            try {
                cscToken = fiscalDecrypt(cfg.csc_token).toString('utf8');
            } catch {
                cscToken = null;
            }
        }

        const xmlEnvioSimulado = `<simulado modelo="${modelo}" serie="${serie}" numero="${numero}" chave="${chave}">Sem transmissao real nesta fase</simulado>`;

        const inserted = await pool.query<{ id: number }>(
            `INSERT INTO fiscal_notes
               (pedido_id, modelo, serie, numero, chave_acesso, status, ambiente,
                xml_envio, payload_venda, protocolo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)
             RETURNING id`,
            [
                body.pedidoId ?? null,
                modelo,
                serie,
                numero,
                chave,
                'pendente',
                cfg.ambiente,
                xmlEnvioSimulado,
                JSON.stringify({
                    payload,
                    cscTokenPresent: Boolean(cscToken),
                }),
            ]
        );

        // Incrementa o próximo número da série usada.
        const nextCol = modelo === '55' ? 'proximo_numero_nfe' : 'proximo_numero_nfce';
        await pool.query(`UPDATE fiscal_config SET ${nextCol} = $2, updated_at = now() WHERE id = $1`, [ROW_ID, numero + 1]);

        return NextResponse.json({
            emitido: true,
            nota: {
                id: inserted.rows[0].id,
                modelo,
                serie,
                numero,
                chaveAcesso: chave,
                status: 'pendente',
                ambiente: cfg.ambiente,
            },
        });
    } catch (error) {
        console.error('Erro ao emitir nota fiscal (simulada):', error);
        return NextResponse.json({ error: 'Erro ao emitir nota fiscal' }, { status: 500 });
    }
}
