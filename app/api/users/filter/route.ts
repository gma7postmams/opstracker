import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const users = await prisma.user.findMany({
    where: {
      active: true,
      role: {
        not: "ADMIN",
      },
    },
    select: {
      id: true,
      firstName: true,
      middleInitial: true,
      surname: true,
      role: true,
    },
  });

  return NextResponse.json(users);
}