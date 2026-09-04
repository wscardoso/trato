import Link from "next/link";
import { TratoMark } from "@/components/brand/trato-mark";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=2400&q=80";

export default function Home() {
  return (
    <div className="bg-[var(--graphite)] text-[var(--offwhite)]">
      <section className="relative flex min-h-dvh flex-col overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(18,20,23,0.55) 0%, rgba(18,20,23,0.78) 45%, rgba(18,20,23,0.96) 100%)",
          }}
          aria-hidden
        />

        <header className="trato-mark-in relative z-10 flex items-center gap-3 px-6 pt-8 sm:px-10">
          <TratoMark className="h-8 w-8 text-[var(--copper)]" />
          <span className="font-[family-name:var(--font-display)] text-xl tracking-[0.28em] text-[var(--offwhite)]">
            TRATO
          </span>
        </header>

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 pb-24 pt-16 text-center">
          <h1 className="trato-mark-in font-[family-name:var(--font-display)] text-[clamp(4.5rem,18vw,9rem)] leading-none tracking-[0.2em] text-[var(--offwhite)]">
            TRATO
          </h1>
          <p className="trato-copy-in mt-6 max-w-md text-lg leading-relaxed text-[var(--steel)] sm:text-xl">
            Dar um trato no visual. Manter o horário.
          </p>
          <Link
            href="/agendar/dom-carlos-barbearia"
            className="trato-cta-in mt-10 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--copper)] px-8 text-sm font-semibold tracking-wide text-[var(--offwhite)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Agendar demo
          </Link>
        </div>

        <p className="relative z-10 px-6 pb-6 text-center text-[11px] tracking-wide text-[var(--steel)]">
          tratobarber.digitallforcelabs.cloud
        </p>
      </section>

      <section className="border-t border-[color-mix(in_srgb,var(--steel)_28%,transparent)] bg-[var(--lead)] px-6 py-20 sm:px-10">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-4xl tracking-[0.12em] text-[var(--copper)] sm:text-5xl">
            O TRATO É SIMPLES
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[var(--steel)]">
            O cliente marca. A casa cumpre. Agendamento online com WhatsApp,
            horários reais e zero confusão de agenda.
          </p>
          <Link
            href="/agendar/dom-carlos-barbearia"
            className="mt-8 inline-flex text-sm font-medium text-[var(--copper)] underline-offset-4 hover:underline"
          >
            Ver fluxo de agendamento →
          </Link>
        </div>
      </section>

      <footer className="border-t border-[color-mix(in_srgb,var(--steel)_22%,transparent)] bg-[var(--graphite)] px-6 py-8 text-center text-xs text-[var(--steel)]">
        Trato · Digitall Force Labs
      </footer>
    </div>
  );
}
