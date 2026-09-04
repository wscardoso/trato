"use client";

import { useMemo, useState } from "react";
import { customerFormSchema } from "@/lib/validations/booking";
import { formatCpf, formatPhoneBr } from "@/lib/formatters/br";
import { useBookingFlow } from "@/store/booking-flow";
import { cn } from "@/lib/utils";

type Props = {
  onContinue: () => void;
};

export function CustomerStep({ onContinue }: Props) {
  const { customer, setCustomer, setStep } = useBookingFlow();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const result = useMemo(
    () => customerFormSchema.safeParse(customer),
    [customer],
  );

  const fieldError = (key: keyof typeof customer): string | undefined => {
    if (!touched[key] || result.success) return undefined;
    const issue = result.error.issues.find((i) => i.path[0] === key);
    return issue?.message;
  };

  const handleContinue = () => {
    setTouched({ name: true, phone: true, email: true, cpf: true });
    if (!result.success) return;
    onContinue();
  };

  return (
    <section className="space-y-4" aria-labelledby="customer-heading">
      <div>
        <h2
          id="customer-heading"
          className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]"
        >
          Seus dados
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Usamos para confirmar via WhatsApp
        </p>
      </div>

      <div className="grid gap-3">
        <Field
          label="Nome completo"
          error={fieldError("name")}
          input={
            <input
              autoComplete="name"
              value={customer.name}
              onChange={(e) => setCustomer({ name: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              className={inputClass(!!fieldError("name"))}
              placeholder="João Silva"
            />
          }
        />

        <Field
          label="WhatsApp"
          error={fieldError("phone")}
          input={
            <input
              inputMode="tel"
              autoComplete="tel"
              value={customer.phone}
              onChange={(e) =>
                setCustomer({ phone: formatPhoneBr(e.target.value) })
              }
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              className={inputClass(!!fieldError("phone"))}
              placeholder="(33) 99999-9999"
            />
          }
        />

        <Field
          label="CPF"
          error={fieldError("cpf")}
          input={
            <input
              inputMode="numeric"
              autoComplete="off"
              value={customer.cpf}
              onChange={(e) =>
                setCustomer({ cpf: formatCpf(e.target.value) })
              }
              onBlur={() => setTouched((t) => ({ ...t, cpf: true }))}
              className={inputClass(!!fieldError("cpf"))}
              placeholder="000.000.000-00"
            />
          }
        />

        <Field
          label="E-mail (opcional)"
          error={fieldError("email")}
          input={
            <input
              type="email"
              autoComplete="email"
              value={customer.email}
              onChange={(e) => setCustomer({ email: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              className={inputClass(!!fieldError("email"))}
              placeholder="voce@email.com"
            />
          }
        />

        <Field
          label="Observações (opcional)"
          input={
            <textarea
              value={customer.notes}
              onChange={(e) => setCustomer({ notes: e.target.value })}
              rows={2}
              className={cn(inputClass(false), "resize-none py-2.5")}
              placeholder="Preferências, alergias…"
            />
          }
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => setStep("datetime")}
          className="min-h-11 flex-1 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)]"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="min-h-11 flex-[2] rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110"
        >
          Revisar
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  error,
  input,
}: {
  label: string;
  error?: string;
  input: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      {input}
      <span className="block min-h-[1rem] text-xs text-red-500">
        {error ?? ""}
      </span>
    </label>
  );
}

function inputClass(hasError: boolean): string {
  return cn(
    "w-full min-h-11 rounded-xl border bg-[var(--surface)] px-3 text-[var(--fg)] outline-none transition",
    "placeholder:text-[var(--muted)]/60 focus:ring-2 focus:ring-[var(--brand)]/40",
    hasError ? "border-red-500" : "border-[var(--border)]",
  );
}
