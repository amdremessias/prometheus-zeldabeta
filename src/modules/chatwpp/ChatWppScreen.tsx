"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

type Chat = {
  id: number;
  phone: string;
  customer_name?: string;
  subject?: string;
  last_message?: string;
  status: "aberto" | "assumido" | "finalizado";
  ticket_id?: string;
  updated_at?: string;
};

export default function ChatWppScreen() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [status, setStatus] = useState("aberto");
  const [selected, setSelected] = useState<Chat | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/whatsapp/human?status=${encodeURIComponent(status)}`, { cache: "no-store" });
      const data = await response.json();
      const next = Array.isArray(data.chats) ? data.chats : [];
      setChats(next);
      setSelected((old) => old ? next.find((chat: Chat) => chat.id === old.id) ?? old : next[0] ?? null);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function sendMessage() {
    if (!selected || !draft.trim()) return;
    setSending(true);
    setNotice("");
    try {
      const response = await fetch(`/api/whatsapp/human/${selected.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draft }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar");
      setDraft("");
      setNotice("Mensagem enviada");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Falha ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  async function finalizeChat() {
    if (!selected) return;
    setNotice("");
    const response = await fetch(`/api/whatsapp/human/${selected.id}/finalize`, { method: "POST" });
    if (!response.ok) {
      setNotice("Não foi possível finalizar o chat");
      return;
    }
    setNotice("Chat finalizado. A automação será retomada somente no próximo contato do cliente.");
    await load();
  }

  return (
    <section className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ChatWPP</h1>
          <p className="text-sm text-slate-500">Atendimentos humanos transferidos pelo WhatsApp.</p>
        </div>
        <select className="rounded border px-3 py-2" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="aberto">Abertos</option>
          <option value="assumido">Assumidos</option>
          <option value="finalizado">Finalizados</option>
        </select>
      </header>
      {notice && (
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">{notice}</div>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(420px,1.2fr)]">
        <div className="space-y-3">
          {loading && chats.length === 0 ? (
            <p>Carregando chats...</p>
          ) : chats.length === 0 ? (
            <p className="rounded border p-4 text-sm text-slate-500">Nenhum atendimento nesta fila.</p>
          ) : (
            chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelected(chat)}
                className={`w-full rounded border p-4 text-left ${selected?.id === chat.id ? "border-emerald-500 bg-emerald-50" : "bg-white"}`}
              >
                <div className="font-semibold">{chat.customer_name || chat.phone}</div>
                <div className="text-xs text-slate-500">{chat.phone} · {chat.ticket_id || "sem ticket"}</div>
                <div className="mt-2 line-clamp-2 text-sm">{chat.last_message || "Sem mensagem"}</div>
                <div className="mt-2 text-xs uppercase text-slate-500">{chat.status}</div>
              </button>
            ))
          )}
        </div>
        {selected ? (
          <article className="flex min-h-[420px] flex-col rounded border bg-white p-5">
            <div className="border-b pb-3">
              <h2 className="font-semibold">{selected.customer_name || selected.phone}</h2>
              <p className="text-sm text-slate-500">
                {selected.phone} · {selected.ticket_id || "Pedido WhatsApp"}
              </p>
            </div>
            <div className="flex-1 py-5">
              {/* Card de aceite */}
              {selected.status !== "finalizado" && (
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-yellow-800">
                        🎫 Atendimento aguardando aceite
                      </p>
                      <p className="mt-1 text-xs text-yellow-700">
                        O cliente <span className="font-medium">{selected.customer_name || selected.phone}</span>
                        ({selected.phone}) enviou a última mensagem: <span className="font-mono text-xs">"{selected.last_message}"</span>.
                        <br />
                        Aceite este atendimento para começar a interagir com o cliente.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => finalizeChat()}
                          className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
                        >
                          Finalizar chat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="max-w-[85%] rounded bg-slate-100 p-3 text-sm whitespace-pre-wrap">
                {selected.last_message || "Nenhuma mensagem registrada."}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                O cliente permanece em atendimento humano até você clicar em "Finalizar chat".
              </p>
            </div>
            {selected.status !== "finalizado" ? (
              <>
                <div className="flex gap-2">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Digite sua resposta para o cliente..."
                    className="min-h-20 flex-1 rounded border p-3 text-sm"
                  />
                  <button
                    disabled={sending || !draft.trim()}
                    onClick={() => void sendMessage()}
                    className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {sending ? "Enviando..." : "Enviar"}
                  </button>
                </div>
                <button
                  onClick={() => void finalizeChat()}
                  className="mt-3 rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white"
                >
                  Finalizar chat
                </button>
              </>
            ) : (
              <p className="mt-4 rounded bg-slate-100 p-3 text-sm">
                Chat finalizado. O próximo contato iniciará uma nova saudação automática.
              </p>
            )}
          </article>
        ) : (
          <div className="rounded border p-6 text-sm text-slate-500">Selecione um atendimento para responder.</div>
        )}
      </div>
    </section>
  );
}

export { ChatWppScreen };