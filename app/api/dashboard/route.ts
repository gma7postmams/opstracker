import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ymd } from "@/lib/format";

const EMPTY = { OPEN: 0, CLOSE_PENDING: 0, CLOSED: 0 };
const toMap = (rows: { status: string; _count: number }[]) => {
  const m = { ...EMPTY } as Record<string, number>;
  rows.forEach((r) => (m[r.status] = r._count));
  return m;
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const [aStatus, tStatus, aTotal, tTotal, cats, aRecent, tRecent, aTrend, tTrend] = await Promise.all([
    prisma.assistance.groupBy({ by: ["status"], _count: true }),
    prisma.task.groupBy({ by: ["status"], _count: true }),
    prisma.assistance.count(),
    prisma.task.count(),
    prisma.assistance.groupBy({ by: ["category"], _count: true, orderBy: { _count: { category: "desc" } } }),
    prisma.assistance.findMany({
      where: { status: { not: "CLOSED" } },
      orderBy: [{ priority: "desc" }, { date: "desc" }],
      take: 6,
      select: { id: true, refNo: true, clientName: true, problem: true, priority: true, status: true },
    }),
    prisma.task.findMany({
      where: { status: { not: "CLOSED" } },
      orderBy: [{ priority: "desc" }, { date: "desc" }],
      take: 6,
      select: { id: true, refNo: true, activityType: true, description: true, priority: true, status: true },
    }),
    prisma.assistance.groupBy({ by: ["date"], _count: true, where: { date: { gte: since } } }),
    prisma.task.groupBy({ by: ["date"], _count: true, where: { date: { gte: since } } }),
  ]);

  // Build a dense 7-day series so days with no activity still render a slot.
  const counts = new Map<string, number>();
  [...aTrend, ...tTrend].forEach((r: any) => {
    const k = ymd(r.date);
    counts.set(k, (counts.get(k) ?? 0) + r._count);
  });
  const trend = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = ymd(d);
    return {
      date: key,
      label: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()],
      count: counts.get(key) ?? 0,
    };
  });

  const attention = [
    ...aRecent.map((r) => ({ ...r, type: "assistance", subject: r.clientName, body: r.problem })),
    ...tRecent.map((r) => ({ ...r, type: "tasks", subject: r.activityType, body: r.description })),
  ].slice(0, 8);

  return NextResponse.json({
    assistance: { total: aTotal, ...toMap(aStatus as any) },
    tasks: { total: tTotal, ...toMap(tStatus as any) },
    categories: cats.map((c: any) => ({ name: c.category, count: c._count })),
    trend,
    attention,
  });
}
