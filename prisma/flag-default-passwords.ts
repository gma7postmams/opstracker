/**
 * One-off for databases seeded before random passwords existed: finds accounts
 * still using a well-known default (admin123, user123, <username>123 or the
 * username itself) and flags them so the owner must pick a new password at
 * next sign-in. Passwords are only compared, never printed or changed.
 *
 *   npm run db:flag-defaults
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { mustChangePassword: false } });
  let flagged = 0;

  for (const u of users) {
    const guesses = [`${u.username}123`, u.username, "admin123", "user123"];
    let weak = false;
    for (const g of guesses) {
      if (await bcrypt.compare(g, u.passwordHash)) { weak = true; break; }
    }
    if (!weak) continue;
    await prisma.user.update({ where: { id: u.id }, data: { mustChangePassword: true } });
    console.log(`Flagged: ${u.username}`);
    flagged++;
  }

  console.log(`${flagged} of ${users.length} account(s) flagged for a password change.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
