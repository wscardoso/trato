"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { DateTime } from "luxon";
import { useBookingFlow, type SelectedSlot } from "@/store/booking-flow";
import { cn } from "@/lib/utils";

type SlotDto = {
  startsAt: string;
  endsAt: string;
  label: string;
};

type SlotsResponse = {
  timezone: string;
  slots: SlotDto[];
  error?: string;
};

type Props = {
  slug: string;
  timezone: string;
  maxAdvanceDays: number;
  onContinue: () => void;
};

function buildDateStrip(
  timezone: string,
  maxAdvanceDays: number,
): Array<{ iso: string; label: string; weekday: string }> {
  const start = DateTime.now().setZone(timezone).startOf("day");
  const days: Array<{ iso: string; label: string; weekday: string }> = [];
  const limit = Math.min(maxAdvanceDays, 21);
  for (let i = 0; i < limit; i += 1) {
    const d = start.plus({ days: i });
    const iso = d.toISODate();
    if (!iso) continue;
    days.push({
      iso,
      label: d.toFormat("dd"),
      weekday: d.setLocale("pt-BR").toFormat("ccc"),
    });
  }
  return days;
}

export function SlotPicker({
  slug,
  timezone,
  maxAdvanceDays,
  onContinue,
}: Props) {
  const {
    service,
    staff,
    staffMode,
    dateLocal,
    slot,
    selectDate,
    selectSlot,
    setStep,
  } = useBookingFlow();

  const dates = useMemo(
    () => buildDateStrip(timezone, maxAdvanceDays),
    [timezone, maxAdvanceDays],
  );

  const [slots, setSlots] = useState<SlotDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Default to today
  useEffect(() => {
    if (!dateLocal && dates[0]) {
      selectDate(dates[0].iso);
    }
  }, [dateLocal, dates, selectDate]);

  const fetchSlots = useCallback(async () => {
    if (!service || !dateLocal) return;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      slug,
      serviceId: service.id,
      date: dateLocal,
    });
    if (staffMode === "specific" && staff) {
      params.set("staffId", staff.id);
    }

    try {
      const res = await fetch(`/api/slots?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as SlotsResponse;
      if (!res.ok) {
        setSlots([]);
        setError(data.error ?? "Não foi possível carregar horários");
        return;
      }
      startTransition(() => {
        setSlots(data.slots);
        // Clear selection if slot no longer available
        if (slot && !data.slots.some((s) => s.startsAt === slot.startsAt)) {
          selectSlot(null);
        }
      });
    } catch {
      setError("Falha de conexão. Tente novamente.");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [
    service,
    dateLocal,
    slug,
    staffMode,
    staff,
    slot,
    selectSlot,
  ]);

  useEffect(() => {
    void fetchSlots();
    // Soft poll for real-time booked slot disable
    const id = window.setInterval(() => {
      void fetchSlots();
    }, 20000);
    return () => window.clearInterval(id);
  }, [fetchSlots]);

  const onPickSlot = (s: SlotDto) => {
    if (!dateLocal) return;
    const next: SelectedSlot = {
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      label: s.label,
      dateLocal,
    };
    selectSlot(next);
  };

  return (
    <section className="space-y-4" aria-labelledby="slot-heading">
      <div>
        <h2
          id="slot-heading"
          className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]"
        >
          Data e horário
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Horários em tempo real · {timezone.replace("_", " ")}
        </p>
      </div>

      {/* Date strip — fixed height to avoid CLS */}
      <div className="-mx-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-h-[72px] gap-2 px-1">
          {dates.map((d) => {
            const active = d.iso === dateLocal;
            return (
              <button
                key={d.iso}
                type="button"
                onClick={() => selectDate(d.iso)}
                className={cn(
                  "flex h-[72px] w-14 shrink-0 flex-col items-center justify-center rounded-xl border transition-colors duration-200",
                  active
                    ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)]",
                )}
              >
                <span className="text-[10px] uppercase tracking-wider opacity-80">
                  {d.weekday}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {d.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Slot grid — reserved min-height for CLS */}
      <div className="relative min-h-[180px]">
        {(loading || isPending) && slots.length === 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-busy>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-lg bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-4 text-center">
            <p className="text-sm text-[var(--muted)]">{error}</p>
            <button
              type="button"
              onClick={() => void fetchSlots()}
              className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-sm font-medium"
            >
              Tentar de novo
            </button>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[var(--border)] px-4 text-center text-sm text-[var(--muted)]">
            Sem horários neste dia. Escolha outra data.
          </div>
        ) : (
          <div
            className="grid grid-cols-3 gap-2 sm:grid-cols-4"
            role="listbox"
            aria-label="Horários disponíveis"
          >
            {slots.map((s) => {
              const selected = slot?.startsAt === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onPickSlot(s)}
                  className={cn(
                    "h-11 rounded-lg border text-sm font-semibold tabular-nums transition-all duration-150 active:scale-[0.97]",
                    selected
                      ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]"
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:border-[var(--brand)]/60",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {loading && slots.length > 0 ? (
          <div className="absolute right-0 top-0 h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand)]" />
        ) : null}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => setStep("staff")}
          className="min-h-11 flex-1 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={!slot}
          className="min-h-11 flex-[2] rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
