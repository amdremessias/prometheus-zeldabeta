"use client";

import { useEffect, useState } from "react";

type Feedback = {
  id: number;
  phone: string;
  customer_name: string;
  kind: string;
  message: string;
  order_number?: string | null;
  status: string;
  created_at: string;
};

export default function FeedbackWppReport() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/whatsapp/feedback");
      const data = await response.json();
      setItems(data.feedback || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <section className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Feedback pedidos WPP</h1>
        <p className="text-sm text-slate-500">Elogios, reclamações e sugestões recebidos pelo WhatsApp.</p>
      </div>
      {loading ? <p>Carregando feedback...</p> : items.length === 0 ? <p className="rounded border p-4 text-slate-500">Nenhum feedback registrado.</p> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50"><tr><th className="p-3">Data</th><th className="p-3">Cliente</th><th className="p-3">Tipo</th><th className="p-3">Pedido</th><th className="p-3">Mensagem</th><th className="p-3">Status</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-3">{new Date(item.created_at).toLocaleString("pt-BR")}</td><td className="p-3">{item.customer_name || item.phone}<br /><span className="text-xs text-slate-500">{item.phone}</span></td><td className="p-3">{item.kind}</td><td className="p-3">{item.order_number || "—"}</td><td className="max-w-md p-3">{item.message}</td><td className="p-3">{item.status}</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export { FeedbackWppReport };
