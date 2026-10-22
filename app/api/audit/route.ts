import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/format";
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

  const userIds = [...new Set(logs.flatMap((log) => log.userId === null ? [] : [log.userId]))];
  const actors = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, middleInitial: true, surname: true, username: true },
      })
    : [];
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

  return NextResponse.json(logs.map((log) => {
    const actor = log.userId === null ? undefined : actorsById.get(log.userId);
    return {
      ...log,
      actorName: actor ? fullName(actor) : null,
      actorUsername: actor?.username ?? null,
    };
  }));
}
