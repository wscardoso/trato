import { describe, expect, it, vi } from "vitest";

/**
 * DB-backed concurrency audit (opt-in).
 * Requires: Postgres with exclusion constraint migrated, REDIS_URL optional,
 * seed data, RUN_DB_TESTS=1 DEMO_MODE=false.
 *
 * Skipped by default in CI/local when DB is unavailable.
 */
const runDb = process.env.RUN_DB_TESTS === "1";

describe.skipIf(!runDb)("DB integration — concurrent bookings", () => {
  it("only one booking survives 5 parallel POST /api/bookings", async () => {
    const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
    const slug = process.env.TEST_TENANT_SLUG ?? "dom-carlos-barbearia";

    const tenantRes = await fetch(`${base}/api/tenants/${slug}`);
    expect(tenantRes.ok).toBe(true);
    const tenant = (await tenantRes.json()) as {
      services: { id: string }[];
      staff: { id: string }[];
    };

    const serviceId = tenant.services[0]!.id;
    const staffId = tenant.staff[0]!.id;

    // Pick a date 7 days out
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 7);
    const dateLocal = date.toISOString().slice(0, 10);

    const slotsRes = await fetch(
      `${base}/api/slots?slug=${slug}&serviceId=${serviceId}&staffId=${staffId}&date=${dateLocal}`,
    );
    expect(slotsRes.ok).toBe(true);
    const slotsJson = (await slotsRes.json()) as {
      slots: { startsAt: string }[];
    };
    expect(slotsJson.slots.length).toBeGreaterThan(0);
    const startsAt = slotsJson.slots[0]!.startsAt;

    const bodies = Array.from({ length: 5 }, (_, i) => ({
      tenantSlug: slug,
      serviceId,
      staffId,
      startsAt,
      source: "public_web",
      customer: {
        name: `DB Race ${i}`,
        phone: `3398888${String(1000 + i).slice(-4)}`,
      },
    }));

    const results = await Promise.all(
      bodies.map((body) =>
        fetch(`${base}/api/bookings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(async (r) => ({
          status: r.status,
          json: await r.json(),
        })),
      ),
    );

    const ok = results.filter((r) => r.status === 201);
    const conflict = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(1);
    expect(conflict).toHaveLength(4);
  });
});

// Silence unused import when skipped
void vi;
