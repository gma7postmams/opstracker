import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { minutesBetween } from "@/lib/format";
import { reportQuerySchema, queryObject, flatten } from "@/lib/validation";

interface Row {
  user: string; total: number; closed: number; open: number; pending: number;
  avgPerDay: string; avgMinutes: number | null;
}

/** One tally per activity type, plus a combined view, all over the same range. */
function tally(rows: any[], days: number): Row[] {
  const byUser = new Map<string, any[]>();
  rows.forEach((r) => {
    const list = byUser.get(r.assigned) ?? [];
    list.push(r);
    byUser.set(r.assigned, list);
  });

  return [...byUser.entries()]
    .map(([user, rs]) => {
      const closed = rs.filter((r) => r.status === "CLOSED");
      const durations = closed
        .map((r) => minutesBetween(r.timeStarted, r.timeEnded))
        .filter((m): m is number => m !== null);
      return {
        user,
        total: rs.length,
        closed: closed.length,
        open: rs.filter((r) => r.status === "OPEN").length,
        pending: rs.filter((r) => r.status === "CLOSE_PENDING").length,
        avgPerDay: (closed.length / days).toFixed(2),
        avgMinutes: durations.length
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : null,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = reportQuerySchema.safeParse(queryObject(req.nextUrl.searchParams));
  if (!parsed.success) {
    const fields = flatten(parsed.error);
    return NextResponse.json({ error: Object.values(fields)[0] ?? "Invalid query", fields }, { status: 400 });
  }
  const { activity, status } = parsed.data;
  const from = parsed.data.from ?? new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const to = parsed.data.to ?? new Date().toISOString().slice(0, 10);

  if (from > to) {
    return NextResponse.json({ error: "From date must be on or before To date" }, { status: 400 });
  }

  const days = Math.max(1, Math.round((+new Date(to) - +new Date(from)) / 864e5) + 1);
  const where: any = { date: { gte: new Date(from), lte: new Date(to) } };
  if (status !== "all") where.status = status;

  const select = {
    assigned: true, status: true, timeStarted: true, timeEnded: true, priority: true,
  };
  const [assistance, tasks] = await Promise.all([
    activity === "tasks" ? [] : prisma.assistance.findMany({ where, select }),
    activity === "assistance" ? [] : prisma.task.findMany({ where, select }),
  ]);

  const combined = [...assistance, ...tasks];
  const closed = combined.filter((r) => r.status === "CLOSED").length;

  return NextResponse.json({
    range: { from, to, days },
    summary: {
      assistance: assistance.length,
      tasks: tasks.length,
      total: combined.length,
      closed,
      open: combined.filter((r) => r.status === "OPEN").length,
      pending: combined.filter((r) => r.status === "CLOSE_PENDING").length,
      avgPerDay: (closed / days).toFixed(2),
    },
    tallies: {
      assistance: activity === "tasks" ? null : tally(assistance, days),
      tasks: activity === "assistance" ? null : tally(tasks, days),
      combined: activity === "all" ? tally(combined, days) : null,
    },
  });
}
