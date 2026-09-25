'use client';

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, Switch } from "@/shared/ui";

export function IntegracoesScreen() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [webhookPath, setWebhookPath] = useState("/webhook/waha-message-internal-v20");
  useEffect(() => { fetch("/api/integrations/whatsapp/settings", { credentials: "include" }).then(r => r.json()).then(d => { setEnabled(d.enabled === true); setWebhookPath(d.webhookPath || "/webhook/waha-message-internal-v20"); }).catch(() => setError("Não foi possível carregar a integração.")).finally(() => setLoading(false)); }, []);
  const toggle = async (next: boolean) => { const old = enabled; setEnabled(next); setSaving(true); setError(""); try { const r = await fetch("/api/integrations/whatsapp/settings", { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: next }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Falha ao salvar"); setEnabled(d.enabled === true); setWebhookPath(d.webhookPath || webhookPath); } catch (e) { setEnabled(old); setError(e instanceof Error ? e.message : "Falha ao salvar"); } finally { setSaving(false); } };
  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold">Integrações · Zelda PDV</h1><p className="text-muted-foreground">Controle o atendimento de pedidos via WhatsApp usando n8n e WAHA.</p></div>
      <Card><CardHeader><CardTitle>Pedidos via WhatsApp</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex items-center justify-between"><div><p className="font-medium">Automação n8n + WAHA</p><p className="text-sm text-muted-foreground">Recebe mensagens, registra o pedido no CRM e responde pelo WhatsApp.</p></div><Switch checked={enabled} disabled={loading || saving} onCheckedChange={toggle} /></div>
        <div className="rounded-lg bg-muted p-3 text-sm"><p><strong>Status:</strong> {loading ? "Carregando..." : saving ? "Salvando..." : enabled ? "Ativada" : "Desativada"}</p><p><strong>Webhook:</strong> {webhookPath}</p>{error && <p className="text-destructive">{error}</p>}<p><strong>Origem dos clientes:</strong> Automação de pedidos WhatsApp</p></div>
      </CardContent></Card>
    </div>
  );
}
