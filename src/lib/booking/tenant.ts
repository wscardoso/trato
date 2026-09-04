import type { Prisma } from "@prisma/client";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { formatAddress } from "@/lib/formatters/br";
import { getDemoTenant, isDemoMode } from "@/lib/demo-store";

export type PublicTenantPayload = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  locale: string;
  currency: string;
  brandPrimary: string | null;
  logoUrl: string | null;
  phone: string | null;
  address: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  maxAdvanceDays: number;
  minLeadMin: number;
  depositRequired: boolean;
  slotIntervalMin: number;
  services: PublicService[];
  staff: PublicStaff[];
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  currency: string;
  category: string | null;
  staffIds: string[];
};

export type PublicStaff = {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  color: string | null;
  serviceIds: string[];
};

const tenantPublicInclude = {
  services: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" as const },
    include: {
      staff: { select: { staffId: true } },
    },
  },
  staff: {
    where: { status: "ACTIVE" as const },
    orderBy: { sortOrder: "asc" as const },
    include: {
      services: { select: { serviceId: true } },
    },
  },
} satisfies Prisma.TenantInclude;

export async function getTenantBySlug(
  slug: string,
): Promise<PublicTenantPayload | null> {
  if (isDemoMode()) {
    const demo = getDemoTenant(slug);
    if (!demo) return null;
    const staffIds = demo.staff.map((s) => s.id);
    const serviceIds = demo.services.map((s) => s.id);
    return {
      id: demo.id,
      slug: demo.slug,
      name: demo.name,
      timezone: demo.timezone,
      locale: "pt-BR",
      currency: "BRL",
      brandPrimary: demo.brandPrimary,
      logoUrl: demo.logoUrl,
      phone: null,
      address: formatAddress(demo),
      addressLine1: demo.addressLine1,
      addressLine2: null,
      city: demo.city,
      state: demo.state,
      maxAdvanceDays: demo.maxAdvanceDays,
      minLeadMin: 60,
      depositRequired: false,
      slotIntervalMin: demo.slotIntervalMin,
      services: demo.services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        durationMin: s.durationMin,
        priceCents: s.priceCents,
        currency: "BRL",
        category: s.category,
        staffIds,
      })),
      staff: demo.staff.map((s) => ({
        id: s.id,
        displayName: s.displayName,
        bio: s.bio,
        avatarUrl: s.avatarUrl,
        color: null,
        serviceIds,
      })),
    };
  }

  const tenant = await prisma.tenant.findFirst({
    where: { slug, isActive: true },
    include: tenantPublicInclude,
  });

  if (!tenant) return null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    timezone: tenant.timezone,
    locale: tenant.locale,
    currency: tenant.currency,
    brandPrimary: tenant.brandPrimary,
    logoUrl: tenant.logoUrl,
    phone: tenant.phone,
    address: formatAddress(tenant),
    addressLine1: tenant.addressLine1,
    addressLine2: tenant.addressLine2,
    city: tenant.city,
    state: tenant.state,
    maxAdvanceDays: tenant.maxAdvanceDays,
    minLeadMin: tenant.minLeadMin,
    depositRequired: tenant.depositRequired,
    slotIntervalMin: tenant.slotIntervalMin,
    services: tenant.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      currency: s.currency,
      category: s.category,
      staffIds: s.staff.map((x) => x.staffId),
    })),
    staff: tenant.staff.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      bio: s.bio,
      avatarUrl: s.avatarUrl,
      color: s.color,
      serviceIds: s.services.map((x) => x.serviceId),
    })),
  };
}

export function isDateWithinHorizon(
  dateLocal: string,
  timezone: string,
  maxAdvanceDays: number,
): boolean {
  const today = DateTime.now().setZone(timezone).startOf("day");
  const target = DateTime.fromISO(dateLocal, { zone: timezone }).startOf(
    "day",
  );
  if (!target.isValid) return false;
  if (target < today) return false;
  const max = today.plus({ days: maxAdvanceDays });
  return target <= max;
}
