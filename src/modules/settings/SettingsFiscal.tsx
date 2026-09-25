'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Label, Switch, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui';
import { Loader2, ShieldCheck } from 'lucide-react';

type FiscalConfig = {
    habilitado: boolean;
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    ie: string;
    crt: string;
    ambiente: number;
    certificadoNome: string;
    certificadoPfxPresente: boolean;
    certificadoSenhaDefinida: boolean;
    cscId: string;
    cscDefinido: boolean;
    serieNfce: number;
    serieNfe: number;
    proximoNumeroNfce: number;
    proximoNumeroNfe: number;
    codigoIbgeMunicipio: string;
};

const EMPTY: FiscalConfig = {
    habilitado: false,
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    ie: '',
    crt: '1',
    ambiente: 2,
    certificadoNome: '',
    certificadoPfxPresente: false,
    certificadoSenhaDefinida: false,
    cscId: '',
    cscDefinido: false,
    serieNfce: 1,
    serieNfe: 1,
    proximoNumeroNfce: 1,
    proximoNumeroNfe: 1,
    codigoIbgeMunicipio: '',
};

export function SettingsFiscal() {
    const [form, setForm] = useState<FiscalConfig>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
    const [senha, setSenha] = useState('');
    const [cscToken, setCscToken] = useState('');
    const [certFile, setCertFile] = useState<File | null>(null);

    const set = <K extends keyof FiscalConfig>(k: K, v: FiscalConfig[K]) => setForm((f) => ({ ...f, [k]: v }));

    useEffect(() => {
        (async () => {
            try {
                const r = await fetch('/api/fiscal/config', { cache: 'no-store' });
                if (r.ok) {
                    const j = await r.json();
                    if (j.config) setForm({ ...EMPTY, ...j.config });
                    else setForm(EMPTY);
                }
            } catch {
                /* offline — mantém vazio */
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const salvar = async () => {
        setSaving(true);
        setMsg(null);
        try {
            const r = await fetch('/api/fiscal/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    habilitado: form.habilitado,
                    cnpj: form.cnpj,
                    razaoSocial: form.razaoSocial,
                    nomeFantasia: form.nomeFantasia,
                    ie: form.ie,
                    crt: form.crt,
                    ambiente: form.ambiente,
                    cscToken: cscToken || undefined,
                    cscId: form.cscId,
                    serieNfce: Number(form.serieNfce) || 1,
                    serieNfe: Number(form.serieNfe) || 1,
                    proximoNumeroNfce: Number(form.proximoNumeroNfce) || 1,
                    proximoNumeroNfe: Number(form.proximoNumeroNfe) || 1,
                    codigoIbgeMunicipio: form.codigoIbgeMunicipio,
                }),
            });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Erro ao salvar');
            setForm({ ...EMPTY, ...j.config });
            setCscToken('');
            setMsg({ type: 'ok', text: 'Configurações fiscais salvas' });
        } catch (e) {
            setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao salvar' });
        } finally {
            setSaving(false);
        }
    };

    const enviarCertificado = async () => {
        if (!certFile) return;
        setSaving(true);
        setMsg(null);
        try {
            const fd = new FormData();
            fd.append('certificado', certFile);
            fd.append('senha', senha);
            const r = await fetch('/api/fiscal/config/certificado', { method: 'POST', body: fd });
            const j = await r.json();
            if (!r.ok) throw new Error(j.error || 'Erro ao enviar certificado');
            setForm((f) => ({
                ...f,
                certificadoNome: j.certificadoNome,
                certificadoPfxPresente: true,
                certificadoSenhaDefinida: true,
            }));
            setCertFile(null);
            setSenha('');
            setMsg({ type: 'ok', text: 'Certificado A1 enviado e criptografado' });
        } catch (e) {
            setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Erro ao enviar certificado' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando configurações fiscais...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-green-600" />
                <h2 className="text-xl font-bold">Configurações Fiscais</h2>
                <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    Modo homologação (sem transmissão real)
                </span>
            </div>
            <p className="text-sm text-gray-600">
                Cadastre o emitente para emissão de NFC-e (modelo 65) e NF-e (modelo 55). Os dados sensíveis
                (certificado, senha e CSC) são armazenados criptografados.
            </p>

            {msg && (
                <div
                    className={`rounded-md px-3 py-2 text-sm ${
                        msg.type === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                >
                    {msg.text}
                </div>
            )}

            {/* Ativar/Desativar módulo fiscal */}
            <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                    <h3 className="text-base font-semibold text-gray-800">Habilitar emissão fiscal (NFC-e / NF-e)</h3>
                    <p className="text-sm text-gray-600">
                        {form.habilitado
                            ? 'Ativo: o sistema coletará os dados fiscais para emissão de notas quando o emitente estiver completo.'
                            : 'Desativado (padrão): o PDV funciona normalmente, sem exigir emissão de nota fiscal.'}
                    </p>
                </div>
                <Switch
                    checked={form.habilitado}
                    onCheckedChange={(v) => set('habilitado', v)}
                    aria-label="Habilitar módulo fiscal"
                />
            </div>

            {/* Emitente */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Dados do Emitente</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>CNPJ</Label>
                        <Input
                            inputMode="numeric"
                            placeholder="00.000.000/0000-00"
                            value={form.cnpj}
                            maxLength={18}
                            onChange={(e) => set('cnpj', e.target.value.replace(/[^\d./-]/g, ''))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Inscrição Estadual (IE)</Label>
                        <Input value={form.ie} onChange={(e) => set('ie', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Razão Social</Label>
                        <Input value={form.razaoSocial} onChange={(e) => set('razaoSocial', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Nome Fantasia</Label>
                        <Input value={form.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Código IBGE do Município</Label>
                        <Input
                            inputMode="numeric"
                            placeholder="3534708"
                            value={form.codigoIbgeMunicipio}
                            maxLength={7}
                            onChange={(e) => set('codigoIbgeMunicipio', e.target.value.replace(/\D/g, ''))}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Regime Tributário (CRT)</Label>
                        <Select value={form.crt} onValueChange={(v) => set('crt', v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="1">1 - Simples Nacional</SelectItem>
                                <SelectItem value="3">3 - Regime Normal</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-md border p-3">
                    <div>
                        <Label>Ambiente</Label>
                        <p className="text-xs text-gray-500">Homologação (testes)</p>
                    </div>
                    <Switch checked disabled aria-label="Ambiente fixo em homologação" />
                    <span className="text-xs text-gray-600">
                        Fixo em <b>2 - Homologação</b> nesta fase. Produção será habilitada após aprovação.
                    </span>
                </div>
            </div>

            {/* Certificado A1 */}
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Certificado Digital A1 (.pfx)</h3>
                {form.certificadoPfxPresente ? (
                    <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                        Certificado instalado: <b>{form.certificadoNome || '(armazenado)'}</b>
                    </div>
                ) : (
                    <div className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                        Nenhum certificado enviado ainda.
                    </div>
                )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-2">
                        <Label>Arquivo .pfx</Label>
                        <Input
                            type="file"
                            accept=".pfx"
                            onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Senha do certificado</Label>
                        <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                        <Button
                            onClick={enviarCertificado}
                            disabled={!certFile || !senha || saving}
                            className="w-full"
                        >
                            Enviar certificado
                        </Button>
                    </div>
                </div>
            </div>

            {/* NFC-e */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">NFC-e (modelo 65)</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>CSC Token</Label>
                        <Input
                            type="password"
                            placeholder="CSC recebido da SEFAZ"
                            value={cscToken}
                            onChange={(e) => setCscToken(e.target.value)}
                        />
                        {form.cscDefinido && (
                            <p className="text-xs text-green-700">CSC configurado (substitua para atualizar)</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label>ID do CSC</Label>
                        <Input value={form.cscId} onChange={(e) => set('cscId', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Série NFC-e</Label>
                        <Input
                            inputMode="numeric"
                            value={form.serieNfce}
                            onChange={(e) => set('serieNfce', Number(e.target.value.replace(/\D/g, '')) || 1)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Próximo Número de Nota</Label>
                        <Input
                            inputMode="numeric"
                            value={form.proximoNumeroNfce}
                            onChange={(e) =>
                                set('proximoNumeroNfce', Number(e.target.value.replace(/\D/g, '')) || 1)
                            }
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-2">
                <Button onClick={salvar} disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar configurações fiscais'}
                </Button>
            </div>
        </div>
    );
}
