import Link from "next/link";

export default function AgendarNotFound() {
  return (
    <div className="booking-shell flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-[var(--fg)]">
        Barbearia não encontrada
      </h1>
      <p className="mt-3 max-w-sm text-[var(--muted)]">
        O link pode estar incorreto ou o estabelecimento está inativo.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-[var(--brand)] underline"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
