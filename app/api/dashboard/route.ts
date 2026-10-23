import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ymd } from "@/lib/format";
import { getCustomPeriodRange, getPeriodRange, PERIOD_OPTIONS, type Period } from "@/lib/period";

const EMPTY = { OPEN: 0, CLOSE_PENDING: 0, CLOSED: 0 };
type TrendGranularity = "day" | "week" | "month" | "year" | "monthWeek";
type TrendBucket = { key: string; date: string; label: string; tooltip: string; highlighted: boolean };
type TrendConfig = {
  start: Date;
  end: Date;
  granularity: TrendGranularity;
  buckets: TrendBucket[];
};

const toMap = (rows: { status: string; _count: number }[]) => {
  const m = { ...EMPTY } as Record<string, number>;
  rows.forEach((r) => (m[r.status] = r._count));
  return m;
};

function startOfUtcDay(date: Date) {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function utcDateKey(date: Date) {
  return ymd(date);
}

function buildTrendConfig(period: Period, now: Date, customRange: { start: Date; end: Date } | null): TrendConfig {
  const today = startOfUtcDay(now);
  const todayKey = utcDateKey(today);
  const currentMonthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const tomorrow = addUtcDays(today, 1);
  const customMatchesCurrentMonth = period === "custom" && customRange?.start.getTime() === currentMonthStart.getTime() && customRange.end.getTime() === tomorrow.getTime();
  const dayBuckets = (start: Date, count: number, highlightedKey: string, labelFormat: "weekday" | "day" | "date" = "weekday") =>
    Array.from({ length: count }, (_, index) => {
      const date = addUtcDays(start, index);
      const key = utcDateKey(date);
      return {
        key,
        date: key,
        label: labelFormat === "weekday"
          ? date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
          : labelFormat === "day"
            ? String(date.getUTCDate())
            : date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" }),
        tooltip: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
        highlighted: key === highlightedKey,
      };
    });

  if (period === "today" || period === "yesterday" || period === "thisWeek") {
    const highlightedDate = period === "yesterday" ? addUtcDays(today, -1) : today;
    const start = period === "thisWeek"
      ? addUtcDays(today, -((today.getUTCDay() + 6) % 7))
      : addUtcDays(highlightedDate, -6);
    const highlightedKey = utcDateKey(highlightedDate);
    return { start, end: addUtcDays(start, 7), granularity: "day", buckets: dayBuckets(start, 7, highlightedKey) };
  }

  if (period === "thisMonth" || customMatchesCurrentMonth) {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth();
    const start = new Date(Date.UTC(year, month, 1));
    const end = new Date(Date.UTC(year, month + 1, 1));
    const firstMonday = addUtcDays(start, -((start.getUTCDay() + 6) % 7));
    const currentMondayKey = utcDateKey(addUtcDays(today, -((today.getUTCDay() + 6) % 7)));
    const buckets: TrendBucket[] = [];
    for (let date = firstMonday; date < end; date = addUtcDays(date, 7)) {
      const key = utcDateKey(date);
      const weekEnd = addUtcDays(date, 6);
      const sameYear = date.getUTCFullYear() === weekEnd.getUTCFullYear();
      const dateOptions: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
        ...(sameYear ? {} : { year: "numeric" }),
        timeZone: "UTC",
      };
      buckets.push({
        key,
        date: key,
        label: `${String(date.getUTCDate()).padStart(2, "0")} ${date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`,
        tooltip: `${date.toLocaleDateString("en-US", dateOptions)} - ${weekEnd.toLocaleDateString("en-US", dateOptions)}`,
        highlighted: key === currentMondayKey,
      });
    }
    return { start, end, granularity: "monthWeek", buckets };
  }

  if (period === "thisYear") {
    const year = today.getUTCFullYear();
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const buckets = Array.from({ length: 12 }, (_, month) => {
      const date = new Date(Date.UTC(year, month, 1));
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      return {
        key,
        date: key,
        label: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
        tooltip: date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
        highlighted: month === today.getUTCMonth(),
      };
    });
    return { start, end, granularity: "month", buckets };
  }

  if (period === "all") {
    const year = today.getUTCFullYear();
    const start = new Date(Date.UTC(year - 4, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    const buckets = Array.from({ length: 5 }, (_, index) => {
      const bucketYear = year - 4 + index;
      return { key: String(bucketYear), date: String(bucketYear), label: String(bucketYear), tooltip: String(bucketYear), highlighted: bucketYear === year };
    });
    return { start, end, granularity: "year", buckets };
  }

  const range = customRange!;
  const dayCount = Math.round((range.end.getTime() - range.start.getTime()) / 86400000);
  const latestDate = addUtcDays(range.end, -1);
  if (dayCount <= 14) {
    return { start: range.start, end: range.end, granularity: "day", buckets: dayBuckets(range.start, dayCount, utcDateKey(latestDate), "date") };
  }
  if (dayCount <= 90) {
    const firstMonday = addUtcDays(range.start, -((range.start.getUTCDay() + 6) % 7));
    const latestMondayKey = utcDateKey(addUtcDays(latestDate, -((latestDate.getUTCDay() + 6) % 7)));
    const buckets: TrendBucket[] = [];
    for (let date = firstMonday; date < range.end; date = addUtcDays(date, 7)) {
      const key = utcDateKey(date);
      buckets.push({
        key,
        date: key,
        label: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        tooltip: date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }),
        highlighted: key === latestMondayKey,
      });
    }
    return { start: range.start, end: range.end, granularity: "week", buckets };
  }

  const firstMonth = new Date(Date.UTC(range.start.getUTCFullYear(), range.start.getUTCMonth(), 1));
  const latestMonthKey = `${latestDate.getUTCFullYear()}-${String(latestDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const buckets: TrendBucket[] = [];
  for (let date = firstMonth; date < range.end; date = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))) {
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    buckets.push({
      key,
      date: key,
      label: date.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }),
      tooltip: date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
      highlighted: key === latestMonthKey,
    });
  }
  return { start: range.start, end: range.end, granularity: "month", buckets };
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = new URL(request.url).searchParams;
  const periodParam = searchParams.get("period") ?? "today";
  if (!PERIOD_OPTIONS.some((option) => option.value === periodParam)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  const period = periodParam as Period;
  let range: { start: Date; end: Date } | null = null;
  if (period === "custom") {
    const fromParam = searchParams.get("from") ?? "";
    const toParam = searchParams.get("to") ?? "";
    range = getCustomPeriodRange(fromParam, toParam);
    if (!range) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
  } else if (period !== "all") {
    range = getPeriodRange(period, new Date());
  }

  const requestedUserId = searchParams.get("userId");
  const filterUserId = user.role === "ADMIN" && requestedUserId ? Number(requestedUserId) : null;
  if (filterUserId !== null && (!Number.isSafeInteger(filterUserId) || filterUserId < 1)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const ownerWhere = {
    ...(user.role === "ADMIN"
      ? filterUserId === null ? {} : { ownerId: filterUserId }
      : { ownerId: user.id }),
  };
  const recordWhere = {
    ...(range ? { startDate: { gte: range.start, lt: range.end } } : {}),
    ...ownerWhere,
  };

  const trendConfig = buildTrendConfig(period, new Date(), range);
  const trendWhere = {
    startDate: { gte: trendConfig.start, lt: trendConfig.end },
    ...(user.role === "ADMIN"
      ? filterUserId === null ? {} : { ownerId: filterUserId }
      : { ownerId: user.id }),
  };

  const [aStatus, tStatus, aTotal, tTotal, cats, aAttention, tAttention, aTrend, tTrend, aOverdue, tOverdue, auditLogs,] = await Promise.all([

    prisma.assistance.groupBy({by: ["status"], _count: true, where: recordWhere,}),
    prisma.task.groupBy({by: ["status"], _count: true, where: recordWhere,}),
    prisma.assistance.count({where: recordWhere,}),
    prisma.task.count({where: recordWhere,}), 

    prisma.assistance.groupBy({ by: ["category"], where: recordWhere, _count: true, orderBy: { _count: { category: "desc",},},}),

    prisma.assistance.findMany({
      where: { ...ownerWhere, status: { in: ["OPEN", "CLOSE_PENDING"] } },
      orderBy: { startDate: "asc" },
      take: 8,
      select: { id: true, refNo: true, clientName: true, showGroup: true, location: true, problem: true, assigned: true, priority: true, status: true, startDate: true },
    }),
    prisma.task.findMany({
      where: { ...ownerWhere, status: { in: ["OPEN", "CLOSE_PENDING"] } },
      orderBy: { startDate: "asc" },
      take: 8,
      select: { id: true, refNo: true, activityType: true, description: true, assigned: true, priority: true, status: true, startDate: true },
    }),
    prisma.assistance.groupBy({ by: ["startDate"], _count: true, where: trendWhere }),
    prisma.task.groupBy({ by: ["startDate"], _count: true, where: trendWhere }),

  prisma.assistance.count({
    where: {
      ...recordWhere,
      status: { not: "CLOSED" },
      startDate: { ...(recordWhere.startDate ?? {}), lt: today },
    },
  }),

prisma.task.count({
  where: {
    ...recordWhere,
    status: { not: "CLOSED" },
    startDate: { ...(recordWhere.startDate ?? {}), lt: today },
  },
}),

prisma.auditLog.findMany({
  orderBy: { createdAt: "desc" },
  take: 5,
}),

  ]);

  const attentionRecords = [
    ...aAttention.map((record) => ({ ...record, type: "assistance" })),
    ...tAttention.map((record) => ({ ...record, type: "tasks" })),
  ];
  const attentionHistory = attentionRecords.length
    ? await prisma.auditLog.findMany({
      where: {
        entityId: { in: attentionRecords.map((record) => record.refNo) },
        entityType: { in: ["assistance", "tasks"] },
        action: { in: ["CREATE", "ENDORSED", "ASSIGNMENT_CHANGE"] },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { entityType: true, entityId: true, action: true, details: true },
    })
    : [];
  const ownershipByRecord = new Map<string, string[]>();
  const appendOwner = (owners: string[], value: unknown) => {
    if (typeof value !== "string") return;
    const owner = value.trim();
    if (owner && owners[owners.length - 1] !== owner) owners.push(owner);
  };
  for (const event of attentionHistory) {
    if (!event.entityId) continue;
    const key = `${event.entityType}:${event.entityId}`;
    const owners = ownershipByRecord.get(key) ?? [];
    const details = event.details && typeof event.details === "object" && !Array.isArray(event.details)
      ? event.details as Record<string, unknown>
      : {};
    if (event.action === "CREATE") {
      appendOwner(owners, details.assigned);
    } else {
      appendOwner(owners, details.previousAssigned);
      appendOwner(owners, details.assigned);
    }
    ownershipByRecord.set(key, owners);
  }

  const getTrendCounts = (rows: { startDate: Date; _count: number }[]) => {
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const dateKey = ymd(row.startDate);
      const date = new Date(`${dateKey}T00:00:00.000Z`);
      const key = trendConfig.granularity === "day"
        ? dateKey
        : trendConfig.granularity === "week"
          ? utcDateKey(addUtcDays(date, -((date.getUTCDay() + 6) % 7)))
          : trendConfig.granularity === "monthWeek"
            ? utcDateKey(addUtcDays(date, -((date.getUTCDay() + 6) % 7)))
            : trendConfig.granularity === "month"
              ? dateKey.slice(0, 7)
              : dateKey.slice(0, 4);
      counts.set(key, (counts.get(key) ?? 0) + row._count);
    });
    return counts;
  };
  const assistanceTrendCounts = getTrendCounts(aTrend);
  const taskTrendCounts = getTrendCounts(tTrend);
  const trend = trendConfig.buckets.map((bucket) => ({
    date: bucket.date,
    label: bucket.label,
    tooltip: bucket.tooltip,
    assistanceCount: assistanceTrendCounts.get(bucket.key) ?? 0,
    taskCount: taskTrendCounts.get(bucket.key) ?? 0,
    highlighted: bucket.highlighted,
  }));
  const trendSubtitle = period === "today" || period === "yesterday" || period === "thisWeek"
    ? "Records logged, this week"
      : period === "thisMonth"
        ? "Records logged, this month"
        : period === "thisYear"
          ? "Records logged, this year"
          : period === "all"
            ? "Records logged, all records"
            : "Records logged, custom range";


  const attention = [
    ...aAttention.map((r) => ({ ...r, type: "assistance", subject: r.clientName, body: r.problem })),
    ...tAttention.map((r) => ({ ...r, type: "tasks", subject: r.activityType, body: r.description })),
  ]
    .sort((left, right) => left.startDate.getTime() - right.startDate.getTime())
    .slice(0, 8)
    .map((record) => {
      const ownershipFlow = ownershipByRecord.get(`${record.type}:${record.refNo}`) ?? [];
      appendOwner(ownershipFlow, record.assigned);
      return {
        ...record,
        ownershipFlow,
        ageDays: Math.max(0, Math.floor((today.getTime() - new Date(`${ymd(record.startDate)}T00:00:00.000Z`).getTime()) / 86400000)),
      };
    });

console.log("Audit Logs Found:", auditLogs.length);

return NextResponse.json({
  assistance: { total: aTotal, ...toMap(aStatus as any) },
  tasks: { total: tTotal, ...toMap(tStatus as any) },
  overdue: aOverdue + tOverdue,
  categories: cats.map((c: any) => ({ name: c.category, count: c._count })),
  trend,
  trendSubtitle,
  attention,

  recentActivity: auditLogs.map((a: any) => ({
    id: a.id,
    action: a.action,
    entityId: a.entityId,
    createdAt: a.createdAt,
    details: a.details,
  })),


});

}
