import { PrismaClient, MasterKind } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MASTER: [MasterKind, string[]][] = [
  ["LOCATION", ["Studio A", "Studio B", "Control Room", "Office", "Transmitter Site"]],
  ["SHIFT", ["Morning", "Afternoon", "Night"]],
  ["SHOW_GROUP", ["News", "Entertainment", "Production", "Engineering"]],
  ["CATEGORY", ["Network", "Hardware", "Software", "Audio", "Video", "Other"]],
  ["ACTIVITY_TYPE", ["Maintenance", "Installation", "Inspection", "Documentation", "Other"]],
];

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      firstName: "System",
      middleInitial: null,
      surname: "Administrator",
      email: "admin@opslog.local",
      username: "admin",
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: "ADMIN",
    },
  });

  if (process.env.SEED_DEMO_USER === "true") {
    const userPassword = process.env.SEED_USER_PASSWORD || "user123";

    await prisma.user.upsert({
      where: { username: "user" },
      update: {},
      create: {
        firstName: "Demo",
        middleInitial: null,
        surname: "User",
        email: "user@opslog.local",
        username: "user",
        passwordHash: await bcrypt.hash(userPassword, 10),
        role: "USER",
      },
    });

    console.log(
      `Demo account also created: "user" / "${userPassword}" — do not leave this enabled in production.`
    );
  }

  for (const [kind, values] of MASTER) {
    for (const [i, value] of values.entries()) {
      await prisma.masterData.upsert({
        where: { kind_value: { kind, value } },
        update: {},
        create: {
          kind,
          value,
          sort: i,
        },
      });
    }
  }

  await prisma.branding.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      title: "MAMS Support Operations Tracker",
      tagline: "Technical assistance and task logging",
    },
  });

  console.log(
    `Seeded. Bootstrap admin: "admin" / "${adminPassword}" — change this immediately.`
  );
  console.log(`Admin user id: ${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
