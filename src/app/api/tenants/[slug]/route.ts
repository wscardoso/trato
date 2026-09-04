import { NextResponse } from "next/server";
import { getPublicTenant } from "@/lib/booking-service";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  try {
    const tenant = await getPublicTenant(slug);
    if (!tenant) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(tenant, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    console.error("[GET /api/tenants/:slug]", err);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }
}
