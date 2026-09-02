import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";

export const runtime = "nodejs";

const FORMAT_VERSION = 1;

/**
 * Full logical backup as JSON. Password hashes are included so a restore
 * produces a working system — treat the file as sensitive.
 */
export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const [users, assistance, tasks, branding, masterData, counters] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: "asc" } }),
    prisma.assistance.findMany({ orderBy: { id: "asc" } }),
    prisma.task.findMany({ orderBy: { id: "asc" } }),
    prisma.branding.findUnique({ where: { id: 1 } }),
    prisma.masterData.findMany({ orderBy: { id: "asc" } }),
    prisma.counter.findMany(),
  ]);

  const payload = {
    format: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: user.name,
    counts: { users: users.length, assistance: assistance.length, tasks: tasks.length },
    data: { users, assistance, tasks, branding, masterData, counters },
  };

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="opslog-backup-${stamp}.json"`,
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
  if (payload?.format !== FORMAT_VERSION || !payload?.data) {
    return NextResponse.json({ error: "Not an OpsLog backup file, or an unsupported version" }, { status: 400 });
  }

  const d = payload.data;
  const incoming = {
    users: d.users?.length ?? 0,
    assistance: d.assistance?.length ?? 0,
    tasks: d.tasks?.length ?? 0,
    masterData: d.masterData?.length ?? 0,
  };

  if (dryRun) {
    const [eu, ea, et] = await Promise.all([
      prisma.user.count(), prisma.assistance.count(), prisma.task.count(),
    ]);
    return NextResponse.json({
      preview: true,
      exportedAt: payload.exportedAt,
      exportedBy: payload.exportedBy,
      incoming,
      existing: { users: eu, assistance: ea, tasks: et },
      mode,
    });
  }

  const dates = (r: any) => ({
    ...r,
    date: new Date(r.date),
    createdAt: r.createdAt ? new Date(r.createdAt) : undefined,
    updatedAt: r.updatedAt ? new Date(r.updatedAt) : undefined,
  });

  const result = await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      // Records first — they reference users.
      await tx.assistance.deleteMany();
      await tx.task.deleteMany();
      await tx.user.deleteMany();
      await tx.masterData.deleteMany();
      await tx.counter.deleteMany();
    }

    let usersAdded = 0, assistanceAdded = 0, tasksAdded = 0, masterAdded = 0;

    for (const u of d.users ?? []) {
      const exists = mode === "merge" && await tx.user.findFirst({
        where: { OR: [{ id: u.id }, { username: u.username }, { email: u.email }] },
      });
      if (exists) continue;
      await tx.user.create({
        data: { ...u, createdAt: new Date(u.createdAt), lastLogin: u.lastLogin ? new Date(u.lastLogin) : null },
      });
      usersAdded++;
    }

    for (const r of d.assistance ?? []) {
      if (mode === "merge" && await tx.assistance.findUnique({ where: { refNo: r.refNo } })) continue;
      await tx.assistance.create({ data: dates(r) });
      assistanceAdded++;
    }
    for (const r of d.tasks ?? []) {
      if (mode === "merge" && await tx.task.findUnique({ where: { refNo: r.refNo } })) continue;
      await tx.task.create({ data: dates(r) });
      tasksAdded++;
    }
    for (const m of d.masterData ?? []) {
      const exists = mode === "merge" && await tx.masterData.findUnique({
        where: { kind_value: { kind: m.kind, value: m.value } },
      });
      if (exists) continue;
      await tx.masterData.create({ data: m });
      masterAdded++;
    }

    if (d.branding) {
      const { id, updatedAt, ...b } = d.branding;
      await tx.branding.upsert({ where: { id: 1 }, update: b, create: { id: 1, ...b } });
    }

    // Sequences and ref-number counters must clear the restored rows or the
    // next insert collides with an id that already exists.
    for (const c of d.counters ?? []) {
      await tx.counter.upsert({
        where: { key: c.key },
        update: { value: { set: Math.max(c.value, 0) } },
        create: c,
      });
    }
    for (const t of ["users", "assistance", "tasks", "master_data"]) {
      await tx.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1))`
      );
    }

    return { usersAdded, assistanceAdded, tasksAdded, masterAdded };
  }, { timeout: 120_000 });

  return NextResponse.json({ ok: true, mode, ...result });
}
