import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { fullName } from "@/lib/format";
import { getCustomPeriodRange, getPeriodRange, PERIOD_OPTIONS, type Period } from "@/lib/period";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const searchParams = new URL(request.url).searchParams;
  const periodParam = searchParams.get("period") ?? "today";
  if (!PERIOD_OPTIONS.some((option) => option.value === periodParam)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const period = periodParam as Period;
  let range: { start: Date; end: Date } | null = null;
  if (period === "custom") {
    range = getCustomPeriodRange(searchParams.get("from") ?? "", searchParams.get("to") ?? "");
    if (!range) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  } else if (period !== "all") {
    range = getPeriodRange(period, new Date());
  }

  const recordWhere = range ? { startDate: { gte: range.start, lt: range.end } } : {};
  const [users, assistanceCounts, taskCounts] = await Promise.all([
    prisma.user.findMany({
      where: { role: "USER", active: true },
      select: { id: true, firstName: true, middleInitial: true, surname: true },
    }),
    prisma.assistance.groupBy({ by: ["ownerId"], _count: true, where: recordWhere }),
    prisma.task.groupBy({ by: ["ownerId"], _count: true, where: recordWhere }),
  ]);

  const assistanceByOwner = new Map(assistanceCounts.map((row) => [row.ownerId, row._count]));
  const tasksByOwner = new Map(taskCounts.map((row) => [row.ownerId, row._count]));
  const workload = users
    .map((eligibleUser) => ({
      id: eligibleUser.id,
      name: fullName(eligibleUser),
      technicalAssistanceCount: assistanceByOwner.get(eligibleUser.id) ?? 0,
      otherTasksCount: tasksByOwner.get(eligibleUser.id) ?? 0,
    }))
    .filter((eligibleUser) => eligibleUser.technicalAssistanceCount > 0 || eligibleUser.otherTasksCount > 0)
    .sort((left, right) => left.name.localeCompare(right.name));

  return NextResponse.json({ users: workload });
}