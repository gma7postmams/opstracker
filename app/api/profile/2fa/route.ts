import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { Email2FAError, sendEmailVerificationCode, verifyEmailVerificationCode } from "@/lib/email2fa";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const actor = await currentUser();
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (action === "send") {
    if (user.email2faEnabled) return NextResponse.json({ error: "Email 2FA is already enabled." }, { status: 400 });
    try {
      const delivery = await sendEmailVerificationCode(user, "setup");
      return NextResponse.json({ sent: true, ...delivery });
    } catch (error) {
      if (error instanceof Email2FAError) {
        return NextResponse.json({ error: error.message, retryAfterSeconds: error.retryAfterSeconds }, { status: error.status });
      }
      throw error;
    }
  }

  if (action === "verify") {
    if (user.email2faEnabled) return NextResponse.json({ error: "Email 2FA is already enabled." }, { status: 400 });
    const code = typeof body.code === "string" ? body.code : "";
    if (!(await verifyEmailVerificationCode(user.id, code))) {
      return NextResponse.json({ error: "The verification code is invalid or expired." }, { status: 400 });
    }
    await prisma.user.update({ where: { id: user.id }, data: { email2faEnabled: true } });
    await logAudit({ userId: user.id, action: "2FA_ENABLED", entityType: "User Profile", entityId: user.username });
    return NextResponse.json({ email2faEnabled: true });
  }

  if (action === "disable") {
    if (user.email2faEnabled) {
      await prisma.$transaction([
        prisma.emailVerificationCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
        prisma.user.update({ where: { id: user.id }, data: { email2faEnabled: false } }),
      ]);
      await logAudit({ userId: user.id, action: "2FA_DISABLED", entityType: "User Profile", entityId: user.username });
    }
    return NextResponse.json({ email2faEnabled: false });
  }

  return NextResponse.json({ error: "Invalid action." }, { status: 400 });
}