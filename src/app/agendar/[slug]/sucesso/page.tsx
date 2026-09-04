import Link from "next/link";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bookingId?: string }>;
};

export const metadata: Metadata = {
  title: "Agendamento confirmado",
};

export default async function SucessoPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { bookingId } = await searchParams;

  return (
    <div className="booking-shell flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)] text-2xl text-[var(--success-fg)]"
          aria-hidden
        >
          ✓
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--fg)]">
          Trato Feito
        </h1>
        <p className="mt-3 text-[var(--muted)]">
          Horário confirmado. Enviamos a confirmação no seu WhatsApp.
        </p>
        {bookingId ? (
          <p className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-xs text-[var(--muted)]">
            Ref: {bookingId}
          </p>
        ) : null}
        <Link
          href={`/agendar/${slug}`}
          className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--border)] px-5 text-sm font-medium text-[var(--fg)]"
        >
          Novo agendamento
        </Link>
      </div>
    </div>
  );
}
