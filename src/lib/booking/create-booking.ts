import { randomUUID } from "crypto";
import { DateTime } from "luxon";
import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { acquireLock, releaseLock } from "@/lib/redis";
import { computeBlockWindow } from "@/lib/slots/compute-available-slots";
import type { CreateBookingInput } from "@/lib/validations/booking";
import { pickStaffForSlot, resolveSlots } from "@/lib/booking/slots";
import { formatAddress } from "@/lib/formatters/br";
import { enqueueBookingCreated } from "@/lib/whatsapp";

export class BookingError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "BookingError";
  }
}

export type CreateBookingResult = {
  booking: {
    id: string;
    status: BookingStatus;
    startsAt: string;
    endsAt: string;
    priceCents: number;
    currency: string;
    paymentStatus: PaymentStatus;
    staffId: string;
    serviceId: string;
    timezone: string;
  };
  customer: {
    id: string;
    name: string;
    phoneE164: string;
  };
};

export async function createBooking(
  input: CreateBookingInput,
  idempotencyKey?: string | null,
): Promise<CreateBookingResult> {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug, isActive: true },
  });
  if (!tenant) throw new BookingError("TENANT_NOT_FOUND", 404);

  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
      include: { customer: true },
    });
    if (existing && existing.tenantId === tenant.id) {
      return {
        booking: {
          id: existing.id,
          status: existing.status,
          startsAt: existing.startsAt.toISOString(),
          endsAt: existing.endsAt.toISOString(),
          priceCents: existing.priceCents,
          currency: existing.currency,
          paymentStatus: existing.paymentStatus,
          staffId: existing.staffId,
          serviceId: existing.serviceId,
          timezone: existing.timezone,
        },
        customer: {
          id: existing.customer.id,
          name: existing.customer.name,
          phoneE164: existing.customer.phoneE164,
        },
      };
    }
  }

  const service = await prisma.service.findFirst({
    where: {
      id: input.serviceId,
      tenantId: tenant.id,
      isActive: true,
    },
  });
  if (!service) throw new BookingError("SERVICE_NOT_FOUND", 404);

  const startsAtDt = DateTime.fromISO(input.startsAt, { zone: "utc" });
  if (!startsAtDt.isValid) {
    throw new BookingError("INVALID_STARTS_AT", 422);
  }
  const dateLocal = startsAtDt
    .setZone(tenant.timezone)
    .toISODate();
  if (!dateLocal) throw new BookingError("INVALID_STARTS_AT", 422);

  const slotsResult = await resolveSlots({
    tenantId: tenant.id,
    timezone: tenant.timezone,
    maxAdvanceDays: tenant.maxAdvanceDays,
    minLeadMin: tenant.minLeadMin,
    slotIntervalMin: tenant.slotIntervalMin,
    bufferBeforeMin: tenant.bufferBeforeMin,
    bufferAfterMin: tenant.bufferAfterMin,
    serviceId: service.id,
    staffId: input.staffId ?? undefined,
    dateLocal,
  });

  if ("error" in slotsResult) {
    throw new BookingError(slotsResult.error, slotsResult.status);
  }

  let staffId = input.staffId ?? null;
  if (!staffId) {
    staffId = pickStaffForSlot(slotsResult.byStaff, input.startsAt);
  }

  if (!staffId) {
    throw new BookingError("SLOT_UNAVAILABLE", 409);
  }

  const staffSlots =
    slotsResult.byStaff.find((s) => s.staffId === staffId)?.slots ?? [];
  if (!staffSlots.some((s) => s.startsAt === input.startsAt)) {
    throw new BookingError("SLOT_UNAVAILABLE", 409);
  }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, tenantId: tenant.id, status: "ACTIVE" },
  });
  if (!staff) throw new BookingError("STAFF_NOT_FOUND", 404);

  const bufferBefore =
    staff.bufferBeforeMin ?? tenant.bufferBeforeMin;
  const bufferAfter = staff.bufferAfterMin ?? tenant.bufferAfterMin;
  const startsAt = startsAtDt.toJSDate();
  const { endsAt, blockStartsAt, blockEndsAt } = computeBlockWindow({
    startsAt,
    serviceDurationMin: service.durationMin,
    serviceBufferAfterMin: service.bufferAfterMin,
    bufferBeforeMin: bufferBefore,
    bufferAfterMin: bufferAfter,
  });

  const needsPayment =
    tenant.depositRequired || service.requiresDeposit;
  const status: BookingStatus = needsPayment
    ? "PENDING_PAYMENT"
    : "CONFIRMED";
  const paymentStatus: PaymentStatus = needsPayment ? "PENDING" : "NONE";

  const lockKey = `t:${tenant.id}:lock:staff:${staffId}:${input.startsAt}`;
  const lockToken = randomUUID();
  const acquired = await acquireLock(lockKey, lockToken, 15);
  if (!acquired) throw new BookingError("SLOT_LOCKED", 409);

  try {
    // Re-check inside lock window
    const recheck = await resolveSlots({
      tenantId: tenant.id,
      timezone: tenant.timezone,
      maxAdvanceDays: tenant.maxAdvanceDays,
      minLeadMin: tenant.minLeadMin,
      slotIntervalMin: tenant.slotIntervalMin,
      bufferBeforeMin: tenant.bufferBeforeMin,
      bufferAfterMin: tenant.bufferAfterMin,
      serviceId: service.id,
      staffId,
      dateLocal,
    });
    if ("error" in recheck) {
      throw new BookingError(recheck.error, recheck.status);
    }
    const stillOpen = recheck.slots.some((s) => s.startsAt === input.startsAt);
    if (!stillOpen) throw new BookingError("SLOT_UNAVAILABLE", 409);

    const result = await prisma.$transaction(async (tx) => {
      // Atomic overlap guard (in addition to GiST exclusion)
      const overlap = await tx.booking.findFirst({
        where: {
          tenantId: tenant.id,
          staffId,
          status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] },
          blockStartsAt: { lt: blockEndsAt },
          blockEndsAt: { gt: blockStartsAt },
        },
        select: { id: true },
      });
      if (overlap) throw new BookingError("SLOT_UNAVAILABLE", 409);

      const customer = await tx.customer.upsert({
        where: {
          tenantId_phoneE164: {
            tenantId: tenant.id,
            phoneE164: input.customer.phone,
          },
        },
        create: {
          tenantId: tenant.id,
          name: input.customer.name,
          phoneE164: input.customer.phone,
          email: input.customer.email,
          cpf: input.customer.cpf,
        },
        update: {
          name: input.customer.name,
          email: input.customer.email ?? undefined,
          cpf: input.customer.cpf,
        },
      });

      try {
        const booking = await tx.booking.create({
          data: {
            tenantId: tenant.id,
            customerId: customer.id,
            staffId,
            serviceId: service.id,
            status,
            startsAt,
            endsAt,
            blockStartsAt,
            blockEndsAt,
            timezone: tenant.timezone,
            priceCents: service.priceCents,
            currency: service.currency,
            paymentStatus,
            notes: input.notes ?? null,
            source: input.source,
            idempotencyKey: idempotencyKey ?? null,
          },
        });

        return { booking, customer };
      } catch (err) {
        if (
          typeof err === "object" &&
          err !== null &&
          "code" in err &&
          (err as { code: string }).code === "P2002"
        ) {
          throw new BookingError("SLOT_UNAVAILABLE", 409);
        }
        // Postgres exclusion violation
        if (
          typeof err === "object" &&
          err !== null &&
          "meta" in err &&
          String((err as { meta?: { code?: string } }).meta?.code) === "23P01"
        ) {
          throw new BookingError("SLOT_UNAVAILABLE", 409);
        }
        throw err;
      }
    });

    // Fire-and-forget WhatsApp after successful commit
    void enqueueBookingCreated({
      bookingId: result.booking.id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      address: formatAddress(tenant),
      timezone: tenant.timezone,
      waInstanceId: tenant.waInstanceId,
      waProvider: tenant.waProvider ?? "uazapi",
      customerName: result.customer.name,
      customerPhoneE164: result.customer.phoneE164.startsWith("+")
        ? result.customer.phoneE164
        : `+${result.customer.phoneE164}`,
      serviceName: service.name,
      staffName: staff.displayName,
      startsAt: result.booking.startsAt,
      endsAt: result.booking.endsAt,
      durationMin: service.durationMin,
      priceCents: result.booking.priceCents,
      currency: result.booking.currency,
      status: result.booking.status,
    }).catch((err: unknown) => {
      console.error("[whatsapp] enqueue failed", err);
    });

    return {
      booking: {
        id: result.booking.id,
        status: result.booking.status,
        startsAt: result.booking.startsAt.toISOString(),
        endsAt: result.booking.endsAt.toISOString(),
        priceCents: result.booking.priceCents,
        currency: result.booking.currency,
        paymentStatus: result.booking.paymentStatus,
        staffId: result.booking.staffId,
        serviceId: result.booking.serviceId,
        timezone: result.booking.timezone,
      },
      customer: {
        id: result.customer.id,
        name: result.customer.name,
        phoneE164: result.customer.phoneE164,
      },
    };
  } finally {
    await releaseLock(lockKey, lockToken);
  }
}
