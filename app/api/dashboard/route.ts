import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ymd } from "@/lib/format";

const EMPTY = { OPEN: 0, CLOSE_PENDING: 0, CLOSED: 0 };
const PERIODS = ["today", "yesterday", "thisWeek", "thisMonth", "thisYear", "all", "custom"] as const;
type DashboardPeriod = (typeof PERIODS)[number];

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

function getPeriodRange(period: DashboardPeriod, now: Date) {
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  if (period === "today") return { start: today, end: tomorrow };
  if (period === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return { start: yesterday, end: today };
  }
  if (period === "thisWeek") {
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return { start: monday, end: tomorrow };
  }
  if (period === "thisMonth") {
    return { start: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)), end: tomorrow };
  }

  return { start: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), end: tomorrow };
}

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

function buildTrendConfig(period: DashboardPeriod, now: Date, customRange: { start: Date; end: Date } | null): TrendConfig {
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
  if (!PERIODS.includes(periodParam as DashboardPeriod)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }
  const period = periodParam as DashboardPeriod;
  let range: { start: Date; end: Date } | null = null;
  if (period === "custom") {
    const fromParam = searchParams.get("from") ?? "";
    const toParam = searchParams.get("to") ?? "";
    const from = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? new Date(`${fromParam}T00:00:00.000Z`) : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? new Date(`${toParam}T00:00:00.000Z`) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || fromParam > toParam ||
      from.toISOString().slice(0, 10) !== fromParam || to.toISOString().slice(0, 10) !== toParam) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const end = new Date(to);
    end.setUTCDate(end.getUTCDate() + 1);
    range = { start: from, end };
  } else if (period !== "all") {
    range = getPeriodRange(period as Exclude<DashboardPeriod, "all" | "custom">, new Date());
  }

  const requestedUserId = searchParams.get("userId");
  const filterUserId = user.role === "ADMIN" && requestedUserId ? Number(requestedUserId) : null;
  if (filterUserId !== null && (!Number.isSafeInteger(filterUserId) || filterUserId < 1)) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const recordWhere = {
    ...(range ? { startDate: { gte: range.start, lt: range.end } } : {}),
    ...(user.role === "ADMIN"
      ? filterUserId === null ? {} : { ownerId: filterUserId }
      : { ownerId: user.id }),
  };

  const trendConfig = buildTrendConfig(period, new Date(), range);
  const trendWhere = {
    startDate: { gte: trendConfig.start, lt: trendConfig.end },
    ...(user.role === "ADMIN"
      ? filterUserId === null ? {} : { ownerId: filterUserId }
      : { ownerId: user.id }),
  };

  const [aStatus, tStatus, aTotal, tTotal, cats, aRecent, tRecent, aTrend, tTrend, aOverdue, tOverdue, auditLogs,] = await Promise.all([

    prisma.assistance.groupBy({by: ["status"], _count: true, where: recordWhere,}),
    prisma.task.groupBy({by: ["status"], _count: true, where: recordWhere,}),
    prisma.assistance.count({where: recordWhere,}),
    prisma.task.count({where: recordWhere,}), 

    prisma.assistance.groupBy({ by: ["category"], where: recordWhere, _count: true, orderBy: { _count: { category: "desc",},},}),

    prisma.assistance.findMany({
      where: {
        ...recordWhere,
        status: { not: "CLOSED" },
      },
      orderBy: [{ priority: "desc" }, { startDate: "desc" }],
      take: 6,
      select: { id: true, refNo: true, clientName: true, problem: true, priority: true, status: true },
    }),
    prisma.task.findMany({
      where: {
        ...recordWhere,
        status: { not: "CLOSED" },
      },
      orderBy: [{ priority: "desc" }, { startDate: "desc" }],
      take: 6,
      select: { id: true, refNo: true, activityType: true, description: true, priority: true, status: true },
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
    ...aRecent.map((r) => ({ ...r, type: "assistance", subject: r.clientName, body: r.problem })),
    ...tRecent.map((r) => ({ ...r, type: "tasks", subject: r.activityType, body: r.description })),
  ].slice(0, 8);

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
