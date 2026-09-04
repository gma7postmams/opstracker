import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

/**
 * Master data is retired rather than deleted: existing records store the value
 * as text, so removing the row must not change what those records say.
 */

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
