"use client";

import { useMemo, useState } from "react";
import auditData from "./audit-data.json";

type Severity = "critica" | "alta" | "media" | "baixa" | "pontoForte";

const SEV_LABEL: Record<Severity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  pontoForte: "Ponto forte",
};

const SEV_STYLE: Record<Severity, string> = {
  critica: "bg-red-100 text-red-700 border-red-300",
  alta: "bg-orange-100 text-orange-700 border-orange-300",
  media: "bg-amber-100 text-amber-700 border-amber-300",
  baixa: "bg-blue-100 text-blue-700 border-blue-300",
  pontoForte: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

const SEV_BAR: Record<Severity, string> = {
  critica: "bg-red-600",
  alta: "bg-orange-500",
  media: "bg-amber-500",
  baixa: "bg-blue-600",
  pontoForte: "bg-emerald-600",
};

const STATUS: Record<"resolvido" | "aberto", { label: string; cls: string }> = {
  resolvido: { label: "Resolvido", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  aberto: { label: "Em aberto", cls: "bg-red-100 text-red-700 border-red-300" },
};

const ALL_FILTERS: ("todos" | Severity)[] = [
  "todos",
  "critica",
  "alta",
  "media",
  "pontoForte",
];

export default function SecurityAuditDashboard() {
  const [filter, setFilter] = useState<"todos" | Severity>("todos");
  const [sfilter, setSfilter] = useState<"todos" | "resolvido" | "aberto">("todos");

  const findings = auditData.findings as Array<{
    id: string;
    severity: Severity;
    file: string;
    line: string;
    title: string;
    recommendation: string;
    status: "resolvido" | "aberto";
    nota?: string;
  }>;

      const filtered = useMemo(
        () =>
          findings.filter(
            (f) =>
              (filter === "todos" || f.severity === filter) &&
              (sfilter === "todos" || f.status === sfilter)
          ),
        [filter, sfilter, findings]
      );

  const counts = auditData.summary as Record<string, number>;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Header */}
        <header className="mb-6 border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold tracking-tight">{auditData.meta.title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Versão {auditData.meta.version} · {auditData.meta.date}
          </p>
          <p className="mt-1 text-sm text-gray-600">{auditData.meta.scope}</p>
        </header>

        {/* Summary cards */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(["critica", "alta", "media", "baixa", "pontoForte"] as Severity[]).map((s) => (
            <div key={s} className={`rounded-lg border p-3 ${SEV_STYLE[s]}`}>
              <div className="text-2xl font-bold">{counts[s] ?? 0}</div>
              <div className="text-xs font-medium uppercase tracking-wide">{SEV_LABEL[s]}</div>
            </div>
          ))}
        </section>

        {/* Severity distribution bar */}
        {auditData.remediacao && (
          <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
            Reavaliação pós-correção ({auditData.remediacao.data}):{" "}
            <b>{auditData.remediacao.resolvidos} resolvidos</b> ·{" "}
            <b>{auditData.remediacao.abertos} em aberto</b>. {auditData.remediacao.nota}
          </div>
        )}

        <section className="mb-8">
          <div className="mb-1 flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
            {(["critica", "alta", "media", "baixa", "pontoForte"] as Severity[]).map((s) => {
              const v = counts[s] ?? 0;
              const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
              return (
                <div
                  key={s}
                  className={SEV_BAR[s]}
                  style={{ width: `${(v / total) * 100}%` }}
                  title={`${SEV_LABEL[s]}: ${v}`}
                />
              );
            })}
          </div>
          <p className="text-xs text-gray-500">Distribuição de severidade ({Object.values(counts).reduce((a, b) => a + b, 0)} achados)</p>
        </section>

        {/* Filters */}
        <section className="mb-6">
          <div className="flex flex-wrap gap-2">
            {ALL_FILTERS.map((f) => {
              const active = filter === f;
              const label = f === "todos" ? "Todos" : SEV_LABEL[f as Severity];
              const cls = f === "todos" ? "bg-gray-800 text-white border-gray-800" : SEV_STYLE[f as Severity];
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                    active ? cls : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Status filter */}
        <section className="mb-6">
          <div className="flex flex-wrap gap-2">
            {(["todos", "resolvido", "aberto"] as const).map((s) => {
              const active = sfilter === s;
              const label = s === "todos" ? "Todos" : STATUS[s].label;
              return (
                <button
                  key={s}
                  onClick={() => setSfilter(s)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                    active
                      ? s === "todos"
                        ? "bg-gray-800 text-white border-gray-800"
                        : STATUS[s].cls
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Findings */}
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">
            Achados ({filtered.length})
          </h2>
          <div className="space-y-3">
            {filtered.map((f) => (
              <article key={f.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-400">{f.id}</span>
                    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${SEV_STYLE[f.severity]}`}>
                      {SEV_LABEL[f.severity]}
                    </span>
                    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${STATUS[f.status].cls}`}>
                      {STATUS[f.status].label}
                    </span>
                  </div>
                  <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                    {f.file}:{f.line}
                  </code>
                </div>
                <h3 className="mt-2 font-medium">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-semibold text-gray-700">Recomendação: </span>
                  {f.recommendation}
                </p>
                {f.nota && (
                  <p className="mt-1 text-xs text-gray-500">
                    <span className="font-semibold">Status: </span>
                    {f.nota}
                  </p>
                )}
              </article>
            ))}
            {filtered.length === 0 && (
              <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Nenhum achado para este filtro.
              </p>
            )}
          </div>
        </section>

        {/* Categories */}
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Resultado por categoria</h2>
          <div className="space-y-3">
            {auditData.categories.map((c) => (
              <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">{c.name}</h3>
                  <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${SEV_STYLE[c.severity as Severity]}`}>
                    {c.verdict}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{c.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Coverage */}
        <section>
          <h2 className="mb-3 text-lg font-semibold">Cobertura confirmada (sem achados)</h2>
          <ul className="space-y-1">
            {auditData.coverage.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                <span className="mt-1 text-emerald-600">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-10 border-t border-gray-200 pt-4 text-xs text-gray-400">
          Confidencial — uso interno · gerado a partir de audit-data.json
        </footer>
      </div>
    </div>
  );
}
