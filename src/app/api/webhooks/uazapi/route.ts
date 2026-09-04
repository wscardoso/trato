import { NextResponse } from "next/server";
import {
  cancelDemoBooking,
  confirmDemoBooking,
  isDemoMode,
} from "@/lib/demo-store";
import { sendWhatsAppText } from "@/lib/whatsapp";

export const runtime = "nodejs";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object"
    ? (value as UnknownRecord)
    : null;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string" && value.trim()) out.push(value.trim());
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object") {
    for (const v of Object.values(value as UnknownRecord)) {
      collectStrings(v, out);
    }
  }
  return out;
}

function extractAction(payload: unknown): {
  action: "confirm" | "cancel" | null;
  bookingId: string | null;
  phone: string | null;
  fromMe: boolean;
} {
  const root = asRecord(payload);
  const message =
    asRecord(root?.message) ??
    asRecord(root?.data) ??
    asRecord(asRecord(root?.event)?.message) ??
    root;

  const fromMe = Boolean(message?.fromMe ?? root?.fromMe);
  const candidates = collectStrings(payload);
  const actionToken = candidates.find((s) =>
    /^(confirm|cancel):[0-9a-f-]{8,}$/i.test(s),
  );

  let action: "confirm" | "cancel" | null = null;
  let bookingId: string | null = null;

  if (actionToken) {
    const [rawAction, id] = actionToken.split(":");
    action = rawAction.toLowerCase() as "confirm" | "cancel";
    bookingId = id;
  } else {
    const joined = candidates.join("\n");
    const cancelMatch = joined.match(/CANCELAR\s+([0-9a-f-]{8,})/i);
    const confirmMatch = joined.match(/CONFIRMAR\s+([0-9a-f-]{8,})/i);
    if (cancelMatch) {
      action = "cancel";
      bookingId = cancelMatch[1];
    } else if (confirmMatch) {
      action = "confirm";
      bookingId = confirmMatch[1];
    }
  }

  const phoneRaw =
    (typeof message?.sender === "string" && message.sender) ||
    (typeof message?.chatid === "string" && message.chatid) ||
    (typeof message?.phone === "string" && message.phone) ||
    (typeof root?.chatid === "string" && root.chatid) ||
    "";

  return {
    action,
    bookingId,
    phone: phoneRaw ? digitsOnly(phoneRaw) : null,
    fromMe,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true, ignored: "invalid_json" });
  }

  console.info("[uazapi:webhook]", JSON.stringify(body).slice(0, 800));

  const { action, bookingId, phone, fromMe } = extractAction(body);
  if (fromMe) {
    return NextResponse.json({ ok: true, ignored: "from_me" });
  }
  if (!action || !bookingId) {
    return NextResponse.json({ ok: true, ignored: "no_action" });
  }

  if (!isDemoMode()) {
    return NextResponse.json({
      ok: true,
      ignored: "demo_only_actions",
      action,
      bookingId,
    });
  }

  const result =
    action === "cancel"
      ? cancelDemoBooking(bookingId)
      : confirmDemoBooking(bookingId);

  const replyTo = phone || result.booking?.phoneE164 || null;
  if (replyTo) {
    await sendWhatsAppText(replyTo, result.message);
  }

  console.info("[uazapi:action]", {
    action,
    bookingId,
    ok: result.ok,
    status: result.booking?.status ?? null,
  });

  return NextResponse.json({
    ok: result.ok,
    action,
    bookingId,
    message: result.message,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "trato-uazapi-webhook" });
}
