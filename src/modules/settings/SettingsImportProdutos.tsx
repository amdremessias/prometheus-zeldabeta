import { useMemo, useRef, useState } from 'react';
import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { showMessage } from '@/store/popupStore';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';
import {
    parseCsv,
    productCsvToItems,
    baixarModeloCsv,
    MODELO_HEADERS,
    type ColumnMapping,
} from '@/shared/lib/parseProductCsv';
import { recalcCategoriaCounts } from './settingsActions';

/* Mapeamento padrão auto-detecção dos cabeçalhos mais comuns. */
const DEFAULT_MAPPING: ColumnMapping = {
    title: 'nome',
    price: 'preco',
    category: 'categoria',
    codigoBarras: 'codBarras',
    codigoInterno: 'codInterno',
    ncm: 'ncm',
    cest: 'cest',
    unidadeComercial: 'unidade',
    origem: 'origem',
    csosn: 'csosn',
    cst: 'cst',
    cfop: 'cfop',
    estoqueAtual: 'estoqueAtual',
    estoqueMinimo: 'estoqueMinimo',
    status: 'status',
};

/* Nomes alternativos normalizados (minúsculo, sem acento) para auto-mapear colunas. */
const ALIASES: Record<string, string[]> = {
    title: ['nome', 'titulo', 'produto', 'descricao', 'name', 'title'],
    price: ['preco', 'preço', 'valor', 'precovenda', 'price', 'valorvenda', 'valor venda'],
    category: ['categoria', 'category'],
    codigoBarras: ['código de barras', 'codbarras', 'codigodebarras', 'codigo de barras', 'barcode', 'ean'],
    codigoInterno: ['código interno', 'codinterno', 'codigointerno', 'referencia', 'skus', 'sku'],
    ncm: ['ncm'],
    cest: ['cest'],
    unidadeComercial: ['unidade', 'unidadecomercial', 'und', 'un'],
    origem: ['origem'],
    csosn: ['csosn'],
    cst: ['cst'],
    cfop: ['cfop'],
    estoqueAtual: ['estoqueatual', 'estoque atual', 'estoque', 'qtdestoque'],
    estoqueMinimo: ['estoqueminimo', 'estoque minimo', 'estoqmin'],
    status: ['status', 'situacao', 'situação'],
};

export function SettingsImportProdutos() {
    const cardapio = useDataStore((state) => state.cardapio);
    const setCardapio = useDataStore((state) => state.setCardapio);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [separador, setSeparador] = useState<';' | ','>(';');
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<string[][] | null>(null);
    const [mapping, setMapping] = useState<ColumnMapping>({ ...DEFAULT_MAPPING });
    const [statusMsg, setStatusMsg] = useState<string | null>(null);
    const [importedCount, setImportedCount] = useState<number | null>(null);
    const [importedErrors, setImportedErrors] = useState<number>(0);

    const parsed = useMemo(() => {
        if (!rows) return null;
        const catLabelToId = new Map<string, number[]>();
        for (const cat of cardapio.categorias) {
            const key = cat.label.trim().toLowerCase();
            const existing = catLabelToId.get(key) || [];
            existing.push(cat.id);
            catLabelToId.set(key, existing);
        }
        const resolve = (label: string) => catLabelToId.get(label.trim().toLowerCase()) || [];
        return productCsvToItems(rows, mapping, resolve);
    }, [rows, mapping, cardapio.categorias]);

    const preview = useMemo<{ cabecalho: string[]; data: string[][] } | null>(() => {
        if (!rows || rows.length === 0) return null;
        const cabecalho = rows[0];
        const data = rows.slice(1, 11);
        return { cabecalho, data };
    }, [rows]);

    function onFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setStatusMsg(null);
        setImportedCount(null);
        setImportedErrors(0);
        const reader = new FileReader();
        reader.onload = () => {
            const csv = parseCsv(String(reader.result ?? ''), separador || ';');
            setRows(csv);
            if (csv.length > 0) {
                // auto-mapear colunas por alias
                const header = csv[0].map((h) =>
                    h
                        .trim()
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                );
                const novo: ColumnMapping = {};
                for (const campo of Object.keys(ALIASES) as Array<keyof ColumnMapping>) {
                    for (const alias of ALIASES[campo]) {
                        const pos = header.indexOf(alias);
                        if (pos >= 0) {
                            novo[campo] = csv[0][pos].trim();
                            break;
                        }
                    }
                }
                setMapping({ ...DEFAULT_MAPPING, ...novo });
            }
        };
        reader.readAsText(file);
    }

    function aplicar() {
        if (!parsed) return;
        if (parsed.items.length === 0) {
            showMessage('Nenhum produto válido no arquivo.', 'error');
            return;
        }
        setCardapio((prev) => {
            let next = prev;
            let lastId = encontrarMenorIdDisponivel(prev.pratos);
            const novos: CardapioFoodType[] = parsed.items.map((item) => {
                const produto: CardapioFoodType = { ...item, id: lastId };
                lastId++;
                return produto;
            });
            next = recalcCategoriaCounts({
                ...next,
                pratos: [...next.pratos, ...novos],
            });
            return next;
        });
        const total = parsed.items.length;
        const errs = parsed.errors.length;
        setImportedCount(total);
        setImportedErrors(errs);
        setStatusMsg(`${total} produto(s) importado(s) com sucesso${errs ? ` (${errs} linha(s) com erro ignorada(s))` : ''}.`);
        showMessage(`Importação concluída: ${total} produto(s).${errs ? ` ${errs} erro(s).` : ''}`, errs ? 'success' : 'success');
    }

    function reset() {
        setFileName('');
        setRows(null);
        setStatusMsg(null);
        setImportedCount(null);
        setImportedErrors(0);
        setMapping({ ...DEFAULT_MAPPING });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    return (
        <div className="space-y-5">
            <div>
                <h3 className="text-lg font-semibold">Importar Produtos</h3>
                <p className="text-sm text-muted-foreground">
                    Cadastre produtos em massa a partir de um arquivo CSV. Baixe o <strong>modelo</strong> abaixo para
                    preencher corretamente e importar sem erros. Colunas comuns são detectadas automaticamente.
                </p>
            </div>

            {/* Modelo / exemplo de preenchimento */}
            <div className="rounded border bg-muted/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <p className="text-sm font-medium text-foreground">Modelo de preenchimento (CSV)</p>
                        <p className="text-xs text-muted-foreground">
                            Clique para baixar um arquivo pronto com cabeçalhos e 3 linhas de exemplo.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => baixarModeloCsv(separador)}>
                            Baixar modelo ({separador === ';' ? ';' : ','})
                        </Button>
                    </div>
                </div>

                <div className="mt-2 overflow-x-auto rounded border bg-background">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50 text-left">
                                {MODELO_HEADERS.map((h, i) => (
                                    <th key={i} className="whitespace-nowrap px-2 py-1 font-medium">
                                        {h}
                                        {(h === 'nome' || h === 'preco') && <span className="text-red-500">*</span>}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-t">
                                <td className="px-2 py-1">Coca-Cola Lata 350ml</td>
                                <td className="px-2 py-1">6,50</td>
                                <td className="px-2 py-1">Bebidas</td>
                                <td className="px-2 py-1">7894900011517</td>
                                <td className="px-2 py-1">COCA350</td>
                                <td className="px-2 py-1">22021000</td>
                                <td className="px-2 py-1"></td>
                                <td className="px-2 py-1">UN</td>
                                <td className="px-2 py-1">0</td>
                                <td className="px-2 py-1">102</td>
                                <td className="px-2 py-1"></td>
                                <td className="px-2 py-1">5102</td>
                                <td className="px-2 py-1">120</td>
                                <td className="px-2 py-1">10</td>
                                <td className="px-2 py-1">Ativo</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                    <span className="text-red-500">*</span> obrigatório: <strong>nome</strong> (título do produto) e{' '}
                    <strong>preco</strong> (ex.: 6,50 ou 6.50). O restante é opcional. Para múltiplos produtos, basta
                    adicionar uma linha por produto.
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                    <Label htmlFor="csv-sep">Separador</Label>
                    <Select
                        value={separador}
                        onValueChange={(v) => setSeparador(v as ';' | ',')}
                    >
                        <SelectTrigger className="mt-1 w-40" id="csv-sep">
                            <SelectValue placeholder="Separador" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value=";">  Ponto e vírgula (;)</SelectItem>
                            <SelectItem value=",">Vírgula (,)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1">
                    <Label htmlFor="csv-file">Arquivo CSV</Label>
                    <div className="mt-1 flex gap-2">
                        <Input
                            id="csv-file"
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            onChange={onFile}
                            className="flex-1"
                        />
                        {fileName && (
                            <Button type="button" variant="outline" onClick={reset}>
                                Limpar
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {fileName && <p className="text-xs text-muted-foreground">Arquivo: {fileName}</p>}

            {preview && preview.cabecalho.length > 0 && (
                <div className="overflow-x-auto rounded border">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-muted/50 text-left">
                                {preview.cabecalho.map((h, i) => (
                                    <th key={i} className="px-2 py-1 font-medium">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {preview.data.map((linha, ri) => (
                                <tr key={ri} className="border-t">
                                    {linha.map((cel, ci) => (
                                        <td key={ci} className="px-2 py-1">
                                            {cel}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                        Prévia das primeiras {preview.data.length} linha(s). Total de linhas: {(rows?.length ?? 1) - 1}.
                    </p>
                </div>
            )}

            {parsed && (
                <div className="rounded border bg-muted/20 p-3 text-sm">
                    <p>
                        <strong>{parsed.items.length}</strong> produto(s) válido(s)
                        {parsed.errors.length > 0 && (
                            <>
                                {' '}
                                e <strong className="text-red-600">{parsed.errors.length}</strong> linha(s) com erro
                            </>
                        )}
                    </p>
                    {parsed.errors.length > 0 && (
                        <ul className="mt-2 max-h-32 list-inside list-disc space-y-0.5 overflow-y-auto text-xs">
                            {parsed.errors.slice(0, 20).map((er, i) => (
                                <li key={i} className="text-red-600">
                                    Linha {er.row}: {er.message}
                                </li>
                            ))}
                            {parsed.errors.length > 20 && (
                                <li className="text-muted-foreground">...e mais {parsed.errors.length - 20} erro(s).</li>
                            )}
                        </ul>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={aplicar} disabled={!parsed || parsed.items.length === 0}>
                    Importar {parsed ? parsed.items.length : 0} produto(s)
                </Button>
                {statusMsg && <span className="text-sm text-green-600">{statusMsg}</span>}
                {importedCount != null && (importedErrors > 0) && (
                    <span className="text-sm text-red-600">{importedErrors} linha(s) ignorada(s).</span>
                )}
            </div>

            <div className="rounded border bg-muted/10 p-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Como importar corretamente</p>
                <ul className="list-inside list-disc space-y-1">
                    <li>
                        Use o <strong>modelo baixado</strong> acima — os cabeçalhos já vêm no padrão aceito pelo
                        sistema.
                    </li>
                    <li>
                        <strong>nome</strong> (obrigatório) e <strong>preco</strong> (obrigatório) são os únicos
                        campos exigidos. Preço aceita &quot;12,50&quot; ou &quot;12.50&quot;.
                    </li>
                    <li>
                        <strong>categoria</strong>: use o <em>rótulo</em> exibido em Configurações (ex.: &quot;Bebidas&quot;).
                        Se não existir ou ficar em branco, o produto é criado sem categoria (não quebra a importação).
                    </li>
                    <li>
                        <strong>unidade</strong>: aceita <strong>UN</strong>, <strong>KG</strong>, <strong>CX</strong> ou{' '}
                        <strong>LT</strong>.
                    </li>
                    <li>
                        <strong>status</strong>: &quot;Ativo&quot; ou &quot;Inativo&quot; (padrão: Ativo).
                    </li>
                    <li>
                        Linhas com erro são <strong>ignoradas</strong> e reportadas na prévia — o restante é importado
                        normalmente.
                    </li>
                    <li>
                        Ao confirmar, os produtos são gravados no <strong>banco de dados</strong> e já aparecem na aba{' '}
                        <strong>Cardápio</strong>, no <strong>PDV</strong> e no <strong>Cardápio Digital</strong>.
                    </li>
                </ul>
            </div>
        </div>
    );
}
