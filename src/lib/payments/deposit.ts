import { prisma } from "@/lib/prisma";

export function depositTimeoutMs(): number {
  const min = Number(process.env.DEPOSIT_TIMEOUT_MIN ?? "30");
  return Math.max(5, Number.isFinite(min) ? min : 30) * 60_000;
}

export function computeDepositCents(opts: {
  priceCents: number;
  depositPercent: number | null | undefined;
  depositFixedCents: number | null | undefined;
}): number {
  if (opts.depositFixedCents != null && opts.depositFixedCents > 0) {
    return Math.min(opts.depositFixedCents, opts.priceCents);
  }
  const pct = opts.depositPercent ?? 30;
  return Math.max(100, Math.round((opts.priceCents * pct) / 100));
}

type AsaasPixResult = {
  providerRef: string;
  pixQrCode: string;
  checkoutUrl: string | null;
  raw: unknown;
  dryRun: boolean;
};

export async function createAsaasPixCharge(input: {
  apiKey: string | null | undefined;
  amountCents: number;
  description: string;
  customerName: string;
  customerPhone: string;
  externalRef: string;
}): Promise<AsaasPixResult> {
  const apiKey =
    input.apiKey ||
    process.env.ASAAS_API_KEY ||
    process.env.ASAAS_API_TOKEN ||
    null;
  const base = (
    process.env.ASAAS_BASE_URL ?? "https://sandbox.asaas.com/api/v3"
  ).replace(/\/$/, "");

  if (!apiKey) {
    const fakePayload = `00020126580014br.gov.bcb.pix0136trato-demo-${input.externalRef.slice(0, 8)}520400005303986540${(input.amountCents / 100).toFixed(2)}5802BR5913TRATO DEMO6009SAO PAULO62070503***6304ABCD`;
    return {
      providerRef: `dry_${input.externalRef}`,
      pixQrCode: fakePayload,
      checkoutUrl: null,
      raw: { dryRun: true, amountCents: input.amountCents },
      dryRun: true,
    };
  }

  const customerRes = await fetch(`${base}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      name: input.customerName,
      mobilePhone: input.customerPhone.replace(/\D/g, "").slice(-11),
      externalReference: input.externalRef,
    }),
  });
  if (!customerRes.ok) {
    const errText = await customerRes.text();
    throw new Error(`ASAAS_CUSTOMER_${customerRes.status}: ${errText.slice(0, 300)}`);
  }
  const customerJson = (await customerRes.json()) as { id?: string };
  const customerId = customerJson.id;
  if (!customerId) throw new Error("ASAAS_CUSTOMER_MISSING_ID");

  const payRes = await fetch(`${base}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value: input.amountCents / 100,
      description: input.description,
      externalReference: input.externalRef,
    }),
  });
  if (!payRes.ok) {
    const errText = await payRes.text();
    throw new Error(`ASAAS_PAYMENT_${payRes.status}: ${errText.slice(0, 300)}`);
  }
  const payJson = (await payRes.json()) as {
    id?: string;
    invoiceUrl?: string;
  };
  const paymentId = payJson.id;
  if (!paymentId) throw new Error("ASAAS_PAYMENT_MISSING_ID");

  const qrRes = await fetch(`${base}/payments/${paymentId}/pixQrCode`, {
    headers: { access_token: apiKey },
  });
  let pixQrCode = "";
  if (qrRes.ok) {
    const qrJson = (await qrRes.json()) as { payload?: string; encodedImage?: string };
    pixQrCode = qrJson.payload ?? "";
  }

  return {
    providerRef: paymentId,
    pixQrCode: pixQrCode || `PIX:${paymentId}`,
    checkoutUrl: payJson.invoiceUrl ?? null,
    raw: { payment: payJson },
    dryRun: false,
  };
}

export async function createDepositForBooking(bookingId: string): Promise<{
  paymentId: string;
  amountCents: number;
  pixQrCode: string | null;
  checkoutUrl: string | null;
  expiresAt: string;
  dryRun: boolean;
} | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      tenant: true,
      customer: true,
      service: true,
    },
  });
  if (!booking) return null;
  if (booking.status !== "PENDING_PAYMENT") return null;

  const existing = await prisma.payment.findFirst({
    where: { bookingId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.pixQrCode) {
    return {
      paymentId: existing.id,
      amountCents: existing.amountCents,
      pixQrCode: existing.pixQrCode,
      checkoutUrl: existing.checkoutUrl,
      expiresAt: new Date(
        existing.createdAt.getTime() + depositTimeoutMs(),
      ).toISOString(),
      dryRun: String(existing.providerRef ?? "").startsWith("dry_"),
    };
  }

  const amountCents = computeDepositCents({
    priceCents: booking.priceCents,
    depositPercent: booking.tenant.depositPercent,
    depositFixedCents: booking.tenant.depositFixedCents,
  });

  const charge = await createAsaasPixCharge({
    apiKey: booking.tenant.asaasApiKeyEnc,
    amountCents,
    description: `Sinal · ${booking.service.name} · ${booking.tenant.name}`,
    customerName: booking.customer.name,
    customerPhone: booking.customer.phoneE164,
    externalRef: booking.id,
  });

  const payment = await prisma.payment.create({
    data: {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      provider: charge.dryRun ? "PIX_MANUAL" : "ASAAS",
      providerRef: charge.providerRef,
      amountCents,
      currency: booking.currency,
      status: "PENDING",
      checkoutUrl: charge.checkoutUrl,
      pixQrCode: charge.pixQrCode,
      rawPayload: charge.raw as object,
    },
  });

  return {
    paymentId: payment.id,
    amountCents: payment.amountCents,
    pixQrCode: payment.pixQrCode,
    checkoutUrl: payment.checkoutUrl,
    expiresAt: new Date(
      payment.createdAt.getTime() + depositTimeoutMs(),
    ).toISOString(),
    dryRun: charge.dryRun,
  };
}

export async function markPaymentPaid(opts: {
  providerRef?: string | null;
  paymentId?: string | null;
  bookingId?: string | null;
}): Promise<{ ok: boolean; bookingId?: string }> {
  let payment = null;
  if (opts.paymentId) {
    payment = await prisma.payment.findUnique({ where: { id: opts.paymentId } });
  } else if (opts.providerRef) {
    payment = await prisma.payment.findFirst({
      where: { providerRef: opts.providerRef },
      orderBy: { createdAt: "desc" },
    });
  } else if (opts.bookingId) {
    payment = await prisma.payment.findFirst({
      where: { bookingId: opts.bookingId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!payment) return { ok: false };

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", paidAt: new Date() },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { status: "CONFIRMED", paymentStatus: "PAID" },
    }),
  ]);

  return { ok: true, bookingId: payment.bookingId };
}

export async function expireStaleDeposits(limit = 50): Promise<number> {
  const cutoff = new Date(Date.now() - depositTimeoutMs());
  const stale = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lte: cutoff },
    },
    take: limit,
    select: { id: true },
  });

  for (const b of stale) {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: b.id },
        data: { status: "EXPIRED", paymentStatus: "FAILED" },
      }),
      prisma.payment.updateMany({
        where: { bookingId: b.id, status: "PENDING" },
        data: { status: "FAILED" },
      }),
    ]);
  }
  return stale.length;
}
