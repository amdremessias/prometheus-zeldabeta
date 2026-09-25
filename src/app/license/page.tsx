'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldCheck, Clock, RefreshCw, KeyRound } from 'lucide-react';
import { Button } from '@/shared/ui';

interface StatusResp {
    licensing_enabled: boolean;
    status: string;
    reason: string | null;
    exp: number | null;
    grace_until: number | null;
    now: number;
    blocked: boolean;
    details: Record<string, unknown> | null;
}

function fmt(ts: number | null) {
    if (!ts) return '—';
    return new Date(ts * 1000).toLocaleString('pt-BR');
}

export default function LicenseBlockScreen() {
    const [status, setStatus] = useState<StatusResp | null>(null);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);
    const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch('/api/license/status', { cache: 'no-store' });
            setStatus(await res.json());
        } catch {
            setStatus(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function requestEmergency() {
        setRequesting(true);
        setMsg(null);
        try {
            const res = await fetch('/api/license/emergency', { method: 'POST', cache: 'no-store' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setMsg({ kind: 'err', text: data.error || 'Não foi possível emitir o acesso emergencial.' });
            } else {
                setMsg({
                    kind: 'ok',
                    text: 'Acesso emergencial de 24h liberado. Recarregue para continuar.',
                });
                await load();
            }
        } catch {
            setMsg({ kind: 'err', text: 'Falha de conexão ao solicitar acesso emergencial.' });
        } finally {
            setRequesting(false);
        }
    }

    const disabled = !status?.licensing_enabled;

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-4">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-red-50 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-800">Licença do sistema</h1>
                        <p className="text-sm text-slate-500">Validação de uso do ZeldaPDV</p>
                    </div>
                </div>

                {disabled ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-4 text-sm flex items-start gap-2">
                        <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" />
                        <span>
                            Licenciamento não habilitado nesta instância. O acesso segue liberado (modo
                            padrão/auto-hospedado).
                        </span>
                    </div>
                ) : loading ? (
                    <div className="text-slate-400 text-sm">Verificando licença…</div>
                ) : (
                    <div className="space-y-3">
                        <div
                            className={`rounded-xl p-4 text-sm border ${
                                status?.blocked
                                    ? 'bg-red-50 border-red-200 text-red-700'
                                    : status?.status === 'grace'
                                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            }`}
                        >
                            <p className="font-semibold">
                                {status?.blocked
                                    ? 'Acesso bloqueado'
                                    : status?.status === 'grace'
                                      ? 'Licença expirada — período de tolerância'
                                      : 'Licença válida'}
                            </p>
                            {status?.reason && <p className="mt-1">{status.reason}</p>}
                        </div>

                        <dl className="text-sm text-slate-600 grid grid-cols-2 gap-y-2">
                            <dt className="flex items-center gap-1.5">
                                <Clock className="h-4 w-4" /> Expira em
                            </dt>
                            <dd className="text-right font-medium">{fmt(status?.exp ?? null)}</dd>
                            {status?.grace_until ? (
                                <>
                                    <dt>Tolerância até</dt>
                                    <dd className="text-right font-medium">{fmt(status.grace_until)}</dd>
                                </>
                            ) : null}
                            <dt>Status</dt>
                            <dd className="text-right font-medium">{status?.status}</dd>
                        </dl>

                        {status?.blocked && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                                <p className="text-sm text-slate-600 flex items-center gap-2">
                                    <KeyRound className="h-4 w-4" />
                                    Solicite um acesso emergencial de 24h para não parar o atendimento.
                                </p>
                                <Button
                                    className="w-full bg-blue-600 hover:bg-blue-700 h-11"
                                    onClick={requestEmergency}
                                    disabled={requesting}
                                >
                                    {requesting ? 'Solicitando…' : 'Solicitar Acesso Emergencial (24h)'}
                                </Button>
                                <p className="text-xs text-slate-400">
                                    Limite de 1 ativação por ciclo por cliente. Renovação oficial reseta a trava.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {msg && (
                    <div
                        className={`rounded-xl p-3 text-sm ${
                            msg.kind === 'ok'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                    >
                        {msg.text}
                    </div>
                )}

                <div className="flex justify-between items-center pt-1">
                    <Button variant="ghost" size="sm" onClick={load} className="gap-1">
                        <RefreshCw className="h-4 w-4" /> Atualizar
                    </Button>
                    {!disabled && !status?.blocked && (
                        <Button variant="outline" size="sm" onClick={() => (window.location.href = '/app')}>
                            Ir para o painel
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
