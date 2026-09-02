import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isRecordType, TYPES } from "@/lib/recordTypes";
import { nextRefNo, normalizeTimes } from "@/lib/records";
import { schemaFor } from "@/lib/validation";
import { parseCsv, normalizeStatus, normalizePriority, normalizeTime, normalizeDate } from "@/lib/csv";
import { parseWorkbook, isExcelFile } from "@/lib/xlsx";

export const runtime = "nodejs";

/** Legacy sheet headers vary; map the ones seen in the exports to our fields. */
const ALIASES: Record<string, string> = {
  date: "date", shift: "shift",
  location: "location", locations: "location",
  showgroup: "showGroup", show: "showGroup", group: "showGroup",
  clientname: "clientName", client: "clientName",
  problem: "problem", issue: "problem",
  category: "category",
  activitytype: "activityType", activity: "activityType",
  description: "description", desc: "description",
  resolution: "resolution", solution: "resolution",
  timestarted: "timeStarted", start: "timeStarted", starttime: "timeStarted",
  timeended: "timeEnded", end: "timeEnded", endtime: "timeEnded",
  status: "status", priority: "priority",
  assignedto: "assigned", assigned: "assigned", technician: "assigned",
  accountableperson: "accountable", accountable: "accountable", person: "accountable",
  remarks: "remarks", notes: "remarks",
};

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") ?? "");
  const dryRun = String(form.get("dryRun") ?? "") === "true";
  const sheetName = String(form.get("sheet") ?? "") || undefined;
  const scope = String(form.get("scope") ?? "self");

  if (!["self", "admin"].includes(scope)) {
    return NextResponse.json({ error: "Unknown import scope" }, { status: 400 });
  }
  // "self" lets any signed-in user load their own work; "admin" additionally
  // honours the Assigned To / Accountable columns, so it is restricted.
  if (scope === "admin" && !isAdmin(user)) {
    return NextResponse.json(
      { error: "Only administrators can import records on behalf of other people" }, { status: 403 }
    );
  }
  if (!isRecordType(type)) return NextResponse.json({ error: "Choose assistance or tasks" }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "That file is over 10 MB" }, { status: 400 });
  }

  const excel = isExcelFile(file.name, file.type);
  const csv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (!excel && !csv) {
    return NextResponse.json({ error: "Upload an .xlsx, .xlsm or .csv file" }, { status: 400 });
  }

  let headers: string[];
  let rows: string[][];
  let sheets: { name: string; rowCount: number }[] = [];
  let sheetUsed: string | undefined;

  if (excel) {
    try {
      const parsed = await parseWorkbook(Buffer.from(await file.arrayBuffer()), sheetName);
      ({ headers, rows, sheets, sheetUsed } = parsed);
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "That file could not be read as a workbook" }, { status: 400 }
      );
    }
  } else {
    ({ headers, rows } = parseCsv(await file.text()));
  }

  if (!rows.length) return NextResponse.json({ error: "That file has no data rows" }, { status: 400 });

  const mapped = headers.map((h) => ALIASES[h.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null);
  const unknown = headers.filter((_, i) => mapped[i] === null);

  // In self scope the people columns are not read at all. Tell the user which
  // ones were present so an overridden value is never a silent surprise.
  const PEOPLE = ["assigned", "accountable"];
  const overridden = scope === "self"
    ? headers.filter((_, i) => mapped[i] !== null && PEOPLE.includes(mapped[i] as string))
    : [];
  const schema = schemaFor(type);

  const valid: any[] = [];
  const errors: { row: number; message: string }[] = [];

  rows.forEach((cells, idx) => {
    const raw: any = {};
    mapped.forEach((field, i) => {
      if (field) raw[field] = (cells[i] ?? "").trim();
    });

    const candidate = {
      ...raw,
      date: normalizeDate(raw.date),
      timeStarted: normalizeTime(raw.timeStarted),
      timeEnded: normalizeTime(raw.timeEnded) || "",
      status: normalizeStatus(raw.status),
      priority: normalizePriority(raw.priority),
      showGroup: raw.showGroup || null,
      remarks: raw.remarks || null,
      assigned: scope === "self" ? user.name : (raw.assigned || user.name),
      accountable: scope === "self" ? user.name : (raw.accountable || user.name),
      ...(type === "assistance" ? { resolution: raw.resolution || null } : {}),
    };

    const parsed = schema.safeParse(candidate);
    if (parsed.success) valid.push(parsed.data);
    else {
      const first = parsed.error.issues[0];
      errors.push({ row: idx + 2, message: `${first.path.join(".") || "row"}: ${first.message}` });
    }
  });

  // A preview pass lets the user see what would happen before committing.
  if (dryRun) {
    return NextResponse.json({
      preview: true, detected: rows.length, valid: valid.length,
      errors: errors.slice(0, 20), unknownColumns: unknown,
      sample: valid.slice(0, 3),
      format: excel ? "excel" : "csv", sheets, sheetUsed,
      scope, overriddenColumns: overridden, importerName: user.name,
    });
  }

  let imported = 0;
  await prisma.$transaction(async (tx) => {
    const d = (type === "assistance" ? tx.assistance : tx.task) as any;
    for (const row of valid) {
      const refNo = await nextRefNo(type, tx);
      await d.create({
        data: { ...normalizeTimes({ ...row, date: new Date(row.date) }), refNo, ownerId: user.id },
      });
      imported++;
    }
  }, { timeout: 60_000 });

  return NextResponse.json({
    imported, failed: errors.length, errors: errors.slice(0, 20), unknownColumns: unknown,
    format: excel ? "excel" : "csv", sheetUsed, scope,
  });
}
