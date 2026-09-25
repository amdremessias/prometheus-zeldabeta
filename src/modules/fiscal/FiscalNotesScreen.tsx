'use client';
import { useCallback, useEffect, useState } from 'react';
import { FileDown, Ban, RefreshCw, Archive, ReceiptText, Loader2 } from 'lucide-react';
import {
    Button,
    Card,
    CardContent,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/shared/ui';
import { formatDateTimeBR } from '@/shared/lib/numberUtils';
import { showMessage } from '@/store/popupStore';

type FiscalNote = {
    id: number;
    pedidoId: number | null;
    vendaId: string;
    modelo: string;
    serie: number;
    numero: number;
    chaveAcesso: string | null;
    status: string;
    ambiente: number;
    protocolo: string | null;
    motivoRejeicao: string | null;
    createdAt: string;
    updatedAt: string;
};

const STATUS_LABEL: Record<string, string> = {
    pendente: 'Pendente',
    autorizada: 'Autorizada',
    rejeitada: 'Rejeitada',
    cancelada: 'Cancelada',
    contingencia: 'Contingência',
};

const STATUS_COLOR: Record<string, string> = {
    pendente: 'bg-amber-100 text-amber-700',
    autorizada: 'bg-green-100 text-green-700',
    rejeitada: 'bg-red-100 text-red-700',
    cancelada: 'bg-gray-100 text-gray-600',
    contingencia: 'bg-blue-100 text-blue-700',
};

export function FiscalNotesScreen() {
    const [notes, setNotes] = useState<FiscalNote[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<string>('todas');
    const [modelo, setModelo] = useState<string>('todos');
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [cancelTarget, setCancelTarget] = useState<FiscalNote | null>(null);
    const [cancelMotivo, setCancelMotivo] = useState('');
    const [exporting, setExporting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const sp = new URLSearchParams();
        if (status !== 'todas') sp.set('status', status);
        if (modelo !== 'todos') sp.set('modelo', modelo);
        if (dataInicio) sp.set('dataInicio', dataInicio + 'T00:00:00');
        if (dataFim) sp.set('dataFim', dataFim + 'T23:59:59');
        sp.set('limit', '200');
        try {
            const res = await fetch(`/api/fiscal/notes?${sp.toString()}`);
            if (!res.ok) throw new Error('Falha ao carregar notas');
            const data = await res.json();
            setNotes(data.notes ?? []);
            setTotal(data.total ?? 0);
        } catch {
            showMessage('Não foi possível carregar as notas fiscais.', 'error');
        } finally {
            setLoading(false);
        }
    }, [status, modelo, dataInicio, dataFim]);

    useEffect(() => {
        void load();
    }, [load]);

    const doCancelar = async () => {
        if (!cancelTarget) return;
        try {
            const res = await fetch(`/api/fiscal/notes/${cancelTarget.id}/cancelar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ motivo: cancelMotivo }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                showMessage(data?.error || 'Não foi possível cancelar a nota.', 'error');
                return;
            }
            showMessage('Nota cancelada.', 'success');
            setCancelTarget(null);
            setCancelMotivo('');
            void load();
        } catch {
            showMessage('Erro ao cancelar a nota.', 'error');
        }
    };

    const baixarXml = (note: FiscalNote) => {
        window.open(`/api/fiscal/notes/${note.id}/xml`, '_blank');
    };

    const exportarMes = async () => {
        setExporting(true);
        try {
            const agora = new Date();
            const res = await fetch(
                `/api/fiscal/exportar-mes?ano=${agora.getFullYear()}&mes=${agora.getMonth() + 1}`
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                showMessage(data?.error || 'Nenhum XML disponível para o mês atual.', 'error');
                return;
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `notas-${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            showMessage('Erro ao exportar as notas do mês.', 'error');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardContent className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-semibold">Notas Fiscais</h2>
                            <p className="text-sm text-gray-500">
                                Registros de NFC-e/NF-e criados nesta fase (emissão simulada, sem transmissão real à SEFAZ).
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => void load()} disabled={loading}>
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                Atualizar
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1" onClick={() => void exportarMes()} disabled={exporting}>
                                <Archive className="h-4 w-4" />
                                {exporting ? 'Exportando...' : 'Exportar mês (.zip)'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todos</SelectItem>
                                    {Object.entries(STATUS_LABEL).map(([v, l]) => (
                                        <SelectItem key={v} value={v}>{l}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Modelo</Label>
                            <Select value={modelo} onValueChange={setModelo}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">NFC-e e NF-e</SelectItem>
                                    <SelectItem value="65">NFC-e (65)</SelectItem>
                                    <SelectItem value="55">NF-e (55)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Início</Label>
                            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Fim</Label>
                            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                        <ReceiptText className="h-5 w-5" />
                        Registros ({total})
                    </h3>
                    {loading ? (
                        <div className="flex items-center justify-center py-10 text-gray-400">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
                        </div>
                    ) : notes.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                            Nenhuma nota encontrada com os filtros atuais.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="text-left p-3">Emissão</th>
                                        <th className="text-left p-3">Modelo</th>
                                        <th className="text-left p-3">Série/Nº</th>
                                        <th className="text-left p-3">Chave de acesso</th>
                                        <th className="text-center p-3">Status</th>
                                        <th className="text-right p-3">Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {notes.map((n) => (
                                        <tr key={n.id} className="border-t">
                                            <td className="p-3 whitespace-nowrap">{formatDateTimeBR(n.createdAt)}</td>
                                            <td className="p-3">{n.modelo === '55' ? 'NF-e' : 'NFC-e'}</td>
                                            <td className="p-3">
                                                {n.serie}/{String(n.numero).padStart(9, '0')}
                                            </td>
                                            <td className="p-3">
                                                <span className="text-xs font-mono text-gray-600">{n.chaveAcesso ?? '—'}</span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[n.status] ?? 'bg-gray-100 text-gray-600'}`}>
                                                    {STATUS_LABEL[n.status] ?? n.status}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => baixarXml(n)}>
                                                        <FileDown className="h-3.5 w-3.5" /> XML
                                                    </Button>
                                                    {(n.status === 'pendente' || n.status === 'autorizada') && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1 h-8 text-red-600 border-red-200 hover:bg-red-50"
                                                            onClick={() => setCancelTarget(n)}
                                                        >
                                                            <Ban className="h-3.5 w-3.5" /> Cancelar
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancelar nota fiscal</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja cancelar a nota{' '}
                            <strong>
                                {cancelTarget?.modelo === '55' ? 'NF-e' : 'NFC-e'} {cancelTarget?.serie}/
                                {cancelTarget?.numero}
                            </strong>
                            ? A operação não pode ser desfeita.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 pt-2">
                        <Label>Motivo do cancelamento</Label>
                        <Input
                            value={cancelMotivo}
                            onChange={(e) => setCancelMotivo(e.target.value)}
                            placeholder="Ex.: desistência do cliente, erro de digitação"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button variant="outline" className="flex-1 h-12 font-bold" onClick={() => setCancelTarget(null)}>
                            Voltar
                        </Button>
                        <Button
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white h-12 font-bold"
                            onClick={() => void doCancelar()}
                        >
                            <Ban className="h-4 w-4 mr-2" />
                            Cancelar nota
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
