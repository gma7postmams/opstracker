export const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "thisWeek", label: "This Week" },
  { value: "thisMonth", label: "This Month" },
  { value: "thisYear", label: "This Year" },
  { value: "all", label: "All Records" },
  { value: "custom", label: "Custom" },
] as const;

export type Period = (typeof PERIOD_OPTIONS)[number]["value"];

export function getPeriodRange(period: Period, now: Date): { start: Date; end: Date } | null {
  if (period === "all" || period === "custom") return null;

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

export function getCustomPeriodRange(from: string, to: string): { start: Date; end: Date } | null {
  const start = /^\d{4}-\d{2}-\d{2}$/.test(from) ? new Date(`${from}T00:00:00.000Z`) : null;
  const lastDay = /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T00:00:00.000Z`) : null;
  if (!start || !lastDay || Number.isNaN(start.getTime()) || Number.isNaN(lastDay.getTime()) || from > to ||
    start.toISOString().slice(0, 10) !== from || lastDay.toISOString().slice(0, 10) !== to) {
    return null;
  }

  const end = new Date(lastDay);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function periodDateFilters(period: Period, now = new Date()) {
  const range = getPeriodRange(period, now);
  if (!range) return { from: "", to: "" };

  const lastDay = new Date(range.end);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return { from: range.start.toISOString().slice(0, 10), to: lastDay.toISOString().slice(0, 10) };
}