"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPriceBRL } from "@/lib/formatters/br";

type Metrics = {
  bookings: number;
  revenuePixCents: number;
  revenueServicesCents: number;
  occupancyPct: number;
  noShowPct: number;
  cancelPct: number;
  novos: number;
  recorrentes: number;
};

export function ReportsBoard() {
  const [period, setPeriod] = useState("7d");
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [topServices, setTopServices] = useState<
    Array<{ name: string; count: number }>
  >([]);
  const [topStaff, setTopStaff] = useState<
    Array<{ name: string; count: number }>
  >([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/app/reports?period=${period}`);
    const data = await res.json();
    setMetrics(data.metrics ?? null);
    setTopServices(data.topServices ?? []);
    setTopStaff(data.topStaff ?? []);
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[
          { id: "today", label: "Hoje" },
          { id: "7d", label: "7 dias" },
          { id: "30d", label: "30 dias" },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={`rounded-full px-3 py-1.5 text-xs ${
              period === p.id
                ? "bg-[var(--copper)] text-white"
                : "bg-[var(--lead)] text-[var(--steel)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {metrics ? (
        <div className="grid grid-cols-2 gap-3">
          <Card label="Agendamentos" value={String(metrics.bookings)} />
          <Card
            label="Receita sinal PIX"
            value={formatPriceBRL(metrics.revenuePixCents)}
          />
          <Card
            label="Receita serviços"
            value={formatPriceBRL(metrics.revenueServicesCents)}
          />
          <Card label="Ocupação" value={`${metrics.occupancyPct}%`} />
          <Card label="No-show" value={`${metrics.noShowPct}%`} />
          <Card label="Cancelamentos" value={`${metrics.cancelPct}%`} />
          <Card label="Novos" value={String(metrics.novos)} />
          <Card label="Recorrentes" value={String(metrics.recorrentes)} />
        </div>
      ) : (
        <p className="text-sm text-[var(--steel)]">Carregando…</p>
      )}

      <section>
        <h2 className="text-sm font-medium text-[var(--steel)]">Top serviços</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {topServices.map((s) => (
            <li key={s.name} className="flex justify-between">
              <span>{s.name}</span>
              <span className="text-[var(--steel)]">{s.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-medium text-[var(--steel)]">Top barbeiros</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {topStaff.map((s) => (
            <li key={s.name} className="flex justify-between">
              <span>{s.name}</span>
              <span className="text-[var(--steel)]">{s.count}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--lead)] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[var(--steel)]">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--offwhite)]">
        {value}
      </p>
    </div>
  );
}
