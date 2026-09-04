"use client";

import type { PublicTenantPayload } from "@/lib/booking/tenant";

type Props = {
  tenant: PublicTenantPayload;
};

export function TenantHeader({ tenant }: Props) {
  const brand = tenant.brandPrimary ?? "#E06535";

  return (
    <header
      className="relative overflow-hidden border-b border-[var(--border)]"
      style={{ ["--brand" as string]: brand }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 20% 0%, color-mix(in srgb, ${brand} 35%, transparent), transparent 70%)`,
        }}
      />
      <div className="relative mx-auto flex max-w-lg items-center gap-4 px-4 py-5 sm:px-6">
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-[var(--surface-2)] ring-2 ring-[var(--brand)]/40">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name}
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center font-[family-name:var(--font-display)] text-lg tracking-wide text-[var(--brand)]"
              aria-hidden
            >
              {tenant.name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[family-name:var(--font-display)] text-2xl leading-tight tracking-[0.04em] text-[var(--fg)]">
            {tenant.name}
          </h1>
          {tenant.address ? (
            <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
              {tenant.address}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
