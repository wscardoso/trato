import { NextResponse } from "next/server";
import { createBookingAtomic } from "@/lib/booking-service";
import { createBookingSchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_JSON", message: "Corpo inválido" },
      { status: 400 },
    );
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_ERROR",
        message: "Dados inválidos",
        issues: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  const idempotencyKey =
    request.headers.get("Idempotency-Key") ??
    request.headers.get("idempotency-key");

  try {
    const result = await createBookingAtomic(parsed.data, idempotencyKey);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.code, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json({ booking: result.booking }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/bookings]", err);
    return NextResponse.json(
      { error: "INTERNAL", message: "Falha ao criar agendamento" },
      { status: 500 },
    );
  }
}
