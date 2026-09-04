import { DateTime } from "luxon";
import type { DayOfWeek, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { acquireSlotLock } from "@/lib/redis-lock";
import {
  createDemoBooking,
  getDemoSlots,
  getDemoTenant,
  isDemoMode,
  type CreateBookingResult,
} from "@/lib/demo-store";
import {
  computeAvailableSlots,
  computeBlockWindow,
  type DayOfWeekCode,
} from "@/lib/slots";
import {
  normalizePhoneE164,
  type CreateBookingInput,
} from "@/lib/validations";
import { enqueueBookingCreated } from "@/lib/whatsapp";
import type { PublicTenant, SlotDTO } from "@/types/booking";

const ACTIVE: Prisma.EnumBookingStatusFilter["in"] = [
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CHECKED_IN",
];

function formatAddress(t: {
  addressLine1: string | null;
  city: string | null;
  state: string | null;
}): string {
  return [t.addressLine1, t.city, t.state].filter(Boolean).join(", ");
}

export async function getPublicTenant(
  slug: string,
): Promise<PublicTenant | null> {
  if (isDemoMode()) return getDemoTenant(slug);

  const tenant = await prisma.tenant.findFirst({
    where: { slug, isActive: true },
    include: {
      services: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      staff: {
        where: { status: "ACTIVE" },
        orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
      },
    },
  });

  if (!tenant) return null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    timezone: tenant.timezone,
    logoUrl: tenant.logoUrl,
    brandPrimary: tenant.brandPrimary ?? "#E06535",
    addressLine1: tenant.addressLine1,
    city: tenant.city,
    state: tenant.state,
    maxAdvanceDays: tenant.maxAdvanceDays,
    slotIntervalMin: tenant.slotIntervalMin,
    services: tenant.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      category: s.category,
    })),
    staff: tenant.staff.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      avatarUrl: s.avatarUrl,
      bio: s.bio,
    })),
  };
}

async function loadStaffCandidates(params: {
  tenantId: string;
  serviceId: string;
  staffId?: string | null;
}) {
  const staff = await prisma.staff.findMany({
    where: {
      tenantId: params.tenantId,
      status: "ACTIVE",
      ...(params.staffId ? { id: params.staffId } : {}),
      services: { some: { serviceId: params.serviceId } },
    },
    include: {
      rules: { where: { isActive: true } },
      exceptions: true,
    },
  });
  return staff;
}

export async function getAvailableSlots(params: {
  slug: string;
  serviceId: string;
  staffId?: string;
  dateLocal: string;
}): Promise<{ timezone: string; intervalMin: number; slots: SlotDTO[] }> {
  if (isDemoMode()) {
    return getDemoSlots({
      serviceId: params.serviceId,
      staffId: params.staffId,
      dateLocal: params.dateLocal,
    });
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug: params.slug, isActive: true },
  });
  if (!tenant) throw new Error("TENANT_NOT_FOUND");

  const service = await prisma.service.findFirst({
    where: {
      id: params.serviceId,
      tenantId: tenant.id,
      isActive: true,
    },
  });
  if (!service) throw new Error("SERVICE_NOT_FOUND");

  const dayStart = DateTime.fromISO(params.dateLocal, {
    zone: tenant.timezone,
  }).startOf("day");
  const dayEnd = dayStart.endOf("day");
  const maxDate = DateTime.now()
    .setZone(tenant.timezone)
    .plus({ days: tenant.maxAdvanceDays })
    .endOf("day");

  if (dayStart > maxDate) {
    return {
      timezone: tenant.timezone,
      intervalMin: tenant.slotIntervalMin,
      slots: [],
    };
  }

  const candidates = await loadStaffCandidates({
    tenantId: tenant.id,
    serviceId: params.serviceId,
    staffId: params.staffId,
  });

  const staffIds = candidates.map((c) => c.id);
  const bookings = staffIds.length
    ? await prisma.booking.findMany({
        where: {
          tenantId: tenant.id,
          staffId: { in: staffIds },
          status: { in: ACTIVE },
          blockStartsAt: { lt: dayEnd.toUTC().toJSDate() },
          blockEndsAt: { gt: dayStart.toUTC().toJSDate() },
        },
      })
    : [];

  const slotMap = new Map<string, SlotDTO>();

  for (const staff of candidates) {
    const interval =
      staff.slotIntervalMin ?? tenant.slotIntervalMin;
    const bufferBefore =
      staff.bufferBeforeMin ?? tenant.bufferBeforeMin;
    const bufferAfter =
      staff.bufferAfterMin ?? tenant.bufferAfterMin;

    const staffBookings = bookings.filter((b) => b.staffId === staff.id);
    const computed = computeAvailableSlots({
      dateLocal: params.dateLocal,
      timezone: tenant.timezone,
      serviceDurationMin: service.durationMin,
      serviceBufferAfterMin: service.bufferAfterMin,
      bufferBeforeMin: bufferBefore,
      bufferAfterMin: bufferAfter,
      slotIntervalMin: interval,
      minLeadMin: tenant.minLeadMin,
      rules: staff.rules.map((r) => ({
        dayOfWeek: r.dayOfWeek as DayOfWeekCode,
        startTime: r.startTime,
        endTime: r.endTime,
        breakStart: r.breakStart,
        breakEnd: r.breakEnd,
        isActive: r.isActive,
      })),
      exceptions: staff.exceptions.map((e) => ({
        date: DateTime.fromJSDate(e.date).toISODate() ?? params.dateLocal,
        isDayOff: e.isDayOff,
        startTime: e.startTime,
        endTime: e.endTime,
      })),
      bookings: staffBookings.map((b) => ({
        blockStartsAt: b.blockStartsAt,
        blockEndsAt: b.blockEndsAt,
        status: b.status,
      })),
    });

    for (const slot of computed) {
      // For "any available", keep first staff that can take the slot
      if (!slotMap.has(slot.startsAt)) {
        slotMap.set(slot.startsAt, {
          ...slot,
          staffId: staff.id,
        });
      }
    }
  }

  const slots = Array.from(slotMap.values()).sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );

  return {
    timezone: tenant.timezone,
    intervalMin: tenant.slotIntervalMin,
    slots,
  };
}

export type { CreateBookingResult };

export async function createBookingAtomic(
  input: CreateBookingInput,
  idempotencyKey?: string | null,
): Promise<CreateBookingResult> {
  if (isDemoMode()) return createDemoBooking(input);

  const tenant = await prisma.tenant.findFirst({
    where: { slug: input.tenantSlug, isActive: true },
  });
  if (!tenant) {
    return {
      ok: false,
      code: "TENANT_NOT_FOUND",
      message: "Barbearia não encontrada",
      status: 404,
    };
  }

  // Idempotency must be tenant-scoped — never leak another tenant's booking
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({
      where: { idempotencyKey },
      include: { staff: true, service: true },
    });
    if (existing && existing.tenantId === tenant.id) {
      return {
        ok: true,
        booking: {
          id: existing.id,
          status: existing.status,
          startsAt: existing.startsAt.toISOString(),
          endsAt: existing.endsAt.toISOString(),
          staffName: existing.staff.displayName,
          serviceName: existing.service.name,
          priceCents: existing.priceCents,
        },
      };
    }
    if (existing && existing.tenantId !== tenant.id) {
      return {
        ok: false,
        code: "IDEMPOTENCY_CONFLICT",
        message: "Chave de idempotência já utilizada",
        status: 409,
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
  if (!service) {
    return {
      ok: false,
      code: "SERVICE_NOT_FOUND",
      message: "Serviço inválido",
      status: 422,
    };
  }

  const startsAt = new Date(input.startsAt);
  const dateLocal =
    DateTime.fromJSDate(startsAt, { zone: "utc" })
      .setZone(tenant.timezone)
      .toISODate() ?? "";

  // Resolve staff: specific or any available for that slot
  let resolvedStaffId = input.staffId;
  if (!resolvedStaffId) {
    const { slots } = await getAvailableSlots({
      slug: tenant.slug,
      serviceId: service.id,
      dateLocal,
    });
    const match = slots.find((s) => s.startsAt === startsAt.toISOString());
    if (!match?.staffId) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "Horário indisponível",
        status: 409,
      };
    }
    resolvedStaffId = match.staffId;
  }

  const lock = await acquireSlotLock(
    tenant.id,
    resolvedStaffId,
    startsAt.toISOString(),
  );
  if (!lock) {
    return {
      ok: false,
      code: "SLOT_LOCKED",
      message: "Horário sendo reservado. Tente novamente.",
      status: 409,
    };
  }

  try {
    // Re-validate eligibility under lock
    const { slots } = await getAvailableSlots({
      slug: tenant.slug,
      serviceId: service.id,
      staffId: resolvedStaffId,
      dateLocal,
    });
    if (!slots.some((s) => s.startsAt === startsAt.toISOString())) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "Horário acabou de ser ocupado",
        status: 409,
      };
    }

    const staff = await prisma.staff.findFirstOrThrow({
      where: { id: resolvedStaffId, tenantId: tenant.id },
    });

    const bufferBefore =
      staff.bufferBeforeMin ?? tenant.bufferBeforeMin;
    const bufferAfter =
      staff.bufferAfterMin ?? tenant.bufferAfterMin;
    const { endsAt, blockStartsAt, blockEndsAt } = computeBlockWindow({
      startsAt,
      durationMin: service.durationMin,
      bufferBeforeMin: bufferBefore,
      bufferAfterMin: bufferAfter,
      serviceBufferAfterMin: service.bufferAfterMin,
    });

    const phoneE164 = normalizePhoneE164(input.customer.phone);
    const cpfDigits = (input.customer.cpf ?? "").replace(/\D/g, "") || null;
    const email =
      input.customer.email && input.customer.email.length > 0
        ? input.customer.email
        : null;

    const booking = await prisma.$transaction(async (tx) => {
      // Atomic overlap check inside the transaction
      const overlap = await tx.booking.findFirst({
        where: {
          tenantId: tenant.id,
          staffId: staff.id,
          status: { in: ACTIVE },
          blockStartsAt: { lt: blockEndsAt },
          blockEndsAt: { gt: blockStartsAt },
        },
        select: { id: true },
      });
      if (overlap) {
        throw new Error("OVERLAP");
      }

      const customer = await tx.customer.upsert({
        where: {
          tenantId_phoneE164: {
            tenantId: tenant.id,
            phoneE164: phoneE164.replace("+", ""),
          },
        },
        create: {
          tenantId: tenant.id,
          name: input.customer.name,
          phoneE164: phoneE164.replace("+", ""),
          email,
          cpf: cpfDigits,
          notes: input.customer.notes || null,
        },
        update: {
          name: input.customer.name,
          email: email ?? undefined,
          cpf: cpfDigits ?? undefined,
        },
      });

      return tx.booking.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          staffId: staff.id,
          serviceId: service.id,
          status:
            tenant.depositRequired || service.requiresDeposit
              ? "PENDING_PAYMENT"
              : "CONFIRMED",
          startsAt,
          endsAt,
          blockStartsAt,
          blockEndsAt,
          timezone: tenant.timezone,
          priceCents: service.priceCents,
          currency: service.currency,
          paymentStatus:
            tenant.depositRequired || service.requiresDeposit
              ? "PENDING"
              : "NONE",
          notes: input.customer.notes || null,
          source: input.source ?? "public_web",
          idempotencyKey: idempotencyKey ?? undefined,
        },
        include: {
          customer: true,
          staff: true,
          service: true,
        },
      });
    });

    // Async WhatsApp after successful commit (skip receipt until PIX paid)
    if (booking.status !== "PENDING_PAYMENT") {
      void enqueueBookingCreated({
        bookingId: booking.id,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        address: formatAddress(tenant),
        timezone: tenant.timezone,
        waInstanceId: tenant.waInstanceId,
        waProvider: tenant.waProvider ?? "uazapi",
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
      }).catch((err) => {
        console.error("[whatsapp] enqueue failed", err);
      });
    }

    let payment: {
      paymentId: string;
      amountCents: number;
      pixQrCode: string | null;
      checkoutUrl: string | null;
      expiresAt: string;
      dryRun: boolean;
    } | null = null;

    if (booking.status === "PENDING_PAYMENT") {
      try {
        const { createDepositForBooking } = await import("@/lib/payments/deposit");
        payment = await createDepositForBooking(booking.id);
        if (payment?.pixQrCode) {
          const { sendWhatsAppText } = await import("@/lib/whatsapp");
          const phone = booking.customer.phoneE164.replace(/\D/g, "");
          void sendWhatsAppText(
            phone,
            [
              `Quase lá, ${booking.customer.name}! Para garantir seu horário na *${tenant.name}*, pague o sinal PIX.`,
              "",
              `Valor: R$ ${(payment.amountCents / 100).toFixed(2).replace(".", ",")}`,
              `Copia e cola:`,
              payment.pixQrCode,
              "",
              `Pague em até ${process.env.DEPOSIT_TIMEOUT_MIN ?? "30"} min ou a vaga é liberada.`,
            ].join("\n"),
          ).catch((err) => console.error("[whatsapp] pix notify failed", err));
        }
      } catch (err) {
        console.error("[payment] deposit create failed", err);
      }
    }

    return {
      ok: true,
      booking: {
        id: booking.id,
        status: booking.status,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        staffName: booking.staff.displayName,
        serviceName: booking.service.name,
        priceCents: booking.priceCents,
        paymentStatus: booking.paymentStatus,
        payment,
      },
    };
  } catch (err) {
    if (err instanceof Error && err.message === "OVERLAP") {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "Horário já reservado",
        status: 409,
      };
    }
    // Postgres exclusion violation
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "23P01"
    ) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "Horário já reservado",
        status: 409,
      };
    }
    throw err;
  } finally {
    await lock.release();
  }
}

export const DOW_FROM_JS: DayOfWeek[] = [
  "SUN",
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
];
