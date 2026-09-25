/* ============================== GERADOR DE PDF SEM DEPENDÊNCIAS ==============================
   Converte linhas de texto em PDF (fontes Courier/Courier-Bold, codificação WinAnsi → acentos
   do pt-BR). Dois formatos de papel:
     - '80mm': cupom térmico (largura ≈ 80mm). Páginas de ~300mm reproduzem o rolo contínuo.
     - 'a4': relatórios gerais (595×842pt), paginados automaticamente.
   Sem dependências externas. */

export type PdfAlign = 'left' | 'center' | 'right';

export interface PdfText {
    kind: 'text';
    text: string;
    align?: PdfAlign;
    bold?: boolean;
    size?: number;
    gap?: number;
}

export interface PdfRowLine {
    kind: 'row';
    left: string;
    right: string;
    size?: number;
    bold?: boolean;
}

export interface PdfRule {
    kind: 'rule';
    dashed?: boolean;
    gap?: number;
}

export interface PdfSpace {
    kind: 'space';
    h?: number;
}

export type PdfLine = PdfText | PdfRowLine | PdfRule | PdfSpace;

export type PdfPaper = '80mm' | 'a4';

export interface PdfRenderOptions {
    paper: PdfPaper;
}

const PT_MM = 2.83465;

const PAPERS: Record<PdfPaper, { width: number; pageHeight: number; marginX: number; marginTop: number; marginBottom: number }> = {
    '80mm': { width: 80 * PT_MM, pageHeight: 300 * PT_MM, marginX: 4, marginTop: 14, marginBottom: 10 },
    a4: { width: 595.28, pageHeight: 841.89, marginX: 44, marginTop: 56, marginBottom: 48 },
};

const DEFAULT_SIZE = 9;

function charWidthPt(sizePt: number): number {
    return sizePt * 0.6;
}

function escLiteral(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function lineHeightPt(l: PdfLine): number {
    if (l.kind === 'space') return l.h ?? 6;
    if (l.kind === 'rule') return (l.gap ?? 6) + 4;
    return ((l as PdfText).size ?? DEFAULT_SIZE) * 1.3 + ((l as PdfText).gap ?? 0);
}

function toWinAnsi(s: string): string {
    let out = '';
    for (let i = 0; i < s.length; i++) {
        let code = s.charCodeAt(i);
        if (code === 0x20ac) code = 0x80;
        else if (code >= 0x80 && code <= 0x9f) code = 0x3f;
        else if (code > 0xff) code = 0x3f;
        out += String.fromCharCode(code);
    }
    return out;
}

function fitText(text: string, size: number, maxWidth: number): string {
    const maxChars = Math.floor(maxWidth / charWidthPt(size));
    if (text.length <= maxChars) return text;
    if (maxChars <= 1) return '?';
    return text.slice(0, maxChars - 1) + '~';
}

/* Quebra texto longo em linhas de no máximo `maxChars` caracteres, preservando palavras.
   Palavras maiores que a linha são quebradas no limite. */
function wrapText(text: string, size: number, maxChars: number): string[] {
    if (maxChars < 2) return [fitText(text, size, maxChars * charWidthPt(size))];
    const words = text.split(/\s+/).filter(Boolean);
    if (!words.length) return [''];

    const lines: string[] = [];
    let current = '';
    const flush = () => {
        if (current) lines.push(current);
        current = '';
    };

    for (const word of words) {
        let piece = word;
        while (piece.length > maxChars) {
            flush();
            lines.push(piece.slice(0, maxChars));
            piece = piece.slice(maxChars);
        }
        if (!piece) continue;
        const candidate = current ? current + ' ' + piece : piece;
        if (candidate.length <= maxChars) {
            current = candidate;
        } else {
            flush();
            current = piece;
        }
    }
    flush();
    return lines.length ? lines : [' '];
}

function justify(left: string, right: string, size: number, maxWidth: number): string {
    const charW = charWidthPt(size);
    const l = fitText(left, size, maxWidth);
    const r = fitText(right, size, maxWidth);
    const spaces = Math.max(1, Math.floor(maxWidth / charW) - l.length - r.length);
    return l + ' '.repeat(spaces) + r;
}

interface PageBuilder {
    ops: string[];
    cursor: number; /* distância do topo até a linha de base / marcação atual */
}

/* [Ajudas de montagem] */
export function pdfText(text: string, opts: { align?: PdfAlign; bold?: boolean; size?: number; gap?: number } = {}): PdfText {
    return { kind: 'text', text, align: opts.align, bold: opts.bold, size: opts.size, gap: opts.gap };
}

export function pdfRow(left: string, right: string, opts: { size?: number; bold?: boolean } = {}): PdfRowLine {
    const size = opts.size ?? DEFAULT_SIZE;
    return { kind: 'row', left, right, size, bold: opts.bold };
}

export function pdfRule(dashed = false, gap = 6): PdfRule {
    return { kind: 'rule', dashed, gap };
}

export function pdfSpace(h = 6): PdfSpace {
    return { kind: 'space', h };
}

function renderLines(lines: PdfLine[], cfg: typeof PAPERS['80mm']): string[][] {
    const usableWidth = cfg.width - cfg.marginX * 2;
    const pages: string[][] = [];
    let page: PageBuilder = { ops: [], cursor: cfg.marginTop };

    const startNewPage = () => {
        pages.push(page.ops);
        page = { ops: [], cursor: cfg.marginTop };
    };

    const ensureRoom = (needed: number) => {
        if (page.cursor + needed > cfg.pageHeight - cfg.marginBottom) startNewPage();
    };

    /* Emite uma linha de texto posicionada; `gap` é o avanço vertical depois dela. */
    const emitLine = (text: string, size: number, align: PdfAlign, bold: boolean, gap: number) => {
        const t = toWinAnsi(fitText(text, size, usableWidth));
        const tw = t.length * charWidthPt(size);
        let x = cfg.marginX;
        if (align === 'center') x = (cfg.width - tw) / 2;
        else if (align === 'right') x = cfg.width - cfg.marginX - tw;

        ensureRoom(size * 1.3 + gap);
        page.ops.push(
            `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(cfg.pageHeight - page.cursor).toFixed(2)} Tm (${escLiteral(t)}) Tj ET`
        );
        page.cursor += size * 1.3 + gap;
    };

    for (const line of lines) {
        if (line.kind === 'space') {
            ensureRoom(line.h ?? 6);
            page.cursor += line.h ?? 6;
            continue;
        }

        if (line.kind === 'rule') {
            const gap = line.gap ?? 6;
            ensureRoom(gap + 4);
            page.cursor += 2 + gap;
            const y = cfg.pageHeight - page.cursor;
            page.ops.push(
                line.dashed
                    ? `[3 2] 0 d ${cfg.marginX} ${y} m ${cfg.width - cfg.marginX} ${y} l S [] 0 d`
                    : `${cfg.marginX} ${y} m ${cfg.width - cfg.marginX} ${y} l S`
            );
            page.cursor += 2;
            continue;
        }

        const size = (line as PdfText).size ?? DEFAULT_SIZE;
        const gap = (line as PdfText).gap ?? 0;
        const maxChars = Math.floor(usableWidth / charWidthPt(size));

        if (line.kind === 'row') {
            const rightMax = Math.min(line.right.length, maxChars - 2);
            const leftMax = maxChars - rightMax - 1;
            if (line.left.length > leftMax) {
                const wrapped = wrapText(line.left, size, leftMax);
                wrapped.forEach((chunk, idx) => {
                    const last = idx === wrapped.length - 1;
                    if (idx === 0) {
                        const right = line.right.slice(0, rightMax);
                        const pad = Math.max(1, maxChars - chunk.length - right.length);
                        emitLine(chunk + ' '.repeat(pad) + right, size, 'left', line.bold ?? false, last ? gap : 0);
                    } else {
                        emitLine(chunk, size, 'left', line.bold ?? false, last ? gap : 0);
                    }
                });
            } else {
                const text = justify(line.left, line.right, size, usableWidth);
                emitLine(text, size, 'left', line.bold ?? false, gap);
            }
            continue;
        }

        const wrapped = wrapText(line.text, size, maxChars);
        wrapped.forEach((chunk, idx) => {
            emitLine(chunk, size, line.align ?? 'left', line.bold ?? false, idx === wrapped.length - 1 ? gap : 0);
        });
    }

    pages.push(page.ops);
    return pages;
}

function buildPdf(lines: PdfLine[], paper: PdfPaper): string {
    const cfg = PAPERS[paper];
    const pages = renderLines(lines, cfg);

    const obj: Record<number, string> = {};
    let next = 1;
    const totalObjects = 4 /* catalog, pages, font, bold */ + pages.length * 2 /* content + page */;

    obj[next++] = '<< /Type /Catalog /Pages 2 0 R >>';
    const pagesRef = next++; /* 2 */
    obj[pagesRef] = '<< /Type /Pages /Kids [] /Count 0 >>';
    const fontRef = next++;
    obj[fontRef] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>';
    const fontBoldRef = next++;
    obj[fontBoldRef] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>';

    const pageRefs: number[] = [];
    for (const ops of pages) {
        const content = ops.join('\n');
        const contentRef = next++;
        obj[contentRef] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
        const pageRef = next++;
        obj[pageRef] = `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 ${cfg.width} ${cfg.pageHeight}] /Resources << /Font << /F1 ${fontRef} 0 R /F2 ${fontBoldRef} 0 R >> >> /Contents ${contentRef} 0 R >>`;
        pageRefs.push(pageRef);
    }

    obj[pagesRef] = `<< /Type /Pages /Kids [${pageRefs.map((r) => `${r} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets: number[] = new Array(totalObjects + 1).fill(0);
    for (let n = 1; n <= totalObjects; n++) {
        offsets[n] = pdf.length;
        pdf += `${n} 0 obj\n${obj[n]}\nendobj\n`;
    }

    const xrefStart = pdf.length;
    let xref = `xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`;
    for (let n = 1; n <= totalObjects; n++) {
        xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += xref;
    pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    return pdf;
}

/* ============================== API PÚBLICA ============================== */

export function renderPdfBlob(lines: PdfLine[], opts: PdfRenderOptions): Blob {
    const pdf = buildPdf(lines, opts.paper);
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
}

export function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
    if (navigator.maxTouchPoints > 1 && window.innerWidth < 900) return true;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) return true;
    return false;
}

/* Abre o PDF em nova aba (no mobile o visualizador permite salvar/compartilhar/imprimir).
   Se o popup for bloqueado, cai para download do arquivo. */
export function openPdf(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}