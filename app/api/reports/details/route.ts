import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  if (from > to) {
    return NextResponse.json(
      { error: "From date must be on or before To date" },
      { status: 400 }
    );
  }

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
          select: {
            refNo: true,
            date: true,
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
            assigned: true,
            accountable: true,
            remarks: true,
          },
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
          select: {
            refNo: true,
            date: true,
            shift: true,
            location: true,
            showGroup: true,
            activityType: true,
            description: true,
            priority: true,
            status: true,
            timeStarted: true,
            timeEnded: true,
            assigned: true,
            accountable: true,
            remarks: true,
          },
        });

  return NextResponse.json({
    range: {
      from,
      to,
    },
    assistance,
    tasks,
  });
}
