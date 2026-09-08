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

  const attachment = await workbook.xlsx.writeBuffer();

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: sender.smtpEmail,
      pass: sender.smtpPassword,
    },
  });

  const filename = `OpsLog_Report_${from}_to_${to}.xlsx`;

const assistanceRows = assistance
  .map(
    (r) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${r.refNo}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.clientName}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.problem}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.status}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.assigned}</td>
      </tr>
    `
  )
  .join("");


const taskRows = tasks
  .map(
    (r) => `
      <tr>

        <td style="padding:8px;border:1px solid #ddd">${r.refNo}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.activityType}</td>
        <td style="padding:8px;border:1px solid #ddd">${r.description}</td>   
        <td style="padding:8px;border:1px solid #ddd">${r.status}</td>    
        <td style="padding:8px;border:1px solid #ddd">${r.assigned}</td>  

      </tr>
    `
  )
  .join("");


try {

  await transporter.sendMail({
    from: `"OpsLog Reports" <${sender.smtpEmail}>`,
    to: sender.smtpRecipients,
    subject: `OpsLog Productivity Report (${from} to ${to})`,

html: `
<div style="
  font-family:Segoe UI,Arial,sans-serif;
  max-width:800px;
">
  <h2 style="
    color:#2563eb;
    margin-bottom:10px;
  ">
    OpsLog Productivity Report
  </h2>

  <p>
    <strong>Prepared By:</strong>
    ${actor.name}
  </p>

  <p>
    <strong>Reporting Period:</strong><br>
    ${from} to ${to}
  </p>

  <p>
    <strong>Activity Filter:</strong> ${activity}<br>
    <strong>Status Filter:</strong> ${status}
  </p>

  <table
    style="
      border-collapse:collapse;
      width:450px;
      margin-top:20px;
      margin-bottom:20px;
    "
  >
    <tr style="
      background:#2563eb;
      color:white;
    ">
      <th style="padding:10px;border:1px solid #ddd">
        Metric
      </th>
      <th style="padding:10px;border:1px solid #ddd">
        Value
      </th>
    </tr>

    <tr>
      <td style="padding:10px;border:1px solid #ddd">
        Technical Assistance
      </td>
      <td style="padding:10px;border:1px solid #ddd">
        ${assistance.length}
      </td>
    </tr>

    <tr>
      <td style="padding:10px;border:1px solid #ddd">
        Other Tasks
      </td>
      <td style="padding:10px;border:1px solid #ddd">
        ${tasks.length}
      </td>
    </tr>

    <tr>
      <td style="padding:10px;border:1px solid #ddd">
        Total Records
      </td>
      <td style="padding:10px;border:1px solid #ddd">
        ${assistance.length + tasks.length}
      </td>
    </tr>
  </table>

<h3 style="color:#2563eb">
  Technical Assistance Details
</h3>

<table
  style="
    border-collapse:collapse;
    width:100%;
    margin-bottom:20px;
  "
>
  <tr style="
    background:#2563eb;
    color:white;
  ">
    <th style="padding:8px;border:1px solid #ddd">Ref No</th>
    <th style="padding:8px;border:1px solid #ddd">Client</th>
    <th style="padding:8px;border:1px solid #ddd">Problem</th>
    <th style="padding:8px;border:1px solid #ddd">Status</th>
    <th style="padding:8px;border:1px solid #ddd">Assigned</th>
  </tr>

  ${assistanceRows}
</table>

<h3 style="color:#7f56d9">
  Other Tasks Details
</h3>

<table
  style="
    border-collapse:collapse;
    width:100%;
    margin-bottom:20px;
  "
>
  <tr style="
    background:#7f56d9;
    color:white;
  ">
    <th style="padding:8px;border:1px solid #ddd">Ref No</th>
    <th style="padding:8px;border:1px solid #ddd">Activity Type</th>
    <th style="padding:8px;border:1px solid #ddd">Description</th>
    <th style="padding:8px;border:1px solid #ddd">Status</th>
    <th style="padding:8px;border:1px solid #ddd">Assigned</th>
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
    Generated automatically by OpsLog.
  </p>
</div>
`,

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

} catch (error) {
  console.error(error);

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
