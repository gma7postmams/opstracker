import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportWorkbook } from "@/lib/reportExcel";
import { addReportTimelineSummaries, addReportWorkLogSummaries, applyReportScope, getReportContributionSummary, getReportWorkLogsForExport, reportOwnerSelect, resolveReportScope } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const s = req.nextUrl.searchParams;

  const from = s.get("from") || "";
  const to = s.get("to") || "";

  if (Boolean(from) !== Boolean(to)) {
    return NextResponse.json({ error: "Both From and To dates are required" }, { status: 400 });
  }
  if (from && from > to) {
    return NextResponse.json({ error: "From date must be on or before To date" }, { status: 400 });
  }

  const activity = s.get("activity") || "all";
  const status = s.get("status") || "all";
  const scope = resolveReportScope(s.get("scope"), user);
  const userId = s.get("userId");
  const ownerOnly = s.get("ownerOnly") === "true";

  const where: any = {};
  if (from && to) {
    where.startDate = {
      gte: new Date(from),
      lte: new Date(to),
    };
  }

  if (status !== "all") {
    where.status = status;
  }
  const scopeWhere = await applyReportScope(where, user, scope, userId);
  const reportWhere = ownerOnly && scope === "mine"
    ? { AND: [scopeWhere, { ownerId: user.id }] }
    : scopeWhere;

  const assistance =
    activity === "tasks"
      ? []
      : await prisma.assistance.findMany({
          where: reportWhere,
          orderBy: [
            { startDate: "desc" },
            { refNo: "desc" },
          ],
          include: {
            owner: { select: reportOwnerSelect },
            workLogs: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 5,
              select: { id: true, type: true, message: true, createdAt: true, createdByName: true },
            },
          },
        });

  const tasks =
    activity === "assistance"
      ? []
      : await prisma.task.findMany({
          where: reportWhere,
          orderBy: [
            { startDate: "desc" },
            { refNo: "desc" },
          ],
          include: {
            owner: { select: reportOwnerSelect },
            workLogs: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 5,
              select: { id: true, type: true, message: true, createdAt: true, createdByName: true },
            },
          },
        });

  const whereWithoutDate = { ...where };
  delete whereWithoutDate.startDate;
  const scopeWhereWithoutDate = await applyReportScope(whereWithoutDate, user, scope, userId);
  const reportWhereWithoutDate = ownerOnly && scope === "mine"
    ? { AND: [scopeWhereWithoutDate, { ownerId: user.id }] }
    : scopeWhereWithoutDate;

  const [scopeAssistanceCount, scopeTaskCount, noDateAssistanceCount, noDateTaskCount] = await Promise.all([
    prisma.assistance.count({ where: scopeWhere }),
    prisma.task.count({ where: scopeWhere }),
    prisma.assistance.count({ where: reportWhereWithoutDate }),
    prisma.task.count({ where: reportWhereWithoutDate }),
  ]);

  console.info("[reports/excel] temporary export diagnostics", {
    userId: user.id,
    scopeWhere,
    reportWhere,
    assistanceCount: assistance.length,
    taskCount: tasks.length,
    scopeAssistanceCount,
    scopeTaskCount,
    noDateAssistanceCount,
    noDateTaskCount,
    dateRange: { from, to },
    ownerOnly,
  });

  const assistanceWithLogs = await addReportWorkLogSummaries(assistance, "assistance");
  const tasksWithLogs = await addReportWorkLogSummaries(tasks, "tasks");
  const assistanceWithTimeline = await addReportTimelineSummaries(assistanceWithLogs, "assistance");
  const tasksWithTimeline = await addReportTimelineSummaries(tasksWithLogs, "tasks");
  const contributionSummary = await getReportContributionSummary(reportWhere, user, activity, userId);

  const workbook = await buildReportWorkbook({
    range: {
      from: from || "All Records",
      to,
    },
    assistance: assistanceWithTimeline,
    tasks: tasksWithTimeline,
    workLogs: await getReportWorkLogsForExport(assistance, tasks),
    contributionSummary,
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = from
    ? `MAMS_Support_Activity_Report_${from}_to_${to}.xlsx`
    : "MAMS_Support_Activity_Report_All_Records.xlsx";

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
