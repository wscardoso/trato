"use client";

import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { formatPriceBRL } from "@/lib/formatters/br";
import { useBookingFlow } from "@/store/booking-flow";

type Props = {
  slug: string;
  timezone: string;
};

export function ConfirmStep({ slug, timezone }: Props) {
  const router = useRouter();
  const {
    service,
    staff,
    staffMode,
    slot,
    customer,
    submitting,
    submitError,
    setStep,
    setSubmitting,
    setSubmitError,
    reset,
  } = useBookingFlow();

  if (!service || !slot) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Dados incompletos.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => setStep("service")}
        >
          Recomeçar
        </button>
      </p>
    );
  }

  const whenLocal = DateTime.fromISO(slot.startsAt, { zone: "utc" })
    .setZone(timezone)
    .setLocale("pt-BR")
    .toFormat("ccc, dd LLL · HH:mm");

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const idempotencyKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          tenantSlug: slug,
          serviceId: service.id,
          staffId: staffMode === "specific" ? staff?.id : null,
          startsAt: slot.startsAt,
          notes: customer.notes || null,
          source: "public_web",
          customer: {
            name: customer.name,
            phone: customer.phone,
            email: customer.email || undefined,
            cpf: customer.cpf,
          },
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        booking?: { id: string };
      };

      if (!res.ok) {
        const map: Record<string, string> = {
          SLOT_UNAVAILABLE: "Esse horário acabou de ser reservado. Escolha outro.",
          SLOT_LOCKED: "Horário temporariamente bloqueado. Tente de novo.",
          VALIDATION_ERROR: "Confira seus dados e tente novamente.",
        };
        setSubmitError(
          map[data.error ?? ""] ?? "Não foi possível confirmar. Tente novamente.",
        );
        if (data.error === "SLOT_UNAVAILABLE" || data.error === "SLOT_LOCKED") {
          setStep("datetime");
        }
        return;
      }

      const bookingId = data.booking?.id ?? "";
      reset();
      router.push(
        `/agendar/${slug}/sucesso?bookingId=${encodeURIComponent(bookingId)}`,
      );
    } catch {
      setSubmitError("Falha de conexão. Verifique a internet e tente de novo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4" aria-labelledby="confirm-heading">
      <div>
        <h2
          id="confirm-heading"
          className="font-[family-name:var(--font-display)] text-xl tracking-wide text-[var(--fg)]"
        >
          Confirmar Trato
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Revise os detalhes antes de finalizar
        </p>
      </div>

      <dl className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <Row label="Serviço" value={service.name} />
        <Row
          label="Profissional"
          value={
            staffMode === "any"
              ? "Qualquer disponível"
              : (staff?.displayName ?? "—")
          }
        />
        <Row label="Quando" value={whenLocal} />
        <Row label="Valor" value={formatPriceBRL(service.priceCents)} />
        <Row label="Cliente" value={customer.name} />
        <Row label="WhatsApp" value={customer.phone} />
      </dl>

      {submitError ? (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
        >
          {submitError}
        </p>
      ) : null}

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={() => setStep("customer")}
          disabled={submitting}
          className="min-h-11 flex-1 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted)] disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={submitting}
          className="relative min-h-11 flex-[2] overflow-hidden rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition enabled:hover:brightness-110 disabled:opacity-70"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--brand-fg)]/30 border-t-[var(--brand-fg)]" />
              Confirmando…
            </span>
          ) : (
            "Confirmar Trato"
          )}
        </button>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3">
      <dt className="text-xs uppercase tracking-wider text-[var(--muted)]">
        {label}
      </dt>
      <dd className="text-right text-sm font-medium text-[var(--fg)]">
        {value}
      </dd>
    </div>
  );
}
