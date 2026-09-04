import { ReportsBoard } from "@/components/app/reports-board";

export default function RelatoriosPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
          Relatórios
        </h1>
        <p className="mt-1 text-sm text-[var(--steel)]">
          Volume, faturamento, ocupação e faltas — de relance.
        </p>
      </header>
      <ReportsBoard />
    </div>
  );
}
