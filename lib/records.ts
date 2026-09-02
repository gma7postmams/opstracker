import { prisma } from "./prisma";
import { RecordType, TYPES, SortKey } from "./recordTypes";
import { SessionUser, canEdit } from "./permissions";

/**
 * Both models expose the same shared columns, so one generic delegate lets a
 * single service layer drive either table. Server-only — never import from a
 * client component.
 */
export function delegateFor(type: RecordType) {
  return (type === "assistance" ? prisma.assistance : prisma.task) as any;
}

export interface ListQuery {
  q?: string;
  status?: string;
  location?: string;
  shift?: string;
  from?: string;
  to?: string;
  sort?: SortKey;
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
}

/**
 * Reference numbers come from a dedicated counter row updated in the same
 * transaction as the insert, so two people saving at once can't collide the
 * way a MAX(id)+1 scheme would.
 */
export async function nextRefNo(type: RecordType, tx: any = prisma) {
  const cfg = TYPES[type];
  const year = new Date().getFullYear();
  const key = `${cfg.counterKey}:${year}`;
  const row = await tx.counter.upsert({
    where: { key },
    update: { value: { increment: 1 } },
    create: { key, value: 1 },
  });
  return `${cfg.prefix}-${year}-${String(row.value).padStart(5, "0")}`;
}

export function buildWhere(type: RecordType, query: ListQuery) {
  const cfg = TYPES[type];
  const where: any = {};

  if (query.status && query.status !== "all") where.status = query.status;
  if (query.location && query.location !== "all") where.location = query.location;
  if (query.shift && query.shift !== "all") where.shift = query.shift;
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(query.from);
    if (query.to) where.date.lte = new Date(query.to);
  }

  const q = query.q?.trim();
  if (q) {
    const like = { contains: q, mode: "insensitive" as const };
    // Search only user-visible columns — never owner ids or lock flags, or
    // searching "admin" would match every record that user happened to enter.
    where.OR = [
      { refNo: like }, { location: like }, { showGroup: like },
      { assigned: like }, { accountable: like }, { remarks: like },
      ...cfg.ownFields.map((f) => ({ [f]: like })),
    ];
  }
  return where;
}

export function buildOrderBy(type: RecordType, sort: SortKey = "date", dir: "asc" | "desc" = "desc") {
  const cfg = TYPES[type];
  if (sort === "subject") return [{ [cfg.subjectField]: dir }];
  if (sort === "date") return [{ date: dir }, { timeStarted: dir }];
  return [{ [sort]: dir }];
}

export async function listRecords(type: RecordType, query: ListQuery) {
  const d = delegateFor(type);
  const where = buildWhere(type, query);
  const perPage = Math.min(query.perPage ?? 50, 200);
  const page = Math.max(query.page ?? 1, 1);

  const [rows, total, unfiltered] = await Promise.all([
    d.findMany({
      where,
      orderBy: buildOrderBy(type, query.sort, query.dir),
      skip: (page - 1) * perPage,
      take: perPage,
      include: { owner: { select: { id: true, firstName: true, middleInitial: true, surname: true } } },
    }),
    d.count({ where }),
    d.count(),
  ]);

  return { rows, total, unfiltered, page, perPage, pages: Math.ceil(total / perPage) || 1 };
}

export async function getRecord(type: RecordType, id: number) {
  return delegateFor(type).findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, middleInitial: true, surname: true, avatarUrl: true } },
      lockedBy: { select: { id: true, firstName: true, surname: true } },
    },
  });
}

/** Closing a record implies an end time; reopening one clears it. */
export function normalizeTimes(data: any) {
  if (data.status === "CLOSED" && !data.timeEnded) data.timeEnded = data.timeStarted;
  if (data.status === "OPEN") data.timeEnded = null;
  return data;
}

export interface BatchResult {
  applied: number;
  skipped: number;
  skippedRefs: string[];
}

/**
 * Batch operations silently skip records the caller may not touch rather than
 * failing the whole request, and report the count back so the UI can say so.
 */
export async function partitionByPermission(type: RecordType, ids: number[], user: SessionUser) {
  const d = delegateFor(type);
  const rows = await d.findMany({
    where: { id: { in: ids } },
    select: { id: true, refNo: true, ownerId: true, locked: true },
  });
  const allowed: number[] = [];
  const skippedRefs: string[] = [];
  for (const r of rows) {
    if (canEdit(user, r)) allowed.push(r.id);
    else skippedRefs.push(r.refNo);
  }
  return { allowed, skippedRefs };
}

export async function batchUpdate(
  type: RecordType, ids: number[], patch: any, user: SessionUser
): Promise<BatchResult> {
  const { allowed, skippedRefs } = await partitionByPermission(type, ids, user);
  if (!allowed.length) return { applied: 0, skipped: skippedRefs.length, skippedRefs };

  const d = delegateFor(type);
  // Status/time coupling is per-row, so a plain updateMany would get it wrong
  // for records with differing start times.
  if (patch.status) {
    const rows = await d.findMany({ where: { id: { in: allowed } }, select: { id: true, timeStarted: true } });
    await prisma.$transaction(
      rows.map((r: any) =>
        d.update({ where: { id: r.id }, data: normalizeTimes({ ...patch, timeStarted: r.timeStarted }) })
      )
    );
  } else {
    await d.updateMany({ where: { id: { in: allowed } }, data: patch });
  }
  return { applied: allowed.length, skipped: skippedRefs.length, skippedRefs };
}

export async function batchDelete(type: RecordType, ids: number[], user: SessionUser): Promise<BatchResult> {
  const { allowed, skippedRefs } = await partitionByPermission(type, ids, user);
  if (allowed.length) {
    await delegateFor(type).deleteMany({ where: { id: { in: allowed } } });
  }
  return { applied: allowed.length, skipped: skippedRefs.length, skippedRefs };
}

/** Locking is admin-only and deliberately ignores ownership. */
export async function batchLock(type: RecordType, ids: number[], lock: boolean, userId: number) {
  const res = await delegateFor(type).updateMany({
    where: { id: { in: ids }, locked: !lock },
    data: { locked: lock, lockedById: lock ? userId : null },
  });
  return { applied: res.count, skipped: ids.length - res.count, skippedRefs: [] as string[] };
}
