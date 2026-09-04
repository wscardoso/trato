import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  const customers = await prisma.customer.findMany({
    where: {
      tenantId: auth.session.tenantId,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phoneE164: { contains: q.replace(/\D/g, "") } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      bookings: {
        orderBy: { startsAt: "desc" },
        take: 1,
        select: {
          id: true,
          startsAt: true,
          status: true,
          service: { select: { name: true } },
        },
      },
      _count: { select: { bookings: true } },
    },
  });

  return NextResponse.json({
    customers: customers.map((c) => ({
      id: c.id,
      name: c.name,
      phoneE164: c.phoneE164,
      email: c.email,
      notes: c.notes,
      marketingOptIn: c.marketingOptIn,
      visits: c._count.bookings,
      lastBooking: c.bookings[0]
        ? {
            id: c.bookings[0].id,
            startsAt: c.bookings[0].startsAt.toISOString(),
            status: c.bookings[0].status,
            serviceName: c.bookings[0].service.name,
          }
        : null,
    })),
  });
}
