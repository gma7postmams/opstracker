import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const FORMAT_VERSION = 2;
const SUPPORTED_FORMATS = [1, FORMAT_VERSION] as const;

const dateValue = z.string().datetime({ offset: true });
const nullableDateValue = dateValue.nullable();
const idValue = z.number().int().positive();
const nullableIdValue = idValue.nullable();

const userSchema = z.object({
  id: idValue,
  firstName: z.string(),
  middleInitial: z.string().max(1).nullable(),
  surname: z.string(),
  email: z.string().email(),
  username: z.string(),
  passwordHash: z.string(),
  role: z.enum(["ADMIN", "USER"]),
  avatarUrl: z.string().nullable(),
  email2faEnabled: z.boolean().optional(),
  smtpEmail: z.string().nullable().optional(),
  smtpPassword: z.string().nullable().optional(),
  smtpRecipients: z.string().nullable().optional(),
  smtpEnabled: z.boolean().optional(),
  active: z.boolean().optional(),
  lastLogin: nullableDateValue,
  createdAt: dateValue,
});

const recordFields = {
  id: idValue,
  refNo: z.string().min(1),
  startDate: dateValue.optional(),
  date: dateValue.optional(),
  endDate: nullableDateValue.optional(),
  shift: z.string(),
  location: z.string(),
  showGroup: z.string().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
  timeStarted: z.string(),
  timeEnded: z.string().nullable(),
  status: z.enum(["OPEN", "CLOSE_PENDING", "CLOSED"]),
  assigned: z.string(),
  accountable: z.string(),
  remarks: z.string().nullable(),
  ownerId: nullableIdValue,
  locked: z.boolean(),
  lockedById: nullableIdValue,
  createdAt: dateValue,
  updatedAt: dateValue,
};

const assistanceSchema = z.object({
  ...recordFields,
  clientName: z.string(),
  problem: z.string(),
  cause: z.string().nullable().optional(),
  category: z.string(),
  resolution: z.string().nullable(),
}).refine((record) => Boolean(record.startDate ?? record.date), "Expected startDate or date");

const taskSchema = z.object({
  ...recordFields,
  activityType: z.string(),
  description: z.string(),
}).refine((record) => Boolean(record.startDate ?? record.date), "Expected startDate or date");

const backupDataSchema = z.object({
  users: z.array(userSchema),
  assistance: z.array(assistanceSchema),
  tasks: z.array(taskSchema),
  branding: z.object({
    id: z.literal(1),
    title: z.string(),
    tagline: z.string(),
    logoUrl: z.string().nullable(),
    faviconUrl: z.string().nullable(),
    updatedAt: dateValue,
  }).nullable(),
  masterData: z.array(z.object({
    id: idValue,
    kind: z.enum(["LOCATION", "SHIFT", "SHOW_GROUP", "CATEGORY", "ACTIVITY_TYPE"]),
    value: z.string(),
    active: z.boolean(),
    sort: z.number().int(),
  })),
  counters: z.array(z.object({ key: z.string().min(1), value: z.number().int().nonnegative() })),
  auditLogs: z.array(z.object({
    id: idValue,
    action: z.string(),
    entityType: z.string(),
    entityId: z.string().nullable(),
    userId: nullableIdValue,
    details: z.any().nullable().optional(),
    createdAt: dateValue,
  })),
  workLogs: z.array(z.object({
    id: idValue,
    assistanceId: nullableIdValue,
    taskId: nullableIdValue,
    type: z.enum(["RESOLUTION", "REMARK", "INVESTIGATION"]),
    message: z.string(),
    createdById: nullableIdValue,
    createdByName: z.string(),
    createdAt: dateValue,
    updatedAt: dateValue,
  }).refine((workLog) => (workLog.assistanceId === null) !== (workLog.taskId === null), "Must reference exactly one record")),
});

const backupSchema = z.object({
  format: z.union([z.literal(1), z.literal(FORMAT_VERSION)]),
  exportedAt: dateValue,
  exportedBy: z.string(),
  counts: z.object({
    users: z.number().int().nonnegative().optional(),
    assistance: z.number().int().nonnegative().optional(),
    tasks: z.number().int().nonnegative().optional(),
    workLogs: z.number().int().nonnegative().optional(),
    auditLogs: z.number().int().nonnegative().optional(),
  }).optional(),
  data: backupDataSchema,
});

function validateBackupIntegrity(data: z.infer<typeof backupDataSchema>) {
  const issues: string[] = [];
  const unique = <T>(rows: T[], key: (row: T) => string, label: string) => {
    const seen = new Set<string>();
    for (const row of rows) {
      const value = key(row);
      if (seen.has(value)) issues.push(`Duplicate ${label}: ${value}`);
      seen.add(value);
    }
  };
  const uniqueIds = <T extends { id: number }>(rows: T[], label: string) => unique(rows, (row) => String(row.id), `${label} id`);

  uniqueIds(data.users, "user");
  uniqueIds(data.assistance, "assistance");
  uniqueIds(data.tasks, "task");
  uniqueIds(data.masterData, "master-data");
  uniqueIds(data.auditLogs, "audit-log");
  uniqueIds(data.workLogs, "work-log");
  unique(data.users, (row) => row.username, "username");
  unique(data.users, (row) => row.email, "email");
  unique(data.assistance, (row) => row.refNo, "assistance reference");
  unique(data.tasks, (row) => row.refNo, "task reference");
  unique(data.masterData, (row) => `${row.kind}\0${row.value}`, "master-data value");
  unique(data.counters, (row) => row.key, "counter key");

  const userIds = new Set(data.users.map(({ id }) => id));
  const assistanceIds = new Set(data.assistance.map(({ id }) => id));
  const taskIds = new Set(data.tasks.map(({ id }) => id));
  for (const record of [...data.assistance, ...data.tasks]) {
    if (record.ownerId !== null && !userIds.has(record.ownerId)) issues.push(`Record ${record.id} references missing owner ${record.ownerId}`);
    if (record.lockedById !== null && !userIds.has(record.lockedById)) issues.push(`Record ${record.id} references missing lock holder ${record.lockedById}`);
  }
  for (const workLog of data.workLogs) {
    if (workLog.assistanceId !== null && !assistanceIds.has(workLog.assistanceId)) issues.push(`Work log ${workLog.id} references missing assistance ${workLog.assistanceId}`);
    if (workLog.taskId !== null && !taskIds.has(workLog.taskId)) issues.push(`Work log ${workLog.id} references missing task ${workLog.taskId}`);
    if (workLog.createdById !== null && !userIds.has(workLog.createdById)) issues.push(`Work log ${workLog.id} references missing user ${workLog.createdById}`);
  }

  return issues;
}

class BackupMergeConflict extends Error {}

/**
 * Full logical backup as JSON. Password hashes are included so a restore
 * produces a working system — treat the file as sensitive.
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

const [users, assistance, tasks, workLogs, branding, masterData, counters, auditLogs] = await prisma.$transaction(
  (tx) => Promise.all([
    tx.user.findMany({ orderBy: { id: "asc" } }),
    tx.assistance.findMany({ orderBy: { id: "asc" } }),
    tx.task.findMany({ orderBy: { id: "asc" } }),
    tx.workLog.findMany({ orderBy: { id: "asc" } }),
    tx.branding.findUnique({ where: { id: 1 } }),
    tx.masterData.findMany({ orderBy: { id: "asc" } }),
    tx.counter.findMany(),
    tx.auditLog.findMany({ orderBy: { id: "asc" } }),
  ]),
  { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 },
);

  const payload = {
    format: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: user.name,
    counts: { users: users.length, assistance: assistance.length, tasks: tasks.length, workLogs: workLogs.length, auditLogs: auditLogs.length },

data: {
  users,
  assistance,
  tasks,
  workLogs,
  branding,
  masterData,
  counters,
  auditLogs,
},

  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");

await logAudit({
  userId: user.id,
  action: "BACKUP",
  entityType: "System",
  entityId: "Backup Downloaded",
  details: {
    user: user.name,
    users: users.length,
    assistance: assistance.length,
    tasks: tasks.length,
  },
});


  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="opstracker-backup-v2-${stamp}.opsbackup"`,
    },
  });
}

/**
 * Restore. "merge" adds rows whose refNo/username is not already present and
 * leaves everything else alone; "replace" wipes the tables first.
 * Uploaded files under /public/uploads are NOT part of this — see the README.
 */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") ?? "merge");
  const dryRun = String(form.get("dryRun") ?? "") === "true";

  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });
  if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "That file is over 50 MB" }, { status: 400 });
  if (!["merge", "replace"].includes(mode)) {
    return NextResponse.json({ error: "Mode must be merge or replace" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: "That file is not valid JSON" }, { status: 400 });
  }
  if (!payload || !SUPPORTED_FORMATS.includes(payload.format) || !payload.data) {
    return NextResponse.json({ error: "Not an OpsTracker Backup file, or an unsupported version" }, { status: 400 });
  }

  if (payload.format === FORMAT_VERSION && !Array.isArray(payload.data.workLogs)) {
    return NextResponse.json({ error: "Backup is missing its workLogs collection" }, { status: 400 });
  }

  const parsed = backupSchema.safeParse({
    ...payload,
    data: { ...payload.data, workLogs: payload.data.workLogs ?? [] },
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({
      error: `Invalid backup data at ${issue.path.join(".") || "root"}: ${issue.message}`,
    }, { status: 400 });
  }
  const d = parsed.data.data;
  const integrityIssues = validateBackupIntegrity(d);
  if (integrityIssues.length) {
    return NextResponse.json({ error: `Backup integrity check failed: ${integrityIssues[0]}` }, { status: 400 });
  }
  const dataCounts = {
    users: d.users.length,
    assistance: d.assistance.length,
    tasks: d.tasks.length,
    workLogs: d.workLogs.length,
    auditLogs: d.auditLogs.length,
  };
  for (const [key, count] of Object.entries(parsed.data.counts ?? {})) {
    if (count !== undefined && count !== dataCounts[key as keyof typeof dataCounts]) {
      return NextResponse.json({ error: `Backup integrity check failed: ${key} count does not match its data` }, { status: 400 });
    }
  }

const incoming = {
  users: d.users?.length ?? 0,
  assistance: d.assistance?.length ?? 0,
  tasks: d.tasks?.length ?? 0,
  workLogs: d.workLogs.length,
  masterData: d.masterData?.length ?? 0,
  auditLogs: d.auditLogs?.length ?? 0,
};


if (dryRun) {
  const [eu, ea, et, ew, em, el] = await Promise.all([
    prisma.user.count(),
    prisma.assistance.count(),
    prisma.task.count(),
    prisma.workLog.count(),
    prisma.masterData.count(),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({
    preview: true,
    exportedAt: payload.exportedAt,
    exportedBy: payload.exportedBy,
    format: parsed.data.format,
    incoming,
    existing: {
      users: eu,
      assistance: ea,
      tasks: et,
      workLogs: ew,
      masterData: em,
      auditLogs: el,
    },
    mode,
  });
}

  const dates = (r: any) => {
    const { date, ...fields } = r;
    return {
      ...fields,
      startDate: new Date(r.startDate ?? date),
      endDate: r.endDate ? new Date(r.endDate) : null,
      createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
      updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
    };
  };

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.workLog.deleteMany();
      await tx.emailVerificationCode.deleteMany();
      await tx.assistance.deleteMany();
      await tx.task.deleteMany();
      await tx.user.deleteMany();
      await tx.masterData.deleteMany();
      await tx.counter.deleteMany();
      await tx.auditLog.deleteMany();
      if (!d.branding) await tx.branding.deleteMany();
    }

    let usersAdded = 0,
    assistanceAdded = 0,
    tasksAdded = 0,
    workLogsAdded = 0,
    masterAdded = 0,
    auditAdded = 0;

    for (const u of d.users ?? []) {
      const matches = mode === "merge" ? await tx.user.findMany({
        where: { OR: [{ id: u.id }, { username: u.username }, { email: u.email }] },
      }) : [];
      if (matches.some((existing) => existing.id !== u.id || existing.username !== u.username || existing.email !== u.email)) {
        throw new BackupMergeConflict(`User identity conflicts with the database: ${u.username}`);
      }
      if (matches.length) continue;
      await tx.user.create({
        data: { ...u, createdAt: new Date(u.createdAt), lastLogin: u.lastLogin ? new Date(u.lastLogin) : null },
      });
      usersAdded++;
    }

    for (const r of d.assistance ?? []) {
      if (mode === "merge") {
        const byReference = await tx.assistance.findUnique({ where: { refNo: r.refNo } });
        if (byReference) {
          if (byReference.id !== r.id) throw new BackupMergeConflict(`Assistance reference has a different database id: ${r.refNo}`);
          continue;
        }
        if (await tx.assistance.findUnique({ where: { id: r.id } })) {
          throw new BackupMergeConflict(`Assistance id is already used by another record: ${r.id}`);
        }
      }
      await tx.assistance.create({ data: dates(r) });
      assistanceAdded++;
    }

    for (const r of d.tasks ?? []) {
      if (mode === "merge") {
        const byReference = await tx.task.findUnique({ where: { refNo: r.refNo } });
        if (byReference) {
          if (byReference.id !== r.id) throw new BackupMergeConflict(`Task reference has a different database id: ${r.refNo}`);
          continue;
        }
        if (await tx.task.findUnique({ where: { id: r.id } })) {
          throw new BackupMergeConflict(`Task id is already used by another record: ${r.id}`);
        }
      }
      await tx.task.create({ data: dates(r) });
      tasksAdded++;
    }

    for (const workLog of d.workLogs) {
      if (mode === "merge") {
        const existing = await tx.workLog.findUnique({
          where: { id: workLog.id },
          select: { assistanceId: true, taskId: true },
        });
        if (existing) {
          if (existing.assistanceId !== workLog.assistanceId || existing.taskId !== workLog.taskId) {
            throw new BackupMergeConflict(`Work Log id is attached to a different record: ${workLog.id}`);
          }
          continue;
        }
      }
      await tx.workLog.create({
        data: {
          ...workLog,
          createdAt: new Date(workLog.createdAt),
          updatedAt: new Date(workLog.updatedAt),
        },
      });
      workLogsAdded++;
    }

    for (const m of d.masterData ?? []) {
      const exists =
        mode === "merge"
          ? await tx.masterData.findUnique({
              where: {
                kind_value: {
                  kind: m.kind,
                  value: m.value,
                },
              },
            })
          : null;

      if (exists) {

        if (exists.active === false) {
          await tx.masterData.update({
            where: { id: exists.id },
            data: {
              active: true,
            },
          });

          masterAdded++;
        }
        continue;
      }

      if (mode === "merge" && await tx.masterData.findUnique({ where: { id: m.id } })) {
        throw new BackupMergeConflict(`Master data id is already used by another value: ${m.id}`);
      }

      await tx.masterData.create({
        data: m,
      });

      masterAdded++;
    }

for (const a of d.auditLogs ?? []) {
  const exists =
    mode === "merge" &&
    (await tx.auditLog.findUnique({
      where: { id: a.id },
    }));

  if (exists) continue;

  await tx.auditLog.create({
    data: {
      ...a,
      details: a.details === null ? Prisma.DbNull : a.details as Prisma.InputJsonValue,
      createdAt: new Date(a.createdAt),
    },
  });

  auditAdded++;
}

    if (d.branding) {
      const { id, updatedAt, ...b } = d.branding;
      await tx.branding.upsert({ where: { id: 1 }, update: b, create: { id: 1, ...b } });
    }

    // Sequences and ref-number counters must clear the restored rows or the
    // next insert collides with an id that already exists.
    for (const c of d.counters) {
      await tx.$executeRaw`
        INSERT INTO "counters" ("key", "value") VALUES (${c.key}, ${c.value})
        ON CONFLICT ("key") DO UPDATE SET "value" = GREATEST("counters"."value", EXCLUDED."value")
      `;
    }
    for (const t of ["users", "assistance", "tasks", "master_data", "audit_logs", "work_logs"]) {
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), EXISTS(SELECT 1 FROM "${t}"))`
      );
    }

      return {
        usersAdded,
        assistanceAdded,
        tasksAdded,
        workLogsAdded,
        masterAdded,
        auditAdded,
      };

    }, { timeout: 120_000 });
  } catch (error) {
    if (error instanceof BackupMergeConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

await logAudit({
  userId: user.id,
  action: "RESTORE",
  entityType: "System",
  entityId:
    mode === "replace"
      ? "Full Restore (Replace)"
      : "Full Restore (Merge)",
  details: {
    user: user.name,
    mode,
    ...result,
  },
});


  return NextResponse.json({ ok: true, mode, ...result });
}
