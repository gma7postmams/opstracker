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

/**
 * The team roster. Renan is seeded as ADMIN since a team needs at least one
 * account able to manage users and branding — adjust roles afterwards from
 * the Users page as needed.
 */
const TEAM: { username: string; firstName: string; middleInitial: string | null; surname: string; role: "ADMIN" | "USER" }[] = [
  { username: "renan", firstName: "Renan", middleInitial: null, surname: "Piatos", role: "ADMIN" },
  { username: "janice", firstName: "Janice", middleInitial: "M", surname: "Revilla", role: "USER" },
  { username: "patty", firstName: "Patty", middleInitial: null, surname: "Ting", role: "USER" },
  { username: "andy", firstName: "Andy", middleInitial: "C", surname: "Lim", role: "USER" },
  { username: "alejandro", firstName: "Alejandro", middleInitial: "A", surname: "Pikit", role: "USER" },
  { username: "feonna", firstName: "Feonna", middleInitial: null, surname: "Biong", role: "USER" },
  { username: "sisfrunio", firstName: "Sisfrunio", middleInitial: null, surname: "Balsac", role: "USER" },
  { username: "gabriel", firstName: "Gabriel", middleInitial: "S", surname: "Bisaya", role: "USER" },
  { username: "marygrace", firstName: "Mary", middleInitial: "G", surname: "Piattos", role: "USER" },
  { username: "nova", firstName: "Nova", middleInitial: null, surname: "Santos", role: "USER" },
];

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const userPassword = process.env.SEED_USER_PASSWORD || "user123";

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      firstName: "System", middleInitial: null, surname: "Administrator",
      email: "admin@opslog.local", username: "admin",
      passwordHash: await bcrypt.hash(adminPassword, 10), role: "ADMIN",
    },
  });

  // A generic "user" account is useful for demos but is a live weak credential
  // in production, so it is opt-in rather than seeded by default.
  if (process.env.SEED_DEMO_USER === "true") {
    await prisma.user.upsert({
      where: { username: "user" },
      update: {},
      create: {
        firstName: "Demo", middleInitial: null, surname: "User",
        email: "user@opslog.local", username: "user",
        passwordHash: await bcrypt.hash(userPassword, 10), role: "USER",
      },
    });
  }

  // Each teammate gets a default password of "<username>123" — change these
  // on first login. Kept per-user (not a shared password) so one leaked
  // credential doesn't expose every account.
  for (const t of TEAM) {
    await prisma.user.upsert({
      where: { username: t.username },
      update: {},
      create: {
        firstName: t.firstName,
        middleInitial: t.middleInitial,
        surname: t.surname,
        email: `${t.username}@opslog.local`,
        username: t.username,
        passwordHash: await bcrypt.hash(`${t.username}123`, 10),
        role: t.role,
      },
    });
  }

  for (const [kind, values] of MASTER) {
    for (const [i, value] of values.entries()) {
      await prisma.masterData.upsert({
        where: { kind_value: { kind, value } },
        update: {},
        create: { kind, value, sort: i },
      });
    }
  }

  await prisma.branding.upsert({
    where: { id: 1 }, update: {},
    create: { id: 1, title: "MAMS Support Operations Tracker", tagline: "Technical assistance and task logging" },
  });

  console.log(`Seeded. Bootstrap admin: "admin" / "${adminPassword}" — change this immediately.`);
  if (process.env.SEED_DEMO_USER === "true") {
    console.log(`Demo account also created: "user" / "${userPassword}" — do not leave this enabled in production.`);
  }
  console.log(`Also seeded ${TEAM.length} named team accounts — username / <username>123 — change these on first login.`);
  console.log(`Admin user id: ${admin.id}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
