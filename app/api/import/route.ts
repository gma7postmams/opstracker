import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { isRecordType } from "@/lib/recordTypes";
import { nextRefNo, normalizeTimes } from "@/lib/records";
import { schemaFor } from "@/lib/validation";
import { parseCsv, normalizeStatus, normalizePriority, normalizeTime, normalizeDate } from "@/lib/csv";
import { parseWorkbook, isExcelFile, type ParsedSheet } from "@/lib/xlsx";
import { fullName } from "@/lib/format";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/** Legacy sheet headers vary; map the ones seen in the exports to our fields. */
const ALIASES: Record<string, string> = {
  date: "startDate", startdate: "startDate", enddate: "endDate", shift: "shift",
  location: "location", locations: "location",
  showgroup: "showGroup", show: "showGroup", group: "showGroup",
  clientname: "clientName", client: "clientName",
  problem: "problem", issue: "problem",
  cause: "cause",
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

type ImportWarning = { row: number; message: string; sheet?: string };

function normalizePersonName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function processRows(
  sheet: ParsedSheet,
  type: "assistance" | "tasks",
  importerName: string,
  usersByName: Map<string, string[]>,
) {
  const mapped = sheet.headers.map((header) =>
    ALIASES[header.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null
  );
  const unknownColumns = sheet.headers.filter((_, index) => mapped[index] === null);
  const overriddenColumns = sheet.headers.filter((_, index) => mapped[index] === "accountable");
  const valid: any[] = [];
  const errors: { row: number; message: string; sheet?: string }[] = [];
  const warnings: ImportWarning[] = [];

  sheet.rows.forEach((cells, index) => {
    const raw: Record<string, string> = {};
    mapped.forEach((field, column) => {
      if (field) raw[field] = (cells[column] ?? "").trim();
    });

    const requestedAssignee = raw.assigned ?? "";
    let assigned = "";
    if (requestedAssignee) {
      const matches = usersByName.get(normalizePersonName(requestedAssignee)) ?? [];
      if (matches.length === 1) {
        assigned = matches[0];
      } else if (matches.length === 0) {
        warnings.push({
          row: index + 2,
          sheet: sheet.sheetUsed,
          message: `Assigned To "${requestedAssignee}" did not match a user; the record will be unassigned.`,
        });
      } else {
        warnings.push({
          row: index + 2,
          sheet: sheet.sheetUsed,
          message: `Assigned To "${requestedAssignee}" matches multiple users; the record will be unassigned.`,
        });
      }
    }

    const candidate = normalizeTimes({
      ...raw,
      startDate: normalizeDate(raw.startDate),
      endDate: normalizeDate(raw.endDate) || "",
      timeStarted: normalizeTime(raw.timeStarted),
      timeEnded: normalizeTime(raw.timeEnded) || "",
      status: normalizeStatus(raw.status),
      priority: normalizePriority(raw.priority),
      ...(type === "assistance"
        ? { location: raw.location || "", showGroup: raw.showGroup || null }
        : {}),
      remarks: raw.remarks || null,
      assigned: assigned || importerName,
      accountable: importerName,
      ...(type === "assistance" ? { resolution: raw.resolution || null } : {}),
    });

    const parsed = schemaFor(type).safeParse(candidate);
    if (parsed.success) {
      valid.push({ ...normalizeTimes(parsed.data), assigned, accountable: importerName, type });
    } else {
      const first = parsed.error.issues[0];
      errors.push({
        row: index + 2,
        sheet: sheet.sheetUsed,
        message: `${first.path.join(".") || "row"}: ${first.message}`,
      });
    }
  });

  return { valid, errors, warnings, unknownColumns, overriddenColumns };
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const type = String(form.get("type") ?? "");
  const dryRun = String(form.get("dryRun") ?? "") === "true";
  const scope = String(form.get("scope") ?? "self");

  if (type !== "both" && !isRecordType(type)) {
    return NextResponse.json({ error: "Unknown record type" }, { status: 400 });
  }
  if (!["self", "admin"].includes(scope)) {
    return NextResponse.json({ error: "Unknown import scope" }, { status: 400 });
  }
  if (scope === "admin" && !isAdmin(user)) {
    return NextResponse.json(
      { error: "Only administrators can import records on behalf of other people" },
      { status: 403 },
    );
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "That file is over 10 MB" }, { status: 400 });
  }

  const excel = isExcelFile(file.name, file.type);
  const csv = /\.csv$/i.test(file.name) || file.type === "text/csv";
  if (!excel && !csv) {
    return NextResponse.json({ error: "Upload an .xlsx, .xlsm or .csv file" }, { status: 400 });
  }
  if (type === "both" && !excel) {
    return NextResponse.json(
      { error: "Both import requires an Excel workbook with separate sheets" },
      { status: 400 },
    );
  }

  const types: Array<"assistance" | "tasks"> = type === "both"
    ? ["assistance", "tasks"]
    : [type as "assistance" | "tasks"];
  const sheetNames = new Map<"assistance" | "tasks", string>([
    ["assistance", "Technical Assistance"],
    ["tasks", "Other Tasks"],
  ]);
  const parsedSheets = new Map<"assistance" | "tasks", ParsedSheet>();
  let sheets: ParsedSheet["sheets"] = [];

  if (excel) {
    const buffer = Buffer.from(await file.arrayBuffer());
    try {
      for (const recordType of types) {
        const parsed = await parseWorkbook(buffer, sheetNames.get(recordType));
        parsedSheets.set(recordType, parsed);
        sheets = parsed.sheets;
      }
    } catch (error: any) {
      const needed = types.map((recordType) => `"${sheetNames.get(recordType)}"`).join(" and ");
      return NextResponse.json({
        error: error?.message || `Workbook must contain the ${needed} worksheet${types.length > 1 ? "s" : ""}`,
      }, { status: 400 });
    }
  } else {
    const parsed = parseCsv(await file.text());
    const recordType = types[0];
    parsedSheets.set(recordType, {
      ...parsed,
      sheets: [],
      sheetUsed: "CSV",
    });
  }

  const parsedRows = new Map<"assistance" | "tasks", ReturnType<typeof processRows>>();
  const allUsers = await prisma.user.findMany({
    select: { firstName: true, middleInitial: true, surname: true },
  });
  const usersByName = new Map<string, string[]>();
  for (const account of allUsers) {
    const name = fullName(account);
    const key = normalizePersonName(name);
    usersByName.set(key, [...(usersByName.get(key) ?? []), name]);
  }

  for (const recordType of types) {
    const parsed = parsedSheets.get(recordType)!;
    parsedRows.set(recordType, processRows(parsed, recordType, user.name, usersByName));
  }

  const sheetSummaries = types.map((recordType) => {
    const result = parsedRows.get(recordType)!;
    return {
      sheet: parsedSheets.get(recordType)!.sheetUsed,
      detected: parsedSheets.get(recordType)!.rows.length,
      valid: result.valid.length,
      failed: result.errors.length,
      warnings: result.warnings.length,
    };
  });
  const results = [...parsedRows.values()];
  const valid = results.flatMap((result) => result.valid);
  const errors = results.flatMap((result) => result.errors);
  const warnings = results.flatMap((result) => result.warnings);
  const unknownColumns = [...new Set(results.flatMap((result) => result.unknownColumns))];
  const overriddenColumns = [...new Set(results.flatMap((result) => result.overriddenColumns))];
  const detected = types.reduce((count, recordType) => count + parsedSheets.get(recordType)!.rows.length, 0);
  const processedSheetNames = types.map((recordType) => sheetNames.get(recordType)!);
  const ignoredSheets = sheets
    .map((sheet) => sheet.name)
    .filter((name) => !processedSheetNames.includes(name));
  const sample = valid.slice(0, 3);

  if (dryRun) {
    return NextResponse.json({
      preview: true,
      detected,
      valid: valid.length,
      errors: errors.slice(0, 20),
      warnings,
      unknownColumns,
      sample,
      format: excel ? "excel" : "csv",
      sheets,
      sheetUsed: type === "both" ? "Both" : (excel ? sheetNames.get(types[0]) : "CSV"),
      sheetSummaries,
      ignoredSheets,
      scope,
      overriddenColumns,
      importerName: user.name,
    });
  }

  let assistanceImported = 0;
  let taskImported = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of valid) {
      const recordType = row.type as "assistance" | "tasks";
      const data = { ...row };
      delete data.type;
      const refNo = await nextRefNo(recordType, tx);
      const recordData = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        refNo,
        ownerId: user.id,
      };
      if (recordType === "assistance") {
        await tx.assistance.create({ data: recordData as any });
        assistanceImported++;
      } else {
        await tx.task.create({ data: { ...recordData, location: "" } as any });
        taskImported++;
      }
    }
  }, { timeout: 60_000 });

  const imported = assistanceImported + taskImported;
  const completedSheetSummaries = sheetSummaries.map((summary, index) => ({
    ...summary,
    imported: types[index] === "assistance" ? assistanceImported : taskImported,
  }));
  await logAudit({
    userId: user.id,
    action: type === "both" ? "IMPORT_BOTH" : "IMPORT",
    entityType: type === "both"
      ? "Workbook"
      : (type === "assistance" ? "Technical Assistance" : "Other Tasks"),
    entityId: `Successfully Imported ${imported} Records`,
    details: {
      user: user.name,
      filename: file.name,
      imported,
      assistanceImported,
      taskImported,
      failed: errors.length,
      scope,
      format: excel ? "excel" : "csv",
      ignoredSheets,
      warnings: warnings.length,
    },
  });

  return NextResponse.json({
    imported,
    assistanceImported,
    taskImported,
    failed: errors.length,
    errors: errors.slice(0, 20),
    warnings,
    sheetSummaries: completedSheetSummaries,
    unknownColumns,
    ignoredSheets,
    format: excel ? "excel" : "csv",
    scope,
  });
}