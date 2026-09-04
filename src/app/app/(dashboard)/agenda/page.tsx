import { AgendaBoard } from "@/components/app/agenda-board";

export default function AgendaPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em] text-[var(--offwhite)]">
          Agenda do dia
        </h1>
        <p className="mt-1 text-sm text-[var(--steel)]">
          Confira horários, faça check-in e atualize status.
        </p>
      </header>
      <AgendaBoard />
    </div>
  );
}
