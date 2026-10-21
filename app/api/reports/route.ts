import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { minutesBetween } from "@/lib/format";
import { applyReportScope, formatReportOwner, getReportContributionSummary, reportOwnerSelect, resolveReportScope } from "@/lib/reports";

interface Row {
  owner: string; assigned: string; total: number; closed: number; open: number; pending: number;
  avgPerDay: string; avgMinutes: number | null;
}

/** One tally per activity type, plus a combined view, all over the same range. */
function tally(rows: any[], days: number): Row[] {
  const byOwnerAndAssignee = new Map<string, { owner: string; assigned: string; records: any[] }>();
  rows.forEach((r) => {
    const owner = formatReportOwner(r.owner);
    const key = JSON.stringify([owner, r.assigned]);
    const group = byOwnerAndAssignee.get(key) ?? { owner, assigned: r.assigned, records: [] as any[] };
    group.records.push(r);
    byOwnerAndAssignee.set(key, group);
  });

  return [...byOwnerAndAssignee.values()]
    .map(({ owner, assigned, records: rs }) => {
      const closed = rs.filter((r) => r.status === "CLOSED");
      const durations = closed
        .map((r) => minutesBetween(r.startDate, r.timeStarted, r.endDate, r.timeEnded))
        .filter((m): m is number => m !== null);
      return {
        owner,
        assigned,
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

  const s = req.nextUrl.searchParams;
  const from = s.get("from") || new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const to = s.get("to") || new Date().toISOString().slice(0, 10);
  const activity = s.get("activity") || "all";
  const status = s.get("status") || "all";
  const userId = s.get("userId") || "all";
  const scope = resolveReportScope(s.get("scope"), user);

  if (from > to) {
    return NextResponse.json({ error: "From date must be on or before To date" }, { status: 400 });
  }
 
  const days = Math.max(1, Math.round((+new Date(to) - +new Date(from)) / 864e5) + 1);

  const where: any = {
    startDate: {
      gte: new Date(from),
      lte: new Date(to),
    },
  };

  const reportWhere = await applyReportScope(where, user, scope, userId);

  if (status !== "all") where.status = status;

  const select = {
    assigned: true, status: true, startDate: true, endDate: true,
    timeStarted: true, timeEnded: true, priority: true,
    owner: { select: reportOwnerSelect },
  };
  const [assistance, tasks] = await Promise.all([
    activity === "tasks" ? [] : prisma.assistance.findMany({ where: reportWhere, select }),
    activity === "assistance" ? [] : prisma.task.findMany({ where: reportWhere, select }),
  ]);

  const combined = [...assistance, ...tasks];
  const closed = combined.filter((r) => r.status === "CLOSED").length;
  const contributionSummary = await getReportContributionSummary(reportWhere, user, activity, userId);

  return NextResponse.json({
    range: { from, to, days },
    contributionSummary,
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
