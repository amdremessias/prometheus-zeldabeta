/* Parser de CSV puro (sem dependências) + conversão de linhas em produtos do cardápio.
   Suporta delimitador ';' ou ',', aspas duplas (campos com separador/quebra),
   remoção de BOM e preço no formato brasileiro ("12,50" ou "12.50"). */

export type ColumnMapping = {
    title?: string;            // nome/cabeçalho da coluna de título
    price?: string;            // cabeçalho da coluna de preço
    category?: string;         // cabeçalho da coluna de categoria (label)
    codigoBarras?: string;
    codigoInterno?: string;
    ncm?: string;
    cest?: string;
    unidadeComercial?: string;
    origem?: string;
    csosn?: string;
    cst?: string;
    cfop?: string;
    estoqueAtual?: string;
    estoqueMinimo?: string;
    status?: string;
};

export type ParsedProductError = {
    row: number; // número real da linha no arquivo (1-based)
    message: string;
};

export type ParsedProductsResult = {
    items: CardapioFoodType[];
    errors: ParsedProductError[];
};

const UNIDADES: Array<CardapioFoodType['unidadeComercial']> = ['UN', 'KG', 'CX', 'LT'];

/* Quebra o CSV em linhas de células, respeitando aspas duplas. */
export function parseCsv(texto: string, separador: ';' | ',' = ';'): string[][] {
    let text = texto.replace(/^\uFEFF/, ''); // BOM
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const rows: string[][] = [];
    let row: string[] = [];
    let campo = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    campo += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                campo += ch;
            }
        } else if (ch === '"') {
            inQuotes = true;
        } else if (ch === separador) {
            row.push(campo);
            campo = '';
        } else if (ch === '\n') {
            row.push(campo);
            rows.push(row);
            row = [];
            campo = '';
        } else {
            campo += ch;
        }
    }
    // última linha sem quebra
    if (campo !== '' || row.length > 0) {
        row.push(campo);
        rows.push(row);
    }

    return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/* Lança exceção se a linha não tiver todas as colunas do mapeamento. */
function obterIndices(cabecalho: string[], mapping: ColumnMapping): Record<string, number> {
    const chave = (s: string) => s.trim().toLowerCase();
    const header = cabecalho.map(chave);
    const idx: Record<string, number> = {};

    for (const campo of Object.keys(mapping) as Array<keyof ColumnMapping>) {
        const nomeEsperado = mapping[campo];
        if (!nomeEsperado) continue;
        const pos = header.indexOf(chave(nomeEsperado));
        if (pos >= 0) idx[campo] = pos;
    }
    return idx;
}

function toNumber(valor: string | undefined): number | undefined {
    if (valor == null || valor.trim() === '') return undefined;
    const n = Number(valor.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : undefined;
}

function toInt(valor: string | undefined): number | undefined {
    const n = toNumber(valor);
    return n != null ? Math.floor(n) : undefined;
}

/* Converte as linhas textuais (com cabeçalho) em produtos + erros por linha. */
export function productCsvToItems(
    csv: string[][],
    mapping: ColumnMapping,
    resolveCategoriaIds: (label: string) => number[]
): ParsedProductsResult {
    const result: ParsedProductsResult = { items: [], errors: [] };
    if (csv.length === 0) return result;

    const cabecalho = csv[0];
    const idx = obterIndices(cabecalho, mapping);

    for (let r = 1; r < csv.length; r++) {
        const linha = csv[r];
        const cel = (pos: number | undefined): string | undefined =>
            pos == null ? undefined : (linha[pos] ?? '').trim();

        const title = cel(idx.title);
        const precoStr = cel(idx.price);

        if (!title) {
            result.errors.push({ row: r + 1, message: 'Nome do produto vazio.' });
            continue;
        }
        const price = toNumber(precoStr);
        if (price == null || price < 0) {
            result.errors.push({ row: r + 1, message: 'Preço inválido.' });
            continue;
        }

        const categoriaLabel = cel(idx.category);
        const category = categoriaLabel ? resolveCategoriaIds(categoriaLabel) : [];

        const status = cel(idx.status) || 'Ativo';
        const ncm = cel(idx.ncm);
        const cest = cel(idx.cest);
        const unidade = cel(idx.unidadeComercial);
        const origem = cel(idx.origem);
        const csosn = cel(idx.csosn);
        const cst = cel(idx.cst);
        const cfop = toNumber(cel(idx.cfop)) ?? 5102;

        result.items.push({
            id: 0, // id real atribuído na aplicação (encontrarMenorIdDisponivel)
            imageBlob: new Blob([]),
            imageURL: '',
            title,
            price,
            category,
            adicionaisDisponiveis: [],
            status,
            estoqueAtual: toInt(cel(idx.estoqueAtual)),
            estoqueMinimo: toInt(cel(idx.estoqueMinimo)),
            ncm: ncm || undefined,
            cest: cest || undefined,
            unidadeComercial: unidade && (UNIDADES as string[]).includes(unidade.toUpperCase())
                ? (unidade.toUpperCase() as CardapioFoodType['unidadeComercial'])
                : undefined,
            origem: origem || undefined,
            csosn: csosn || undefined,
            cst: cst || undefined,
            cfop,
            codigoBarras: cel(idx.codigoBarras) || undefined,
            codigoInterno: cel(idx.codigoInterno) || undefined,
        });
    }

    return result;
}

/* Cabeçalhos canônicos do modelo de importação (na ordem das colunas do DEFAULT_MAPPING). */
export const MODELO_HEADERS: string[] = [
    'nome',
    'preco',
    'categoria',
    'codBarras',
    'codInterno',
    'ncm',
    'cest',
    'unidade',
    'origem',
    'csosn',
    'cst',
    'cfop',
    'estoqueAtual',
    'estoqueMinimo',
    'status',
];

/* Escapa um valor de célula para CSV: aspas duplas e separador/quebra dentro do campo. */
export function escapaCsv(value: string, separador: ';' | ','): string {
    if (/["\n]/.test(value) || value.includes(separador)) {
        return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
}

/* Gera o arquivo CSV de modelo (pré-preenchido com exemplos) para download pelo usuário.
   Os cabeçalhos usados são exatamente os esperados pelo parser (auto-mapeados). */
export function gerarModeloCsv(separador: ';' | ',' = ';'): string {
    const headers = MODELO_HEADERS.join(separador);
    const linhas: string[][] = [
        ['Coca-Cola Lata 350ml', '6,50', 'Bebidas', '7894900011517', 'COCA350', '22021000', '', 'UN', '0', '102', '', '5102', '120', '10', 'Ativo'],
        ['Pizza Calabresa Grande', '54,90', 'Pizzas', '', 'PIZCAL', '19041000', '', 'UN', '1', '102', '', '5102', '', '', 'Ativo'],
        ['Batata Frita 300g', '18,00', 'Porções', '', '', '20052000', '', 'KG', '0', '102', '', '5102', '30', '5', 'Ativo'],
    ];
    const corpo = linhas
        .map((linha) => linha.map((c) => escapaCsv(c, separador)).join(separador))
        .join('\n');
    return `${headers}\n${corpo}\n`;
}

/* Cria e dispara o download do arquivo CSV no navegador. */
export function baixarModeloCsv(separador: ';' | ',' = ';') {
    const conteudo = gerarModeloCsv(separador);
    // BOM (U+FEFF) para o Excel abrir com acentuação correta.
    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = separador === ';' ? 'modelo-importacao-produtos.csv' : 'modelo-importacao-produtos-virgula.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
