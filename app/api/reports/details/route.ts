import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  if (from > to) {
    return NextResponse.json(
      { error: "From date must be on or before To date" },
      { status: 400 }
    );
  }

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
          select: {
            id: true,
            refNo: true,
            startDate: true,
            shift: true,
            location: true,
            showGroup: true,
            clientName: true,
            problem: true,
            category: true,
            resolution: true,
            priority: true,
            status: true,
            timeStarted: true,
            timeEnded: true,
            owner: { select: reportOwnerSelect },
            assigned: true,
            accountable: true,
            remarks: true,
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
          select: {
            id: true,
            refNo: true,
            startDate: true,
            shift: true,
            location: true,
            showGroup: true,
            activityType: true,
            description: true,
            priority: true,
            status: true,
            timeStarted: true,
            timeEnded: true,
            owner: { select: reportOwnerSelect },
            assigned: true,
            accountable: true,
            remarks: true,
            workLogs: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 5,
              select: { id: true, type: true, message: true, createdAt: true, createdByName: true },
            },
          },
        });

  const assistanceWithLogs = await addReportWorkLogSummaries(assistance, "assistance");
  const tasksWithLogs = await addReportWorkLogSummaries(tasks, "tasks");

  return NextResponse.json({
    range: {
      from,
      to,
    },
    assistance: assistanceWithLogs,
    tasks: tasksWithLogs,
  });
}
