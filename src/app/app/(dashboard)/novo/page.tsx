import { ManualBookingForm } from "@/components/app/manual-booking-form";
import { requireOwnerSession } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";

export default async function NovoPage() {
  const session = await requireOwnerSession();
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.tenantId },
    select: {
      slug: true,
      timezone: true,
      services: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, durationMin: true },
      },
      staff: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
        select: { id: true, displayName: true },
      },
    },
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
          Novo agendamento
        </h1>
        <p className="mt-1 text-sm text-[var(--steel)]">
          Lance um horário manualmente pela recepção.
        </p>
      </header>
      <ManualBookingForm
        tenantSlug={tenant.slug}
        timezone={tenant.timezone}
        services={tenant.services}
        staff={tenant.staff}
      />
    </div>
  );
}
