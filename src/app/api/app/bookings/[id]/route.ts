import { NextResponse } from "next/server";
import { z } from "zod";
import type { BookingStatus } from "@prisma/client";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const ALLOWED: BookingStatus[] = [
  "CANCELLED",
  "COMPLETED",
  "NO_SHOW",
  "CHECKED_IN",
  "CONFIRMED",
];

const bodySchema = z.object({
  status: z.enum([
    "CANCELLED",
    "COMPLETED",
    "NO_SHOW",
    "CHECKED_IN",
    "CONFIRMED",
  ]),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "INVALID_ID", message: "ID inválido" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Corpo inválido" },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !ALLOWED.includes(parsed.data.status)) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Status inválido" },
      { status: 422 },
    );
  }

  const booking = await prisma.booking.findFirst({
    where: { id, tenantId: auth.session.tenantId },
  });
  if (!booking) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Agendamento não encontrado" },
      { status: 404 },
    );
  }

  const status = parsed.data.status as BookingStatus;
  const data: {
    status: BookingStatus;
    cancelledAt?: Date | null;
    completedAt?: Date | null;
  } = { status };

  if (status === "CANCELLED") {
    data.cancelledAt = new Date();
  }
  if (status === "COMPLETED") {
    data.completedAt = new Date();
  }
  if (status === "CONFIRMED" || status === "CHECKED_IN") {
    data.cancelledAt = null;
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data,
    include: {
      customer: { select: { name: true, phoneE164: true } },
      service: { select: { name: true } },
      staff: { select: { displayName: true } },
    },
  });

  return NextResponse.json({
    booking: {
      id: updated.id,
      status: updated.status,
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
      customer: updated.customer,
      service: updated.service,
      staff: updated.staff,
    },
  });
}
