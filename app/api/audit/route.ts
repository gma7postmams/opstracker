import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCustomPeriodRange, getPeriodRange, PERIOD_OPTIONS, type Period } from "@/lib/period";

export async function GET(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const periodParam = searchParams.get("period") ?? "today";
  if (!PERIOD_OPTIONS.some((option) => option.value === periodParam)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const period = periodParam as Period;
  const range = period === "custom"
    ? getCustomPeriodRange(searchParams.get("from") ?? "", searchParams.get("to") ?? "")
    : getPeriodRange(period, new Date());
  if (period === "custom" && !range) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const logs = await prisma.auditLog.findMany({
    where:
      user.role === "ADMIN"
        ? range ? { createdAt: { gte: range.start, lt: range.end } } : {}
        : { userId: user.id, ...(range ? { createdAt: { gte: range.start, lt: range.end } } : {}) },
    orderBy: {
      createdAt: "desc",
    },
    take: 200,
  });

  return NextResponse.json(logs);
}
