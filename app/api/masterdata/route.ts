import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { masterDataSchema, flatten } from "@/lib/validation";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.masterData.findMany({
    where: { active: true },
    orderBy: [{ kind: "asc" }, { sort: "asc" }, { value: "asc" }],
  });
  const grouped: Record<string, string[]> = {
    LOCATION: [], SHIFT: [], SHOW_GROUP: [], CATEGORY: [], ACTIVITY_TYPE: [],
  };
  rows.forEach((r) => grouped[r.kind].push(r.value));
  return NextResponse.json({ grouped, rows });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  const parsed = masterDataSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }

const exists = await prisma.masterData.findUnique({
  where: {
    kind_value: {
      kind: parsed.data.kind,
      value: parsed.data.value,
    },
  },
});

if (exists) {
  if (!exists.active) {
    const restored = await prisma.masterData.update({
      where: { id: exists.id },
      data: { active: true },
    });

    await logAudit({
      action: "MASTERDATA_RESTORE",
      entityType: exists.kind,
      entityId: exists.value,
      userId: user.id,
      details: {
        name: user.name,
        value: exists.value,
      },
    });

    return NextResponse.json(restored);
  }

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
