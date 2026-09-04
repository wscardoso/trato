import { NextResponse } from "next/server";
import { getAvailableSlots } from "@/lib/booking-service";
import { slotsQuerySchema } from "@/lib/validations";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = slotsQuerySchema.safeParse({
    slug: searchParams.get("slug"),
    serviceId: searchParams.get("serviceId"),
    staffId: searchParams.get("staffId") || undefined,
    date: searchParams.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await getAvailableSlots({
      slug: parsed.data.slug,
      serviceId: parsed.data.serviceId,
      staffId: parsed.data.staffId,
      dateLocal: parsed.data.date,
    });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=15",
      },
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "TENANT_NOT_FOUND") {
        return NextResponse.json(
          { error: "TENANT_NOT_FOUND" },
          { status: 404 },
        );
      }
      if (err.message === "SERVICE_NOT_FOUND") {
        return NextResponse.json(
          { error: "SERVICE_NOT_FOUND" },
          { status: 404 },
        );
      }
    }
    console.error("[GET /api/slots]", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
