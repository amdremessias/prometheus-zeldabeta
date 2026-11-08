'use client';

import { useEffect, useState } from 'react';

type WhatsAppState = { enabled: boolean; provider: 'waha' | 'meta'; configured: { waha: boolean; meta: boolean }; webhookPath: string };
type AiState = { provider: 'n8n' | 'gemini' | 'gateway'; configured: { n8n: boolean; gemini: boolean; gateway: boolean } };

export function SettingsIntegrations() {
  const [whatsapp, setWhatsapp] = useState<WhatsAppState | null>(null);
  const [ai, setAi] = useState<AiState | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch('/api/integrations/whatsapp/settings').then((r) => r.json()),
      fetch('/api/integrations/ai/settings').then((r) => r.json()),
    ]).then(([w, a]) => {
      if (!live) return;
      if (!w.error) setWhatsapp(w);
      if (!a.error) setAi(a);
    }).catch(() => { if (live) setNotice('Não foi possível carregar as configurações.'); });
    return () => { live = false; };
  }, []);

  async function saveWhatsApp() {
    if (!whatsapp) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/integrations/whatsapp/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: whatsapp.enabled, provider: whatsapp.provider }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao salvar WhatsApp');
      setWhatsapp(result); setNotice('Configuração do WhatsApp salva.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao salvar WhatsApp.'); }
    finally { setBusy(false); }
  }

  async function saveAi() {
    if (!ai) return;
    setBusy(true); setNotice('');
    try {
      const response = await fetch('/api/integrations/ai/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: ai.provider }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha ao salvar IA');
      setAi(result); setNotice('Provedor de IA salvo.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Falha ao salvar IA.'); }
    finally { setBusy(false); }
  }

  const card = 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900';
  const select = 'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';
  const button = 'mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50';
  if (!whatsapp || !ai) return <div className="p-4 text-sm text-slate-500">Carregando integrações…</div>;

  const whatsappPath = whatsapp.provider === 'waha' ? 'Webhook: ' + whatsapp.webhookPath : 'Webhook público: /api/integrations/whatsapp/official/webhook';
  const whatsappConfigured = whatsapp.configured[whatsapp.provider] ? 'credenciais configuradas' : 'faltam variáveis no ambiente';
  const aiConfigured = ai.configured[ai.provider] ? 'endpoint/chave configurados' : 'o provedor ainda não está configurado no ambiente desta instância';

  return <div className="space-y-4">
    <p className="text-sm text-slate-600 dark:text-slate-300">Cada instância usa seus próprios segredos e endpoints. Credenciais ficam no ambiente do deployment; esta tela só escolhe os provedores.</p>
    <section className={card}>
      <h3 className="text-base font-semibold">WhatsApp</h3>
      <label className="mt-3 block text-sm font-medium">Provedor de mensagens
        <select className={select} value={whatsapp.provider} onChange={(e) => setWhatsapp({ ...whatsapp, provider: e.target.value as WhatsAppState['provider'] })}>
          <option value="waha">WAHA (self-hosted)</option>
          <option value="meta">WhatsApp Business Cloud API (Meta)</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-slate-500">{whatsappPath} · {whatsappConfigured}</p>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={whatsapp.enabled} onChange={(e) => setWhatsapp({ ...whatsapp, enabled: e.target.checked })} />Ativar atendimento automático</label>
      <button type="button" className={button} disabled={busy} onClick={saveWhatsApp}>Salvar WhatsApp</button>
    </section>
    <section className={card}>
      <h3 className="text-base font-semibold">Inteligência artificial</h3>
      <label className="mt-3 block text-sm font-medium">Agente da instância
        <select className={select} value={ai.provider} onChange={(e) => setAi({ ...ai, provider: e.target.value as AiState['provider'] })}>
          <option value="n8n">n8n (workflow isolado)</option>
          <option value="gemini">Gemini</option>
          <option value="gateway">Gateway OpenAI-compatible (VPN ou terceiro)</option>
        </select>
      </label>
      <p className="mt-2 text-xs text-slate-500">{aiConfigured}. n8n e gateway não fazem fallback para Gemini, a menos que ZELDAPDV_AI_FALLBACK_TO_GEMINI=true.</p>
      <button type="button" className={button} disabled={busy} onClick={saveAi}>Salvar provedor de IA</button>
    </section>
    {notice && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{notice}</p>}
  </div>;
}
