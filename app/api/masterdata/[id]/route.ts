import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { masterDataSchema, flatten } from "@/lib/validation";

const normalizeValue = (value: string) => value.trim().toLocaleLowerCase();

/**
 * Master data is retired rather than deleted: existing records store the value
 * as text, so removing the row must not change what those records say.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await currentUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  }

  const p = await params;
  const id = Number(p.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const item = await prisma.masterData.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = masterDataSchema.safeParse({ kind: item.kind, value: body?.value });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", fields: flatten(parsed.error) },
      { status: 400 }
    );
  }

  const value = parsed.data.value;
  let affectedRecords = 0;
  let updated;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const siblings = await tx.masterData.findMany({ where: { kind: item.kind } });
      const duplicate = siblings.find((row) => row.id !== item.id
        && normalizeValue(row.value) === normalizeValue(value));
      if (duplicate) return { duplicate: true as const };

      const renamed = await tx.masterData.update({
        where: { id: item.id },
        data: { value },
      });

      switch (item.kind) {
        case "LOCATION":
          affectedRecords += await tx.$executeRaw`UPDATE assistance SET location = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(location)) = LOWER(BTRIM(${item.value}))`;
          affectedRecords += await tx.$executeRaw`UPDATE tasks SET location = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(location)) = LOWER(BTRIM(${item.value}))`;
          break;
        case "SHIFT":
          affectedRecords += await tx.$executeRaw`UPDATE assistance SET shift = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(shift)) = LOWER(BTRIM(${item.value}))`;
          affectedRecords += await tx.$executeRaw`UPDATE tasks SET shift = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(shift)) = LOWER(BTRIM(${item.value}))`;
          break;
        case "SHOW_GROUP":
          affectedRecords += await tx.$executeRaw`UPDATE assistance SET show_group = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(show_group)) = LOWER(BTRIM(${item.value}))`;
          affectedRecords += await tx.$executeRaw`UPDATE tasks SET show_group = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(show_group)) = LOWER(BTRIM(${item.value}))`;
          break;
        case "CATEGORY":
          affectedRecords += await tx.$executeRaw`UPDATE assistance SET category = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(category)) = LOWER(BTRIM(${item.value}))`;
          break;
        case "ACTIVITY_TYPE":
          affectedRecords += await tx.$executeRaw`UPDATE tasks SET activity_type = ${value}, updated_at = CURRENT_TIMESTAMP WHERE LOWER(BTRIM(activity_type)) = LOWER(BTRIM(${item.value}))`;
          break;
      }

      return { renamed };
    });

    if ("duplicate" in result) {
      return NextResponse.json(
        { error: "Validation failed", fields: { value: "That entry already exists" } },
        { status: 400 }
      );
    }
    updated = result.renamed;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "Validation failed", fields: { value: "That entry already exists" } },
        { status: 400 }
      );
    }
    throw error;
  }

  await logAudit({
    action: "MASTERDATA_RENAME",
    entityType: item.kind,
    entityId: String(item.id),
    userId: user.id,
    details: { name: user.name, oldValue: item.value, newValue: updated.value, affectedRecords },
  });

  return NextResponse.json({ ...updated, affectedRecords });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const p = await params;

  const user = await currentUser();

  if (!user || !isAdmin(user)) {
    return NextResponse.json(
      { error: "Administrators only" },
      { status: 403 }
    );
  }

  const item = await prisma.masterData.findUnique({
    where: {
      id: Number(p.id),
    },
  });

  if (!item) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404 }
    );
  }

  await prisma.masterData.update({
    where: {
      id: item.id,
    },
    data: {
      active: false,
    },
  });

  await logAudit({
    action: "MASTERDATA_RETIRE",
    entityType: item.kind,
    entityId: item.value,
    userId: user.id,
    details: {
      name: user.name,
      value: item.value,
    },
  });

  return NextResponse.json({ ok: true });
}
