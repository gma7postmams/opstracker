import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import type { User } from "@prisma/client";
import { logAudit } from "./audit";
import { prisma } from "./prisma";

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODES_PER_WINDOW = 5;

export class Email2FAError extends Error {
  constructor(message: string, public status: number, public retryAfterSeconds?: number) {
    super(message);
  }
}

export async function sendEmailVerificationCode(
  user: User,
  purpose: "login" | "setup",
  options: { enforceResendCooldown?: boolean } = {},
) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    throw new Email2FAError("Add a valid email address to your profile first.", 400);
  }
  if (!user.smtpEmail || !user.smtpPassword) {
    throw new Email2FAError("Configure a Gmail sender and app password in Email Reports first.", 400);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_WINDOW_MS);
  const result = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationCode.deleteMany({
      where: { userId: user.id, createdAt: { lt: windowStart } },
    });

    const recentCodes = await tx.emailVerificationCode.findMany({
      where: { userId: user.id, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const lastSentAt = recentCodes[0]?.createdAt;
    if (options.enforceResendCooldown !== false && lastSentAt && now.getTime() - lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new Email2FAError("Please wait before requesting another code.", 429,
        Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - lastSentAt.getTime())) / 1000));
    }
    if (recentCodes.length >= MAX_CODES_PER_WINDOW) {
      const retryAfter = Math.ceil((recentCodes[recentCodes.length - 1].createdAt.getTime() + RATE_WINDOW_MS - now.getTime()) / 1000);
      throw new Email2FAError("Too many verification codes requested. Try again later.", 429, retryAfter);
    }

    await tx.emailVerificationCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await bcrypt.hash(code, 10);
    await tx.emailVerificationCode.create({
      data: {
        userId: user.id,
        code: codeHash,
        expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
      },
    });
    return { code };
  }, { isolationLevel: "Serializable" });

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: user.smtpEmail, pass: user.smtpPassword },
    });
    await transporter.sendMail({
      from: `"OpsTracker" <${user.smtpEmail}>`,
      to: user.email,
      subject: "OpsTracker Verification Code",
      text: `Your verification code is:\n\n${result.code}\n\nThis code expires in 10 minutes.\n\nIf you did not attempt to sign in, ignore this email.`,
      html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Verify your identity</title>
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { width: 100% !important; }
        .email-content { padding: 28px 22px !important; }
        .code-value { font-size: 30px !important; letter-spacing: 8px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f2f6fa;font-family:Arial,Helvetica,sans-serif;color:#172b45;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f2f6fa;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" class="email-shell" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dce5ef;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:22px 28px;background:#173b64;color:#ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;border-radius:9px;background:#3b82d0;color:#ffffff;font-size:13px;font-weight:bold;">OT</td>
                  <td style="padding-left:12px;color:#ffffff;font-size:14px;font-weight:bold;line-height:1.4;">MAMS Support Operations Tracker</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-content" style="padding:36px 40px 32px;">
              <p style="margin:0 0 9px;color:#56718f;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;">Sign-in security</p>
              <h1 style="margin:0 0 12px;color:#173b64;font-size:25px;line-height:1.25;">Verify your identity</h1>
              <p style="margin:0 0 25px;color:#52677f;font-size:15px;line-height:1.6;">Enter this verification code to continue signing in to your OpsTracker account.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px;background:#f1f7fd;border:1px solid #d6e5f5;border-radius:10px;">
                <tr><td align="center" style="padding:22px 12px;">
                  <span class="code-value" style="color:#174f8a;font-family:Arial,Helvetica,sans-serif;font-size:36px;font-weight:bold;letter-spacing:12px;">${result.code}</span>
                </td></tr>
              </table>
              <p style="margin:0;color:#536b83;font-size:13px;line-height:1.6;"><strong style="color:#263e58;">Expires in 10 minutes.</strong> For your security, do not share this code with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #e3eaf1;background:#f8fafc;color:#718198;font-size:12px;line-height:1.6;">
              If you did not attempt to sign in, you may safely ignore this email.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    });
  } catch (error) {
    await prisma.emailVerificationCode.updateMany({
      where: { userId: user.id, usedAt: null, createdAt: now },
      data: { usedAt: new Date() },
    });
    await logAudit({
      userId: user.id,
      action: "2FA_FAILURE",
      entityType: "auth",
      entityId: "Email delivery failed",
      details: { purpose },
    });
    console.error("2FA email delivery failed:", error);
    throw new Email2FAError("Could not send the verification email. Check your Gmail SMTP settings.", 502);
  }

  await logAudit({
    userId: user.id,
    action: "2FA_CODE_SENT",
    entityType: "auth",
    entityId: "Email verification code",
    details: { purpose },
  });
  return { expiresInSeconds: CODE_LIFETIME_MS / 1000 };
}

export async function verifyEmailVerificationCode(userId: number, submittedCode: string) {
  const now = new Date();
  const codes = await prisma.emailVerificationCode.findMany({
    where: { userId, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  let matchingCode: (typeof codes)[number] | undefined;
  if (/^\d{6}$/.test(submittedCode)) {
    for (const candidate of codes) {
      if (await bcrypt.compare(submittedCode, candidate.code)) {
        matchingCode = candidate;
        break;
      }
    }
  }

  if (!matchingCode) {
    await logAudit({ userId, action: "2FA_FAILURE", entityType: "auth", entityId: "Invalid verification code" });
    return false;
  }

  const consumed = await prisma.emailVerificationCode.updateMany({
    where: { id: matchingCode.id, userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) {
    await logAudit({ userId, action: "2FA_FAILURE", entityType: "auth", entityId: "Reused verification code" });
    return false;
  }
  return true;
}