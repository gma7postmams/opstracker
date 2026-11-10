import { prisma } from "./prisma";
import { logAudit, makeAuditChanges } from "./audit";
import { RecordType, TYPES, SortKey } from "./recordTypes";
import { SessionUser, canEdit } from "./permissions";
import { fullName } from "./format";

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
  category?: string;
  shift?: string;
  from?: string;
  to?: string;
  userId?: number | "all";
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

function searchDateRange(value: string) {
  let year: number;
  let month: number;
  let day: number;
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) {
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
    if (match) {
      month = Number(match[1]);
      day = Number(match[2]);
      year = Number(match[3]);
    } else if (/^[a-z]{3,9}\s+\d{1,2},?\s+\d{4}$/i.test(value)) {
      const parsed = new Date(`${value} UTC`);
      if (Number.isNaN(parsed.getTime())) return undefined;
      year = parsed.getUTCFullYear();
      month = parsed.getUTCMonth() + 1;
      day = parsed.getUTCDate();
    } else {
      return undefined;
    }
  }

  const start = new Date(Date.UTC(year, month - 1, day));
  if (start.getUTCFullYear() !== year || start.getUTCMonth() !== month - 1 || start.getUTCDate() !== day) {
    return undefined;
  }
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: start, lt: end };
}

export function buildWhere(type: RecordType, query: ListQuery) {
  const cfg = TYPES[type];
  const where: any = {};

  if (query.status && query.status !== "all") where.status = query.status;
  if (type === "assistance" && query.location && query.location !== "all") where.location = query.location;
  if (type === "assistance" && query.category && query.category !== "all") where.category = query.category;
  if (query.shift && query.shift !== "all") where.shift = query.shift;
  if (query.from || query.to) {
    where.startDate = {};
    if (query.from) where.startDate.gte = new Date(query.from);
    if (query.to) where.startDate.lte = new Date(query.to);
  }

  const q = query.q?.trim();
  if (q) {
    const like = { contains: q, mode: "insensitive" as const };
    const normalizedQuery = q.toLowerCase().replace(/[_-]+/g, " ");
    const statusOptions = [
      ["OPEN", "Open"],
      ["CLOSE_PENDING", "Close Pending"],
      ["CLOSED", "Closed"],
    ] as const;
    const priorityOptions = [
      ["LOW", "Low"],
      ["NORMAL", "Normal"],
      ["HIGH", "High"],
      ["CRITICAL", "Critical"],
    ] as const;
    const workLogTypeOptions = [
      ["INVESTIGATION", "Investigation"],
      ["RESOLUTION", "Resolution"],
      ["REMARK", "Remark"],
    ] as const;
    const matchingStatuses = statusOptions
      .filter(([value, label]) => `${value.replaceAll("_", " ")} ${label}`.toLowerCase().includes(normalizedQuery))
      .map(([value]) => value);
    const matchingPriorities = priorityOptions
      .filter(([value, label]) => `${value} ${label}`.toLowerCase().includes(normalizedQuery))
      .map(([value]) => value);
    const matchingWorkLogTypes = workLogTypeOptions
      .filter(([value, label]) => `${value} ${label}`.toLowerCase().includes(normalizedQuery))
      .map(([value]) => value);
    const dateRange = searchDateRange(q);
    // Search only user-visible columns — never owner ids or lock flags, or
    // searching "admin" would match every record that user happened to enter.
    where.OR = [
      { refNo: like },
      ...(type === "assistance" ? [{ location: like }] : []),
      ...(type === "assistance" ? [{ showGroup: like }] : []),
      ...(type === "assistance" ? [{ cause: like }] : []),
      { shift: like }, { timeStarted: like }, { timeEnded: like },
      { assigned: like }, { accountable: like }, { remarks: like },
      ...cfg.ownFields.map((f) => ({ [f]: like })),
      { owner: { is: { OR: [
        { firstName: like }, { middleInitial: like }, { surname: like },
      ] } } },
      { workLogs: { some: { OR: [
        { message: like }, { createdByName: like },
        ...(matchingWorkLogTypes.length ? [{ type: { in: matchingWorkLogTypes } }] : []),
        ...(dateRange ? [{ createdAt: dateRange }, { updatedAt: dateRange }] : []),
      ] } } },
      ...(matchingStatuses.length ? [{ status: { in: matchingStatuses } }] : []),
      ...(matchingPriorities.length ? [{ priority: { in: matchingPriorities } }] : []),
      ...(dateRange ? [{ startDate: dateRange }, { endDate: dateRange }] : []),
    ];
  }
  return where;
}

export function buildOrderBy(type: RecordType, sort: SortKey = "date", dir: "asc" | "desc" = "desc") {
  const cfg = TYPES[type];
  if (sort === "subject") return [{ [cfg.subjectField]: dir }];
  if (sort === "date") return [{ startDate: dir }, { timeStarted: dir }];
  if (sort === "category") {
    return type === "assistance"
      ? [{ category: dir }]
      : [{ activityType: dir }];
  }
  return [{ [sort]: dir }];
}

export function recordVisibilityWhere(user: SessionUser, includeAllUserOwned = false) {
  if (user.role === "ADMIN") return {};
  if (includeAllUserOwned) return { owner: { is: { role: "USER" as const } } };
  return recordParticipationWhere(user);
}

export function recordParticipationWhere(user: { id: number; name?: string }) {
  return {
    OR: [
      { ownerId: user.id },
      ...(user.name ? [{ assigned: user.name }] : []),
      { workLogs: { some: { createdById: user.id } } },
    ],
  };
}

export async function hasUserParticipated(type: RecordType, recordId: number, userId: number) {
  const recordLink = type === "assistance" ? { assistanceId: recordId } : { taskId: recordId };
  return Boolean(await prisma.workLog.findFirst({
    where: { ...recordLink, createdById: userId },
    select: { id: true },
  }));
}

export function applyRecordVisibility<T extends Record<string, any>>(
  where: T,
  user: SessionUser,
  includeAllUserOwned = false
) {
  const visibility = recordVisibilityWhere(user, includeAllUserOwned);
  return Object.keys(visibility).length ? { AND: [where, visibility] } : where;
}

export async function listRecords(type: RecordType, query: ListQuery, user?: any) {
  const d = delegateFor(type);
  const filters = buildWhere(type, query);
  const includeAllUserOwned = query.userId === "all";
  let where = user ? applyRecordVisibility(filters, user, includeAllUserOwned) : filters;
  if (query.userId && query.userId !== "all") {
    const filterUserId = Number(query.userId);
    if (Number.isInteger(filterUserId) && filterUserId > 0) {
      let filterUserName = filterUserId === user?.id ? user.name : undefined;
      if (!filterUserName) {
        const filterUser = await prisma.user.findUnique({
          where: { id: filterUserId },
          select: { firstName: true, middleInitial: true, surname: true },
        });
        if (filterUser) filterUserName = fullName(filterUser);
      }
      where = { AND: [where, recordParticipationWhere({ id: filterUserId, name: filterUserName })] };
    }
  }
  const unfilteredWhere = user ? recordVisibilityWhere(user, includeAllUserOwned) : {};


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
    d.count({ where: unfilteredWhere }),
  ]);

  return { rows, total, unfiltered, page, perPage, pages: Math.ceil(total / perPage) || 1 };
}

export async function getRecord(type: RecordType, id: number) {
  return delegateFor(type).findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, firstName: true, middleInitial: true, surname: true, avatarUrl: true, role: true } },
      lockedBy: { select: { id: true, firstName: true, surname: true } },
    },
  });
}

/** Normalize status-dependent end timestamps. */
export function normalizeTimes(data: any) {
  const normalized = { ...data };
  if (normalized.status === "OPEN") {
    normalized.endDate = null;
    normalized.timeEnded = null;
  } else if (normalized.status === "CLOSE_PENDING") {
    const now = new Date();
    if (!normalized.endDate) {
      normalized.endDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    }
    if (!normalized.timeEnded) {
      normalized.timeEnded = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
  }
  return normalized;
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
    select: { id: true, refNo: true, ownerId: true, assigned: true, locked: true },
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
    const rows = await d.findMany({
      where: { id: { in: allowed } },
      select: { id: true, refNo: true, status: true, endDate: true, timeEnded: true },
    });
    const changed = await prisma.$transaction(async (tx) => {
      const txDelegate = (type === "assistance" ? tx.assistance : tx.task) as any;
      return Promise.all(rows.map(async (row: any) => {
        const normalized = normalizeTimes({
          ...patch,
          endDate: patch.endDate ?? row.endDate?.toISOString().slice(0, 10) ?? null,
          timeEnded: patch.timeEnded ?? row.timeEnded,
        });
        const updated = await txDelegate.update({
          where: { id: row.id },
          data: {
            ...normalized,
            endDate: normalized.endDate ? new Date(normalized.endDate) : null,
          } as any,
        });
        return { previous: row, updated };
      }));
    });
    await Promise.all(changed
      .filter(({ previous, updated }) => previous.status !== updated.status)
      .map(({ previous, updated }) => logAudit({
        action: "STATUS_CHANGE",
        entityType: type,
        entityId: updated.refNo,
        userId: user.id,
        details: {
          name: user.name,
          changes: makeAuditChanges(previous, updated, ["status", "endDate", "timeEnded"]),
        },
      })));
  } else {
    await prisma.$transaction([
      d.updateMany({
        where: { id: { in: allowed }, status: "OPEN" },
        data: { ...patch, endDate: null, timeEnded: null },
      }),
      d.updateMany({
        where: { id: { in: allowed }, status: { not: "OPEN" } },
        data: patch,
      }),
    ]);
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
