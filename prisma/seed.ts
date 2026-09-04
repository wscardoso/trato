import { PrismaClient, DayOfWeek } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const prisma = new PrismaClient();

const WEEKDAYS: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

/**
 * Seed IDs must be RFC 4122 UUIDs (version + variant nibbles).
 * Postgres accepts looser hex, but Zod `z.string().uuid()` rejects them —
 * which caused VALIDATION_ERROR on /api/slots after DEMO_MODE was turned off.
 */
const SERVICE_IDS = {
  corteSocial: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  barba: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  combo: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
} as const;

const STAFF_IDS = {
  carlos: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  diego: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
} as const;

/** Legacy non-RFC IDs from the first seed — remap in place when present. */
const LEGACY_SERVICE_IDS: Array<{ from: string; to: string }> = [
  { from: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1", to: SERVICE_IDS.corteSocial },
  { from: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2", to: SERVICE_IDS.barba },
  { from: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3", to: SERVICE_IDS.combo },
];

const LEGACY_STAFF_IDS: Array<{ from: string; to: string }> = [
  { from: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1", to: STAFF_IDS.carlos },
  { from: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2", to: STAFF_IDS.diego },
];

async function remapServiceId(from: string, to: string) {
  const legacy = await prisma.service.findUnique({ where: { id: from } });
  if (!legacy) return;

  const target = await prisma.service.findUnique({ where: { id: to } });
  if (!target) {
    await prisma.service.create({
      data: {
        id: to,
        tenantId: legacy.tenantId,
        name: legacy.name,
        description: legacy.description,
        durationMin: legacy.durationMin,
        bufferAfterMin: legacy.bufferAfterMin,
        priceCents: legacy.priceCents,
        currency: legacy.currency,
        category: legacy.category,
        isActive: legacy.isActive,
        requiresDeposit: legacy.requiresDeposit,
        sortOrder: legacy.sortOrder,
      },
    });
  }

  // Junction rows are recreated by the seed upserts below.
  await prisma.$executeRawUnsafe(
    `DELETE FROM staff_services WHERE service_id = $1::uuid`,
    from,
  );
  await prisma.$executeRawUnsafe(
    `UPDATE bookings SET service_id = $1::uuid WHERE service_id = $2::uuid`,
    to,
    from,
  );
  await prisma.service.delete({ where: { id: from } });
}

async function remapStaffId(from: string, to: string) {
  const legacy = await prisma.staff.findUnique({ where: { id: from } });
  if (!legacy) return;

  const target = await prisma.staff.findUnique({ where: { id: to } });
  if (!target) {
    await prisma.staff.create({
      data: {
        id: to,
        tenantId: legacy.tenantId,
        userId: legacy.userId,
        locationId: legacy.locationId,
        displayName: legacy.displayName,
        bio: legacy.bio,
        avatarUrl: legacy.avatarUrl,
        color: legacy.color,
        status: legacy.status,
        sortOrder: legacy.sortOrder,
        slotIntervalMin: legacy.slotIntervalMin,
        bufferBeforeMin: legacy.bufferBeforeMin,
        bufferAfterMin: legacy.bufferAfterMin,
      },
    });
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM staff_services WHERE staff_id = $1::uuid`,
    from,
  );

  if (target) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM availability_rules WHERE staff_id = $1::uuid`,
      from,
    );
    await prisma.$executeRawUnsafe(
      `DELETE FROM availability_exceptions WHERE staff_id = $1::uuid`,
      from,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE availability_rules SET staff_id = $1::uuid WHERE staff_id = $2::uuid`,
      to,
      from,
    );
    await prisma.$executeRawUnsafe(
      `UPDATE availability_exceptions SET staff_id = $1::uuid WHERE staff_id = $2::uuid`,
      to,
      from,
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE bookings SET staff_id = $1::uuid WHERE staff_id = $2::uuid`,
    to,
    from,
  );
  await prisma.staff.delete({ where: { id: from } });
}

async function remapLegacyIds() {
  for (const { from, to } of LEGACY_SERVICE_IDS) {
    await remapServiceId(from, to);
  }
  for (const { from, to } of LEGACY_STAFF_IDS) {
    await remapStaffId(from, to);
  }
}

async function main() {
  await remapLegacyIds();

  const tenant = await prisma.tenant.upsert({
    where: { slug: "dom-carlos-barbearia" },
    update: {
      waProvider: "uazapi",
      waInstanceId: process.env.UAZAPI_TOKEN || undefined,
    },
    create: {
      slug: "dom-carlos-barbearia",
      name: "DOM CARLOS BARBEARIA",
      timezone: "America/Sao_Paulo",
      phone: "+5533999990000",
      whatsappE164: "5533999990000",
      addressLine1: "AV BRASIL, 142",
      addressLine2: "Parque das Nações",
      city: "Iapu",
      state: "MG",
      brandPrimary: "#C4A35A",
      slotIntervalMin: 15,
      minLeadMin: 30,
      maxAdvanceDays: 45,
      bufferBeforeMin: 0,
      bufferAfterMin: 5,
      waProvider: "uazapi",
      waInstanceId: process.env.UAZAPI_TOKEN || null,
    },
  });

  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: SERVICE_IDS.corteSocial },
      update: {},
      create: {
        id: SERVICE_IDS.corteSocial,
        tenantId: tenant.id,
        name: "Corte Social",
        description: "Corte clássico com acabamento",
        durationMin: 40,
        bufferAfterMin: 5,
        priceCents: 3500,
        category: "Cabelo",
        sortOrder: 1,
      },
    }),
    prisma.service.upsert({
      where: { id: SERVICE_IDS.barba },
      update: {},
      create: {
        id: SERVICE_IDS.barba,
        tenantId: tenant.id,
        name: "Barba",
        description: "Barba completa com toalha quente",
        durationMin: 30,
        bufferAfterMin: 5,
        priceCents: 2500,
        category: "Barba",
        sortOrder: 2,
      },
    }),
    prisma.service.upsert({
      where: { id: SERVICE_IDS.combo },
      update: {},
      create: {
        id: SERVICE_IDS.combo,
        tenantId: tenant.id,
        name: "Corte + Barba",
        durationMin: 60,
        bufferAfterMin: 10,
        priceCents: 5500,
        category: "Combo",
        sortOrder: 3,
      },
    }),
  ]);

  const carlos = await prisma.staff.upsert({
    where: { id: STAFF_IDS.carlos },
    update: {},
    create: {
      id: STAFF_IDS.carlos,
      tenantId: tenant.id,
      displayName: "Carlos",
      bio: "Especialista em cortes clássicos",
      color: "#8B6914",
      sortOrder: 1,
    },
  });

  const diego = await prisma.staff.upsert({
    where: { id: STAFF_IDS.diego },
    update: {},
    create: {
      id: STAFF_IDS.diego,
      tenantId: tenant.id,
      displayName: "Diego",
      bio: "Fade e degradês",
      color: "#4A3728",
      sortOrder: 2,
    },
  });

  for (const service of services) {
    for (const staff of [carlos, diego]) {
      await prisma.staffService.upsert({
        where: {
          staffId_serviceId: {
            staffId: staff.id,
            serviceId: service.id,
          },
        },
        update: {},
        create: {
          staffId: staff.id,
          serviceId: service.id,
          tenantId: tenant.id,
        },
      });
    }
  }

  for (const staff of [carlos, diego]) {
    for (const day of WEEKDAYS) {
      const existing = await prisma.availabilityRule.findFirst({
        where: { staffId: staff.id, dayOfWeek: day, startTime: "09:00" },
      });
      if (!existing) {
        await prisma.availabilityRule.create({
          data: {
            tenantId: tenant.id,
            staffId: staff.id,
            dayOfWeek: day,
            startTime: "09:00",
            endTime: day === "SAT" ? "14:00" : "19:00",
            breakStart: day === "SAT" ? null : "12:00",
            breakEnd: day === "SAT" ? null : "13:00",
            isActive: true,
          },
        });
      }
    }
  }

  const ownerPassword = process.env.OWNER_PASSWORD || "trato-demo";
  const passwordHash = hashPassword(ownerPassword);
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "dono@domcarlos.local",
      },
    },
    update: {
      name: "Dono Dom Carlos",
      role: "OWNER",
      isActive: true,
      passwordHash,
    },
    create: {
      tenantId: tenant.id,
      email: "dono@domcarlos.local",
      name: "Dono Dom Carlos",
      role: "OWNER",
      isActive: true,
      passwordHash,
    },
  });

  console.log("Seed OK → /agendar/dom-carlos-barbearia");
  console.log("Owner login → /app/login (dono@domcarlos.local)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
