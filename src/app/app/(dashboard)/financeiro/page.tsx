import { FinanceBoard } from "@/components/app/finance-board";

export default function FinanceiroPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
          Financeiro
        </h1>
        <p className="mt-1 text-sm text-[var(--steel)]">
          Sinais PIX pendentes, pagos e expirados.
        </p>
      </header>
      <FinanceBoard />
    </div>
  );
}
