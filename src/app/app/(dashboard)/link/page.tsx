import { LinkShareKit } from "@/components/app/link-share-kit";
import { requireOwnerSession } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";

export default async function LinkPage() {
  const session = await requireOwnerSession();
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: session.tenantId },
    select: { slug: true, name: true },
  });

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const bookingUrl = `${base}/agendar/${tenant.slug}`;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
          Link & marca
        </h1>
        <p className="mt-1 text-sm text-[var(--steel)]">
          Compartilhe o link de agendamento da {tenant.name}.
        </p>
      </header>
      <LinkShareKit bookingUrl={bookingUrl} tenantName={tenant.name} />
    </div>
  );
}
