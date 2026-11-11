export type BackupFrequencyValue = "DAILY" | "WEEKLY" | "MONTHLY";

export type BackupScheduleInput = {
  frequency: BackupFrequencyValue;
  backupTime: string;
  timezone: string;
  weeklyDay: number | null;
  monthlyDay: number | null;
};

function zonedParts(date: Date, timezone: string) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => formatted.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function wallTimeToDate(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let timestamp = target;
  for (let attempt = 0; attempt < 4; attempt++) {
    const observed = zonedParts(new Date(timestamp), timezone);
    const observedAsUtc = Date.UTC(observed.year, observed.month - 1, observed.day, observed.hour, observed.minute);
    timestamp += target - observedAsUtc;
  }
  const result = new Date(timestamp);
  const actual = zonedParts(result, timezone);
  if (actual.year !== year || actual.month !== month || actual.day !== day || actual.hour !== hour || actual.minute !== minute) {
    return null;
  }
  return result;
}

export function getNextBackupRun(schedule: BackupScheduleInput, after: Date) {
  const [hour, minute] = schedule.backupTime.split(":").map(Number);
  const localNow = zonedParts(after, schedule.timezone);

  for (let offset = 0; offset <= 370; offset++) {
    const calendarDay = new Date(Date.UTC(localNow.year, localNow.month - 1, localNow.day + offset));
    if (schedule.frequency === "WEEKLY" && calendarDay.getUTCDay() !== schedule.weeklyDay) continue;
    if (schedule.frequency === "MONTHLY") {
      const lastDay = new Date(Date.UTC(calendarDay.getUTCFullYear(), calendarDay.getUTCMonth() + 1, 0)).getUTCDate();
      if (calendarDay.getUTCDate() !== Math.min(schedule.monthlyDay ?? 1, lastDay)) continue;
    }

    const candidate = wallTimeToDate(
      calendarDay.getUTCFullYear(),
      calendarDay.getUTCMonth() + 1,
      calendarDay.getUTCDate(),
      hour,
      minute,
      schedule.timezone,
    );
    if (candidate && candidate.getTime() > after.getTime()) return candidate;
  }

  throw new Error("Could not calculate the next backup run");
}