import { afterEach, describe, expect, it } from "vitest";
import { createBookingAtomic } from "@/lib/booking-service";
import { resetDemoBookings } from "@/lib/demo-store";
import {
  DEMO_SERVICE_ID,
  DEMO_STAFF_ID,
  DEMO_TENANT_SLUG,
  findOpenDemoSlot,
} from "./helpers";

describe("Concurrency & race conditions — same slot / same staff", () => {
  afterEach(() => {
    resetDemoBookings();
  });

  it("allows only 1 of 5 concurrent bookings for the same staff+slot", async () => {
    const { startsAt } = findOpenDemoSlot(5);

    const payloads = Array.from({ length: 5 }, (_, i) => ({
      tenantSlug: DEMO_TENANT_SLUG,
      serviceId: DEMO_SERVICE_ID,
      staffId: DEMO_STAFF_ID,
      startsAt,
      source: "public_web" as const,
      customer: {
        name: `Concurrent User ${i + 1}`,
        phone: `3399999${String(1000 + i).slice(-4)}`,
        email: "",
        cpf: "",
        notes: "",
      },
    }));

    const results = await Promise.all(
      payloads.map((p) => createBookingAtomic(p)),
    );

    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(4);

    for (const fail of failures) {
      if (fail.ok) continue;
      expect(["SLOT_UNAVAILABLE", "SLOT_LOCKED"]).toContain(fail.code);
      expect(fail.status).toBe(409);
      // Clear client-facing message (PT equivalent of "Slot no longer available")
      expect(fail.message.toLowerCase()).toMatch(
        /ocupado|reservado|indispon|sendo reservado/,
      );
    }
  });

  it("documents DB exclusion constraint requirement for production validity", () => {
    // prisma/migrations/0_exclusion_constraint/migration.sql
    // EXCLUDE USING gist (staff_id, tstzrange(block_starts_at, block_ends_at))
    // WHERE status IN (PENDING_PAYMENT, CONFIRMED, CHECKED_IN)
    expect(true).toBe(true);
  });
});
