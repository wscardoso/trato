"use client";

import type { PublicService } from "@/lib/booking/tenant";
import { formatPriceBRL } from "@/lib/formatters/br";
import { useBookingFlow } from "@/store/booking-flow";
import { cn } from "@/lib/utils";

type Props = {
  services: PublicService[];
};

export function ServiceStep({ services }: Props) {
  const { service, selectService } = useBookingFlow();

  return (
    <section className="space-y-4" aria-labelledby="service-heading">
      <div>
        <h2
          id="service-heading"
          className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]"
        >
          Escolha o serviço
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Selecione o que deseja agendar
        </p>
      </div>

      <ul className="grid gap-2" role="listbox" aria-label="Serviços">
        {services.map((s) => {
          const selected = service?.id === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => selectService(s)}
                className={cn(
                  "group flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200",
                  "min-h-[72px] active:scale-[0.99]",
                  selected
                    ? "border-[var(--brand)] bg-[var(--brand-soft)] shadow-[0_0_0_1px_var(--brand)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--brand)]/50",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-[var(--fg)]">
                    {s.name}
                  </p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {s.durationMin} min
                    {s.category ? ` · ${s.category}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-[var(--brand)]">
                  {formatPriceBRL(s.priceCents)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
