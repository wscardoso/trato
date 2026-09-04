"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPriceBRL } from "@/lib/formatters/br";

type Props = {
  slug: string;
  bookingId: string;
};

type PayState = {
  amountCents: number;
  pixQrCode: string | null;
  expiresAt: string;
  dryRun: boolean;
  status: string;
  priceCents: number;
  serviceName: string;
};

export function PixCheckout({ slug, bookingId }: Props) {
  const router = useRouter();
  const [data, setData] = useState<PayState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/payments/${bookingId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Pagamento não encontrado");
      return;
    }
    if (json.status === "CONFIRMED" || json.paymentStatus === "PAID") {
      router.replace(`/agendar/${slug}/sucesso?bookingId=${bookingId}`);
      return;
    }
    setData(json);
  }, [bookingId, router, slug]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  const copy = async () => {
    if (!data?.pixQrCode) return;
    await navigator.clipboard.writeText(data.pixQrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const simulatePay = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/payments/${bookingId}/simulate`, {
        method: "POST",
      });
      if (res.ok) {
        router.replace(`/agendar/${slug}/sucesso?bookingId=${bookingId}`);
      } else {
        const j = await res.json();
        setError(j.message ?? "Falha ao simular pagamento");
      }
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        <p>{error}</p>
        <Link href={`/agendar/${slug}`} className="underline">
          Voltar ao agendamento
        </Link>
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-[var(--steel)]">Gerando PIX…</p>;
  }

  const remaining = Math.max(0, data.priceCents - data.amountCents);

  return (
    <section className="space-y-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-[0.08em]">
          Pagar sinal PIX
        </h1>
        <p className="mt-1 text-sm text-[var(--steel)]">
          {data.serviceName} · sinal{" "}
          <strong className="text-[var(--offwhite)]">
            {formatPriceBRL(data.amountCents)}
          </strong>
          {remaining > 0 ? (
            <>
              {" "}
              · restante no local {formatPriceBRL(remaining)}
            </>
          ) : null}
        </p>
      </header>

      {data.pixQrCode ? (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--lead)] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data.pixQrCode)}`}
            alt="QR Code PIX"
            className="mx-auto rounded-lg bg-white p-2"
            width={220}
            height={220}
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="w-full rounded-lg bg-[var(--copper)] px-4 py-3 text-sm font-semibold text-[var(--offwhite)]"
          >
            {copied ? "Copiado!" : "Copiar código PIX"}
          </button>
          <p className="break-all rounded-lg bg-[var(--graphite)] p-3 font-mono text-[10px] text-[var(--steel)]">
            {data.pixQrCode}
          </p>
        </div>
      ) : null}

      <p className="text-xs text-[var(--steel)]">
        Após o pagamento, a confirmação é automática. Expira em{" "}
        {new Date(data.expiresAt).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        .
      </p>

      {data.dryRun ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void simulatePay()}
          className="w-full rounded-lg border border-[var(--signal)] px-4 py-3 text-sm text-[var(--signal)]"
        >
          {busy ? "Confirmando…" : "Simular pagamento (sandbox)"}
        </button>
      ) : null}
    </section>
  );
}
