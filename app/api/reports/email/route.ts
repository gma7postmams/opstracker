import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportWorkbook } from "@/lib/reportExcel";
import { logAudit } from "@/lib/audit";
import { addReportWorkLogSummaries, applyReportScope, buildReportRecordDetails, formatReportOwner, getReportContributionSummary, getReportWorkLogsForExport, reportOwnerSelect, resolveReportScope } from "@/lib/reports";

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
  const contributionSummary = await getReportContributionSummary(reportWhere, actor, activity, userId);

  const workbook = await buildReportWorkbook({
    range: { from, to },
    assistance: assistanceWithLogs,
    tasks: tasksWithLogs,
    workLogs: await getReportWorkLogsForExport(assistance, tasks),
    contributionSummary,
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

const tableStyle = "width:100%;border-collapse:collapse;table-layout:fixed;";
const cellStyle = "padding:10px 8px;border-bottom:1px solid #e3e8ee;color:#273444;font-family:Arial,sans-serif;font-size:11px;line-height:16px;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;";
const refNoCellStyle = `${cellStyle}word-break:normal;overflow-wrap:normal;white-space:nowrap;`;
const headerCellStyle = "padding:9px 8px;background:#f3f6f7;border-bottom:1px solid #d7e0e5;color:#435564;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;text-align:left;";
const tableHead = () => `<tr>${["Ref No", "Details", "Status", "Owner", "Assigned"].map((label) =>
  `<th style="${headerCellStyle}${label === "Ref No" ? "white-space:nowrap;" : ""}">${label}</th>`).join("")}</tr>`;
const renderReportDetails = (record: Record<string, any>, recordType: "assistance" | "tasks") => {
  const reportDetails = buildReportRecordDetails(record, recordType);
  const details = recordType === "assistance"
    ? [
        { label: "Problem", value: record.problem },
        { label: "Cause", value: record.cause },
        { label: "Investigation", value: record.latestInvestigationWorkLog?.message },
        { label: "Resolution", value: record.latestResolutionWorkLog?.message || record.resolution },
        { label: "Remarks", value: record.latestRemarkWorkLog?.message || record.remarks },
      ]
    : [
        { label: "Activity Type", value: record.activityType },
        { label: "Description", value: record.description },
        { label: "Investigation", value: record.latestInvestigationWorkLog?.message },
        { label: "Resolution", value: record.latestResolutionWorkLog?.message || record.resolution },
        { label: "Remarks", value: record.latestRemarkWorkLog?.message || record.remarks },
      ];
  const header = reportDetails.header
    ? `<tr><td style="padding:0 0 6px;color:#263947;font-family:Arial,sans-serif;font-size:14px;font-weight:700;line-height:21px;">${escapeHtml(reportDetails.header)}</td></tr>`
    : "";
  const sections = details
    .map(({ label, value }) => ({ label, value: typeof value === "string" ? value.trim() : "" }))
    .filter(({ value }) => value)
    .map(({ label, value }) =>
      `<tr><td style="padding:6px 0 2px;color:#273444;font-family:Arial,sans-serif;font-size:13px;line-height:20px;vertical-align:top;"><span style="color:#165d59;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;line-height:20px;text-transform:uppercase;">${escapeHtml(label)}:</span> <span style="font-family:Arial,sans-serif;font-size:13px;line-height:20px;">${escapeHtml(value)}</span></td></tr>`).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">${header}${sections}</table>`;
};
const assistanceRows = assistanceWithLogs.length
  ? assistanceWithLogs.map((row) => {
      const details = renderReportDetails(row, "assistance");
      return `<tr>
        <td style="${refNoCellStyle}">${escapeHtml(row.refNo)}</td>
        <td style="${cellStyle}">${details}</td>
        <td style="${cellStyle}">${escapeHtml(formatStatusLabel(row.status))}</td>
        <td style="${cellStyle}">${escapeHtml(formatReportOwner(row.owner))}</td>
        <td style="${cellStyle}">${escapeHtml(row.assigned)}</td>
      </tr>`;
    }).join("")
  : `<tr><td colspan="5" style="${cellStyle}color:#6b7785;text-align:center;padding:18px;">No technical assistance records in this period.</td></tr>`;
const taskRows = tasksWithLogs.length
  ? tasksWithLogs.map((row) => {
      const details = renderReportDetails(row, "tasks");
      return `<tr>
        <td style="${refNoCellStyle}">${escapeHtml(row.refNo)}</td>
        <td style="${cellStyle}">${details}</td>
        <td style="${cellStyle}">${escapeHtml(formatStatusLabel(row.status))}</td>
        <td style="${cellStyle}">${escapeHtml(formatReportOwner(row.owner))}</td>
        <td style="${cellStyle}">${escapeHtml(row.assigned)}</td>
      </tr>`;
    }).join("")
  : `<tr><td colspan="5" style="${cellStyle}color:#6b7785;text-align:center;padding:18px;">No other task records in this period.</td></tr>`;

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
const summaryMetric = (label: string, value: number) => `
  <td width="33%" align="center" valign="middle" style="width:33%;padding:3px 8px 7px;vertical-align:middle;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <tr><td align="center" style="padding:0 2px 3px;border-bottom:1px solid #dfe6e8;color:#20343d;font-family:Arial,sans-serif;font-size:24px;font-weight:bold;line-height:27px;text-align:center;">${value}</td></tr>
      <tr><td align="center" style="padding:4px 2px 0;color:#64747d;font-family:Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.5px;line-height:14px;text-align:center;">${escapeHtml(label.toUpperCase())}</td></tr>
    </table>
  </td>`;

const summaryHeadingStyle = "padding:9px 5px 1px;color:#263947;font-family:Arial,sans-serif;font-size:13px;font-weight:bold;line-height:17px;";

const emailHtml = `
<!doctype html>
<html lang="en">
<head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>MAMS Support Activity Report</title></head>
<body style="margin:0;padding:0;background-color:#ffffff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;background-color:#ffffff;border-collapse:collapse;">
    <tr><td align="center" style="padding:12px 10px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;background-color:#ffffff;border-collapse:collapse;font-family:Arial,sans-serif;">
        <tr><td bgcolor="#165d59" style="padding:24px 22px;background-color:#165d59;color:#ffffff;">
          <div style="font-family:Arial,sans-serif;font-size:23px;line-height:29px;font-weight:bold;">MAMS Support Activity Report</div>
          <div style="padding-top:9px;font-family:Arial,sans-serif;font-size:13px;line-height:20px;color:#e2f1ef;">Reporting period: ${escapeHtml(reportingPeriod)}</div>
          <div style="font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#e2f1ef;">Prepared by ${escapeHtml(actor.name)} &nbsp;|&nbsp; Generated ${escapeHtml(generatedAt)}</div>
        </td></tr>
        <tr><td style="padding:12px 16px 4px;">
          ${(activity !== "all" || status !== "all") ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 12px;background-color:#f2f7f7;border-left:3px solid #59a59d;color:#435564;font-family:Arial,sans-serif;font-size:12px;line-height:19px;">${activity !== "all" ? `<strong>Activity:</strong> ${escapeHtml(activity)} &nbsp;&nbsp;` : ""}${status !== "all" ? `<strong>Status:</strong> ${escapeHtml(status)}` : ""}</td></tr></table>` : ""}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <tr><td colspan="3" style="${summaryHeadingStyle}">Activity Summary</td></tr>
            <tr>${summaryMetric("Technical Assistance", assistanceWithLogs.length)}${summaryMetric("Other Tasks", tasksWithLogs.length)}${summaryMetric("Total Records", totalRecords)}</tr>
            <tr><td colspan="3" style="${summaryHeadingStyle}">Contribution Summary</td></tr>
            <tr>${summaryMetric("Owned Records", contributionSummary.owned)}${summaryMetric("Assigned Records", contributionSummary.assigned)}${summaryMetric("Participation", contributionSummary.participationCount)}</tr>
            <tr><td colspan="3" style="${summaryHeadingStyle}">Status Summary</td></tr>
            <tr>${summaryMetric("Open", statusCounts.open)}${summaryMetric("Close Pending", statusCounts.pending)}${summaryMetric("Closed", statusCounts.closed)}</tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${tableStyle}margin-top:14px;">
            <colgroup><col width="14%"><col width="58%"><col width="8%"><col width="10%"><col width="10%"></colgroup>
            <tr><td colspan="5" style="padding:0 0 9px;color:#165d59;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;line-height:21px;">TECHNICAL ASSISTANCE RECORDS</td></tr>
            ${tableHead()}
            ${assistanceRows}
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${tableStyle}margin-top:18px;">
            <colgroup><col width="14%"><col width="58%"><col width="8%"><col width="10%"><col width="10%"></colgroup>
            <tr><td colspan="5" style="padding:0 0 9px;color:#165d59;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;line-height:21px;">OTHER TASK RECORDS</td></tr>
            ${tableHead()}
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
  const details = [
    typeof error?.responseCode === "number" ? `SMTP ${error.responseCode}` : null,
    typeof error?.response === "string" ? error.response : null,
    typeof error?.code === "string" ? error.code : null,
  ].filter(Boolean).join(" · ").slice(0, 500);

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
      ...(details ? { details } : {}),
    },
    {
      status: 500,
    }
  );
}


}
