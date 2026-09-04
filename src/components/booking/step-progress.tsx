"use client";

import { stepIndex, type BookingStep } from "@/store/booking-flow";
import { cn } from "@/lib/utils";

const LABELS: Record<BookingStep, string> = {
  service: "Serviço",
  staff: "Profissional",
  datetime: "Horário",
  customer: "Dados",
  confirm: "Confirmar",
};

const ORDER: BookingStep[] = [
  "service",
  "staff",
  "datetime",
  "customer",
  "confirm",
];

type Props = {
  step: BookingStep;
};

export function StepProgress({ step }: Props) {
  const current = stepIndex(step);

  return (
    <nav aria-label="Progresso do agendamento" className="px-4 py-3 sm:px-6">
      <ol className="mx-auto flex max-w-lg items-center gap-1">
        {ORDER.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full transition-colors duration-300",
                  done || active ? "bg-[var(--brand)]" : "bg-[var(--surface-2)]",
                )}
              />
              <span
                className={cn(
                  "truncate text-[10px] font-medium uppercase tracking-wider sm:text-xs",
                  active
                    ? "text-[var(--fg)]"
                    : done
                      ? "text-[var(--brand)]"
                      : "text-[var(--muted)]",
                )}
              >
                {LABELS[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
