"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils";

type StaffOpt = { id: string; displayName: string };

type BookingRow = {
  id: string;
  status: string;
  startsAt: string;
  endsAt: string;
  customer: { name: string; phoneE164: string };
  service: { name: string; durationMin: number };
  staff: { id: string; displayName: string; color: string | null };
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  CONFIRMED: "Confirmado",
  CHECKED_IN: "Check-in",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
  EXPIRED: "Expirado",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: "bg-amber-500/15 text-amber-300",
  CONFIRMED: "bg-[var(--brand-soft)] text-[var(--copper)]",
  CHECKED_IN: "bg-sky-500/15 text-sky-300",
  COMPLETED: "bg-[color-mix(in_srgb,var(--signal)_18%,transparent)] text-[var(--signal)]",
  CANCELLED: "bg-zinc-500/20 text-zinc-400",
  NO_SHOW: "bg-rose-500/15 text-rose-300",
  EXPIRED: "bg-zinc-500/20 text-zinc-400",
};

const ACTIONS: Array<{ status: string; label: string }> = [
  { status: "CHECKED_IN", label: "Check-in" },
  { status: "COMPLETED", label: "Concluir" },
  { status: "NO_SHOW", label: "No-show" },
  { status: "CANCELLED", label: "Cancelar" },
  { status: "CONFIRMED", label: "Reabrir" },
];

function todayLocal(): string {
  return DateTime.now().setZone("America/Sao_Paulo").toISODate() ?? "";
}

export function AgendaBoard() {
  const [date, setDate] = useState(todayLocal);
  const [staffId, setStaffId] = useState("");
  const [staff, setStaff] = useState<StaffOpt[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ date });
      if (staffId) qs.set("staffId", staffId);
      const res = await fetch(`/api/app/agenda?${qs}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Erro ao carregar agenda");
        return;
      }
      setBookings(data.bookings ?? []);
      setStaff(data.staff ?? []);
      setTimezone(data.timezone ?? "America/Sao_Paulo");
    } catch {
      setError("Falha de rede ao carregar agenda");
    } finally {
      setLoading(false);
    }
  }, [date, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/app/bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Não foi possível atualizar");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
            Data
          </span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--lead)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
          />
        </label>
        <label className="flex-1 space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
            Profissional
          </span>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--lead)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
          >
            <option value="">Todos</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--steel)]">
          Carregando agenda…
        </p>
      ) : bookings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--steel)]">
          Nenhum agendamento neste dia.
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => {
            const start = DateTime.fromISO(b.startsAt, { zone: "utc" }).setZone(
              timezone,
            );
            const end = DateTime.fromISO(b.endsAt, { zone: "utc" }).setZone(
              timezone,
            );
            return (
              <li
                key={b.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--lead)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-[var(--copper)]">
                      {start.toFormat("HH:mm")}
                      <span className="text-base text-[var(--steel)]">
                        {" "}
                        – {end.toFormat("HH:mm")}
                      </span>
                    </p>
                    <p className="mt-1 text-base font-medium">
                      {b.customer.name}
                    </p>
                    <p className="text-sm text-[var(--steel)]">
                      {b.service.name} · {b.staff.displayName}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      STATUS_STYLE[b.status] ?? STATUS_STYLE.CONFIRMED,
                    )}
                  >
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {ACTIONS.filter((a) => a.status !== b.status).map((a) => (
                    <button
                      key={a.status}
                      type="button"
                      disabled={busyId === b.id}
                      onClick={() => void patchStatus(b.id, a.status)}
                      className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--offwhite)] enabled:active:scale-[0.98] disabled:opacity-50"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
