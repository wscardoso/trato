import { afterEach, describe, expect, it, vi } from "vitest";
import { createBookingAtomic } from "@/lib/booking-service";
import { resetDemoBookings } from "@/lib/demo-store";
import {
  deliverWhatsAppForTest,
  type BookingNotifyContext,
} from "@/lib/whatsapp";
import { bookingPayload } from "./helpers";

function sampleCtx(): BookingNotifyContext {
  return {
    bookingId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantName: "DOM CARLOS BARBEARIA",
    tenantSlug: "dom-carlos-barbearia",
    address: "AV BRASIL, 142",
    timezone: "America/Sao_Paulo",
    waInstanceId: "uazapi-instance-token",
    waProvider: "uazapi",
    customerName: "Cliente",
    customerPhoneE164: "+5533999990001",
    serviceName: "Corte Social",
    staffName: "Carlos",
    startsAt: new Date("2026-06-10T15:00:00.000Z"),
    endsAt: new Date("2026-06-10T15:35:00.000Z"),
    durationMin: 35,
    priceCents: 3000,
    currency: "BRL",
    status: "CONFIRMED",
  };
}

describe("Webhook failure resilience (WhatsApp downtime)", () => {
  afterEach(() => {
    resetDemoBookings();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.UAZAPI_BASE_URL;
    delete process.env.UAZAPI_TOKEN;
  });

  it("completes booking successfully even when WhatsApp provider would be down", async () => {
    process.env.UAZAPI_BASE_URL = "https://wa.example.invalid";
    process.env.UAZAPI_TOKEN = "test-token";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("Internal Server Error", { status: 500 }),
      ),
    );

    const result = await createBookingAtomic(bookingPayload());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.booking.id).toBeTruthy();
    expect(result.booking.status).toBe("CONFIRMED");
  });

  it("marks failed WhatsApp delivery as retry (queueable) on HTTP 500", async () => {
    process.env.UAZAPI_BASE_URL = "https://wa.example.invalid";

    const fetchMock = vi.fn(async () =>
      new Response("provider down", { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const delivery = await deliverWhatsAppForTest(
      sampleCtx(),
      "Olá — teste de falha",
    );

    expect(delivery.status).toBe("retry");
    expect(delivery.error).toMatch(/HTTP_500/);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://wa.example.invalid/send/text",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          token: "uazapi-instance-token",
        }),
      }),
    );
  });

  it("marks network errors as retry without throwing", async () => {
    process.env.UAZAPI_BASE_URL = "https://wa.example.invalid";

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );

    const delivery = await deliverWhatsAppForTest(sampleCtx(), "texto");
    expect(delivery.status).toBe("retry");
    expect(delivery.error).toContain("ECONNREFUSED");
  });

  it("posts to uazapi /send/text with token header on success", async () => {
    process.env.UAZAPI_BASE_URL = "https://demo.uazapi.com";

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: "msg-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const delivery = await deliverWhatsAppForTest(sampleCtx(), "ok");
    expect(delivery.status).toBe("sent");
    expect(delivery.providerMsgId).toBe("msg-123");

    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    const [url, init] = call as unknown as [string, RequestInit];
    expect(url).toBe("https://demo.uazapi.com/send/text");
    expect((init.headers as Record<string, string>).token).toBe(
      "uazapi-instance-token",
    );
    const body = JSON.parse(String(init.body)) as {
      number: string;
      text: string;
      linkPreview: boolean;
    };
    expect(body.number).toBe("5533999990001");
    expect(body.text).toBe("ok");
    expect(body.linkPreview).toBe(false);
  });
});
