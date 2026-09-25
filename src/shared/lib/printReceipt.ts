import { pdfText, pdfRow, pdfRule, pdfSpace, renderPdfBlob, openPdf, isMobileDevice, type PdfLine, type PdfPaper } from '@/shared/lib/pdfPrinter';

export interface ReceiptItem {
    title: string;
    quantity: number;
    price: number;
    note?: string;
    addons?: { descricao: string; valor: number }[];
    fracoes?: { montante: number; sabor?: { nome: string } }[];
}

export interface ReceiptMeta {
    label: string;
    value: string;
}

export interface ReceiptData {
    heading: string;
    restaurantName: string;
    restaurantMeta?: { label: string; value: string }[];
    meta?: ReceiptMeta[];
    items?: ReceiptItem[];
    subtotal?: number;
    taxLabel?: string;
    tax?: number;
    total?: number;
    payment?: { label: string; paid: number; change: number };
    note?: string;
    footer?: string;
    /* Formato do papel do PDF gerado. Padrão: '80mm' (cupom térmico). */
    paper?: PdfPaper;
    /* Corpo em linhas do PDF. Quando informado, substitui o corpo padrão no PDF
       (mantém cabeçalho, restaurantMeta, data e footer). */
    bodyLines?: PdfLine[];
    /* Corpo HTML customizado — usado apenas na impressão direta do browser (desktop). */
    bodyHTML?: string;
}

function row(label: string, value: string, bold = false): string {
    const b = bold ? 'font-weight:bold;' : '';
    return `<div style="display:flex;justify-content:space-between;${b}"><span>${label}</span><span>${value}</span></div>`;
}

function fmt(n: number): string {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function esc(s: string | number): string {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export { esc };

function buildHTML(data: ReceiptData): string {
    const now = new Date();
    const dateLabel = now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const metaRows = (data.restaurantMeta ?? [])
        .map((m) => row(m.label, esc(m.value)))
        .join('');

    const tableItems = (data.items ?? [])
        .map(
            (i) =>
                `<div style="display:flex;justify-content:space-between;">` +
                `<span>${esc(i.quantity)}x ${esc(i.title)}</span>` +
                `<span>${fmt(i.price * i.quantity)}</span></div>` +
                (i.note ? `<div style="font-size:10px;padding-left:2px;">Obs: ${esc(i.note)}</div>` : '') +
                (i.fracoes && i.fracoes.length
                    ? `<div style="font-size:10px;padding-left:2px;color:#1e40af;">` +
                      i.fracoes.map((f, i2) =>
                          `<span style="margin-right:4px;">${esc(f.montante)}/${esc(f.sabor?.nome || 'Porção')}</span>`
                      ).join(' ') +
                      `</div>`
                    : '') +
                (i.addons && i.addons.length
                    ? i.addons
                          .map(
                              (a) =>
                                  `<div style="font-size:10px;padding-left:2px;">+ ${esc(a.descricao)} (${fmt(a.valor)})</div>`
                          )
                          .join('')
                    : '')
        )
        .join('');

    const detailRows = (data.meta ?? []).map((m) => row(m.label, esc(m.value))).join('');

    const body = data.bodyHTML
        ? `${data.restaurantMeta?.length ? `<div class="sep"></div>${metaRows}` : ''}
            <div class="sep"></div>
            ${row('Data', dateLabel)}
            ${detailRows}
            ${data.bodyHTML}`
        : `${data.restaurantMeta?.length ? `<div class="sep"></div>${metaRows}` : ''}
            <div class="sep"></div>
            ${row('Data', dateLabel)}
            ${detailRows}
            ${data.items?.length ? `<div class="sep"></div>${tableItems}` : ''}
            ${data.subtotal != null ? `<div class="sep"></div>${row('Subtotal', fmt(data.subtotal))}` : ''}
            ${data.tax != null ? row(data.taxLabel ?? 'Taxa de serviço', fmt(data.tax)) : ''}
            ${data.total != null ? `<div class="sep"></div>${row('Total', fmt(data.total), true)}` : ''}
            ${
                data.payment
                    ? `<div class="sep"></div>
                       ${row(data.payment.label, fmt(data.payment.paid))}
                       ${row('Troco', fmt(data.payment.change))}`
                    : ''
            }
            ${data.note ? `<div class="sep"></div><div class="center">${esc(data.note)}</div>` : ''}`;

    const js = String.raw`
        <html>
            <head>
                <meta charset="utf-8" />
                <title>Impressão</title>
                <style>
                    @page { margin: 8mm; }
                    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; color: #000; }
                    h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
                    .center { text-align: center; }
                    .sep { border-top: 1px solid #000; margin: 6px 0; }
                    .row { display: flex; justify-content: space-between; }
                    .footer { text-align: center; margin-top: 8px; }
                </style>
            </head>
            <body>
                <h1>${esc(data.restaurantName)}</h1>
                <div class="center">${esc(data.heading)}</div>
                ${body}
                ${data.footer ? `<div class="sep"></div><div class="footer">${esc(data.footer)}</div>` : ''}
            </body>
        </html>`;

    return js.replaceAll('\\n', '');
}

function fracaoLabel(f: { montante: number; sabor?: { nome: string } }): string {
    const alt = f as unknown as { fracao?: string; nome?: string };
    if (alt.fracao) return alt.nome ? `${alt.fracao} ${alt.nome}` : alt.fracao;
    return `${f.montante} ${f.sabor?.nome || 'Porção'}`;
}

/* Converte o ReceiptData em linhas do PDF (cupom 80mm / A4). */
function buildReceiptLines(data: ReceiptData): PdfLine[] {
    const now = new Date();
    const dateLabel = now.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const lines: PdfLine[] = [];
    lines.push(pdfText(data.restaurantName || 'Restaurante', { align: 'center', bold: true, size: 10.5 }));
    lines.push(pdfText(data.heading, { align: 'center', size: 7.5 }));

    if (data.restaurantMeta?.length) {
        lines.push(pdfRule());
        data.restaurantMeta.forEach((m) => lines.push(pdfRow(m.label, m.value, { size: 7.5 })));
    }

    lines.push(pdfRule());
    lines.push(pdfRow('Data', dateLabel));
    if (data.meta?.length) {
        data.meta.forEach((m) => lines.push(pdfRow(m.label, m.value)));
    }

    const body = data.bodyLines ?? defaultBody(data);
    lines.push(...body);

    if (data.footer) {
        lines.push(pdfRule());
        lines.push(pdfText(data.footer, { align: 'center', size: 7.5 }));
    }

    lines.push(pdfSpace(4));
    return lines;
}

function defaultBody(data: ReceiptData): PdfLine[] {
    const lines: PdfLine[] = [];

    if (data.items?.length) {
        lines.push(pdfRule());
        for (const i of data.items) {
            lines.push(pdfRow(`${i.quantity}x ${i.title}`, fmt(i.price * i.quantity)));
            if (i.note) lines.push(pdfText(`Obs: ${i.note}`, { size: 7.5, gap: 1 }));
            if (i.fracoes?.length) {
                lines.push(
                    pdfText(i.fracoes.map(fracaoLabel).join(' '), { size: 7.5, gap: 1 })
                );
            }
            if (i.addons?.length) {
                i.addons.forEach((a) => lines.push(pdfText(`+ ${a.descricao} (${fmt(a.valor)})`, { size: 7.5, gap: 1 })));
            }
        }
    }

    if (data.subtotal != null) {
        lines.push(pdfRule());
        lines.push(pdfRow('Subtotal', fmt(data.subtotal)));
    }
    if (data.tax != null) {
        lines.push(pdfRow(data.taxLabel ?? 'Taxa de serviço', fmt(data.tax)));
    }
    if (data.total != null) {
        lines.push(pdfRule());
        lines.push(pdfRow('Total', fmt(data.total), { bold: true }));
    }
    if (data.payment) {
        lines.push(pdfRule());
        lines.push(pdfRow(data.payment.label, fmt(data.payment.paid)));
        lines.push(pdfRow('Troco', fmt(data.payment.change)));
    }
    if (data.note) {
        lines.push(pdfRule());
        lines.push(pdfText(data.note, { align: 'center', size: 7.5 }));
    }

    return lines;
}

function receiptFilename(data: ReceiptData): string {
    const base = (data.heading || 'cupom')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'cupom';
    const dt = new Date();
    const stamp = `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}-${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}`;
    return `${base}-${stamp}.pdf`;
}

/* Impressão via iframe oculto (dinâmica para o browser do desktop imprimir direto). */
function printHtml(data: ReceiptData): void {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
        document.body.removeChild(iframe);
        return;
    }

    doc.open();
    doc.write(buildHTML(data));
    doc.close();

    let printed = false;
    const doPrint = () => {
        if (printed) return;
        printed = true;
        try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        } catch (error) {
            console.error('Erro ao imprimir:', error);
        }
        setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1000);
    };

    iframe.onload = doPrint;
    setTimeout(doPrint, 400);
}

/* Gera o cupom/relatório em PDF e:
   - Mobile: abre o PDF (visualizador → salvar/compartilhar/imprimir em qualquer impressora).
   - Desktop: além do PDF em nova aba, dispara a impressão direta do browser. */
export function printReceipt(data: ReceiptData): void {
    const paper = data.paper ?? '80mm';
    const blob = renderPdfBlob(buildReceiptLines(data), { paper });
    openPdf(blob, receiptFilename(data));

    if (!isMobileDevice()) {
        setTimeout(() => printHtml(data), 500);
    }
}