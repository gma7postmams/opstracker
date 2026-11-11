import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getNextBackupRun } from "@/lib/backup-schedule";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

const scheduleSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  backupTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().min(1).max(100),
  weeklyDay: z.number().int().min(0).max(6).nullable(),
  monthlyDay: z.number().int().min(1).max(31).nullable(),
  retentionCount: z.number().int().min(1).max(1000),
});

async function authorize() {
  const user = await currentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin(user)) return { user: null, response: NextResponse.json({ error: "Administrators only" }, { status: 403 }) };
  return { user, response: null };
}

export async function GET() {
  const { response } = await authorize();
  if (response) return response;
  const schedule = await prisma.backupSchedule.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return NextResponse.json(schedule);
}

export async function PUT(request: NextRequest) {
  const { user, response } = await authorize();
  if (response) return response;
  const body = await request.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid backup schedule settings" }, { status: 400 });

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: parsed.data.timezone });
  } catch {
    return NextResponse.json({ error: "Choose a valid timezone" }, { status: 400 });
  }
  if (parsed.data.frequency === "WEEKLY" && parsed.data.weeklyDay === null) {
    return NextResponse.json({ error: "Choose a day of the week" }, { status: 400 });
  }
  if (parsed.data.frequency === "MONTHLY" && parsed.data.monthlyDay === null) {
    return NextResponse.json({ error: "Choose a day of the month" }, { status: 400 });
  }

  const previous = await prisma.backupSchedule.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const values = {
    ...parsed.data,
    weeklyDay: parsed.data.frequency === "WEEKLY" ? parsed.data.weeklyDay : null,
    monthlyDay: parsed.data.frequency === "MONTHLY" ? parsed.data.monthlyDay : null,
  };
  const nextRunAt = values.enabled
    ? getNextBackupRun(values, new Date())
    : null;
  const updated = await prisma.backupSchedule.update({
    where: { id: 1 },
    data: { ...values, nextRunAt },
  });

  await logAudit({
    userId: user!.id,
    action: "BACKUP_SCHEDULE_UPDATED",
    entityType: "System",
    entityId: "Backup Schedule",
    details: {
      previous: {
        enabled: previous.enabled,
        frequency: previous.frequency,
        backupTime: previous.backupTime,
        timezone: previous.timezone,
        weeklyDay: previous.weeklyDay,
        monthlyDay: previous.monthlyDay,
        retentionCount: previous.retentionCount,
      },
      updated: values,
    },
  });

  return NextResponse.json(updated);
}