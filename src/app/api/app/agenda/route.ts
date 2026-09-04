import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");
  const staffId = searchParams.get("staffId");

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.session.tenantId },
    select: { timezone: true, slug: true, name: true },
  });
  if (!tenant) {
    return NextResponse.json(
      { error: "TENANT_NOT_FOUND", message: "Barbearia não encontrada" },
      { status: 404 },
    );
  }

  const tz = tenant.timezone || "America/Sao_Paulo";
  const dateLocal =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : (DateTime.now().setZone(tz).toISODate() ?? "");

  const start = DateTime.fromISO(dateLocal, { zone: tz }).startOf("day");
  const end = start.endOf("day");
  if (!start.isValid) {
    return NextResponse.json(
      { error: "INVALID_DATE", message: "Data inválida" },
      { status: 422 },
    );
  }

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: auth.session.tenantId,
      startsAt: { gte: start.toUTC().toJSDate(), lte: end.toUTC().toJSDate() },
      ...(staffId ? { staffId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phoneE164: true } },
      service: { select: { id: true, name: true, durationMin: true, priceCents: true } },
      staff: { select: { id: true, displayName: true, color: true } },
    },
    orderBy: { startsAt: "asc" },
  });

  const staff = await prisma.staff.findMany({
    where: { tenantId: auth.session.tenantId, status: "ACTIVE" },
    select: { id: true, displayName: true },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  return NextResponse.json({
    date: dateLocal,
    timezone: tz,
    tenant: { slug: tenant.slug, name: tenant.name },
    staff,
    bookings: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      customer: b.customer,
      service: b.service,
      staff: b.staff,
      priceCents: b.priceCents,
      source: b.source,
    })),
  });
}
