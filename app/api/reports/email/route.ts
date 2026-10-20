import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportWorkbook } from "@/lib/reportExcel";
import { logAudit } from "@/lib/audit";
import { addReportWorkLogSummaries, applyReportScope, formatReportOwner, reportOwnerSelect, resolveReportScope } from "@/lib/reports";

export async function POST(req: NextRequest) {
  const actor = await currentUser();

  if (!actor) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json();
  const preview = body.preview === true;

  const from = body.from;
  const to = body.to;
  const activity = body.activity || "all";
  const status = body.status || "all";
  const scope = resolveReportScope(body.scope, actor);
  const userId = typeof body.userId === "string" ? body.userId : null;

  const sender = await prisma.user.findUnique({
    where: { id: actor.id },
  });

  if (!sender?.smtpEnabled) {
    return NextResponse.json(
      { error: "Email reporting is not enabled." },
      { status: 400 }
    );
  }

  if (!sender.smtpEmail || !sender.smtpPassword) {
    return NextResponse.json(
      { error: "SMTP settings are incomplete." },
      { status: 400 }
    );
  }

  if (!sender.smtpRecipients) {
    return NextResponse.json(
      { error: "No recipients configured." },
      { status: 400 }
    );
  }


  const where: any = {
    startDate: {
      gte: new Date(from),
      lte: new Date(to),
    },
  };

  if (status !== "all") {
    where.status = status;
  }
  const reportWhere = await applyReportScope(where, actor, scope, userId);

  const assistance =
    activity === "tasks"
      ? []
      : await prisma.assistance.findMany({
          where: reportWhere,
          orderBy: [{ startDate: "desc" }],
          include: {
            owner: { select: reportOwnerSelect },
            workLogs: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 5,
              select: { id: true, type: true, message: true, createdAt: true, createdByName: true },
            },
          },
        });

  const tasks =
    activity === "assistance"
      ? []
      : await prisma.task.findMany({
          where: reportWhere,
          orderBy: [{ startDate: "desc" }],
          include: {
            owner: { select: reportOwnerSelect },
            workLogs: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 5,
              select: { id: true, type: true, message: true, createdAt: true, createdByName: true },
            },
          },
        });

  const assistanceWithLogs = await addReportWorkLogSummaries(assistance, "assistance");
  const tasksWithLogs = await addReportWorkLogSummaries(tasks, "tasks");

  const workbook = await buildReportWorkbook({
    range: { from, to },
    assistance: assistanceWithLogs,
    tasks: tasksWithLogs,
  });

  const attachment = Buffer.from(await workbook.xlsx.writeBuffer());

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: sender.smtpEmail,
      pass: sender.smtpPassword,
    },
  });

  const filename =
    from === to
      ? `MAMS_Support_Activity_Report_${from}.xlsx`
      : `MAMS_Support_Activity_Report_${from}_to_${to}.xlsx`;

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

const formatStatusLabel = (value: string) => ({
  OPEN: "Open",
  CLOSED: "Closed",
  CLOSE_PENDING: "Close Pending",
}[value] ?? value);

const cellStyle = "padding:9px 8px;border-bottom:1px solid #e3e8ee;color:#273444;font-family:Arial,sans-serif;font-size:12px;line-height:17px;word-break:break-word;";
const tableStyle = "width:100%;border-collapse:collapse;table-layout:fixed;";
const headerCellStyle = "padding:10px 8px;background:#edf3f4;border-bottom:1px solid #d7e0e5;color:#435564;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;letter-spacing:.04em;text-align:left;white-space:nowrap;";
const detailStyle = "margin-top:6px;padding:6px 8px;background-color:#f3f6f7;border-left:2px solid #bac8ce;color:#6b7785;font-family:Arial,sans-serif;font-size:10px;line-height:14px;word-break:break-word;word-wrap:break-word;overflow-wrap:break-word;";
const secondaryDetail = (label: string, value: unknown) =>
  value ? `<div style="${detailStyle}"><strong>${label}:</strong><br>${escapeHtml(value)}</div>` : "";
const formatWorkLog = (log: any) =>
  log ? `${new Date(log.createdAt).toLocaleString()} · ${log.createdByName}: ${log.message}` : "";
const formatRecentWorkLogs = (logs: any[]) =>
  logs.map((log) => `${log.type} · ${formatWorkLog(log)}`).join(" | ");
const tableHead = (labels: string[]) => `<tr>${labels.map((label) => {
  const align = label === "Status" || label === "Assigned" ? "center" : "left";
  return `<th align="${align}" style="${headerCellStyle}text-align:${align};">${label}</th>`;
}).join("")}</tr>`;
const assistanceRows = assistanceWithLogs.length
  ? assistanceWithLogs.map((row) => `
      <tr>
        <td style="${cellStyle}white-space:nowrap;word-break:normal;overflow-wrap:normal;font-size:11px;">${escapeHtml(row.refNo)}</td>
        <td style="${cellStyle}">${escapeHtml(row.clientName)}</td>
        <td style="${cellStyle}vertical-align:top;">
          <div>${escapeHtml(row.problem)}</div>
          ${secondaryDetail("Latest Investigation Work Log", formatWorkLog(row.latestInvestigationWorkLog))}
          ${secondaryDetail("Resolution", row.resolution)}
          ${secondaryDetail("Remarks", row.remarks)}
          ${secondaryDetail("Latest Resolution Work Log", formatWorkLog(row.latestResolutionWorkLog))}
          ${secondaryDetail("Latest Remark Work Log", formatWorkLog(row.latestRemarkWorkLog))}
          ${secondaryDetail("Recent Work Log Entries", formatRecentWorkLogs(row.recentWorkLogs))}
        </td>
        <td style="${cellStyle}width:120px;text-align:center;white-space:nowrap;word-break:normal;overflow-wrap:normal;font-size:11px;">${escapeHtml(formatStatusLabel(row.status))}</td>
          <td style="${cellStyle}white-space:nowrap;word-break:normal;overflow-wrap:normal;">${escapeHtml(formatReportOwner(row.owner))}</td>
          <td style="${cellStyle}text-align:center;white-space:nowrap;word-break:normal;overflow-wrap:normal;font-size:11px;">${escapeHtml(row.assigned)}</td>
      </tr>`).join("")
        : `<tr><td colspan="6" style="${cellStyle}color:#6b7785;text-align:center;padding:18px;">No technical assistance records in this period.</td></tr>`;

const taskRows = tasksWithLogs.length
  ? tasksWithLogs.map((row) => `
      <tr>
        <td style="${cellStyle}white-space:nowrap;word-break:normal;overflow-wrap:normal;font-size:11px;">${escapeHtml(row.refNo)}</td>
        <td style="${cellStyle}white-space:nowrap;word-break:normal;overflow-wrap:normal;font-size:11px;">${escapeHtml(row.activityType)}</td>
        <td style="${cellStyle}vertical-align:top;">
          <div>${escapeHtml(row.description)}</div>
          ${secondaryDetail("Remarks", row.remarks)}
          ${secondaryDetail("Latest Investigation Work Log", formatWorkLog(row.latestInvestigationWorkLog))}
          ${secondaryDetail("Latest Resolution Work Log", formatWorkLog(row.latestResolutionWorkLog))}
          ${secondaryDetail("Latest Remark Work Log", formatWorkLog(row.latestRemarkWorkLog))}
          ${secondaryDetail("Recent Work Log Entries", formatRecentWorkLogs(row.recentWorkLogs))}
        </td>
        <td style="${cellStyle}width:120px;text-align:center;white-space:nowrap;word-break:normal;overflow-wrap:normal;font-size:11px;">${escapeHtml(formatStatusLabel(row.status))}</td>
          <td style="${cellStyle}white-space:nowrap;word-break:normal;overflow-wrap:normal;">${escapeHtml(formatReportOwner(row.owner))}</td>
          <td style="${cellStyle}text-align:center;white-space:nowrap;word-break:normal;overflow-wrap:normal;font-size:11px;">${escapeHtml(row.assigned)}</td>
      </tr>`).join("")
        : `<tr><td colspan="6" style="${cellStyle}color:#6b7785;text-align:center;padding:18px;">No other task records in this period.</td></tr>`;

const generatedAt = new Date().toLocaleString("en-PH", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const reportingPeriod =
  from === to
    ? `As of ${from}`
    : `${from} to ${to}`;

const totalRecords = assistanceWithLogs.length + tasksWithLogs.length;
const allRows = [...assistanceWithLogs, ...tasksWithLogs];
const statusCounts = {
  open: allRows.filter((row) => row.status === "OPEN").length,
  pending: allRows.filter((row) => row.status === "CLOSE_PENDING").length,
  closed: allRows.filter((row) => row.status === "CLOSED").length,
};
const summaryCard = (label: string, value: number, color: string, icon: string) => `
  <td class="summary-cell" width="33.33%" align="center" valign="middle" style="width:33.33%;padding:4px 3px;vertical-align:middle;">
    <table class="summary-card" role="presentation" width="170" height="78" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:170px;height:78px;table-layout:fixed;border:1px solid #e3e8ee;border-left:4px solid ${color};border-radius:7px;background-color:#ffffff;background-image:linear-gradient(180deg,#ffffff 0%,#f8fafb 100%);box-shadow:0 2px 7px rgba(32,53,67,.10);">
      <tr>
        <td height="36" align="center" valign="middle" style="height:36px;padding:5px 5px 0;vertical-align:middle;">
          <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
            <tr>
              <td width="18" valign="middle" style="width:18px;padding:0 4px 0 0;color:${color};font-family:'Segoe UI Symbol',Arial,sans-serif;font-size:12px;font-weight:bold;line-height:15px;vertical-align:middle;"><span aria-hidden="true">${icon}</span></td>
              <td valign="middle" style="padding:0;color:#536575;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;line-height:13px;vertical-align:middle;">${label}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td height="34" align="center" valign="middle" style="height:34px;padding:0 7px 5px;color:${color};font-family:Arial,sans-serif;font-size:20px;font-weight:bold;line-height:24px;text-align:center;vertical-align:middle;">${value}</td></tr>
    </table>
  </td>`;

const emailWidth = 1100;

const emailHtml = `
<!doctype html>
<html lang="en">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MAMS Support Activity Report</title><style type="text/css">@media only screen and (max-width:600px){.summary-card{width:100% !important;max-width:100% !important}.summary-cell{padding:4px 2px !important}}</style></head>
<body style="margin:0;padding:0;background-color:#f1f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f4f5" style="width:100%;background-color:#f1f4f5;border-collapse:collapse;">
    <tr><td align="center" style="padding:20px 10px;">
      <table role="presentation" width="${emailWidth}" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:95%;max-width:${emailWidth}px;background-color:#ffffff;border-collapse:collapse;font-family:Arial,sans-serif;">
        <tr><td bgcolor="#165d59" style="padding:24px 22px;background-color:#165d59;color:#ffffff;">
          <div style="font-family:Arial,sans-serif;font-size:23px;line-height:29px;font-weight:bold;">MAMS Support Activity Report</div>
          <div style="padding-top:9px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#e2f1ef;">Reporting period: ${escapeHtml(reportingPeriod)}</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#e2f1ef;">Prepared by ${escapeHtml(actor.name)} &nbsp;|&nbsp; Generated ${escapeHtml(generatedAt)}</div>
        </td></tr>
        <tr><td style="padding:19px 16px 4px;">
          ${(activity !== "all" || status !== "all") ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 12px;background-color:#f2f7f7;border-left:3px solid #59a59d;color:#435564;font-family:Arial,sans-serif;font-size:12px;line-height:19px;">${activity !== "all" ? `<strong>Activity:</strong> ${escapeHtml(activity)} &nbsp;&nbsp;` : ""}${status !== "all" ? `<strong>Status:</strong> ${escapeHtml(status)}` : ""}</td></tr></table>` : ""}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <tr><td colspan="3" style="padding:10px 5px 4px;color:#263947;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Activity Summary</td></tr>
            <tr>${summaryCard("Technical Assistance", assistanceWithLogs.length, "#0786a3", "&#8984;")}${summaryCard("Other Tasks", tasksWithLogs.length, "#b77914", "&#9776;")}${summaryCard("Total Records", totalRecords, "#2563a8", "&#9638;")}</tr>
            <tr><td colspan="3" style="padding:10px 5px 4px;color:#263947;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Status Summary</td></tr>
            <tr>${summaryCard("Open", statusCounts.open, "#c74646", "&#9675;")}${summaryCard("Close Pending", statusCounts.pending, "#b77914", "&#9684;")}${summaryCard("Closed", statusCounts.closed, "#34845e", "&#10003;")}</tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${tableStyle}margin-top:22px;">
            <colgroup><col width="12%"><col width="14%"><col width="38%"><col width="120"><col width="13%"><col width="14%"></colgroup>
            <tr><td colspan="6" style="padding:0 0 9px;color:#165d59;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Technical assistance details</td></tr>
            ${tableHead(["Ref No", "Client", "Problem", "Status", "Owner", "Assigned"])}
            ${assistanceRows}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${tableStyle}margin-top:22px;">
            <colgroup><col width="12%"><col width="14%"><col width="38%"><col width="120"><col width="13%"><col width="14%"></colgroup>
            <tr><td colspan="6" style="padding:0 0 9px;color:#165d59;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">Other task details</td></tr>
            ${tableHead(["Ref No", "Activity type", "Description", "Status", "Owner", "Assigned"])}
            ${taskRows}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:22px;border-top:1px solid #e3e8ee;border-collapse:collapse;">
            <tr><td style="padding:14px 0 4px;color:#4d5c68;font-family:Arial,sans-serif;font-size:12px;line-height:19px;">The detailed Excel workbook is attached as <strong>${escapeHtml(filename)}</strong>.</td></tr>
            <tr><td style="padding:0 0 15px;color:#78848e;font-family:Arial,sans-serif;font-size:11px;line-height:17px;">Generated automatically by MAMS Support Operations Tracker.</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

if (preview) {
  return NextResponse.json({
    ok: true,
    subject: `MAMS Support Activity Report (${reportingPeriod})`,
    recipients: sender.smtpRecipients,
    html: emailHtml,
  });
}


try {

  await transporter.sendMail({
    from: `"MAMS Support Reports" <${sender.smtpEmail}>`,
    to: sender.smtpRecipients,
    subject: `MAMS Support Activity Report (${reportingPeriod})`,

    html: emailHtml,
    attachments: [
      {
        filename,
        content: attachment,
      },
    ],
  });

await logAudit({
  userId: actor.id,
  action: "REPORT_EMAIL_SENT",
  entityType: "REPORT",
  entityId: reportingPeriod,
  details: {
    user: actor.name,
    sender: sender.smtpEmail,
    recipients: sender.smtpRecipients,
    filename,
    activity,
    status,
  },
});

return NextResponse.json({
  ok: true,
  message: `Report emailed successfully to ${sender.smtpRecipients}`,
});

} catch (error: any) {
  console.error(error);

  await logAudit({
    userId: actor.id,
    action: "REPORT_EMAIL_FAILED",
    entityType: "REPORT",
    entityId: reportingPeriod,
    details: {
      user: actor.name,
      sender: sender.smtpEmail,
      recipients: sender.smtpRecipients,
      filename,
      activity,
      status,
      error: error?.message ?? "Unknown error",
    },
  });

  return NextResponse.json(
    {
      error: "Failed to send email.",
    },
    {
      status: 500,
    }
  );
}


}
