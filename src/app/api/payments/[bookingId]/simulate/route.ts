import { NextResponse } from "next/server";
import { markPaymentPaid } from "@/lib/payments/deposit";
import { enqueueBookingCreated } from "@/lib/whatsapp";
import { prisma } from "@/lib/prisma";
import { formatAddress } from "@/lib/formatters/br";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ bookingId: string }> };

/** Sandbox / dry-run confirmation when ASAAS_API_KEY is absent. */
export async function POST(_req: Request, ctx: Ctx) {
  const { bookingId } = await ctx.params;
  const allow =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_PIX_SIMULATE === "true" ||
    !process.env.ASAAS_API_KEY;

  if (!allow) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "Simulação desabilitada" },
      { status: 403 },
    );
  }

  const result = await markPaymentPaid({ bookingId });
  if (!result.ok || !result.bookingId) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Pagamento pendente não encontrado" },
      { status: 404 },
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: result.bookingId },
    include: {
      tenant: true,
      customer: true,
      staff: true,
      service: true,
    },
  });

  if (booking) {
    void enqueueBookingCreated({
      bookingId: booking.id,
      tenantId: booking.tenantId,
      tenantName: booking.tenant.name,
      tenantSlug: booking.tenant.slug,
      address: formatAddress(booking.tenant),
      timezone: booking.timezone,
      waInstanceId: booking.tenant.waInstanceId,
      waProvider: booking.tenant.waProvider ?? "uazapi",
      customerName: booking.customer.name,
      customerPhoneE164: `+${booking.customer.phoneE164.replace(/^\+/, "")}`,
      serviceName: booking.service.name,
      staffName: booking.staff.displayName,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      durationMin: booking.service.durationMin,
      priceCents: booking.priceCents,
      currency: booking.currency,
      status: booking.status,
    }).catch((err) => console.error("[whatsapp] after pix", err));
  }

  return NextResponse.json({ ok: true, bookingId: result.bookingId });
}
