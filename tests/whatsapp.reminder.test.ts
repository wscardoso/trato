import { afterEach, describe, expect, it, vi } from "vitest";
import { createBookingAtomic } from "@/lib/booking-service";
import { resetDemoBookings } from "@/lib/demo-store";
import { reminder24DelayMs } from "@/lib/whatsapp";
import { bookingPayload } from "./helpers";

describe("WhatsApp D−1 reminder timing", () => {
  afterEach(() => {
    resetDemoBookings();
    vi.restoreAllMocks();
  });

  it("uses 60s delay when appointment is within 24h", () => {
    const now = Date.parse("2026-09-04T15:00:00.000Z");
    const startsAt = new Date("2026-09-04T20:00:00.000Z"); // 5h ahead
    expect(reminder24DelayMs(startsAt, now)).toBe(60_000);
  });

  it("schedules real D−1 delay when appointment is far enough", () => {
    const now = Date.parse("2026-09-04T15:00:00.000Z");
    const startsAt = new Date("2026-09-06T15:00:00.000Z"); // 48h ahead → due in 24h
    expect(reminder24DelayMs(startsAt, now)).toBe(24 * 60 * 60 * 1000);
  });

  it("sends create menu with Cancel only (no Confirm)", async () => {
    const logs: Array<{ choices?: string[] }> = [];
    const info = vi.spyOn(console, "info").mockImplementation((...args) => {
      if (args[0] === "[whatsapp:dry-run-menu]") {
        logs.push(args[1] as { choices?: string[] });
      }
    });

    const result = await createBookingAtomic(bookingPayload());
    expect(result.ok).toBe(true);

    // Allow fire-and-forget send to settle
    await new Promise((r) => setTimeout(r, 50));

    const createMenu = logs.find((l) =>
      l.choices?.some((c) => c.startsWith("Cancelar horário|")),
    );
    expect(createMenu?.choices).toEqual([
      expect.stringMatching(/^Cancelar horário\|cancel:/),
    ]);
    expect(createMenu?.choices?.some((c) => c.startsWith("Confirmar"))).toBe(
      false,
    );

    info.mockRestore();
  });
});
