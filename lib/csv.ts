/**
 * Quote-aware CSV reader. Free-text columns like "Problem" routinely contain
 * commas and sometimes embedded newlines, so splitting on "," is not enough.
 */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;

  const src = text.replace(/^\uFEFF/, ""); // strip BOM from Excel exports

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.some((v) => v.trim() !== "")) rows.push(row);

  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows };
}

export function normalizeStatus(raw?: string): "OPEN" | "CLOSE_PENDING" | "CLOSED" {
  const v = (raw ?? "").toUpperCase().trim().replace(/[\s-]+/g, "_");
  if (v === "CLOSE_PENDING" || v === "PENDING" || v === "FOR_CLOSING") return "CLOSE_PENDING";
  if (v === "CLOSED" || v === "CLOSE" || v === "COMPLETED" || v === "DONE" || v === "RESOLVED") return "CLOSED";
  return "OPEN";
}

export function normalizePriority(raw?: string): "LOW" | "NORMAL" | "HIGH" | "CRITICAL" {
  const v = (raw ?? "").toUpperCase().trim();
  if (v === "LOW" || v === "MINOR") return "LOW";
  if (v === "HIGH" || v === "MAJOR" || v === "URGENT") return "HIGH";
  if (v === "CRITICAL" || v === "SEVERE") return "CRITICAL";
  return "NORMAL";
}

/**
 * Accepts 8:05, 08:05, 8:05 AM, 20:05, and the ISO-ish "YYYY-MM-DDTHH:MM" that
 * the Excel reader emits for cells holding a real datetime. Returns HH:MM.
 */
export function normalizeTime(raw?: string): string {
  let v = (raw ?? "").trim();
  if (!v) return "";

  // Excel datetime cell — keep the clock part.
  const iso = v.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2})/);
  if (iso) return iso[1];

  // Excel time cells occasionally survive as a raw fraction of a day.
  if (/^0?\.\d+$/.test(v)) {
    const mins = Math.round(Number(v) * 24 * 60);
    return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }

  const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return v;
  let h = Number(m[1]);
  const min = m[2];
  const mer = m[3]?.toUpperCase();
  if (mer === "PM" && h < 12) h += 12;
  if (mer === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

/**
 * Excel exports are inconsistent. ISO passes through; otherwise we read
 * slash/dash dates as day-first only when the first part cannot be a month,
 * and otherwise assume the US month-first order these sheets are exported in.
 */
export function normalizeDate(raw?: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);

  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    let [, a, b, y] = m;
    let year = Number(y);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    let month = Number(a);
    let day = Number(b);
    if (month > 12) { [month, day] = [day, month]; }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const d = new Date(v);
  return isNaN(+d) ? v : d.toISOString().slice(0, 10);
}
