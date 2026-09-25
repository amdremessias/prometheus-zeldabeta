"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, ArrowLeft, Send, CheckCircle2, User, Bot, AlertCircle } from "lucide-react";

type Chat = {
  id: number;
  phone: string;
  customer_name: string;
  subject: string;
  last_message: string;
  status: "aberto" | "assumido" | "finalizado";
  assigned_to_name: string | null;
  ticket_id: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, unknown>;
};

type Message = {
  id: number;
  direction: "inbound" | "outbound";
  senderType: "customer" | "human" | "automation" | "system";
  text: string;
  createdAt: string;
};

const statusLabel: Record<Chat["status"], string> = {
  aberto: "Aberto",
  assumido: "Em atendimento",
  finalizado: "Finalizado",
};

const statusColor: Record<Chat["status"], string> = {
  aberto: "bg-amber-100 text-amber-800 border-amber-200",
  assumido: "bg-emerald-100 text-emerald-800 border-emerald-200",
  finalizado: "bg-slate-200 text-slate-700 border-slate-300",
};

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function ChatWppTickets() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [filter, setFilter] = useState<"aberto" | "assumido" | "finalizado">("aberto");
  const [selected, setSelected] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/whatsapp/human?status=${encodeURIComponent(filter)}`, { cache: "no-store" });
      const data = await response.json();
      const next = Array.isArray(data.chats) ? (data.chats as Chat[]) : [];
      setChats(next);
      setSelected((old) => {
        if (!old) return null;
        const found = next.find((chat) => chat.id === old.id);
        return found ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadMessages = useCallback(async (chatId: number) => {
    try {
      const response = await fetch(`/api/whatsapp/human/${chatId}/message`, { cache: "no-store" });
      const data = await response.json();
      setMessages(Array.isArray(data.messages) ? data.messages as Message[] : []);
    } catch {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const interval = window.setInterval(() => void loadList(), 5000);
    return () => window.clearInterval(interval);
  }, [loadList]);

  useEffect(() => {
    if (selected) void loadMessages(selected.id);
  }, [selected, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function pick(chat: Chat) {
    setSelected(chat);
    setNotice("");
  }

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
      await Promise.all([loadMessages(selected.id), loadList()]);
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
    const data = await response.json().catch(() => ({} as Record<string, unknown>));
    const finalized: Chat = data.chat ? (data.chat as Chat) : { ...selected, status: "finalizado" };
    setSelected(finalized);
    setNotice("Chat finalizado. A automação foi retomada e uma mensagem de encerramento foi enviada ao cliente. O próximo contato iniciará um novo atendimento.");
    await loadMessages(selected.id);
  }

  if (selected) {
    return (
      <section className="flex h-full flex-col p-6">
        <header className="flex items-center gap-3 border-b pb-4">
          <button
            onClick={() => {
              setSelected(null);
              setMessages([]);
            }}
            className="rounded border p-2 hover:bg-slate-100"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{selected.customer_name || selected.phone}</h1>
              <span className={`rounded-full border px-2 py-0.5 text-xs ${statusColor[selected.status]}`}>
                {statusLabel[selected.status]}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {selected.phone} · <span className="font-mono">{selected.ticket_id || "sem ticket"}</span>
              {selected.subject ? ` · ${selected.subject}` : ""}
              {selected.assigned_to_name ? ` · atendente: ${selected.assigned_to_name}` : ""}
            </p>
          </div>
          {selected.status !== "finalizado" && (
            <button
              onClick={() => void finalizeChat()}
              className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Finalizar
            </button>
          )}
        </header>

        {/* Card de aceite */}
        {selected.status !== "finalizado" && messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="max-w-md w-full rounded-lg bg-yellow-50 border border-yellow-200 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-yellow-800">Aguardando aceite do atendente</h2>
              <p className="mt-2 text-sm text-yellow-700">
                O cliente <span className="font-medium">{selected.customer_name || selected.phone}</span>
                ({selected.phone}) enviou uma mensagem e está aguardando um atendente para interagir.
              </p>
              <p className="mt-1 text-xs text-yellow-600">
                Ticket: <span className="font-mono">{selected.ticket_id}</span>
              </p>
              <p className="mt-4 text-xs text-yellow-600">
                Clique em "Finalizar" após concluir ou aguarde outro atendente aceitar.
              </p>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-5">
          {messages.length === 0 && (
            <p className="rounded border border-dashed p-6 text-center text-sm text-slate-500">
              Nenhuma mensagem registrada para este ticket ainda.
            </p>
          )}
          {messages.map((message) => {
            const fromCustomer = message.senderType === "customer";
            const isAutomation = message.senderType === "automation";
            const isSystem = message.senderType === "system";
            const isOutbound = message.direction === "outbound" && message.senderType === "human";
            const align = fromCustomer ? "items-start" : "items-end";
            const bubbleColor = isOutbound
              ? "bg-emerald-600 text-white"
              : isAutomation
                ? "bg-violet-100 text-violet-900 border border-violet-200"
                : isSystem
                  ? "bg-slate-100 text-slate-700 border border-slate-200"
                  : fromCustomer
                    ? "bg-slate-100 text-slate-800"
                    : "bg-slate-100 text-slate-800";
            const label = isOutbound
              ? { icon: User, text: "Humano" }
              : isAutomation
                ? { icon: Bot, text: "Automação" }
                : isSystem
                  ? { icon: AlertCircle, text: "Sistema" }
                  : { icon: MessageCircle, text: "Cliente" };
            return (
              <div key={message.id} className={`flex ${align}`}>
                <div className={`max-w-[75%] ${bubbleColor} rounded-lg px-3 py-2 text-sm whitespace-pre-wrap`}>
                  <div className="mb-1 flex items-center gap-1 text-[11px] opacity-70">
                    <label.icon className="h-3 w-3" />
                    <span className="uppercase">{label.text}</span>
                  </div>
                  {message.text}
                  {message.createdAt && (
                    <div className="mt-1 text-right text-[10px] opacity-60">
                      {fmtTime(message.createdAt)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selected.status !== "finalizado" ? (
          <footer className="flex gap-2 border-t pt-4">
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
              className="min-h-16 flex-1 rounded border p-3 text-sm"
            />
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !draft.trim()}
              className="flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {sending ? "Enviando..." : "Enviar"}
            </button>
          </footer>
        ) : (
          <footer className="flex items-center gap-2 rounded bg-slate-100 p-3 text-sm text-slate-600">
            <CheckCircle2 className="h-4 w-4" />
            Ticket finalizado. O próximo contato retoma a automação com novo ticket e boas-vindas.
          </footer>
        )}
        {notice && (
          <div className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {notice}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">ChatWPP</h1>
          <p className="text-sm text-slate-500">
            Atendimentos humanos transferidos pela automação — histórico completo por ticket.
          </p>
        </div>
        <div className="flex gap-2">
          {(["aberto", "assumido", "finalizado"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded border px-3 py-2 text-sm ${filter === value ? "border-emerald-500 bg-emerald-50 font-semibold" : "bg-white text-slate-600"}`}
            >
              {statusLabel[value]}
            </button>
          ))}
        </div>
      </header>

      {loading && chats.length === 0 ? (
        <p className="rounded border p-6 text-sm text-slate-500">Carregando atendimentos...</p>
      ) : chats.length === 0 ? (
        <p className="rounded border p-6 text-sm text-slate-500">Nenhum atendimento nesta fila.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => void pick(chat)}
              className="rounded border bg-white p-4 text-left shadow-sm transition hover:border-emerald-400"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{chat.customer_name || chat.phone}</div>
                <span className={`rounded-full border px-2 py-0.5 text-[11px] uppercase ${statusColor[chat.status]}`}>
                  {statusLabel[chat.status]}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                <span className="font-mono">{chat.ticket_id || "sem ticket"}</span> · {chat.phone}
              </div>
              {chat.subject && (
                <div className="mt-1 text-xs font-medium text-slate-600">{chat.subject}</div>
              )}
              <div className="mt-2 line-clamp-2 text-sm text-slate-700">
                {chat.last_message || "Sem mensagem ainda"}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>{chat.updated_at ? `atualizado ${fmtTime(chat.updated_at)}` : ""}</span>
                <span>
                  {chat.status === "assumido" && chat.assigned_to_name
                    ? chat.assigned_to_name
                    : chat.status === "finalizado"
                      ? "fechado"
                      : "novo"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export { ChatWppTickets };