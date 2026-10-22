import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(actor)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Invalid user." }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, username: true, email2faEnabled: true } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (target.email2faEnabled) {
    await prisma.$transaction([
      prisma.emailVerificationCode.updateMany({ where: { userId: id, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id }, data: { email2faEnabled: false } }),
    ]);
    await logAudit({
      userId: actor.id,
      action: "2FA_DISABLED",
      entityType: "User Profile",
      entityId: target.username,
      details: { actor: actor.name, targetUserId: id, recovery: true },
    });
  }
  return NextResponse.json({ email2faEnabled: false });
}