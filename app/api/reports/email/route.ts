import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportWorkbook } from "@/lib/reportExcel";
import { logAudit } from "@/lib/audit";

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
    date: {
      gte: new Date(from),
      lte: new Date(to),
    },
  };

  if (actor.role !== "ADMIN") {
    where.ownerId = actor.id;
  }



  if (status !== "all") {
    where.status = status;
  }

  const assistance =
    activity === "tasks"
      ? []
      : await prisma.assistance.findMany({
          where,
          orderBy: [{ date: "desc" }],
        });

  const tasks =
    activity === "assistance"
      ? []
      : await prisma.task.findMany({
          where,
          orderBy: [{ date: "desc" }],
        });

  const workbook = await buildReportWorkbook({
    range: { from, to },
    assistance,
    tasks,
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

  const filename = `MAMS_Support_Activity_Report_${from}_to_${to}.xlsx`;

const assistanceRows = assistance
  .map(
    (r) => `
      <tr>

        <td style="
          padding:8px;
          border:1px solid #ddd;
          white-space:nowrap;
          text-align:left;
        ">
          ${r.refNo}
        </td>

        <td style="
          padding:8px;
          border:1px solid #ddd;
          white-space:nowrap;
          text-align:left;
        ">
          ${r.clientName}
        </td>

	<td style="
	  padding:8px;
	  border:1px solid #ddd;
	  text-align:left;
	  word-break:break-word;
	  overflow-wrap:break-word;
	">
	  ${r.problem}
	</td>

  <td style="
    padding:8px;
    border:1px solid #ddd;
    white-space:nowrap;
    text-align:center;
  ">
    ${r.status}
  </td>

  <td style="
    padding:8px;
    border:1px solid #ddd;
    text-align:center;
  ">
    ${r.assigned}
  </td>

      </tr>
    `
  )
  .join("");



const taskRows = tasks
  .map(
    (r) => `
      <tr>

        <td style="
          padding:8px;
          border:1px solid #ddd;
          white-space:nowrap;
          text-align:left;
        ">
          ${r.refNo}
        </td>

        <td style="
          padding:8px;
          border:1px solid #ddd;
          white-space:nowrap;
          text-align:left;
        ">
          ${r.activityType}
        </td>

        <td style="
          padding:8px;
          border:1px solid #ddd;
          text-align:left;
        ">
          ${r.description}
        </td>

        <td style="
          padding:8px;
          border:1px solid #ddd;
          white-space:nowrap;
          text-align:center;
        ">
          ${r.status}
        </td>

        <td style="
          padding:8px;
          border:1px solid #ddd;
          white-space:nowrap;
          text-align:center;
        ">
          ${r.assigned}
        </td>

      </tr>
    `
  )
  .join("");


const emailHtml = `
  <table
  width="100%"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
  background:#f3f4f6;
  margin:0;
  padding:20px 0;
  "
  >

  <tr>
  <td align="center">
   
  <table
  width="1100"
  cellpadding="0"
  cellspacing="0"
  border="0"
  style="
  background:#ffffff;
  font-family:Segoe UI,Arial,sans-serif;
  border-collapse:collapse;
  "
  >
  <tr>
  <td style="padding:24px;">

  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      background:#2563eb;
      color:white;
      margin-bottom:20px;
    ">
    <tr>
      <td style="padding:20px;">
        <div
          style="
            font-size:28px;
            font-weight:bold;
            margin-bottom:8px;
          "
        >
          MAMS Support Activity Report
        </div>

        <div style="font-size:14px;">
          Prepared By: ${actor.name}
        </div>

        <div style="font-size:14px;">
          Reporting Period: ${from} to ${to}
        </div>
      </td>
    </tr>
  </table>

  <p>
    ${activity !== "all"
      ? `<strong>Activity Filter:</strong> ${activity}<br>`
      : ""}

    ${status !== "all"
      ? `<strong>Status Filter:</strong> ${status}<br>`
      : ""}  
  </p>

  <h3 style="color:#2563eb;margin-top:20px;margin-bottom:10px;">
    Activity Summary
  </h3>

  <table
    width="450"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      width:450px;
      border-collapse:collapse;
      margin-bottom:20px;
    "
  >

    <tr>
      <th style="
        padding:10px;
        border:1px solid #ddd;
        background:#2563eb;
        color:white;
        text-align:left;
      ">
        Metric
      </th>

      <th style="
        padding:10px;
        border:1px solid #ddd;
        background:#2563eb;
        color:white;
        text-align:right;
      ">
        Value
      </th>
    </tr>

    <tr>
      <td style="padding:10px;border:1px solid #ddd">
        Technical Assistance
      </td>

      <td style="padding:10px;border:1px solid #ddd;text-align:right">
        ${assistance.length}
      </td>
      
    </tr>

    <tr>
      <td style="padding:10px;border:1px solid #ddd">
        Other Tasks
      </td>

      <td style="padding:10px;border:1px solid #ddd;text-align:right">
        ${tasks.length}
      </td>

    </tr>

    <tr>

    <td style="padding:10px;border:1px solid #ddd;font-weight:bold">
      Total Records
    </td>

    <td style="
      padding:10px;
      border:1px solid #ddd;
      text-align:right;
      font-weight:bold;
    ">
      ${assistance.length + tasks.length}
    </td>

    </tr>

  </table>

  <h3 style="
    color:#2563eb;
    margin-top:30px;
    margin-bottom:12px;
  ">
    Technical Assistance Details
  </h3>

  <table
    style="
      border-collapse:collapse;
      width:100%;
      table-layout:fixed;
      margin-bottom:20px;
    "
  >

  <tr>
    <th style="padding:8px;border:1px solid #ddd;background:#2563eb;color:white;width:140px;">Ref No</th>
    <th style="padding:8px;border:1px solid #ddd;background:#2563eb;color:white;width:140px;">Client</th>
    <th style="padding:8px;border:1px solid #ddd;background:#2563eb;color:white;">Problem</th>
    <th style="
      padding:8px;
      border:1px solid #ddd;
      background:#2563eb;
      color:white;
      width:120px;
      text-align:center;
    ">
      Status
    </th>

    <th style="
      padding:8px;
      border:1px solid #ddd;
      background:#2563eb;
      color:white;
      width:220px;
      text-align:center;
    ">
      Assigned
    </th>
  </tr>

  ${assistanceRows}
</table>

  <h3 style="
    color:#7f56d9;
    margin-top:30px;
    margin-bottom:12px;
  ">
    Other Tasks Details
  </h3>

<table
  style="
    border-collapse:collapse;
    width:100%;
    table-layout:auto;
    margin-bottom:20px;
  "
>
  <tr>
	<th style="padding:8px;border:1px solid #ddd;background:#7f56d9;color:white;width:140px;">Ref No</th>
	<th style="padding:8px;border:1px solid #ddd;background:#7f56d9;color:white;width:140px;white-space:nowrap;">Activity Type</th>
	<th style="padding:8px;border:1px solid #ddd;background:#7f56d9;color:white;">Description</th>
    <th style="
      padding:8px;
      border:1px solid #ddd;
      background:#7f56d9;
      color:white;
      width:120px;
      text-align:center;
    ">
      Status
    </th>

    <th style="
      padding:8px;
      border:1px solid #ddd;
      background:#7f56d9;
      color:white;
      width:220px;
      text-align:center;
    ">
      Assigned
    </th>
  </tr>

  ${taskRows}
</table>


  <p>
    The detailed Excel workbook is attached to this email.
  </p>

  <p>
    File:
    <strong>${filename}</strong>
  </p>

  <hr>

  <p style="
    color:#666;
    font-size:12px;
  ">
    Generated automatically by MAMS Support Operations Tracker.
  </p>

  </td>
  </tr>
  </table>

  </td>
  </tr>
  </table>
  `;

if (preview) {
  return NextResponse.json({
    ok: true,
    subject: `MAMS Support Activity Report (${from} to ${to})`,
    recipients: sender.smtpRecipients,
    html: emailHtml,
  });
}


try {

  await transporter.sendMail({
    from: `"MAMS Support Reports" <${sender.smtpEmail}>`,
    to: sender.smtpRecipients,
    subject: `MAMS Support Activity Report (${from} to ${to})`,

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
  entityId: `${from} to ${to}`,
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
    entityId: `${from} to ${to}`,
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
