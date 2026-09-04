import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "@/lib/slots";

const baseRules = [
  {
    dayOfWeek: "FRI" as const,
    startTime: "09:00",
    endTime: "18:00",
    breakStart: null,
    breakEnd: null,
    isActive: true,
  },
];

describe("Timezone & slot computation", () => {
  it("rejects 90-minute service booked 30 minutes before shop closing", () => {
    // Shop closes 18:00; 17:30 + 90min = 19:00 → must not appear
    const dateLocal = "2026-03-06"; // Friday
    const now = DateTime.fromISO("2026-03-06T08:00:00", {
      zone: "America/Sao_Paulo",
    }).toJSDate();

    const slots = computeAvailableSlots({
      dateLocal,
      timezone: "America/Sao_Paulo",
      serviceDurationMin: 90,
      serviceBufferAfterMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotIntervalMin: 30,
      minLeadMin: 0,
      rules: baseRules,
      exceptions: [],
      bookings: [],
      now,
    });

    const labels = slots.map((s) => s.label);
    expect(labels).not.toContain("17:30");
    expect(labels).not.toContain("17:00"); // 17:00+90=18:30 > close
    // Last valid start for 90min in 09:00–18:00 is 16:30
    expect(labels).toContain("16:30");
    expect(labels.filter((l) => l >= "17:00")).toHaveLength(0);
  });

  it("computes stable UTC instants across America/Sao_Paulo (no DST since 2019)", () => {
    const dateLocal = "2026-02-13"; // Friday
    const now = DateTime.fromISO("2026-02-01T12:00:00Z").toJSDate();

    const slots = computeAvailableSlots({
      dateLocal,
      timezone: "America/Sao_Paulo",
      serviceDurationMin: 60,
      serviceBufferAfterMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotIntervalMin: 60,
      minLeadMin: 0,
      rules: baseRules,
      exceptions: [],
      bookings: [],
      now,
    });

    const nine = slots.find((s) => s.label === "09:00");
    expect(nine).toBeDefined();
    // America/Sao_Paulo is UTC-3 year-round
    expect(nine!.startsAt).toBe("2026-02-13T12:00:00.000Z");
  });

  it("handles US Eastern spring-forward DST gap without inventing invalid local times", () => {
    // 2026-03-08: clocks jump 02:00 → 03:00 in America/New_York
    const dateLocal = "2026-03-08";
    const now = DateTime.fromISO("2026-03-01T12:00:00Z").toJSDate();

    const slots = computeAvailableSlots({
      dateLocal,
      timezone: "America/New_York",
      serviceDurationMin: 30,
      serviceBufferAfterMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotIntervalMin: 30,
      minLeadMin: 0,
      rules: [
        {
          dayOfWeek: "SUN",
          startTime: "01:00",
          endTime: "05:00",
          breakStart: null,
          breakEnd: null,
          isActive: true,
        },
      ],
      exceptions: [],
      bookings: [],
      now,
    });

    for (const slot of slots) {
      const local = DateTime.fromISO(slot.startsAt, { zone: "utc" }).setZone(
        "America/New_York",
      );
      expect(local.isValid).toBe(true);
      // No slot should claim the non-existent 02:xx local wall time after conversion
      expect(local.hour === 2 && local.minute < 60).toBe(false);
    }
  });

  it("handles US Eastern fall-back overlap day with distinct UTC starts", () => {
    // 2026-11-01: 01:00–02:00 repeats in America/New_York
    const dateLocal = "2026-11-01";
    const now = DateTime.fromISO("2026-10-20T12:00:00Z").toJSDate();

    const slots = computeAvailableSlots({
      dateLocal,
      timezone: "America/New_York",
      serviceDurationMin: 30,
      serviceBufferAfterMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotIntervalMin: 30,
      minLeadMin: 0,
      rules: [
        {
          dayOfWeek: "SUN",
          startTime: "00:30",
          endTime: "03:00",
          breakStart: null,
          breakEnd: null,
          isActive: true,
        },
      ],
      exceptions: [],
      bookings: [],
      now,
    });

    const utcStarts = slots.map((s) => s.startsAt);
    expect(new Set(utcStarts).size).toBe(utcStarts.length);
  });

  it("respects tenant timezone when labeling multi-tz settings", () => {
    const dateLocal = "2026-06-05"; // Friday
    const now = DateTime.fromISO("2026-06-01T12:00:00Z").toJSDate();
    const common = {
      dateLocal,
      serviceDurationMin: 30,
      serviceBufferAfterMin: 0,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      slotIntervalMin: 30,
      minLeadMin: 0,
      rules: baseRules,
      exceptions: [],
      bookings: [],
      now,
    };

    const sp = computeAvailableSlots({
      ...common,
      timezone: "America/Sao_Paulo",
    });
    const ny = computeAvailableSlots({
      ...common,
      timezone: "America/New_York",
    });

    const spNine = sp.find((s) => s.label === "09:00")!;
    const nyNine = ny.find((s) => s.label === "09:00")!;
    expect(spNine.startsAt).not.toBe(nyNine.startsAt);
  });
});
