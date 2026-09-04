import { prisma } from "@/lib/prisma";

export async function cancelDbBooking(bookingIdOrPrefix: string): Promise<{
  ok: boolean;
  bookingId?: string;
  phoneE164?: string;
  status?: string;
  message: string;
}> {
  const booking = await findBooking(bookingIdOrPrefix);
  if (!booking) {
    return { ok: false, message: "Agendamento não encontrado." };
  }
  if (booking.status === "CANCELLED") {
    return {
      ok: true,
      bookingId: booking.id,
      phoneE164: booking.customer.phoneE164,
      status: booking.status,
      message: "Este horário já estava cancelado.",
    };
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: "customer_whatsapp",
    },
    include: { customer: true },
  });

  return {
    ok: true,
    bookingId: updated.id,
    phoneE164: updated.customer.phoneE164,
    status: updated.status,
    message: "Horário cancelado. A vaga voltou para a agenda.",
  };
}

export async function confirmDbBooking(bookingIdOrPrefix: string): Promise<{
  ok: boolean;
  bookingId?: string;
  phoneE164?: string;
  status?: string;
  message: string;
}> {
  const booking = await findBooking(bookingIdOrPrefix);
  if (!booking) {
    return { ok: false, message: "Agendamento não encontrado." };
  }
  if (booking.status === "CANCELLED") {
    return {
      ok: false,
      bookingId: booking.id,
      phoneE164: booking.customer.phoneE164,
      status: booking.status,
      message: "Este horário já foi cancelado e não pode ser confirmado.",
    };
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CONFIRMED" },
    include: { customer: true },
  });

  return {
    ok: true,
    bookingId: updated.id,
    phoneE164: updated.customer.phoneE164,
    status: updated.status,
    message: "Trato confirmado! Te esperamos no horário marcado.",
  };
}

async function findBooking(bookingIdOrPrefix: string) {
  if (!bookingIdOrPrefix) return null;

  const exact = await prisma.booking.findUnique({
    where: { id: bookingIdOrPrefix },
    include: { customer: true },
  });
  if (exact) return exact;

  if (bookingIdOrPrefix.length < 8) return null;

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id::text AS id
    FROM bookings
    WHERE id::text LIKE ${`${bookingIdOrPrefix}%`}
    LIMIT 2
  `;
  if (rows.length !== 1) return null;

  return prisma.booking.findUnique({
    where: { id: rows[0].id },
    include: { customer: true },
  });
}
