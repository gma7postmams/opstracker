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
export function duration(start: string, end?: string | null) {
  return end ? `${start} – ${end}` : `Since ${start}`;
}
export function minutesBetween(start: string, end?: string | null) {
  if (!end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight shift
  return mins;
}
