import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // PENDING | PAID | FAILED

  const payments = await prisma.payment.findMany({
    where: {
      tenantId: auth.session.tenantId,
      ...(status ? { status: status as "PENDING" | "PAID" | "FAILED" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      booking: {
        include: {
          customer: { select: { name: true, phoneE164: true } },
          service: { select: { name: true } },
        },
      },
    },
  });

  return NextResponse.json({
    payments: payments.map((p) => ({
      id: p.id,
      status: p.status,
      amountCents: p.amountCents,
      provider: p.provider,
      createdAt: p.createdAt.toISOString(),
      paidAt: p.paidAt?.toISOString() ?? null,
      bookingId: p.bookingId,
      bookingStatus: p.booking.status,
      customerName: p.booking.customer.name,
      customerPhone: p.booking.customer.phoneE164,
      serviceName: p.booking.service.name,
      startsAt: p.booking.startsAt.toISOString(),
    })),
    generatedAt: DateTime.utc().toISO(),
  });
}
