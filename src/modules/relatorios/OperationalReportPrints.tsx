'use client';
import { useState } from 'react';
import { Button, Input } from '@/shared/ui';
import {
    pdfRow,
    pdfRule,
    pdfSpace,
    pdfText,
    renderPdfBlob,
    openPdf,
    type PdfLine,
} from '@/shared/lib/pdfPrinter';

function s(v: unknown): string {
    return String(v ?? '');
}

function stamp(): string {
    const dt = new Date();
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}`;
}

function emitPdf(title: string, rows: PdfLine[], filename: string): void {
    const lines: PdfLine[] = [
        pdfText('Zelda PDV', { align: 'center', bold: true, size: 13 }),
        pdfText(title, { align: 'center', size: 10 }),
        pdfRule(),
        ...rows,
        pdfSpace(4),
    ];
    const blob = renderPdfBlob(lines, { paper: 'a4' });
    openPdf(blob, filename);
}

function cells(parts: unknown[]): string {
    return parts.map(s).join(' | ');
}

export function OperationalReportPrints() {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [busy, setBusy] = useState(false);
    const period = `${from || 'início'} até ${to || 'hoje'}`;

    const printWpp = async () => {
        setBusy(true);
        try {
            const r = await fetch('/api/pedidos-web?status=pendente', { cache: 'no-store' });
            const rows = (await r.json()) as Array<Record<string, unknown>>;
            const body: PdfLine[] = [
                pdfText('Pedidos pendentes para conferência.', { size: 8.5 }),
                pdfRule(),
                pdfRow('Nº', 'Total', { bold: true }),
                pdfRule(true, 2),
                ...rows.map((x) =>
                    pdfRow(
                        `#${s(x.id)} | ${s(x.cliente)} | ${s(x.telefone)} | ${s(x.pagamento)}`,
                        `R$ ${s(x.total)}`,
                        { size: 8.5 }
                    )
                ),
            ];
            emitPdf(`Pedidos WPP (${period})`, body, `pedidos-wpp-${stamp()}.pdf`);
        } finally {
            setBusy(false);
        }
    };

    const printWallet = async () => {
        setBusy(true);
        try {
            const q = new URLSearchParams();
            if (from) q.set('from', from);
            if (to) q.set('to', to);
            const r = await fetch(`/api/relatorios/carteira?${q}`, { cache: 'no-store' });
            const rows = (await r.json()) as Array<Record<string, unknown>>;
            const body: PdfLine[] = [
                pdfRow('Cliente | Telefone | Tipo | Pedido | Recebido', 'Valor', { bold: true }),
                pdfRule(true, 2),
                ...rows.map((x) =>
                    pdfRow(
                        `${s(x.cliente)} | ${s(x.telefone)} | ${s(x.tipo)} | ${s(x.pedido_id)} | ${x.recebido ? 'Sim' : 'Não'}`,
                        `R$ ${s(x.valor)}`,
                        { size: 8.5 }
                    )
                ),
            ];
            emitPdf(`Carteira/Fiado (${period})`, body, `carteira-${stamp()}.pdf`);
        } finally {
            setBusy(false);
        }
    };

    const printSales = async () => {
        setBusy(true);
        try {
            const r = await fetch('/api/state', { cache: 'no-store' });
            const data = await r.json();
            const rows: Array<Record<string, unknown>> = data?.data?.vendas || data?.vendas || [];
            const body: PdfLine[] = [
                pdfRow('Data | Cliente | Método', 'Total', { bold: true }),
                pdfRule(true, 2),
                ...rows.map((x) =>
                    pdfRow(
                        `${s(x.data || x.createdAt || '')} | ${s(x.cliente || '')} | ${s(x.metodo || x.pagamento || '')}`,
                        `R$ ${s(x.total || 0)}`,
                        { size: 8.5 }
                    )
                ),
            ];
            emitPdf(`Movimentações de venda (${period})`, body, `vendas-${stamp()}.pdf`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="mb-6 rounded-lg border bg-white p-4">
            <h2 className="mb-3 font-bold">Impressões operacionais</h2>
            <div className="mb-3 flex flex-wrap gap-2">
                <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                />
                <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                />
            </div>
            <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={printWpp}>
                    Imprimir pedidos WPP
                </Button>
                <Button disabled={busy} variant="outline" onClick={printWallet}>
                    Imprimir Carteira/Fiado
                </Button>
                <Button disabled={busy} variant="outline" onClick={printSales}>
                    Imprimir movimentações de venda
                </Button>
            </div>
        </section>
    );
}