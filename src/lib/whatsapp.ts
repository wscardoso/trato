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
    `Olá ${ctx.customerName}! ✅ Seu horário na *${ctx.tenantName}* está reservado.`,
    "",
    `📋 Serviço: ${ctx.serviceName}`,
    `💈 Profissional: ${ctx.staffName}`,
    `🗓️ Quando: ${localWhen(ctx.startsAt, ctx.timezone)}`,
    ctx.address ? `📍 ${ctx.address}` : null,
    "",
    "Um dia antes do horário pedimos confirmação de presença.",
    "Se precisar desmarcar agora, use o botão abaixo para liberar a vaga.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

function buildReminder24Message(ctx: BookingNotifyContext): string {
  return [
    `Oi ${ctx.customerName}! Lembrete do seu horário na *${ctx.tenantName}* amanhã.`,
    "",
    `📋 Serviço: ${ctx.serviceName}`,
    `💈 Profissional: ${ctx.staffName}`,
    `🗓️ Quando: ${localWhen(ctx.startsAt, ctx.timezone)}`,
    ctx.address ? `📍 ${ctx.address}` : null,
    "",
    "Confirme sua presença ou cancele para liberar a vaga.",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

function buildReminder2Message(ctx: BookingNotifyContext): string {
  return [
    `Oi ${ctx.customerName}! Em cerca de 2 horas é o seu horário na *${ctx.tenantName}*.`,
    "",
    `📋 ${ctx.serviceName} com ${ctx.staffName}`,
    `🗓️ ${localWhen(ctx.startsAt, ctx.timezone)}`,
    ctx.address ? `📍 ${ctx.address}` : null,
    "",
    "Te esperamos!",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

function cancelOnlyChoices(bookingId: string): string[] {
  return [`Cancelar horário|cancel:${bookingId}`];
}

function confirmCancelChoices(bookingId: string): string[] {
  return [
    `Confirmar presença|confirm:${bookingId}`,
    `Cancelar horário|cancel:${bookingId}`,
  ];
}

function menuFallbackText(text: string, choices: string[]): string {
  const lines = choices.map((c) => {
    const [label, id] = c.split("|");
    if (id?.startsWith("confirm:")) {
      return `✅ CONFIRMAR ${id.slice("confirm:".length).slice(0, 8)}`;
    }
    if (id?.startsWith("cancel:")) {
      return `❌ CANCELAR ${id.slice("cancel:".length).slice(0, 8)}`;
    }
    return label;
  });
  return `${text}\n\nResponda:\n${lines.join("\n")}`;
}

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

function resolveUazapiToken(ctx?: Pick<BookingNotifyContext, "waInstanceId"> | null): string | null {
  return ctx?.waInstanceId || process.env.UAZAPI_TOKEN || null;
}

function uazapiBaseUrl(): string {
  return (process.env.UAZAPI_BASE_URL ?? "").replace(/\/$/, "");
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

let webhookEnsurePromise: Promise<void> | null = null;

/** Register inbound webhook once per process so button replies reach Trato. */
export async function ensureUazapiWebhook(): Promise<void> {
  if (webhookEnsurePromise) return webhookEnsurePromise;
  webhookEnsurePromise = (async () => {
    const baseUrl = uazapiBaseUrl();
    const token = process.env.UAZAPI_TOKEN;
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    if (!baseUrl || !token || !appUrl) return;

    const webhookUrl = `${appUrl}/api/webhooks/uazapi`;
    try {
      const res = await fetch(`${baseUrl}/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token,
        },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          events: ["messages"],
          excludeMessages: ["fromMeYes"],
        }),
      });
      console.info("[whatsapp:webhook]", {
        status: res.status,
        url: webhookUrl,
        ok: res.ok,
      });
    } catch (err) {
      console.error("[whatsapp:webhook] failed", err);
    }
  })();
  return webhookEnsurePromise;
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
  const baseUrl = uazapiBaseUrl();
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

async function sendMenuViaProvider(
  ctx: BookingNotifyContext,
  text: string,
  choices: string[],
): Promise<{ providerMsgId: string | null; status: string; error?: string }> {
  const baseUrl = uazapiBaseUrl();
  const token = resolveUazapiToken(ctx);

  if (!baseUrl || !token) {
    console.info("[whatsapp:dry-run-menu]", {
      to: ctx.customerPhoneE164,
      text: text.slice(0, 120),
      choices,
    });
    return { providerMsgId: null, status: "queued" };
  }

  try {
    await ensureUazapiWebhook();
    const res = await fetch(`${baseUrl}/send/menu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({
        number: digitsOnly(ctx.customerPhoneE164),
        type: "button",
        text,
        choices,
        footerText: "Trato · agendamento com compromisso",
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[whatsapp:menu-fallback]", res.status, errText.slice(0, 200));
      return sendViaProvider(ctx, menuFallbackText(text, choices));
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

export async function sendWhatsAppText(
  toPhone: string,
  text: string,
): Promise<{ status: string; error?: string }> {
  const baseUrl = uazapiBaseUrl();
  const token = process.env.UAZAPI_TOKEN;
  if (!baseUrl || !token) {
    console.info("[whatsapp:dry-run-reply]", { to: toPhone, text: text.slice(0, 120) });
    return { status: "queued" };
  }

  try {
    const res = await fetch(`${baseUrl}/send/text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({
        number: digitsOnly(toPhone),
        text,
        linkPreview: false,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { status: "retry", error: `HTTP_${res.status}: ${errText}`.slice(0, 500) };
    }
    return { status: "sent" };
  } catch (err) {
    return {
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

/** Demo / no-DB path: receipt with Cancel only (confirm comes on D−1). */
export async function sendBookingCreatedMessage(
  ctx: BookingNotifyContext,
): Promise<{ status: string; error?: string }> {
  const text = buildCreatedMessage(ctx);
  const choices = cancelOnlyChoices(ctx.bookingId);
  const result = await sendMenuViaProvider(ctx, text, choices);
  console.info("[whatsapp:demo-send]", {
    to: digitsOnly(ctx.customerPhoneE164),
    status: result.status,
    error: result.error ?? null,
    providerMsgId: result.providerMsgId,
  });
  return { status: result.status, error: result.error };
}

/** D−1 reminder: Confirm + Cancel to free the slot. */
export async function sendReminder24Message(
  ctx: BookingNotifyContext,
): Promise<{ status: string; error?: string; providerMsgId?: string | null }> {
  const text = buildReminder24Message(ctx);
  const choices = confirmCancelChoices(ctx.bookingId);
  const result = await sendMenuViaProvider(ctx, text, choices);
  console.info("[whatsapp:reminder-24h]", {
    to: digitsOnly(ctx.customerPhoneE164),
    bookingId: ctx.bookingId,
    status: result.status,
    error: result.error ?? null,
    providerMsgId: result.providerMsgId,
  });
  return {
    status: result.status,
    error: result.error,
    providerMsgId: result.providerMsgId,
  };
}

/** Delay until D−1; if already inside the 24h window, wait ~60s (demo-friendly). */
export function reminder24DelayMs(startsAt: Date, nowMs = Date.now()): number {
  const dueMs = DateTime.fromJSDate(startsAt, { zone: "utc" })
    .minus({ hours: 24 })
    .toMillis();
  const remaining = dueMs - nowMs;
  return remaining <= 60_000 ? 60_000 : remaining;
}

export function scheduleDemoReminder24(ctx: BookingNotifyContext): void {
  const delay = reminder24DelayMs(ctx.startsAt);
  const MAX_TIMEOUT = 2_147_483_647;
  if (delay > MAX_TIMEOUT) {
    console.warn("[whatsapp:demo-reminder] skip — delay exceeds setTimeout cap", {
      bookingId: ctx.bookingId,
      delay,
    });
    return;
  }

  console.info("[whatsapp:demo-reminder] scheduled", {
    bookingId: ctx.bookingId,
    delayMs: delay,
  });

  setTimeout(() => {
    void (async () => {
      try {
        const { getDemoBooking } = await import("@/lib/demo-store");
        const booking = getDemoBooking(ctx.bookingId);
        if (!booking || booking.status !== "CONFIRMED") {
          console.info("[whatsapp:demo-reminder] skipped", {
            bookingId: ctx.bookingId,
            status: booking?.status ?? "missing",
          });
          return;
        }
        await sendReminder24Message(ctx);
      } catch (err) {
        console.error("[whatsapp:demo-reminder] failed", err);
      }
    })();
  }, delay);
}

export async function enqueueBookingCreated(
  ctx: BookingNotifyContext,
): Promise<void> {
  const text = buildCreatedMessage(ctx);
  const choices = cancelOnlyChoices(ctx.bookingId);
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
    message: { type: "button", text, choices },
    provider: {
      name: ctx.waProvider ?? "uazapi",
      endpoint: "/send/menu",
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

  void (async () => {
    const result = await sendMenuViaProvider(ctx, text, choices);
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

  const now = DateTime.utc();
  const reminder24Raw = DateTime.fromJSDate(ctx.startsAt, { zone: "utc" }).minus({
    hours: 24,
  });
  // Inside 24h window → schedule immediately so confirm is not on the receipt
  const reminder24When = reminder24Raw <= now ? now : reminder24Raw;
  const reminder2 = DateTime.fromJSDate(ctx.startsAt, { zone: "utc" }).minus({
    hours: 2,
  });
  const feedback = DateTime.fromJSDate(ctx.endsAt, { zone: "utc" }).plus({
    minutes: 30,
  });

  const reminder24Text = buildReminder24Message(ctx);
  const reminder24Choices = confirmCancelChoices(ctx.bookingId);

  const delayed: Array<{
    event: NotificationEvent;
    templateKey: string;
    when: DateTime;
    payload: Prisma.InputJsonValue;
  }> = [
    {
      event: "REMINDER_24H",
      templateKey: "reminder_24h_v1",
      when: reminder24When,
      payload: {
        event: "REMINDER_24H",
        templateKey: "reminder_24h_v1",
        scheduledFor: reminder24When.toISO(),
        bookingId: ctx.bookingId,
        message: {
          type: "button",
          text: reminder24Text,
          choices: reminder24Choices,
        },
      },
    },
    {
      event: "REMINDER_2H",
      templateKey: "reminder_2h_v1",
      when: reminder2,
      payload: {
        event: "REMINDER_2H",
        scheduledFor: reminder2.toISO(),
        bookingId: ctx.bookingId,
        message: { type: "text", text: buildReminder2Message(ctx) },
      },
    },
    {
      event: "FEEDBACK_POST_SERVICE",
      templateKey: "feedback_post_v1",
      when: feedback,
      payload: {
        event: "FEEDBACK_POST_SERVICE",
        scheduledFor: feedback.toISO(),
        bookingId: ctx.bookingId,
      },
    },
  ];

  await prisma.notificationLog.createMany({
    data: delayed
      .filter((d) => d.event === "REMINDER_24H" || d.when > now)
      .map((d) => ({
        tenantId: ctx.tenantId,
        bookingId: ctx.bookingId,
        channel: "WHATSAPP" as const,
        event: d.event,
        toE164,
        templateKey: d.templateKey,
        payload: d.payload,
        status: "queued",
        scheduledFor: d.when.toJSDate(),
      })),
  });
}

type BookingWithRelations = {
  id: string;
  status: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  priceCents: number;
  currency: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    addressLine1: string | null;
    city: string | null;
    state: string | null;
    waInstanceId: string | null;
    waProvider: string | null;
  };
  customer: { name: string; phoneE164: string };
  staff: { displayName: string };
  service: { name: string; durationMin: number };
};

function ctxFromBooking(booking: BookingWithRelations): BookingNotifyContext {
  const t = booking.tenant;
  return {
    bookingId: booking.id,
    tenantId: t.id,
    tenantName: t.name,
    tenantSlug: t.slug,
    address: [t.addressLine1, t.city, t.state].filter(Boolean).join(", "),
    timezone: booking.timezone || t.timezone,
    waInstanceId: t.waInstanceId,
    waProvider: t.waProvider,
    customerName: booking.customer.name,
    customerPhoneE164: booking.customer.phoneE164,
    serviceName: booking.service.name,
    staffName: booking.staff.displayName,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    durationMin: booking.service.durationMin,
    priceCents: booking.priceCents,
    currency: booking.currency,
    status: booking.status,
  };
}

/** Drain due NotificationLog rows (cron / worker). */
export async function processQueuedNotifications(
  limit = 20,
): Promise<{ processed: number; sent: number; skipped: number; retry: number }> {
  const due = await prisma.notificationLog.findMany({
    where: {
      status: { in: ["queued", "retry"] },
      scheduledFor: { lte: new Date() },
      event: { in: ["REMINDER_24H", "REMINDER_2H"] },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let sent = 0;
  let skipped = 0;
  let retry = 0;

  for (const log of due) {
    if (!log.bookingId) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status: "skipped", error: "missing_booking_id" },
      });
      skipped += 1;
      continue;
    }

    const booking = await prisma.booking.findUnique({
      where: { id: log.bookingId },
      include: {
        tenant: true,
        customer: true,
        staff: true,
        service: true,
      },
    });

    if (
      !booking ||
      booking.status === "CANCELLED" ||
      booking.status === "EXPIRED" ||
      booking.status === "NO_SHOW"
    ) {
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: {
          status: "skipped",
          error: booking ? `booking_${booking.status.toLowerCase()}` : "booking_missing",
        },
      });
      skipped += 1;
      continue;
    }

    const ctx = ctxFromBooking(booking);
    const result =
      log.event === "REMINDER_24H"
        ? await sendReminder24Message(ctx)
        : await sendViaProvider(ctx, buildReminder2Message(ctx));

    await prisma.notificationLog.update({
      where: { id: log.id },
      data: {
        status: result.status,
        providerMsgId: result.providerMsgId ?? null,
        error: result.error ?? null,
        sentAt: result.status === "sent" ? new Date() : null,
      },
    });

    if (result.status === "sent" || result.status === "queued") sent += 1;
    else if (result.status === "retry") retry += 1;
  }

  return { processed: due.length, sent, skipped, retry };
}
