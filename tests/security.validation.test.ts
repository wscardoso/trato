import { describe, expect, it } from "vitest";
import { createBookingAtomic, getPublicTenant } from "@/lib/booking-service";
import {
  createBookingSchema,
  sanitizePlainText,
  slotsQuerySchema,
} from "@/lib/validations";
import {
  DEMO_SERVICE_ID,
  DEMO_STAFF_ID,
  DEMO_TENANT_SLUG,
  bookingPayload,
  findOpenDemoSlot,
} from "./helpers";

describe("Validation & security penetration", () => {
  it("sanitizes XSS payloads in plain-text fields", () => {
    expect(sanitizePlainText('<script>alert(1)</script>João')).toBe("João");
    expect(sanitizePlainText('Evil<img src=x onerror=alert(1)>')).toBe("Evil");
    expect(sanitizePlainText("javascript:alert(1)")).toBe("alert(1)");
  });

  it("rejects / strips XSS in customer name via Zod schema", () => {
    const { startsAt } = findOpenDemoSlot();
    const parsed = createBookingSchema.safeParse({
      tenantSlug: DEMO_TENANT_SLUG,
      serviceId: DEMO_SERVICE_ID,
      staffId: DEMO_STAFF_ID,
      startsAt,
      customer: {
        name: '<script>alert("xss")</script>Maria Silva',
        phone: "33988776655",
        email: "",
        cpf: "",
        notes: '<img src=x onerror=alert(1)> anotação',
      },
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.customer.name).not.toMatch(/<script/i);
    expect(parsed.data.customer.name).toContain("Maria Silva");
    expect(parsed.data.customer.notes ?? "").not.toMatch(/<img|onerror/i);
  });

  it("does not treat SQL injection strings as executable — validation stays structural", () => {
    const { startsAt } = findOpenDemoSlot();
    const sqli = "'; customers; DROP TABLE bookings;--";

    const parsed = createBookingSchema.safeParse({
      tenantSlug: DEMO_TENANT_SLUG,
      serviceId: DEMO_SERVICE_ID,
      staffId: DEMO_STAFF_ID,
      startsAt,
      customer: {
        name: sqli,
        phone: "33988776655",
        notes: "1' OR '1'='1",
      },
    });

    // Name length may pass; Prisma parameterized queries prevent execution.
    // Assert schema never expands tenantSlug/serviceId from injection strings.
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.tenantSlug).toBe(DEMO_TENANT_SLUG);
    expect(parsed.data.serviceId).toBe(DEMO_SERVICE_ID);
    expect(parsed.data.customer.notes).toBe("1' OR '1'='1");
  });

  it("rejects non-UUID serviceId (injection / tampering)", () => {
    const parsed = createBookingSchema.safeParse({
      tenantSlug: DEMO_TENANT_SLUG,
      serviceId: "1; DROP TABLE bookings;--",
      staffId: null,
      startsAt: new Date().toISOString(),
      customer: { name: "Teste", phone: "33988776655" },
    });
    expect(parsed.success).toBe(false);
  });

  it("slots query accepts RFC UUIDs and rejects legacy non-version hex IDs", () => {
    const ok = slotsQuerySchema.safeParse({
      slug: DEMO_TENANT_SLUG,
      serviceId: DEMO_SERVICE_ID,
      date: "2026-09-10",
    });
    expect(ok.success).toBe(true);

    // Postgres uuid accepted these; Zod does not — root cause of staging VALIDATION_ERROR.
    const legacy = slotsQuerySchema.safeParse({
      slug: DEMO_TENANT_SLUG,
      serviceId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
      date: "2026-09-10",
    });
    expect(legacy.success).toBe(false);
  });

  it("enforces tenant isolation on public tenant lookup", async () => {
    const legit = await getPublicTenant(DEMO_TENANT_SLUG);
    const other = await getPublicTenant("tenant-b-inexistente");
    expect(legit).not.toBeNull();
    expect(legit!.slug).toBe(DEMO_TENANT_SLUG);
    expect(other).toBeNull();
  });

  it("rejects booking when serviceId does not belong to resolved tenant (demo)", async () => {
    const payload = bookingPayload({
      serviceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    const result = await createBookingAtomic(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("SERVICE_NOT_FOUND");
  });

  it("rejects foreign staff UUID that is not part of demo tenant roster", async () => {
    const payload = bookingPayload({
      staffId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    const result = await createBookingAtomic(payload);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(["SLOT_UNAVAILABLE", "STAFF_NOT_FOUND", "SERVICE_NOT_FOUND"]).toContain(
      result.code,
    );
  });
});
