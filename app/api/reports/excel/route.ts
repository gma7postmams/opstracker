import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportWorkbook } from "@/lib/reportExcel";
import { addReportWorkLogSummaries, applyReportScope, reportOwnerSelect, resolveReportScope } from "@/lib/reports";

export async function GET(req: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const s = req.nextUrl.searchParams;

  const from =
    s.get("from") ||
    new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);

  const to =
    s.get("to") ||
    new Date().toISOString().slice(0, 10);

  const activity = s.get("activity") || "all";
  const status = s.get("status") || "all";
  const scope = resolveReportScope(s.get("scope"), user);
  const userId = s.get("userId");

  const where: any = {
    startDate: {
      gte: new Date(from),
      lte: new Date(to),
    },
  };

  if (status !== "all") {
    where.status = status;
  }
  const reportWhere = await applyReportScope(where, user, scope, userId);

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

  const assistanceWithLogs = await addReportWorkLogSummaries(assistance, "assistance");
  const tasksWithLogs = await addReportWorkLogSummaries(tasks, "tasks");

  const workbook = await buildReportWorkbook({
    range: {
      from,
      to,
    },
    assistance: assistanceWithLogs,
    tasks: tasksWithLogs,
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `MAMS_Support_Activity_Report_${from}_to_${to}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
