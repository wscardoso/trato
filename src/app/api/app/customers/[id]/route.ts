import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: auth.session.tenantId },
    include: {
      bookings: {
        orderBy: { startsAt: "desc" },
        take: 30,
        include: {
          service: { select: { name: true, priceCents: true } },
          staff: { select: { displayName: true } },
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      phoneE164: customer.phoneE164,
      email: customer.email,
      notes: customer.notes,
      marketingOptIn: customer.marketingOptIn,
      bookings: customer.bookings.map((b) => ({
        id: b.id,
        startsAt: b.startsAt.toISOString(),
        status: b.status,
        paymentStatus: b.paymentStatus,
        priceCents: b.priceCents,
        serviceName: b.service.name,
        staffName: b.staff.displayName,
      })),
    },
  });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const body = (await request.json()) as { notes?: string };

  const updated = await prisma.customer.updateMany({
    where: { id, tenantId: auth.session.tenantId },
    data: { notes: body.notes ?? undefined },
  });
  if (!updated.count) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
