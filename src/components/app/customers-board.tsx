"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPriceBRL } from "@/lib/formatters/br";

type CustomerRow = {
  id: string;
  name: string;
  phoneE164: string;
  notes: string | null;
  visits: number;
  lastBooking: {
    startsAt: string;
    status: string;
    serviceName: string;
  } | null;
};

type Detail = {
  id: string;
  name: string;
  phoneE164: string;
  email: string | null;
  notes: string | null;
  bookings: Array<{
    id: string;
    startsAt: string;
    status: string;
    priceCents: number;
    serviceName: string;
    staffName: string;
  }>;
};

export function CustomersBoard() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    const res = await fetch(`/api/app/customers${qs}`);
    const data = await res.json();
    setRows(data.customers ?? []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const open = async (id: string) => {
    const res = await fetch(`/api/app/customers/${id}`);
    const data = await res.json();
    setSelected(data.customer);
    setNotes(data.customer?.notes ?? "");
  };

  const saveNotes = async () => {
    if (!selected) return;
    await fetch(`/api/app/customers/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    await open(selected.id);
    await load();
  };

  return (
    <div className="space-y-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar nome ou WhatsApp"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--lead)] px-3 py-3 text-sm"
      />

      {loading ? (
        <p className="text-sm text-[var(--steel)]">Carregando…</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => void open(c.id)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--lead)] p-3 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{c.name}</p>
                  <span className="text-xs text-[var(--steel)]">
                    {c.visits} visita{c.visits === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-[var(--steel)]">{c.phoneE164}</p>
                {c.lastBooking ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Último: {c.lastBooking.serviceName} · {c.lastBooking.status}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center">
          <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--graphite)] p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <a
                  className="text-sm text-[var(--copper)]"
                  href={`https://wa.me/${selected.phoneE164.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp {selected.phoneE164}
                </a>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--steel)]"
                onClick={() => setSelected(null)}
              >
                Fechar
              </button>
            </div>

            <label className="block text-xs text-[var(--steel)]">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--lead)] p-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void saveNotes()}
              className="mt-2 rounded-lg bg-[var(--copper)] px-3 py-2 text-sm font-medium"
            >
              Salvar notas
            </button>

            <h3 className="mt-5 text-sm font-medium text-[var(--steel)]">
              Histórico
            </h3>
            <ul className="mt-2 space-y-2">
              {selected.bookings.map((b) => (
                <li
                  key={b.id}
                  className="rounded-lg border border-[var(--border)] bg-[var(--lead)] p-2 text-xs"
                >
                  <p>
                    {b.serviceName} · {b.staffName}
                  </p>
                  <p className="text-[var(--steel)]">
                    {new Date(b.startsAt).toLocaleString("pt-BR")} · {b.status}{" "}
                    · {formatPriceBRL(b.priceCents)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
