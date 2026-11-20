import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { fullName } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: {
      active: true,
      ...(user.role === "ADMIN" ? {} : { role: "USER" }),
    },
    orderBy: [{ surname: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      middleInitial: true,
      surname: true,
      role: true,
    },
  });

  return NextResponse.json(users.map((entry) => ({ ...entry, name: fullName(entry) })));
}