"use client";

import type { PublicStaff, PublicService } from "@/lib/booking/tenant";
import { useBookingFlow } from "@/store/booking-flow";
import { cn } from "@/lib/utils";

type Props = {
  staff: PublicStaff[];
  service: PublicService;
  onContinue: () => void;
};

export function StaffStep({ staff, service, onContinue }: Props) {
  const { staffMode, staff: selected, selectStaff, selectStaffMode, setStep } =
    useBookingFlow();

  const eligible = staff.filter((s) => s.serviceIds.includes(service.id));

  return (
    <section className="space-y-4" aria-labelledby="staff-heading">
      <div>
        <h2
          id="staff-heading"
          className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]"
        >
          Profissional
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Qualquer disponível ou escolha alguém
        </p>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => {
            selectStaffMode("any");
            selectStaff(null);
          }}
          className={cn(
            "flex min-h-[64px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.99]",
            staffMode === "any"
              ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-[0_0_0_1px_var(--brand)]"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]/50",
          )}
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-lg"
            aria-hidden
          >
            ✦
          </span>
          <div>
            <p className="font-medium text-[var(--fg)]">Qualquer disponível</p>
            <p className="text-sm text-[var(--muted)]">
              Primeiro horário livre entre a equipe
            </p>
          </div>
        </button>

        {eligible.map((s) => {
          const isSelected = staffMode === "specific" && selected?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                selectStaffMode("specific");
                selectStaff(s);
              }}
              className={cn(
                "flex min-h-[64px] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200 active:scale-[0.99]",
                isSelected
                  ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-[0_0_0_1px_var(--brand)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]/50",
              )}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-[var(--bg)]"
                style={{ background: s.color ?? "var(--brand)" }}
                aria-hidden
              >
                {s.displayName.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-[var(--fg)]">
                  {s.displayName}
                </p>
                {s.bio ? (
                  <p className="truncate text-sm text-[var(--muted)]">{s.bio}</p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => setStep("service")}
          className="min-h-11 flex-1 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={onContinue}
          disabled={staffMode === "specific" && !selected}
          className="min-h-11 flex-[2] rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition enabled:hover:brightness-110 disabled:opacity-40"
        >
          Continuar
        </button>
      </div>
    </section>
  );
}
