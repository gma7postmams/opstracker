import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { currentUser } from "@/lib/auth";
import { canView } from "@/lib/permissions";
import { getRecord, hasUserParticipated } from "@/lib/records";
import { isRecordType } from "@/lib/recordTypes";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const MAX_PDF_SIZE = 15 * 1024 * 1024;

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]!);

function datePart(value: Date | string | null | undefined) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function wallClockDate(date: Date | string | null | undefined, time: string | null | undefined) {
  const dateValue = datePart(date);
  if (!dateValue || !time) return null;
  const parsed = new Date(`${dateValue}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDuration(record: { startDate: Date | string; endDate?: Date | string | null; timeStarted?: string | null; timeEnded?: string | null; status: string }) {
  const startedAt = wallClockDate(record.startDate, record.timeStarted);
  const endedAt = record.status === "OPEN"
    ? new Date()
    : wallClockDate(record.endDate ?? record.startDate, record.timeEnded);
  const minutes = startedAt && endedAt
    ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000))
    : 0;
  return `${minutes} ${minutes === 1 ? "Minute" : "Minutes"}`;
}

function formatGeneratedAt(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  if (!isRecordType(type)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const recordId = Number(id);
  if (!Number.isInteger(recordId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const record = await getRecord(type, recordId);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const hasParticipated = user.role !== "ADMIN" && await hasUserParticipated(type, record.id, user.id);
  if (!canView(user, { ...record, hasParticipated }, req.nextUrl.searchParams.get("userId") === "all")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sender = await prisma.user.findUnique({ where: { id: user.id } });
  if (!sender?.smtpEnabled) return NextResponse.json({ error: "Email reporting is not enabled." }, { status: 400 });
  if (!sender.smtpEmail || !sender.smtpPassword) return NextResponse.json({ error: "SMTP settings are incomplete." }, { status: 400 });
  if (!sender.smtpRecipients) return NextResponse.json({ error: "No recipients configured." }, { status: 400 });
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PDF_SIZE + 1024 * 1024) {
    return NextResponse.json({ error: "The PDF must be smaller than 15 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "A PDF attachment is required." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.type !== "application/pdf" || file.size === 0 || file.size > MAX_PDF_SIZE) {
    return NextResponse.json({ error: "The PDF must be between 1 byte and 15 MB." }, { status: 400 });
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...signature) !== "%PDF-") {
    return NextResponse.json({ error: "The attachment is not a valid PDF." }, { status: 400 });
  }

  const filename = `${type === "assistance" ? "TA" : "OT"}-${record.refNo.split("-").slice(1).join("-")}.pdf`;
  const recordType = type === "assistance" ? "Technical Assistance" : "Other Task";
  const statusLabel = record.status === "CLOSE_PENDING" ? "CLOSE PENDING" : record.status;
  const statusColors = record.status === "CLOSED"
    ? { background: "#dcfce7", color: "#166534" }
    : record.status === "CLOSE_PENDING"
      ? { background: "#fff0d7", color: "#9a5b00" }
      : { background: "#fee2e2", color: "#b42318" };
  const generatedAt = new Date();
  const summary: [string, string][] = [
    ["Reference No.", record.refNo],
    ["Status", statusLabel],
    ...(type === "assistance" ? [["Location", record.location ?? ""], ["Client", record.clientName ?? ""]] as [string, string][] : []),
    ["Assigned To", record.assigned ?? ""],
    ["Duration", formatDuration(record)],
  ];
  const detailsHtml = summary.filter(([, value]) => value.trim() !== "").map(([label, value]) => {
    const renderedValue = label === "Status"
      ? `<span style="display:inline-block;padding:5px 10px;border-radius:20px;background:${statusColors.background};color:${statusColors.color};font-family:Arial,sans-serif;font-size:12px;font-weight:700;">${escapeHtml(value)}</span>`
      : `<span style="color:#263947;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:600;overflow-wrap:anywhere;">${escapeHtml(value)}</span>`;
    return `<tr><td style="padding:12px 14px;border-bottom:1px solid #e8eeee;color:#667780;font-family:Arial,sans-serif;font-size:12px;line-height:18px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:12px 14px;border-bottom:1px solid #e8eeee;text-align:right;vertical-align:top;">${renderedValue}</td></tr>`;
  }).join("");
  const subject = `[OpsTracker] ${recordType} Report - ${record.refNo}`;
  const generatedText = formatGeneratedAt(generatedAt);
  const emailHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px 12px;background:#f2f6f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px;border:1px solid #dfe8e8;border-radius:10px;background:#ffffff;border-collapse:separate;border-spacing:0;overflow:hidden;">
        <tr><td style="padding:24px 26px;background:#165d59;color:#ffffff;font-family:Arial,sans-serif;">
          <div style="font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">OpsTracker</div>
          <div style="padding-top:7px;font-size:22px;line-height:29px;font-weight:700;">${recordType} Report</div>
          <div style="padding-top:6px;color:#e2f1ef;font-size:14px;line-height:21px;">A report has been generated and attached.</div>
        </td></tr>
        <tr><td style="padding:20px 20px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #e8eeee;border-radius:8px;border-collapse:separate;border-spacing:0;overflow:hidden;">
            ${detailsHtml}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:16px;border:1px solid #dce8e7;border-radius:8px;background:#f5f9f8;border-collapse:separate;border-spacing:0;">
            <tr><td style="padding:13px 15px;color:#53656b;font-family:Arial,sans-serif;font-size:12px;line-height:18px;font-weight:700;">Attached Report</td></tr>
            <tr><td style="padding:0 15px 14px;color:#165d59;font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:700;overflow-wrap:anywhere;">${escapeHtml(filename)}</td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:19px 26px 22px;color:#667780;font-family:Arial,sans-serif;font-size:12px;line-height:19px;">
          <div style="padding-bottom:5px;color:#43545a;font-weight:700;">Generated from OpsTracker</div>
          <div>Generated: ${escapeHtml(generatedText)}</div>
          <div>Reference: ${escapeHtml(record.refNo)}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const emailText = [
    `${recordType} Report`,
    "A report has been generated and attached.",
    "",
    ...summary.filter(([, value]) => value.trim() !== "").flatMap(([label, value]) => [label, `    ${value}`]),
    "",
    "Attached Report",
    `    ${filename}`,
    "",
    "Generated from OpsTracker",
    `Generated: ${generatedText}`,
    `Reference: ${record.refNo}`,
  ].join("\n");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: sender.smtpEmail, pass: sender.smtpPassword },
  });

  try {
    await transporter.sendMail({
      from: `"OpsTracker Reports" <${sender.smtpEmail}>`,
      to: sender.smtpRecipients,
      subject,
      text: emailText,
      html: emailHtml,
      attachments: [{ filename, content: Buffer.from(await file.arrayBuffer()), contentType: "application/pdf" }],
    });
    await logAudit({
      userId: user.id,
      action: "RECORD_REPORT_EMAIL_SENT",
      entityType: type,
      entityId: record.refNo,
      details: { user: user.name, recipients: sender.smtpRecipients, filename },
    });
    return NextResponse.json({
      ok: true,
      recipients: sender.smtpRecipients,
      sentAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to send email. Check the configured email settings." }, { status: 500 });
  }
}