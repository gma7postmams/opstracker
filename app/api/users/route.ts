import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { userCreateSchema, flatten } from "@/lib/validation";
import { fullName } from "@/lib/format";

const PUBLIC = {
  id: true, firstName: true, middleInitial: true, surname: true, email: true,
  username: true, role: true, avatarUrl: true, active: true, lastLogin: true,
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    select: {
      ...PUBLIC,
      _count: { select: { assistanceOwned: true, tasksOwned: true } },
    },
    orderBy: [{ surname: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json(
    users.map((u) => ({
      ...u,
      name: fullName(u),
      recordCount: u._count.assistanceOwned + u._count.tasksOwned,
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const parsed = userCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;

  const clash = await prisma.user.findFirst({
    where: { OR: [{ username: d.username }, { email: d.email }] },
    select: { username: true, email: true },
  });
  if (clash) {
    return NextResponse.json({
      error: "Validation failed",
      fields: clash.username === d.username
        ? { username: "That username is already taken" }
        : { email: "That email is already registered to another user" },
    }, { status: 400 });
  }

  const created = await prisma.user.create({
    data: {
      firstName: d.firstName,
      middleInitial: d.middleInitial?.toUpperCase() || null,
      surname: d.surname,
      email: d.email,
      username: d.username,
      role: d.role,
      avatarUrl: d.avatarUrl || null,
      passwordHash: await bcrypt.hash(d.password, 10),
    },
    select: PUBLIC,
  });
  return NextResponse.json({ ...created, name: fullName(created) }, { status: 201 });
}
