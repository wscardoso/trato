import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const OWNER_ROLES = new Set(["OWNER", "MANAGER", "SUPER_ADMIN"]);

export async function requireOwnerSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session || !OWNER_ROLES.has(session.role)) {
    redirect("/app/login");
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
      isActive: true,
    },
    select: { id: true, role: true },
  });

  if (!user || !OWNER_ROLES.has(user.role)) {
    redirect("/app/login");
  }

  return session;
}

export async function requireOwnerApi(): Promise<
  { ok: true; session: SessionPayload } | { ok: false; response: NextResponse }
> {
  const session = await getSession();
  if (!session || !OWNER_ROLES.has(session.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Faça login para continuar" },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findFirst({
    where: {
      id: session.userId,
      tenantId: session.tenantId,
      isActive: true,
    },
    select: { id: true, role: true },
  });

  if (!user || !OWNER_ROLES.has(user.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sessão inválida" },
        { status: 401 },
      ),
    };
  }

  return { ok: true, session };
}
