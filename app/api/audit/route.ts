import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const logs = await prisma.auditLog.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : { userId: user.id },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return NextResponse.json(logs);
}
