import { CustomersBoard } from "@/components/app/customers-board";

export default function ClientesPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
          Clientes
        </h1>
        <p className="mt-1 text-sm text-[var(--steel)]">
          Busque por nome ou WhatsApp, veja histórico e anote preferências.
        </p>
      </header>
      <CustomersBoard />
    </div>
  );
}
