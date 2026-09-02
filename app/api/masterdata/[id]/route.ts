import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/permissions";

/**
 * Master data is retired rather than deleted: existing records store the value
 * as text, so removing the row must not change what those records say.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  await prisma.masterData.update({ where: { id: Number(p.id) }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
