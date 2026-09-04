"use client";

import { FormEvent, useState } from "react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { normalizePhoneE164 } from "@/lib/validations";

type Props = {
  tenantSlug: string;
  timezone: string;
  services: Array<{ id: string; name: string; durationMin: number }>;
  staff: Array<{ id: string; displayName: string }>;
};

export function ManualBookingForm({
  tenantSlug,
  timezone,
  services,
  staff,
}: Props) {
  const router = useRouter();
  const today = DateTime.now().setZone(timezone).toISODate() ?? "";
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("10:00");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const local = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
      if (!local.isValid) {
        setError("Data ou horário inválidos");
        return;
      }
      const startsAt = local.toUTC().toISO();
      if (!startsAt) {
        setError("Horário inválido");
        return;
      }

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          tenantSlug,
          serviceId,
          staffId,
          startsAt,
          source: "owner_admin",
          customer: {
            name,
            phone: normalizePhoneE164(phone),
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Não foi possível criar o agendamento");
        return;
      }
      router.push(`/app/agenda?date=${date}`);
      router.refresh();
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--lead)] p-4 sm:p-6"
    >
      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
          Serviço
        </span>
        <select
          required
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--graphite)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMin} min)
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
          Profissional
        </span>
        <select
          required
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--graphite)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
        >
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
            Data
          </span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--graphite)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
            Horário
          </span>
          <input
            type="time"
            required
            step={900}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--graphite)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
          Nome do cliente
        </span>
        <input
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--graphite)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs uppercase tracking-wider text-[var(--steel)]">
          WhatsApp
        </span>
        <input
          required
          inputMode="tel"
          placeholder="(33) 99999-0000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--graphite)] px-3 text-base outline-none ring-[var(--copper)] focus:ring-2"
        />
      </label>

      {error ? (
        <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !serviceId || !staffId}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--copper)] text-sm font-semibold tracking-wide disabled:opacity-50"
      >
        {loading ? "Salvando…" : "Confirmar agendamento"}
      </button>
    </form>
  );
}
