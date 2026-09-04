"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { PublicTenantPayload } from "@/lib/booking/tenant";
import { TenantHeader } from "@/components/booking/tenant-header";
import { StepProgress } from "@/components/booking/step-progress";
import { ServiceStep } from "@/components/booking/service-step";
import { StaffStep } from "@/components/booking/staff-step";
import { SlotPicker } from "@/components/booking/slot-picker";
import { CustomerStep } from "@/components/booking/customer-step";
import { ConfirmStep } from "@/components/booking/confirm-step";
import { useBookingFlow } from "@/store/booking-flow";

type Props = {
  tenant: PublicTenantPayload;
};

export function BookingWizard({ tenant }: Props) {
  const { step, service, setStep, hydrateTenant } = useBookingFlow();
  const [ready, setReady] = useState(false);
  const brand = tenant.brandPrimary ?? "#E06535";

  useEffect(() => {
    const apply = () => {
      hydrateTenant(tenant.slug);
      setReady(true);
    };

    if (useBookingFlow.persist.hasHydrated()) {
      apply();
      return;
    }

    return useBookingFlow.persist.onFinishHydration(apply);
  }, [tenant.slug, hydrateTenant]);

  return (
    <div
      className="booking-shell min-h-dvh"
      style={
        {
          ["--brand"]: brand,
          ["--brand-soft"]: `color-mix(in srgb, ${brand} 18%, transparent)`,
          ["--brand-fg"]: "#F4F5F6",
        } as CSSProperties
      }
    >
      <TenantHeader tenant={tenant} />
      <StepProgress step={step} />

      <main className="mx-auto max-w-lg px-4 pb-24 pt-2 sm:px-6">
        {!ready ? (
          <div className="space-y-3" aria-busy>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-xl bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : null}

        {ready && step === "service" ? (
          <ServiceStep services={tenant.services} />
        ) : null}

        {ready && step === "staff" && service ? (
          <StaffStep
            staff={tenant.staff}
            service={service}
            onContinue={() => setStep("datetime")}
          />
        ) : null}

        {ready && step === "datetime" && service ? (
          <SlotPicker
            slug={tenant.slug}
            timezone={tenant.timezone}
            maxAdvanceDays={tenant.maxAdvanceDays}
            onContinue={() => setStep("customer")}
          />
        ) : null}

        {ready && step === "customer" ? (
          <CustomerStep onContinue={() => setStep("confirm")} />
        ) : null}

        {ready && step === "confirm" ? (
          <ConfirmStep slug={tenant.slug} timezone={tenant.timezone} />
        ) : null}
      </main>

      <footer className="mx-auto flex max-w-lg items-center justify-center gap-1.5 px-4 pb-8 text-xs text-[var(--muted)]">
        <span>Agendado com</span>
        <span className="font-[family-name:var(--font-display)] tracking-[0.14em] text-[var(--fg)]">
          TRATO
        </span>
      </footer>
    </div>
  );
}
