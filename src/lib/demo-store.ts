import { DateTime } from "luxon";
import type { DayOfWeekCode } from "@/lib/slots";
import { computeAvailableSlots } from "@/lib/slots";
import type { CreateBookingInput } from "@/lib/validations";
import { normalizePhoneE164 } from "@/lib/validations";
import type { PublicTenant, SlotDTO } from "@/types/booking";

export type CreateBookingResult =
  | {
      ok: true;
      booking: {
        id: string;
        status: string;
        startsAt: string;
        endsAt: string;
        staffName: string;
        serviceName: string;
        priceCents: number;
      };
    }
  | { ok: false; code: string; message: string; status: number };

const DEMO_TENANT_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_STAFF_ID = "22222222-2222-4222-8222-222222222222";
const DEMO_STAFF_2 = "33333333-3333-4333-8333-333333333333";

const SERVICES = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    name: "Corte Social",
    description: "Corte social com acabamento na tesoura",
    durationMin: 35,
    priceCents: 3000,
    category: "Cabelo",
    bufferAfterMin: 0,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
    name: "Corte Degradê na Zero",
    description: "Degradê com acabamento na máquina zero",
    durationMin: 35,
    priceCents: 3000,
    category: "Cabelo",
    bufferAfterMin: 0,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
    name: "Corte Navalhado",
    description: "Degradê com acabamento na navalha",
    durationMin: 35,
    priceCents: 3500,
    category: "Cabelo",
    bufferAfterMin: 0,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4",
    name: "Sobrancelha",
    description: "Design de sobrancelha",
    durationMin: 20,
    priceCents: 1000,
    category: "Estética",
    bufferAfterMin: 0,
  },
] as const;

type DemoBooking = {
  id: string;
  staffId: string;
  blockStartsAt: Date;
  blockEndsAt: Date;
  status: "CONFIRMED" | "CANCELLED";
  phoneE164: string;
  serviceName: string;
  staffName: string;
};

const globalDemo = globalThis as unknown as {
  __demoBookings?: DemoBooking[];
};

const demoBookings: DemoBooking[] =
  globalDemo.__demoBookings ?? (globalDemo.__demoBookings = []);

const WEEKDAY_RULES: Array<{
  dayOfWeek: DayOfWeekCode;
  startTime: string;
  endTime: string;
  breakStart: string;
  breakEnd: string;
}> = [
  { dayOfWeek: "TUE", startTime: "07:50", endTime: "19:55", breakStart: "10:45", breakEnd: "13:30" },
  { dayOfWeek: "WED", startTime: "07:50", endTime: "18:45", breakStart: "10:45", breakEnd: "13:30" },
  { dayOfWeek: "THU", startTime: "07:50", endTime: "20:30", breakStart: "10:45", breakEnd: "13:30" },
  { dayOfWeek: "FRI", startTime: "07:50", endTime: "19:55", breakStart: "10:45", breakEnd: "13:30" },
  { dayOfWeek: "SAT", startTime: "08:00", endTime: "12:05", breakStart: "12:05", breakEnd: "13:00" },
];

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true";
}

export function getDemoTenant(slug: string): PublicTenant | null {
  if (slug !== "dom-carlos-barbearia" && slug !== "demo") return null;
  return {
    id: DEMO_TENANT_ID,
    slug: slug === "demo" ? "demo" : "dom-carlos-barbearia",
    name: "DOM CARLOS BARBEARIA",
    timezone: "America/Sao_Paulo",
    logoUrl: null,
    brandPrimary: "#E06535",
    addressLine1: "AV BRASIL, 142, Parque das Nações",
    city: "Iapu",
    state: "MG",
    maxAdvanceDays: 14,
    slotIntervalMin: 35,
    services: SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      category: s.category,
    })),
    staff: [
      {
        id: DEMO_STAFF_ID,
        displayName: "Carlos",
        avatarUrl: null,
        bio: "Barbeiro titular",
      },
      {
        id: DEMO_STAFF_2,
        displayName: "André",
        avatarUrl: null,
        bio: "Especialista em degradê",
      },
    ],
  };
}

export function getDemoSlots(params: {
  serviceId: string;
  staffId?: string;
  dateLocal: string;
}): { timezone: string; intervalMin: number; slots: SlotDTO[] } {
  const service = SERVICES.find((s) => s.id === params.serviceId);
  if (!service) {
    return { timezone: "America/Sao_Paulo", intervalMin: 35, slots: [] };
  }

  const staffIds = params.staffId
    ? [params.staffId]
    : [DEMO_STAFF_ID, DEMO_STAFF_2];

  const slotMap = new Map<string, SlotDTO>();

  for (const staffId of staffIds) {
    const computed = computeAvailableSlots({
      dateLocal: params.dateLocal,
      timezone: "America/Sao_Paulo",
      serviceDurationMin: service.durationMin,
      serviceBufferAfterMin: service.bufferAfterMin,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotIntervalMin: 35,
      minLeadMin: 60,
      rules: WEEKDAY_RULES.map((r) => ({ ...r, isActive: true })),
      exceptions: [],
      bookings: demoBookings.filter(
        (b) => b.staffId === staffId && b.status === "CONFIRMED",
      ),
    });
    for (const slot of computed) {
      if (!slotMap.has(slot.startsAt)) {
        slotMap.set(slot.startsAt, { ...slot, staffId });
      }
    }
  }

  return {
    timezone: "America/Sao_Paulo",
    intervalMin: 35,
    slots: Array.from(slotMap.values()).sort((a, b) =>
      a.startsAt.localeCompare(b.startsAt),
    ),
  };
}

function normalizeIso(iso: string): string {
  return new Date(iso).toISOString();
}

/** Reset in-memory demo bookings (tests only). */
export function resetDemoBookings(): void {
  demoBookings.length = 0;
}

export async function createDemoBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const service = SERVICES.find((s) => s.id === input.serviceId);
  if (!service) {
    return {
      ok: false,
      code: "SERVICE_NOT_FOUND",
      message: "Serviço inválido",
      status: 422,
    };
  }

  const knownStaff = new Set([DEMO_STAFF_ID, DEMO_STAFF_2]);
  if (input.staffId && !knownStaff.has(input.staffId)) {
    return {
      ok: false,
      code: "STAFF_NOT_FOUND",
      message: "Profissional inválido",
      status: 404,
    };
  }

  const startsAt = new Date(input.startsAt);
  const startsIso = startsAt.toISOString();
  const dateLocal =
    DateTime.fromJSDate(startsAt, { zone: "utc" })
      .setZone("America/Sao_Paulo")
      .toISODate() ?? "";

  const staffHint = input.staffId ?? DEMO_STAFF_ID;
  const { acquireSlotLock } = await import("@/lib/redis-lock");
  const lock = await acquireSlotLock(DEMO_TENANT_ID, staffHint, startsIso);
  if (!lock) {
    return {
      ok: false,
      code: "SLOT_LOCKED",
      message: "Horário sendo reservado. Tente novamente.",
      status: 409,
    };
  }

  try {
    const { slots } = getDemoSlots({
      serviceId: input.serviceId,
      staffId: input.staffId ?? undefined,
      dateLocal,
    });

    const match = slots.find(
      (s) => normalizeIso(s.startsAt) === startsIso,
    );
    if (!match?.staffId) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "Horário acabou de ser ocupado",
        status: 409,
      };
    }

    // Re-check overlap under lock (race with concurrent demo bookers)
    const overlaps = demoBookings.some(
      (b) =>
        b.staffId === match.staffId &&
        b.status === "CONFIRMED" &&
        b.blockStartsAt < DateTime.fromJSDate(startsAt).plus({ minutes: service.durationMin }).toJSDate() &&
        b.blockEndsAt > startsAt,
    );
    if (overlaps) {
      return {
        ok: false,
        code: "SLOT_UNAVAILABLE",
        message: "Horário acabou de ser ocupado",
        status: 409,
      };
    }

    const endsAt = DateTime.fromJSDate(startsAt, { zone: "utc" })
      .plus({ minutes: service.durationMin })
      .toJSDate();

    const staffName =
      match.staffId === DEMO_STAFF_2 ? "André" : "Carlos";
    const phone = normalizePhoneE164(input.customer.phone);
    const bookingId = crypto.randomUUID();
    const tenant =
      getDemoTenant(input.tenantSlug) ?? getDemoTenant("dom-carlos-barbearia");

    demoBookings.push({
      id: bookingId,
      staffId: match.staffId,
      blockStartsAt: startsAt,
      blockEndsAt: endsAt,
      status: "CONFIRMED",
      phoneE164: phone.replace(/\D/g, ""),
      serviceName: service.name,
      staffName,
    });

    console.info("[demo-booking]", {
      customer: input.customer.name,
      phone,
      service: service.name,
      startsAt: startsAt.toISOString(),
    });

    if (tenant) {
      const { sendBookingCreatedMessage, scheduleDemoReminder24 } = await import(
        "@/lib/whatsapp"
      );
      const notifyCtx = {
        bookingId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        address: [tenant.addressLine1, tenant.city, tenant.state]
          .filter(Boolean)
          .join(", "),
        timezone: tenant.timezone,
        waInstanceId: process.env.UAZAPI_TOKEN ?? null,
        waProvider: "uazapi",
        customerName: input.customer.name,
        customerPhoneE164: phone.startsWith("+") ? phone : `+${phone}`,
        serviceName: service.name,
        staffName,
        startsAt,
        endsAt,
        durationMin: service.durationMin,
        priceCents: service.priceCents,
        currency: "BRL",
        status: "CONFIRMED",
      };
      void sendBookingCreatedMessage(notifyCtx).catch((err) => {
        console.error("[whatsapp] demo send failed", err);
      });
      scheduleDemoReminder24(notifyCtx);
    }

    return {
      ok: true,
      booking: {
        id: bookingId,
        status: "CONFIRMED",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        staffName,
        serviceName: service.name,
        priceCents: service.priceCents,
      },
    };
  } finally {
    await lock.release();
  }
}

export function getDemoBooking(bookingId: string): DemoBooking | null {
  return demoBookings.find((b) => b.id === bookingId) ?? null;
}

export function findDemoBookingByPrefix(prefix: string): DemoBooking | null {
  if (!prefix) return null;
  const matches = demoBookings.filter((b) => b.id.startsWith(prefix));
  return matches.length === 1 ? matches[0] : null;
}

export function cancelDemoBooking(bookingIdOrPrefix: string): {
  ok: boolean;
  booking?: DemoBooking;
  message: string;
} {
  const booking =
    getDemoBooking(bookingIdOrPrefix) ??
    findDemoBookingByPrefix(bookingIdOrPrefix);
  if (!booking) {
    return { ok: false, message: "Agendamento não encontrado." };
  }
  if (booking.status === "CANCELLED") {
    return { ok: true, booking, message: "Este horário já estava cancelado." };
  }
  booking.status = "CANCELLED";
  return {
    ok: true,
    booking,
    message: "Horário cancelado. A vaga voltou para a agenda.",
  };
}

export function confirmDemoBooking(bookingIdOrPrefix: string): {
  ok: boolean;
  booking?: DemoBooking;
  message: string;
} {
  const booking =
    getDemoBooking(bookingIdOrPrefix) ??
    findDemoBookingByPrefix(bookingIdOrPrefix);
  if (!booking) {
    return { ok: false, message: "Agendamento não encontrado." };
  }
  if (booking.status === "CANCELLED") {
    return {
      ok: false,
      booking,
      message: "Este horário já foi cancelado e não pode ser confirmado.",
    };
  }
  booking.status = "CONFIRMED";
  return {
    ok: true,
    booking,
    message: "Trato confirmado! Te esperamos no horário marcado.",
  };
}
