"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/formatters";
import type { SlotDTO } from "@/types/booking";

type Props = {
  slug: string;
  serviceId: string;
  staffId: string | null;
  timezone: string;
  maxAdvanceDays: number;
  selectedDate: string | null;
  selectedStartsAt: string | null;
  onDateChange: (date: string) => void;
  onSelect: (slot: SlotDTO) => void;
  brandPrimary: string;
};

export function SlotPicker({
  slug,
  serviceId,
  staffId,
  timezone,
  maxAdvanceDays,
  selectedDate,
  selectedStartsAt,
  onDateChange,
  onSelect,
  brandPrimary,
}: Props) {
  const [slots, setSlots] = useState<SlotDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const days = useMemo(() => {
    const start = DateTime.now().setZone(timezone).startOf("day");
    return Array.from({ length: Math.min(maxAdvanceDays, 21) }, (_, i) => {
      const d = start.plus({ days: i });
      return {
        iso: d.toISODate()!,
        weekday: d.setLocale("pt-BR").toFormat("ccc"),
        day: d.toFormat("dd"),
        month: d.setLocale("pt-BR").toFormat("LLL"),
        isToday: i === 0,
      };
    });
  }, [timezone, maxAdvanceDays]);

  const activeDate = selectedDate ?? days[0]?.iso ?? null;

  useEffect(() => {
    if (!activeDate) return;
    if (!selectedDate) onDateChange(activeDate);
  }, [activeDate, selectedDate, onDateChange]);

  useEffect(() => {
    if (!activeDate || !serviceId) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      slug,
      serviceId,
      date: activeDate,
    });
    if (staffId) params.set("staffId", staffId);

    fetch(`/api/slots?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Falha ao carregar horários");
        return res.json() as Promise<{ slots: SlotDTO[] }>;
      })
      .then((data) => {
        startTransition(() => {
          setSlots(data.slots);
          setLoading(false);
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Erro");
        setLoading(false);
      });

    return () => controller.abort();
  }, [slug, serviceId, staffId, activeDate]);

  return (
    <div className="space-y-5">
      <div
        className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="listbox"
        aria-label="Escolha a data"
      >
        {days.map((d) => {
          const active = d.iso === activeDate;
          return (
            <button
              key={d.iso}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onDateChange(d.iso)}
              className={cn(
                "flex h-[72px] w-[64px] shrink-0 flex-col items-center justify-center rounded-2xl border text-center transition-colors",
                active
                  ? "border-transparent text-[var(--brand-fg)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--brand)]/40",
              )}
              style={
                active
                  ? { backgroundColor: brandPrimary }
                  : undefined
              }
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                {d.weekday}
              </span>
              <span className="text-lg font-bold leading-none">{d.day}</span>
              <span className="text-[10px] uppercase opacity-80">{d.month}</span>
            </button>
          );
        })}
      </div>

      <div
        className="min-h-[160px]"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-11 animate-pulse rounded-xl bg-[var(--surface-2)]"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {!loading && !error && slots.length === 0 && (
          <p className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            Sem horários neste dia. Escolha outra data.
          </p>
        )}

        {!loading && !error && slots.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const selected = slot.startsAt === selectedStartsAt;
              return (
                <button
                  key={slot.startsAt}
                  type="button"
                  onClick={() => onSelect(slot)}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-semibold tabular-nums transition-transform active:scale-[0.98]",
                    selected
                      ? "border-transparent text-[var(--brand-fg)]"
                      : "border-[var(--line)] bg-[var(--surface)] text-[var(--fg)] hover:border-[var(--brand)]/50",
                  )}
                  style={
                    selected
                      ? { backgroundColor: brandPrimary }
                      : undefined
                  }
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
