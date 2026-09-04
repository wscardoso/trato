import { PrismaClient, DayOfWeek } from "@prisma/client";

const prisma = new PrismaClient();

const WEEKDAYS: DayOfWeek[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "dom-carlos-barbearia" },
    update: {},
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
    },
  });

  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1" },
      update: {},
      create: {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
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
      where: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2" },
      update: {},
      create: {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2",
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
      where: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3" },
      update: {},
      create: {
        id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3",
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
    where: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1" },
    update: {},
    create: {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1",
      tenantId: tenant.id,
      displayName: "Carlos",
      bio: "Especialista em cortes clássicos",
      color: "#8B6914",
      sortOrder: 1,
    },
  });

  const diego = await prisma.staff.upsert({
    where: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2" },
    update: {},
    create: {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
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

  console.log("Seed OK → /agendar/dom-carlos-barbearia");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
