export function fullName(u?: { firstName: string; middleInitial?: string | null; surname: string } | null) {
  if (!u) return "Unknown";
  return [u.firstName, u.middleInitial ? u.middleInitial + "." : "", u.surname].filter(Boolean).join(" ");
}
export function initials(u?: { firstName: string; surname: string } | null) {
  if (!u) return "?";
  return ((u.firstName?.[0] || "") + (u.surname?.[0] || "")).toUpperCase();
}
export function ymd(d: Date | string) {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
export function formatTime12Hour(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return time;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return time;

  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? "AM" : "PM"}`;
}
export function duration(start: string, end?: string | null) {
  return end ? `${start} – ${end}` : `Since ${start}`;
}
export function minutesBetween(startDate: Date | string, startTime: string, endDate?: Date | string | null, endTime?: string | null) {
  if (!endDate || !endTime) return null;
  const start = new Date(`${ymd(startDate)}T${startTime}:00`);
  const end = new Date(`${ymd(endDate)}T${endTime}:00`);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}
