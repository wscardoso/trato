import Link from "next/link";
import { requireOwnerSession } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app/app-nav";
import { LogoutButton } from "@/components/app/logout-button";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOwnerSession();
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { name: true },
  });

  return (
    <div className="min-h-dvh bg-[var(--graphite)] text-[var(--offwhite)]">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 70% 35% at 50% -8%, color-mix(in srgb, var(--copper) 16%, transparent), transparent 50%), linear-gradient(180deg, var(--graphite), color-mix(in srgb, var(--lead) 55%, var(--graphite)))",
        }}
        aria-hidden
      />

      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--graphite)_88%,transparent)] px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/app/agenda"
              className="font-[family-name:var(--font-display)] text-xl tracking-[0.18em] text-[var(--copper)]"
            >
              TRATO
            </Link>
            <p className="truncate text-xs text-[var(--steel)]">
              {tenant?.name ?? "Painel"}
            </p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-0 pb-24 md:gap-8 md:px-6 md:pb-8 md:pt-6">
        <aside className="hidden w-52 shrink-0 md:block">
          <AppNav variant="side" />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 md:px-0 md:py-0">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--lead)_94%,transparent)] backdrop-blur-md md:hidden">
        <AppNav variant="bottom" />
      </nav>
    </div>
  );
}
