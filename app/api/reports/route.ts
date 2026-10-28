import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { minutesBetween } from "@/lib/format";
import { addReportWorkLogSummaries, applyReportScope, buildReportParticipationRows, buildReportRecordDetails, formatReportOwner, getReportContributionSummary, reportOwnerSelect, resolveReportScope } from "@/lib/reports";

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

  const commonSelect = {
    id: true, refNo: true, ownerId: true, assigned: true, accountable: true, status: true, startDate: true, endDate: true,
    timeStarted: true, timeEnded: true, priority: true,
    owner: { select: reportOwnerSelect },
  } as const;
  const workLogSelect = {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 5,
    select: { id: true, type: true, message: true, createdAt: true, createdByName: true },
  };
  const [assistanceRecords, taskRecords] = await Promise.all([
    activity === "tasks" ? [] : prisma.assistance.findMany({
      where: reportWhere,
      select: { ...commonSelect, workLogs: workLogSelect, clientName: true, showGroup: true, location: true, problem: true, resolution: true, remarks: true },
    }),
    activity === "assistance" ? [] : prisma.task.findMany({
      where: reportWhere,
      select: { ...commonSelect, workLogs: workLogSelect, activityType: true, description: true, remarks: true },
    }),
  ]);
  const [assistanceWithLogs, tasksWithLogs] = await Promise.all([
    addReportWorkLogSummaries(assistanceRecords, "assistance"),
    addReportWorkLogSummaries(taskRecords, "tasks"),
  ]);

  const combined = [
    ...assistanceWithLogs.map((record) => ({ ...record, recordType: "assistance" as const })),
    ...tasksWithLogs.map((record) => ({ ...record, recordType: "tasks" as const })),
  ];
  const closed = combined.filter((r) => r.status === "CLOSED").length;
  const [contributionSummary, users] = await Promise.all([
    getReportContributionSummary(reportWhere, user, activity, userId),
    prisma.user.findMany({
      select: { id: true, firstName: true, middleInitial: true, surname: true },
    }),
  ]);
  const participationSummary = buildReportParticipationRows(combined, users);
  const reportRecords = [
    ...assistanceWithLogs.map((record) => ({
      refNo: record.refNo,
      recordType: "Technical Assistance",
      status: record.status,
      owner: formatReportOwner(record.owner),
      assigned: record.assigned,
      details: buildReportRecordDetails(record, "assistance"),
    })),
    ...tasksWithLogs.map((record) => ({
      refNo: record.refNo,
      recordType: "Other Tasks",
      status: record.status,
      owner: formatReportOwner(record.owner),
      assigned: record.assigned,
      details: buildReportRecordDetails(record, "tasks"),
    })),
  ];

  return NextResponse.json({
    range: { from, to, days },
    contributionSummary,
    participationSummary,
    reportRecords,
    summary: {
      assistance: assistanceWithLogs.length,
      tasks: tasksWithLogs.length,
      total: combined.length,
      closed,
      open: combined.filter((r) => r.status === "OPEN").length,
      pending: combined.filter((r) => r.status === "CLOSE_PENDING").length,
      avgPerDay: (closed / days).toFixed(2),
    },
    tallies: {
      assistance: activity === "tasks" ? null : tally(assistanceWithLogs, days),
      tasks: activity === "assistance" ? null : tally(tasksWithLogs, days),
      combined: activity === "all" ? tally(combined, days) : null,
    },
  });
}
