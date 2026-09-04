import { DateTime } from "luxon";
import { getDemoSlots, resetDemoBookings } from "@/lib/demo-store";
import type { CreateBookingInput } from "@/lib/validations";

export const DEMO_SERVICE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const DEMO_STAFF_ID = "22222222-2222-4222-8222-222222222222";
export const DEMO_TENANT_SLUG = "dom-carlos-barbearia";

/** Next weekday (Tue–Sat) at least `minDaysAhead` from now with an open slot. */
export function findOpenDemoSlot(minDaysAhead = 3): {
  startsAt: string;
  dateLocal: string;
} {
  resetDemoBookings();
  const tz = "America/Sao_Paulo";
  let day = DateTime.now().setZone(tz).plus({ days: minDaysAhead }).startOf("day");

  for (let i = 0; i < 21; i++) {
    const dateLocal = day.toISODate()!;
    const { slots } = getDemoSlots({
      serviceId: DEMO_SERVICE_ID,
      staffId: DEMO_STAFF_ID,
      dateLocal,
    });
    if (slots.length > 0) {
      return { startsAt: slots[0]!.startsAt, dateLocal };
    }
    day = day.plus({ days: 1 });
  }
  throw new Error("No demo slot found in next 21 days");
}

export function bookingPayload(
  overrides: Partial<CreateBookingInput> & {
    customer?: Partial<CreateBookingInput["customer"]>;
  } = {},
): CreateBookingInput {
  const slot = findOpenDemoSlot();
  const { customer: customerOverrides, ...rest } = overrides;
  return {
    tenantSlug: DEMO_TENANT_SLUG,
    serviceId: DEMO_SERVICE_ID,
    staffId: DEMO_STAFF_ID,
    startsAt: slot.startsAt,
    source: "public_web",
    customer: {
      name: "Cliente Teste",
      phone: "33999990001",
      email: "",
      cpf: "",
      notes: "",
      ...customerOverrides,
    },
    ...rest,
  };
}
