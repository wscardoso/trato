import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createDepositForBooking,
  depositTimeoutMs,
} from "@/lib/payments/deposit";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ bookingId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { bookingId } = await ctx.params;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { service: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!booking) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Agendamento não encontrado" },
      { status: 404 },
    );
  }

  if (booking.status === "CONFIRMED" || booking.paymentStatus === "PAID") {
    return NextResponse.json({
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    });
  }

  if (booking.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: "INVALID_STATUS", message: "Este horário não aguarda PIX" },
      { status: 409 },
    );
  }

  let deposit = null;
  try {
    deposit = await createDepositForBooking(bookingId);
  } catch (err) {
    console.error("[GET payment]", err);
    return NextResponse.json(
      { error: "PAYMENT_FAILED", message: "Não foi possível gerar o PIX" },
      { status: 502 },
    );
  }

  return NextResponse.json({
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    priceCents: booking.priceCents,
    serviceName: booking.service.name,
    amountCents: deposit?.amountCents ?? 0,
    pixQrCode: deposit?.pixQrCode ?? null,
    expiresAt:
      deposit?.expiresAt ??
      new Date(booking.createdAt.getTime() + depositTimeoutMs()).toISOString(),
    dryRun: deposit?.dryRun ?? true,
  });
}
