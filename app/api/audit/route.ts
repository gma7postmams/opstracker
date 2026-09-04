import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await currentUser();

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 403 }
    );
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return NextResponse.json(logs);
}
