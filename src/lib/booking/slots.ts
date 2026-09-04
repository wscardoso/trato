import { DateTime } from "luxon";
import type { DayOfWeek } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  computeAvailableSlots,
  type DayOfWeekCode,
  type Slot,
} from "@/lib/slots/compute-available-slots";
import { isDateWithinHorizon } from "@/lib/booking/tenant";

export type ResolveSlotsParams = {
  tenantId: string;
  timezone: string;
  maxAdvanceDays: number;
  minLeadMin: number;
  slotIntervalMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  serviceId: string;
  staffId?: string;
  dateLocal: string;
};

export type ResolvedSlots = {
  timezone: string;
  intervalMin: number;
  staffId: string | null;
  anyAvailable: boolean;
  slots: Slot[];
  byStaff: Array<{ staffId: string; displayName: string; slots: Slot[] }>;
};

function toDow(code: DayOfWeek): DayOfWeekCode {
  return code as DayOfWeekCode;
}

async function loadStaffCandidates(params: {
  tenantId: string;
  serviceId: string;
  staffId?: string;
}) {
  if (params.staffId) {
    const staff = await prisma.staff.findFirst({
      where: {
        id: params.staffId,
        tenantId: params.tenantId,
        status: "ACTIVE",
        services: { some: { serviceId: params.serviceId } },
      },
      include: {
        rules: { where: { isActive: true } },
        exceptions: true,
      },
    });
    return staff ? [staff] : [];
  }

  return prisma.staff.findMany({
    where: {
      tenantId: params.tenantId,
      status: "ACTIVE",
      services: { some: { serviceId: params.serviceId } },
    },
    include: {
      rules: { where: { isActive: true } },
      exceptions: true,
    },
    orderBy: { sortOrder: "asc" },
  });
}

export async function resolveSlots(
  params: ResolveSlotsParams,
): Promise<ResolvedSlots | { error: string; status: number }> {
  if (
    !isDateWithinHorizon(
      params.dateLocal,
      params.timezone,
      params.maxAdvanceDays,
    )
  ) {
    return { error: "DATE_OUT_OF_RANGE", status: 422 };
  }

  const service = await prisma.service.findFirst({
    where: {
      id: params.serviceId,
      tenantId: params.tenantId,
      isActive: true,
    },
  });
  if (!service) return { error: "SERVICE_NOT_FOUND", status: 404 };

  const staffList = await loadStaffCandidates({
    tenantId: params.tenantId,
    serviceId: params.serviceId,
    staffId: params.staffId,
  });
  if (staffList.length === 0) {
    return { error: "STAFF_NOT_FOUND", status: 404 };
  }

  const dayStart = DateTime.fromISO(params.dateLocal, {
    zone: params.timezone,
  }).startOf("day");
  const dayEnd = dayStart.endOf("day");
  // Pad ±1 day for UTC boundary / buffers
  const rangeStart = dayStart.minus({ days: 1 }).toUTC().toJSDate();
  const rangeEnd = dayEnd.plus({ days: 1 }).toUTC().toJSDate();

  const bookings = await prisma.booking.findMany({
    where: {
      tenantId: params.tenantId,
      staffId: { in: staffList.map((s) => s.id) },
      status: { in: ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"] },
      blockStartsAt: { lt: rangeEnd },
      blockEndsAt: { gt: rangeStart },
    },
    select: {
      staffId: true,
      blockStartsAt: true,
      blockEndsAt: true,
      status: true,
    },
  });

  const byStaff: ResolvedSlots["byStaff"] = [];
  const merged = new Map<string, Slot>();

  for (const staff of staffList) {
    const interval =
      staff.slotIntervalMin ?? params.slotIntervalMin;
    const bufferBefore =
      staff.bufferBeforeMin ?? params.bufferBeforeMin;
    const bufferAfter =
      staff.bufferAfterMin ?? params.bufferAfterMin;

    const staffBookings = bookings.filter((b) => b.staffId === staff.id);
    const exceptions = staff.exceptions
      .filter((e) => {
        const d = DateTime.fromJSDate(e.date, { zone: "utc" }).toISODate();
        return d === params.dateLocal;
      })
      .map((e) => ({
        date: params.dateLocal,
        isDayOff: e.isDayOff,
        startTime: e.startTime,
        endTime: e.endTime,
      }));

    const slots = computeAvailableSlots({
      dateLocal: params.dateLocal,
      timezone: params.timezone,
      staffId: staff.id,
      serviceDurationMin: service.durationMin,
      serviceBufferAfterMin: service.bufferAfterMin,
      bufferBeforeMin: bufferBefore,
      bufferAfterMin: bufferAfter,
      slotIntervalMin: interval,
      minLeadMin: params.minLeadMin,
      rules: staff.rules.map((r) => ({
        dayOfWeek: toDow(r.dayOfWeek),
        startTime: r.startTime,
        endTime: r.endTime,
        breakStart: r.breakStart,
        breakEnd: r.breakEnd,
        isActive: r.isActive,
      })),
      exceptions,
      bookings: staffBookings,
    });

    byStaff.push({
      staffId: staff.id,
      displayName: staff.displayName,
      slots,
    });

    for (const slot of slots) {
      if (!merged.has(slot.startsAt)) merged.set(slot.startsAt, slot);
    }
  }

  const anyAvailable = !params.staffId;
  const slots = Array.from(merged.values()).sort((a, b) =>
    a.startsAt.localeCompare(b.startsAt),
  );

  return {
    timezone: params.timezone,
    intervalMin: params.slotIntervalMin,
    staffId: params.staffId ?? null,
    anyAvailable,
    slots,
    byStaff,
  };
}

/** Pick first staff who can take `startsAt` when "any available" is selected. */
export function pickStaffForSlot(
  byStaff: ResolvedSlots["byStaff"],
  startsAt: string,
): string | null {
  for (const entry of byStaff) {
    if (entry.slots.some((s) => s.startsAt === startsAt)) {
      return entry.staffId;
    }
  }
  return null;
}
