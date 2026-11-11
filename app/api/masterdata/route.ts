import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { masterDataSchema, flatten } from "@/lib/validation";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";

const normalizeValue = (value: string) => value.trim().toLocaleLowerCase();

function valueKey(kind: string, value: string) {
  return `${kind}:${normalizeValue(value)}`;
}

type UsageRecordMatch = {
  refNo: string;
  recordType: string;
  date: string;
  details: string;
};

async function lookupUsage(kind: string, value: string) {
  let result: { usageCount: number; records: UsageRecordMatch[] }[];
  switch (kind) {
    case "LOCATION":
      result = await prisma.$queryRaw<{ usageCount: number; records: UsageRecordMatch[] }[]>`
        WITH matches AS (
          SELECT ref_no AS "refNo", 'Technical Assistance'::text AS "recordType", date::text AS date,
            CONCAT_WS(' | ', 'Shift: ' || shift, 'Show / Group: ' || show_group) AS details
          FROM assistance WHERE LOWER(BTRIM(location)) = LOWER(BTRIM(${value}))
          UNION ALL
          SELECT ref_no, 'Other Task'::text, date::text,
            CONCAT_WS(' | ', 'Shift: ' || shift, 'Activity Type: ' || activity_type)
          FROM tasks WHERE LOWER(BTRIM(location)) = LOWER(BTRIM(${value}))
        ), recent AS (SELECT * FROM matches ORDER BY date DESC LIMIT 5)
        SELECT (SELECT COUNT(*)::int FROM matches) AS "usageCount",
          COALESCE((SELECT JSON_AGG(TO_JSON(recent)) FROM recent), '[]'::json) AS records`;
      break;
    case "SHIFT":
      result = await prisma.$queryRaw<{ usageCount: number; records: UsageRecordMatch[] }[]>`
        WITH matches AS (
          SELECT ref_no AS "refNo", 'Technical Assistance'::text AS "recordType", date::text AS date,
            CONCAT_WS(' | ', 'Location: ' || location, 'Show / Group: ' || show_group, 'Category: ' || category) AS details
          FROM assistance WHERE LOWER(BTRIM(shift)) = LOWER(BTRIM(${value}))
          UNION ALL
          SELECT ref_no, 'Other Task'::text, date::text,
            CONCAT_WS(' | ', 'Location: ' || location, 'Activity Type: ' || activity_type)
          FROM tasks WHERE LOWER(BTRIM(shift)) = LOWER(BTRIM(${value}))
        ), recent AS (SELECT * FROM matches ORDER BY date DESC LIMIT 5)
        SELECT (SELECT COUNT(*)::int FROM matches) AS "usageCount",
          COALESCE((SELECT JSON_AGG(TO_JSON(recent)) FROM recent), '[]'::json) AS records`;
      break;
    case "SHOW_GROUP":
      result = await prisma.$queryRaw<{ usageCount: number; records: UsageRecordMatch[] }[]>`
        WITH matches AS (
          SELECT ref_no AS "refNo", 'Technical Assistance'::text AS "recordType", date::text AS date,
            CONCAT_WS(' | ', 'Shift: ' || shift, 'Location: ' || location, 'Category: ' || category) AS details
          FROM assistance WHERE LOWER(BTRIM(show_group)) = LOWER(BTRIM(${value}))
          UNION ALL
          SELECT ref_no, 'Other Task'::text, date::text,
            CONCAT_WS(' | ', 'Shift: ' || shift, 'Location: ' || location, 'Activity Type: ' || activity_type)
          FROM tasks WHERE LOWER(BTRIM(show_group)) = LOWER(BTRIM(${value}))
        ), recent AS (SELECT * FROM matches ORDER BY date DESC LIMIT 5)
        SELECT (SELECT COUNT(*)::int FROM matches) AS "usageCount",
          COALESCE((SELECT JSON_AGG(TO_JSON(recent)) FROM recent), '[]'::json) AS records`;
      break;
    case "CATEGORY":
      result = await prisma.$queryRaw<{ usageCount: number; records: UsageRecordMatch[] }[]>`
        WITH matches AS (
          SELECT ref_no AS "refNo", 'Technical Assistance'::text AS "recordType", date::text AS date,
            CONCAT_WS(' | ', 'Shift: ' || shift, 'Location: ' || location, 'Show / Group: ' || show_group) AS details
          FROM assistance WHERE LOWER(BTRIM(category)) = LOWER(BTRIM(${value}))
        ), recent AS (SELECT * FROM matches ORDER BY date DESC LIMIT 5)
        SELECT (SELECT COUNT(*)::int FROM matches) AS "usageCount",
          COALESCE((SELECT JSON_AGG(TO_JSON(recent)) FROM recent), '[]'::json) AS records`;
      break;
    case "ACTIVITY_TYPE":
      result = await prisma.$queryRaw<{ usageCount: number; records: UsageRecordMatch[] }[]>`
        WITH matches AS (
          SELECT ref_no AS "refNo", 'Other Task'::text AS "recordType", date::text AS date,
            CONCAT_WS(' | ', 'Shift: ' || shift, 'Location: ' || location) AS details
          FROM tasks WHERE LOWER(BTRIM(activity_type)) = LOWER(BTRIM(${value}))
        ), recent AS (SELECT * FROM matches ORDER BY date DESC LIMIT 5)
        SELECT (SELECT COUNT(*)::int FROM matches) AS "usageCount",
          COALESCE((SELECT JSON_AGG(TO_JSON(recent)) FROM recent), '[]'::json) AS records`;
      break;
    default:
      return { usageCount: 0, records: [] };
  }
  return { usageCount: result[0]?.usageCount ?? 0, records: result[0]?.records ?? [] };
}

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const search = new URL(req.url).searchParams;
  const searchKind = search.get("kind");
  const searchValue = search.get("value");
  if (searchKind && searchValue !== null) {
    if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });
    const kindResult = masterDataSchema.safeParse({ kind: searchKind, value: "placeholder" });
    if (!kindResult.success) {
      return NextResponse.json({ error: "Validation failed", fields: flatten(kindResult.error) }, { status: 400 });
    }
    const value = searchValue.trim();
    const [usage, configuredRows] = await Promise.all([
      lookupUsage(kindResult.data.kind, value),
      prisma.masterData.findMany({ where: { kind: kindResult.data.kind } }),
    ]);
    const configured = configuredRows.find((row) => row.active && normalizeValue(row.value) === normalizeValue(value))
      ?? configuredRows.find((row) => normalizeValue(row.value) === normalizeValue(value));
    return NextResponse.json({
      ...usage,
      configured: configured ? { value: configured.value, active: configured.active } : null,
    });
  }
  const includeRetired = search.get("includeRetired") === "true";
  if (includeRetired && !isAdmin(user)) {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }
  const rows = await prisma.masterData.findMany({
    where: includeRetired ? undefined : { active: true },
    orderBy: [{ kind: "asc" }, { value: "asc" }],
  });
  const [assistance, tasks] = await Promise.all([
    prisma.assistance.findMany({ select: { shift: true, location: true, showGroup: true, category: true } }),
    prisma.task.findMany({ select: { shift: true, location: true, showGroup: true, activityType: true } }),
  ]);
  const usage = new Map<string, number>();
  const countRecordValues = (values: [string, string | null][]) => {
    const recordKeys = new Set(values.filter((entry): entry is [string, string] => Boolean(entry[1]))
      .map(([kind, value]) => valueKey(kind, value)));
    recordKeys.forEach((key) => usage.set(key, (usage.get(key) ?? 0) + 1));
  };
  assistance.forEach((record) => countRecordValues([
    ["SHIFT", record.shift], ["LOCATION", record.location],
    ["SHOW_GROUP", record.showGroup], ["CATEGORY", record.category],
  ]));
  tasks.forEach((record) => countRecordValues([
    ["SHIFT", record.shift], ["LOCATION", record.location],
    ["SHOW_GROUP", record.showGroup], ["ACTIVITY_TYPE", record.activityType],
  ]));
  const rowsWithUsage = rows.map((row) => ({
    ...row,
    usageCount: usage.get(valueKey(row.kind, row.value)) ?? 0,
  }));
  const grouped: Record<string, string[]> = {
    LOCATION: [], SHIFT: [], SHOW_GROUP: [], CATEGORY: [], ACTIVITY_TYPE: [],
  };
  rowsWithUsage.forEach((r) => grouped[r.kind].push(r.value));
  return NextResponse.json({ grouped, rows: rowsWithUsage });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();

  if (typeof body?.csv === "string") {
    const kindResult = masterDataSchema.safeParse({ kind: body.kind, value: "placeholder" });
    if (!kindResult.success) {
      return NextResponse.json({ error: "Validation failed", fields: flatten(kindResult.error) }, { status: 400 });
    }
    const { rows } = parseCsv(body.csv);
    const rawValues = rows.map((row) => row[0] ?? "");
    if (rawValues.length && /^(value|name|location|shift|show\s*\/\s*group|category|activity\s*type)$/i.test(rawValues[0].trim())) {
      rawValues.shift();
    }

    const existing = await prisma.masterData.findMany({ where: { kind: kindResult.data.kind } });
    const seen = new Set(existing.map((row) => normalizeValue(row.value)));
    const candidates: string[] = [];
    const skippedValues: string[] = [];
    let skipped = 0;
    for (const rawValue of rawValues) {
      const value = rawValue.trim();
      const normalized = normalizeValue(value);
      if (!value || seen.has(normalized)) {
        skipped++;
        if (value && skippedValues.length < 20) skippedValues.push(value);
        continue;
      }
      seen.add(normalized);
      candidates.push(value);
    }

    if (body.preview === true) {
      return NextResponse.json({
        added: candidates.length,
        skipped,
        values: candidates.slice(0, 20),
        skippedValues,
      });
    }

    let added = 0;
    for (const value of candidates) {
      try {
        await prisma.masterData.create({ data: { kind: kindResult.data.kind, value } });
        added++;
        await logAudit({
          action: "MASTERDATA_ADD",
          entityType: kindResult.data.kind,
          entityId: value,
          userId: user.id,
          details: { name: user.name, value },
        });
      } catch (error) {
        if ((error as { code?: string }).code !== "P2002") throw error;
        skipped++;
      }
    }

    return NextResponse.json({ added, skipped });
  }

  const parsed = masterDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }
const matchingRows = await prisma.masterData.findMany({ where: { kind: parsed.data.kind } });
const normalized = normalizeValue(parsed.data.value);
const activeExists = matchingRows.find((row) => row.active && normalizeValue(row.value) === normalized);
const retiredExists = matchingRows.find((row) => !row.active && normalizeValue(row.value) === normalized);

if (activeExists) {
  return NextResponse.json(
    {
      error: "Validation failed",
      fields: {
        value: "That entry already exists",
      },
    },
    { status: 400 }
  );
}

if (retiredExists) {
  const restored = await prisma.masterData.update({
    where: { id: retiredExists.id },
    data: { active: true },
  });

  await logAudit({
    action: "MASTERDATA_RESTORE",
    entityType: retiredExists.kind,
    entityId: retiredExists.value,
    userId: user.id,
    details: {
      name: user.name,
      value: retiredExists.value,
    },
  });

  return NextResponse.json(restored);
}

const row = await prisma.masterData.create({
  data: parsed.data,
});

await logAudit({
  action: "MASTERDATA_ADD",
  entityType: parsed.data.kind,
  entityId: parsed.data.value,
  userId: user.id,
  details: {
    name: user.name,
    value: parsed.data.value,
  },
});

return NextResponse.json(row, { status: 201 });

}
