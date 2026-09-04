import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Não autenticado" },
      { status: 401 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: session.userId, tenantId: session.tenantId, isActive: true },
    include: {
      tenant: { select: { id: true, slug: true, name: true } },
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Sessão inválida" },
      { status: 401 },
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      tenantSlug: user.tenant.slug,
      tenantName: user.tenant.name,
    },
  });
}
