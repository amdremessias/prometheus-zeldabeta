'use client';

import { formatCurrency, formatDateTimeBR } from '@/shared/lib/numberUtils';
import { esc } from '@/shared/lib/printReceipt';
import { pdfRow, pdfRule, pdfSpace, pdfText, type PdfLine } from '@/shared/lib/pdfPrinter';

const methodLabel: Record<VendaPagamentoType['metodo'], string> = {
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    pix: 'Pix',
    fiado: 'Fiado',
};

export interface CaixaReportSummary {
    vendas: VendaType[];
    porMetodo: [VendaPagamentoType['metodo'], number][];
    porOrigem: [string, number][];
    porCliente: [string, number][];
    porItem: { title: string; quantity: number; total: number }[];
    totalReceita: number;
    totalFiado: number;
    transacoesCount: number;
}

/* Deriva os resumos do relatório de caixa (compartilhado entre a visualização e a impressão). */
export function computeCaixaReport(detail: CaixaReportType): CaixaReportSummary {
    const vendas = detail.vendas || [];

    const porMetodo = new Map<VendaPagamentoType['metodo'], number>();
    vendas.forEach((v) => {
        if (v.pagamentos?.length) {
            v.pagamentos.forEach((p) => porMetodo.set(p.metodo, (porMetodo.get(p.metodo) || 0) + (Number(p.valor) || 0)));
        } else {
            porMetodo.set(v.metodo, (porMetodo.get(v.metodo) || 0) + v.total);
        }
    });

    const porOrigem = new Map<string, number>();
    vendas.forEach((v) => porOrigem.set(v.origem, (porOrigem.get(v.origem) || 0) + v.total));

    const porCliente = new Map<string, number>();
    vendas.forEach((v) => {
        if (v.cliente) porCliente.set(v.cliente, (porCliente.get(v.cliente) || 0) + v.total);
    });

    const porItem = new Map<number, { title: string; quantity: number; total: number }>();
    vendas.forEach((venda) =>
        venda.items.forEach((item) => {
            const atual = porItem.get(item.foodId) || { title: item.title, quantity: 0, total: 0 };
            atual.quantity += item.quantity;
            atual.total += item.price * item.quantity;
            porItem.set(item.foodId, atual);
        })
    );

    const totalReceita = vendas.reduce((a, v) => a + v.total, 0);
    const totalFiado = Array.from(porMetodo.entries()).find(([m]) => m === 'fiado')?.[1] || 0;

    return {
        vendas,
        porMetodo: Array.from(porMetodo.entries()),
        porOrigem: Array.from(porOrigem.entries()),
        porCliente: Array.from(porCliente.entries()),
        porItem: Array.from(porItem.values()),
        totalReceita,
        totalFiado,
        transacoesCount: (detail.transacoes || []).length,
    };
}

function row(label: string, value: string, bold = false): string {
    const b = bold ? 'font-weight:bold;' : '';
    return `<div class="row" style="${b}"><span>${label}</span><span>${value}</span></div>`;
}

function title(text: string): string {
    return `<div style="text-align:center;font-weight:bold;margin:2px 0;">${esc(text)}</div>`;
}

/* Corpo do relatório de caixa em HTML (formato 72mm, monoespaçado). */
export function buildCaixaReportHTML(detail: CaixaReportType, currency: string): string {
    const s = computeCaixaReport(detail);
    const c = (n: number) => formatCurrency(n, currency);
    const parts: string[] = [];

    parts.push(`<div class="sep"></div>`);
    parts.push(row('Vendas', String(s.vendas.length)));
    parts.push(row('Receita', c(s.totalReceita)));
    parts.push(row('Fiado', c(s.totalFiado)));
    parts.push(row('Transações', String(s.transacoesCount)));

    if (s.porMetodo.length > 0) {
        parts.push(`<div class="sep"></div>`);
        parts.push(title('Por método de pagamento'));
        s.porMetodo.forEach(([metodo, total]) => parts.push(row(methodLabel[metodo], c(total))));
    }

    if (s.porOrigem.length > 0) {
        parts.push(`<div class="sep"></div>`);
        parts.push(title('Por mesa / origem'));
        s.porOrigem.forEach(([origem, total]) => parts.push(row(esc(origem), c(total))));
    }

    if (s.porCliente.length > 0) {
        parts.push(`<div class="sep"></div>`);
        parts.push(title('Por cliente'));
        s.porCliente.forEach(([cliente, total]) => parts.push(row(esc(cliente), c(total))));
    }

    if (s.porItem.length > 0) {
        parts.push(`<div class="sep"></div>`);
        parts.push(title('Itens vendidos'));
        s.porItem.forEach((item) =>
            parts.push(row(`${esc(item.title)} (${item.quantity}x)`, c(item.total)))
        );
    }

    parts.push(`<div class="sep"></div>`);
    parts.push(title('Vendas individuais'));
    if (s.vendas.length === 0) {
        parts.push(row('Nenhuma venda registrada.', ''));
    }
    s.vendas.forEach((venda) => {
        const pagamento = venda.pagamentos?.length
            ? venda.pagamentos
                  .map((p) => `${methodLabel[p.metodo]} ${c(Number(p.valor) || 0)}`)
                  .join(' + ')
            : methodLabel[venda.metodo];

        parts.push(row(`${esc(venda.origem)} · ${pagamento}`, c(venda.total), true));
        parts.push(
            `<div style="font-size:10px;">${esc(formatDateTimeBR(venda.date))}` +
                `${venda.cliente ? ` · ${esc(venda.cliente)}` : ''}` +
                `${venda.taxa > 0 ? ` · taxa ${c(venda.taxa)}` : ''}</div>`
        );
        if (venda.items.length > 0) {
            parts.push(
                `<div style="font-size:10px;">${esc(venda.items.map((i) => `${i.quantity}x ${i.title}`).join(', '))}</div>`
            );
        }
        parts.push(`<div class="sep"></div>`);
    });

    return parts.join('');
}

/* Versão do relatório como linhas do PDF (A4/80mm). Substitui o corpo padrão do printReceipt. */
export function buildCaixaReportLines(detail: CaixaReportType, currency: string): PdfLine[] {
    const s = computeCaixaReport(detail);
    const c = (n: number) => formatCurrency(n, currency);
    const title = (text: string) => pdfText(text, { align: 'center', bold: true, size: 8.5 });
    const lines: PdfLine[] = [];

    lines.push(pdfRule());
    lines.push(pdfRow('Vendas', String(s.vendas.length)));
    lines.push(pdfRow('Receita', c(s.totalReceita)));
    lines.push(pdfRow('Fiado', c(s.totalFiado)));
    lines.push(pdfRow('Transações', String(s.transacoesCount)));

    if (s.porMetodo.length > 0) {
        lines.push(pdfRule());
        lines.push(title('Por método de pagamento'));
        s.porMetodo.forEach(([metodo, total]) => lines.push(pdfRow(methodLabel[metodo], c(total))));
    }

    if (s.porOrigem.length > 0) {
        lines.push(pdfRule());
        lines.push(title('Por mesa / origem'));
        s.porOrigem.forEach(([origem, total]) => lines.push(pdfRow(origem, c(total))));
    }

    if (s.porCliente.length > 0) {
        lines.push(pdfRule());
        lines.push(title('Por cliente'));
        s.porCliente.forEach(([cliente, total]) => lines.push(pdfRow(cliente, c(total))));
    }

    if (s.porItem.length > 0) {
        lines.push(pdfRule());
        lines.push(title('Itens vendidos'));
        s.porItem.forEach((item) => lines.push(pdfRow(`${item.title} (${item.quantity}x)`, c(item.total))));
    }

    lines.push(pdfRule());
    lines.push(title('Vendas individuais'));
    if (s.vendas.length === 0) {
        lines.push(pdfRow('Nenhuma venda registrada.', ''));
    }
    s.vendas.forEach((venda) => {
        const pagamento = venda.pagamentos?.length
            ? venda.pagamentos.map((p) => `${methodLabel[p.metodo]} ${c(Number(p.valor) || 0)}`).join(' + ')
            : methodLabel[venda.metodo];

        lines.push(pdfRow(`${venda.origem} · ${pagamento}`, c(venda.total), { bold: true }));
        const info = `${formatDateTimeBR(venda.date)}${venda.cliente ? ` · ${venda.cliente}` : ''}${
            venda.taxa > 0 ? ` · taxa ${c(venda.taxa)}` : ''
        }`;
        lines.push(pdfText(info, { size: 7.5, gap: 1 }));
        if (venda.items.length > 0) {
            lines.push(pdfText(venda.items.map((i) => `${i.quantity}x ${i.title}`).join(', '), { size: 7.5, gap: 1 }));
        }
        lines.push(pdfSpace(3));
    });

    return lines;
}
