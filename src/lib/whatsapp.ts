import type { NotificationEvent, Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";

export type BookingNotifyContext = {
  bookingId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  address: string;
  timezone: string;
  /** uazapiGO instance token (Tenant.waInstanceId) */
  waInstanceId: string | null;
  waProvider: string | null;
  customerName: string;
  customerPhoneE164: string;
  serviceName: string;
  staffName: string;
  startsAt: Date;
  endsAt: Date;
  durationMin: number;
  priceCents: number;
  currency: string;
  status: string;
};

function localWhen(startsAt: Date, tz: string): string {
  return DateTime.fromJSDate(startsAt, { zone: "utc" })
    .setZone(tz)
    .toFormat("dd/MM/yyyy 'às' HH:mm");
}

function buildCreatedMessage(ctx: BookingNotifyContext): string {
  return [
    `Olá ${ctx.customerName}! ✅ Seu horário na *${ctx.tenantName}* está confirmado.`,
    "",
    `📋 Serviço: ${ctx.serviceName}`,
    `💈 Profissional: ${ctx.staffName}`,
    `🗓️ Quando: ${localWhen(ctx.startsAt, ctx.timezone)}`,
    ctx.address ? `📍 ${ctx.address}` : null,
    "",
    "Para cancelar ou remarcar, responda esta mensagem.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function resolveUazapiToken(ctx: BookingNotifyContext): string | null {
  return ctx.waInstanceId || process.env.UAZAPI_TOKEN || null;
}

function extractProviderMsgId(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as Record<string, unknown>;

  if (typeof obj.id === "string") return obj.id;
  if (typeof obj.messageid === "string") return obj.messageid;
  if (typeof obj.messageId === "string") return obj.messageId;

  const key = obj.key;
  if (key && typeof key === "object") {
    const keyId = (key as Record<string, unknown>).id;
    if (typeof keyId === "string") return keyId;
  }

  const message = obj.message;
  if (message && typeof message === "object") {
    const msgId = (message as Record<string, unknown>).id;
    if (typeof msgId === "string") return msgId;
  }

  return null;
}

/**
 * uazapiGO send path:
 * POST {UAZAPI_BASE_URL}/send/text
 * Header: token: <instance token>
 * Body: { number, text, linkPreview }
 * @see https://docs.uazapi.com/
 */
async function sendViaProvider(
  ctx: BookingNotifyContext,
  text: string,
): Promise<{ providerMsgId: string | null; status: string; error?: string }> {
  const baseUrl = (process.env.UAZAPI_BASE_URL ?? "").replace(/\/$/, "");
  const token = resolveUazapiToken(ctx);

  if (!baseUrl || !token) {
    console.info("[whatsapp:dry-run]", {
      provider: "uazapi",
      to: ctx.customerPhoneE164,
      text: text.slice(0, 120),
    });
    return { providerMsgId: null, status: "queued" };
  }

  try {
    const res = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({
        number: digitsOnly(ctx.customerPhoneE164),
        text,
        linkPreview: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        providerMsgId: null,
        status: "retry",
        error: `HTTP_${res.status}: ${errText}`.slice(0, 500),
      };
    }

    const json: unknown = await res.json();
    return {
      providerMsgId: extractProviderMsgId(json),
      status: "sent",
    };
  } catch (err) {
    return {
      providerMsgId: null,
      status: "retry",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

/** Exported for unit tests — simulates provider delivery without DB. */
export async function deliverWhatsAppForTest(
  ctx: BookingNotifyContext,
  text: string,
): Promise<{ providerMsgId: string | null; status: string; error?: string }> {
  return sendViaProvider(ctx, text);
}

/** Demo / no-DB path: send WhatsApp without NotificationLog persistence. */
export async function sendBookingCreatedMessage(
  ctx: BookingNotifyContext,
): Promise<{ status: string; error?: string }> {
  const text = buildCreatedMessage(ctx);
  const result = await sendViaProvider(ctx, text);
  console.info("[whatsapp:demo-send]", {
    to: digitsOnly(ctx.customerPhoneE164),
    status: result.status,
    error: result.error ?? null,
    providerMsgId: result.providerMsgId,
  });
  return { status: result.status, error: result.error };
}

export async function enqueueBookingCreated(
  ctx: BookingNotifyContext,
): Promise<void> {
  const text = buildCreatedMessage(ctx);
  const toE164 = digitsOnly(ctx.customerPhoneE164);
  const payload: Prisma.InputJsonValue = {
    event: "BOOKING_CREATED",
    templateKey: "booking_created_v1",
    channel: "WHATSAPP",
    toE164,
    tenant: {
      id: ctx.tenantId,
      name: ctx.tenantName,
      slug: ctx.tenantSlug,
    },
    booking: {
      id: ctx.bookingId,
      status: ctx.status,
      serviceName: ctx.serviceName,
      staffName: ctx.staffName,
      startsAt: ctx.startsAt.toISOString(),
      startsAtLocal: localWhen(ctx.startsAt, ctx.timezone),
      timezone: ctx.timezone,
      durationMin: ctx.durationMin,
      priceCents: ctx.priceCents,
      currency: ctx.currency,
      address: ctx.address,
    },
    customer: {
      name: ctx.customerName,
      phoneE164: toE164,
    },
    message: { type: "text", text },
    provider: {
      name: ctx.waProvider ?? "uazapi",
      endpoint: "/send/text",
    },
  };

  const log = await prisma.notificationLog.create({
    data: {
      tenantId: ctx.tenantId,
      bookingId: ctx.bookingId,
      channel: "WHATSAPP",
      event: "BOOKING_CREATED" satisfies NotificationEvent,
      toE164,
      templateKey: "booking_created_v1",
      payload,
      status: "queued",
      scheduledFor: new Date(),
    },
  });

  // Fire-and-forget provider call after DB commit
  void (async () => {
    const result = await sendViaProvider(ctx, text);
    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.status,
        providerMsgId: result.providerMsgId,
        error: result.error,
        sentAt: result.status === "sent" ? new Date() : null,
      },
    });
  })();

  // Schedule reminder logs (worker picks them up later)
  const reminder24 = DateTime.fromJSDate(ctx.startsAt, { zone: "utc" }).minus({
    hours: 24,
  });
  const reminder2 = DateTime.fromJSDate(ctx.startsAt, { zone: "utc" }).minus({
    hours: 2,
  });
  const feedback = DateTime.fromJSDate(ctx.endsAt, { zone: "utc" }).plus({
    minutes: 30,
  });

  const delayed: Array<{
    event: NotificationEvent;
    templateKey: string;
    when: DateTime;
  }> = [
    {
      event: "REMINDER_24H",
      templateKey: "reminder_24h_v1",
      when: reminder24,
    },
    { event: "REMINDER_2H", templateKey: "reminder_2h_v1", when: reminder2 },
    {
      event: "FEEDBACK_POST_SERVICE",
      templateKey: "feedback_post_v1",
      when: feedback,
    },
  ];

  await prisma.notificationLog.createMany({
    data: delayed
      .filter((d) => d.when > DateTime.utc())
      .map((d) => ({
        tenantId: ctx.tenantId,
        bookingId: ctx.bookingId,
        channel: "WHATSAPP" as const,
        event: d.event,
        toE164,
        templateKey: d.templateKey,
        payload: {
          event: d.event,
          scheduledFor: d.when.toISO(),
          bookingId: ctx.bookingId,
        },
        status: "queued",
        scheduledFor: d.when.toJSDate(),
      })),
  });
}
