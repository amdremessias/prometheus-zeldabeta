import { useEffect, useRef, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui';
import { Download, RefreshCw, RotateCcw, Save, Upload } from 'lucide-react';
import { showMessage } from '@/store/popupStore';
import { useDataStore } from '@/store/userStore';
import { SYSTEM_VERSION } from '@/shared/lib/version';

export interface BackupRow {
    name: string;
    size: number;
    mtime: string;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR');
}

export function BackupSettings() {
    const [backups, setBackups] = useState<BackupRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [restoreTarget, setRestoreTarget] = useState<BackupRow | null>(null);
    const [restoring, setRestoring] = useState(false);
    const [importing, setImporting] = useState(false);
    const importRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/backup');
            if (!res.ok) throw new Error('Falha ao listar backups');
            const data = await res.json();
            setBackups(data.backups || []);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao listar backups.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load();
    }, []);

    const create = async () => {
        setCreating(true);
        try {
            const res = await fetch('/api/backup', { method: 'POST' });
            if (!res.ok) throw new Error('Falha ao gerar backup');
            const data = await res.json();
            showMessage('Backup gerado: ' + (data.name || ''));
            await load();
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao gerar backup.', 'error');
        } finally {
            setCreating(false);
        }
    };

    const confirmRestore = (row: BackupRow) => setRestoreTarget(row);

    const runRestore = async () => {
        if (!restoreTarget) return;
        setRestoring(true);
        try {
            const res = await fetch('/api/backup/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: restoreTarget.name }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || 'Falha ao restaurar backup');
            }
            showMessage('Backup restaurado com sucesso!');
            setRestoreTarget(null);
            // Recarrega o estado do servidor para a UI refletir o backup restaurado
            // (é isso que impede o auto-save de re-gravar o estado antigo por cima).
            await useDataStore.getState().loadInitialData(false);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao restaurar backup.', 'error');
        } finally {
            setRestoring(false);
        }
    };

    const download = async (row: BackupRow) => {
        try {
            const res = await fetch('/api/backup/download?name=' + encodeURIComponent(row.name));
            if (!res.ok) throw new Error('Falha ao baixar backup');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = row.name;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao baixar backup.', 'error');
        }
    };

    const importBackup = async (file: File | null) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.dump')) {
            showMessage('Envie um arquivo .dump (backup do sistema).', 'error');
            return;
        }
        setImporting(true);
        try {
            const res = await fetch('/api/backup/import', {
                method: 'POST',
                headers: { 'x-backup-filename': file.name },
                body: file,
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) throw new Error(data?.error || 'Falha ao importar backup');
            showMessage('Backup importado: ' + (data?.name || file.name));
            if (importRef.current) importRef.current.value = '';
            await load();
        } catch (error) {
            showMessage(error instanceof Error ? error.message : 'Falha ao importar backup.', 'error');
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-gray-50 px-4 py-3">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Versão do sistema</p>
                    <p className="text-lg font-bold text-gray-800">{SYSTEM_VERSION}</p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    Ativo
                </span>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-3">
                <div>
                    <h2 className="text-xl font-bold">Backups</h2>
                    <p className="text-sm text-gray-500">
                        Gere, baixe e restaure cópias de todo o banco de dados do sistema.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void load()}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar
                    </Button>
                    <input
                        ref={importRef}
                        type="file"
                        accept=".dump"
                        className="hidden"
                        onChange={(e) => void importBackup(e.target.files?.[0] ?? null)}
                    />
                    <Button variant="outline" onClick={() => importRef.current?.click()} disabled={importing}>
                        <Upload className="h-4 w-4 mr-2" />
                        {importing ? 'Importando...' : 'Restaurar de arquivo (.dump)'}
                    </Button>
                    <Button className="bg-green-600 hover:bg-green-700 cursor-pointer" onClick={() => void create()} disabled={creating}>
                        <Save className="h-4 w-4 mr-2" />
                        {creating ? 'Gerando...' : 'Gerar backup'}
                    </Button>
                </div>
            </div>

            <div className="border rounded-md overflow-scroll">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-3">Arquivo</th>
                            <th className="text-left p-3">Data</th>
                            <th className="text-left p-3">Tamanho</th>
                            <th className="text-right p-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading &&
                            Array.from({ length: 3 }).map((_, i) => (
                                <tr key={`ske-${i}`} className="border-t">
                                    <td colSpan={4} className="p-3">
                                        <div className="h-4 bg-gray-200 rounded animate-pulse" />
                                    </td>
                                </tr>
                            ))}
                        {!loading && backups.length === 0 && (
                            <tr className="border-t">
                                <td colSpan={4} className="p-3 text-sm text-gray-500">
                                    Nenhum backup encontrado ainda. Clique em &quot;Gerar backup&quot; para criar o primeiro.
                                </td>
                            </tr>
                        )}
                        {backups.map((row) => (
                            <tr key={row.name} className="border-t">
                                <td className="p-3 font-mono text-sm">{row.name}</td>
                                <td className="p-3 text-sm">{formatDate(row.mtime)}</td>
                                <td className="p-3 text-sm">{formatBytes(row.size)}</td>
                                <td className="p-3">
                                    <div className="inline-flex flex-row items-center justify-end w-full gap-3">
                                        <Download
                                            size={20}
                                            className="cursor-pointer"
                                            aria-label="Baixar"
                                            onClick={() => void download(row)}
                                        />
                                        <RotateCcw
                                            size={20}
                                            className="cursor-pointer text-red-500"
                                            aria-label="Restaurar"
                                            onClick={() => confirmRestore(row)}
                                        />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Dialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Restaurar backup</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <p className="text-sm text-gray-600">
                            Esta ação irá <strong>substituir todos os dados atuais</strong> do banco pelos dados do
                            backup <span className="font-mono">{restoreTarget?.name}</span>. Esta operação é irreversível.
                        </p>
                        <Button className="w-full bg-red-600 hover:bg-red-700 text-white h-12 font-bold" onClick={() => void runRestore()} disabled={restoring}>
                            {restoring ? 'Restaurando...' : 'Confirmar restauração'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}