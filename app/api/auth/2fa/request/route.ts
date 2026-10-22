import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { Email2FAError, sendEmailVerificationCode } from "@/lib/email2fa";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const suppliedRequestId = req.headers.get("x-request-id");
  const requestId = suppliedRequestId && /^[\w-]{1,64}$/.test(suppliedRequestId) ? suppliedRequestId : randomUUID();
  const requestType = body.requestType === "resend" ? "resend" : "initial";
  console.info("[auth:2fa] request received", { requestId, requestType });
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) return NextResponse.json({ error: "Username and password are required." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    await logAudit({ action: "LOGIN_FAILED", entityType: "auth", entityId: "Invalid Username or Password", details: { username } });
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  if (!user.email2faEnabled) return NextResponse.json({ requires2fa: false });

  try {
    const delivery = await sendEmailVerificationCode(user, "login", { enforceResendCooldown: requestType === "resend" });
    console.log("2FA REQUEST SENT", { requestId, requestType, userId: user.id });
    return NextResponse.json({ requires2fa: true, ...delivery });
  } catch (error) {
    if (error instanceof Email2FAError) {
      console.log("2FA REQUEST REJECTED", { requestId, requestType, status: error.status, retryAfterSeconds: error.retryAfterSeconds });
      return NextResponse.json({ error: error.message, retryAfterSeconds: error.retryAfterSeconds }, { status: error.status });
    }
    throw error;
  }
}