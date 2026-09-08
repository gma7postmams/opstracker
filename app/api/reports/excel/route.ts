import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportWorkbook } from "@/lib/reportExcel";

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

  const where: any = {
    date: {
      gte: new Date(from),
      lte: new Date(to),
    },
  };

  if (status !== "all") {
    where.status = status;
  }

  const assistance =
    activity === "tasks"
      ? []
      : await prisma.assistance.findMany({
          where,
          orderBy: [
            { date: "desc" },
            { refNo: "desc" },
          ],
        });

  const tasks =
    activity === "assistance"
      ? []
      : await prisma.task.findMany({
          where,
          orderBy: [
            { date: "desc" },
            { refNo: "desc" },
          ],
        });

  const workbook = await buildReportWorkbook({
    range: {
      from,
      to,
    },
    assistance,
    tasks,
  });

  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `OpsLog_Report_${from}_to_${to}.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
