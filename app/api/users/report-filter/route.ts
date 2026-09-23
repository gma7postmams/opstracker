import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const users = await prisma.user.findMany({
    where: {
      active: true,
    },
    orderBy: [
      { firstName: "asc" },
      { surname: "asc" },
    ],
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
