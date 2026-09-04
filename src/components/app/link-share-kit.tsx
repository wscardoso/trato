"use client";

import { useState } from "react";

type Props = {
  bookingUrl: string;
  tenantName: string;
};

export function LinkShareKit({ bookingUrl, tenantName }: Props) {
  const [copied, setCopied] = useState(false);
  const shareText = `Agende seu horário na ${tenantName}: ${bookingUrl}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--lead)] p-5">
        <p className="text-xs uppercase tracking-wider text-[var(--steel)]">
          URL de agendamento
        </p>
        <p className="mt-2 break-all text-sm text-[var(--offwhite)]">
          {bookingUrl}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void copy()}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[var(--copper)] text-sm font-semibold"
          >
            {copied ? "Copiado!" : "Copiar link"}
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm font-semibold"
          >
            Compartilhar no WhatsApp
          </a>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--lead)] p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt="QR Code do link de agendamento"
          width={200}
          height={200}
          className="rounded-xl bg-white p-2"
        />
        <p className="max-w-sm text-center text-sm text-[var(--steel)]">
          Use o QR no balcão ou imprima para cartões. Clientes abrem o
          agendamento direto no celular.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-[var(--border)] p-5">
        <h2 className="text-sm font-semibold text-[var(--offwhite)]">
          Dica — bio do Instagram
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[var(--steel)]">
          <li>Cole o link na bio e destaque &quot;Agende aqui&quot;.</li>
          <li>
            No Stories, use o sticker de link ou mostre o QR por alguns
            segundos.
          </li>
          <li>
            Padronize a mensagem: &quot;Marque pelo link — sem fila no
            WhatsApp.&quot;
          </li>
        </ul>
      </div>
    </div>
  );
}
