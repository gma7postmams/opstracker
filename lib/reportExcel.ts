import ExcelJS from "exceljs";
import { minutesBetween } from "@/lib/format";
import { formatReportOwner, ReportContributionSummary } from "@/lib/reports";

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFF" },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "2563EB" },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });
}

function autoFit(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((column) => {
    let max = 12;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = String(cell.value ?? "");
      max = Math.max(max, value.length);
    });

    column.width = Math.min(max + 3, 60);
  });
}

function dateOnly(value: Date | string | null | undefined) {
  if (!value) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function formatDuration(record: any) {
  const totalMinutes = minutesBetween(record.startDate, record.timeStarted, record.endDate, record.timeEnded);
  if (totalMinutes == null) return "";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""]
    .filter(Boolean)
    .join(" ") || "0m";
}

function colorStatusColumn(
  ws: ExcelJS.Worksheet,
  statusColumn: number,
  startRow: number
) {
  for (let i = startRow; i <= ws.rowCount; i++) {
    const cell = ws.getRow(i).getCell(statusColumn);

    if (cell.value === "CLOSED") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "16A34A" },
      };

      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
      };
    }

    if (cell.value === "OPEN") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "DC2626" },
      };

      cell.font = {
        color: { argb: "FFFFFF" },
        bold: true,
      };
    }

    if (cell.value === "CLOSE_PENDING") {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "F59E0B" },
      };

      cell.font = {
        color: { argb: "000000" },
        bold: true,
      };
    }
  }
}

export async function buildReportWorkbook(data: {
  range: {
    from: string;
    to: string;
  };
  assistance: any[];
  tasks: any[];
  workLogs: Array<{
    parentRecordNo: string;
    recordType: string;
    type: string;
    createdAt: Date;
    createdBy: string;
    message: string;
  }>;
  contributionSummary: ReportContributionSummary;
}) {
  const wb = new ExcelJS.Workbook();

  wb.creator = "OpsLog";
  wb.created = new Date();

  //
  // SUMMARY
  //
  const summary = wb.addWorksheet("Summary");

  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "MAMS Support Activity Report";
  summary.getCell("A1").font = {
    size: 18,
    bold: true,
    color: { argb: "2563EB" },
  };

  summary.addRow([]);
  summary.addRow(["Reporting Period", data.range.to ? `${data.range.from} to ${data.range.to}` : data.range.from]);
  summary.addRow(["Generated On", new Date().toLocaleString()]);

  summary.addRow([]);

  const summaryHeader = summary.addRow([
    "Metric",
    "Value",
  ]);

  styleHeader(summaryHeader);

  summary.addRow([
    "Technical Assistance",
    data.assistance.length,
  ]);

  summary.addRow([
    "Other Tasks",
    data.tasks.length,
  ]);

  summary.addRow([
    "Total Records",
    data.assistance.length + data.tasks.length,
  ]);

  summary.addRow([]);
  const contributionHeader = summary.addRow(["Contribution Summary", data.contributionSummary.userName]);
  styleHeader(contributionHeader);
  summary.addRow(["Owned Records", data.contributionSummary.owned]);
  summary.addRow(["Assigned Records", data.contributionSummary.assigned]);
  summary.addRow(["Participation Count", data.contributionSummary.participationCount]);

  autoFit(summary);

  //
  // TECHNICAL ASSISTANCE
  //
  const ta = wb.addWorksheet("Technical Assistance");

  ta.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  const taHeader = ta.addRow([
    "Reference No",
    "Status",
    "Priority",
    "Shift",
    "Location",
    "Show / Group",
    "Category",
    "Client",
    "Assigned To",
    "Accountable",
    "Owner",
    "Start Date",
    "Start Time",
    "End Date",
    "End Time",
    "Duration",
    "Problem",
    "Cause",
    "Resolution",
    "Remarks",
    "Created By",
    "Created At",
    "Updated At",
  ]);

  styleHeader(taHeader);

  ta.autoFilter = {
    from: "A1",
    to: "W1",
  };

  data.assistance.forEach((r) => {
    ta.addRow([
      r.refNo,
      r.status,
      r.priority,
      r.shift,
      r.location,
      r.showGroup,
      r.category,
      r.clientName,
      r.assigned,
      r.accountable,
      formatReportOwner(r.owner),
      dateOnly(r.startDate),
      r.timeStarted,
      dateOnly(r.endDate),
      r.timeEnded,
      formatDuration(r),
      r.problem,
      r.cause,
      r.resolution,
      r.remarks,
      r.createdBy,
      r.createdAt,
      r.updatedAt,
    ]);
  });

  colorStatusColumn(ta, 2, 2);
  ta.getColumn(22).numFmt = "yyyy-mm-dd hh:mm";
  ta.getColumn(23).numFmt = "yyyy-mm-dd hh:mm";
  autoFit(ta);

  //
  // OTHER TASKS
  //
  const taskSheet = wb.addWorksheet("Other Tasks");

  taskSheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  const taskHeader = taskSheet.addRow([
    "Reference No",
    "Status",
    "Priority",
    "Shift",
    "Location",
    "Show / Group",
    "Activity Type",
    "Description",
    "Assigned To",
    "Accountable",
    "Owner",
    "Start Date",
    "Start Time",
    "End Date",
    "End Time",
    "Duration",
    "Remarks",
    "Created By",
    "Created At",
    "Updated At",
  ]);

  styleHeader(taskHeader);

  taskSheet.autoFilter = {
    from: "A1",
    to: "T1",
  };

  data.tasks.forEach((r) => {
    taskSheet.addRow([
      r.refNo,
      r.status,
      r.priority,
      r.shift,
      r.location,
      r.showGroup,
      r.activityType,
      r.description,
      r.assigned,
      r.accountable,
      formatReportOwner(r.owner),
      dateOnly(r.startDate),
      r.timeStarted,
      dateOnly(r.endDate),
      r.timeEnded,
      formatDuration(r),
      r.remarks,
      r.createdBy,
      r.createdAt,
      r.updatedAt,
    ]);
  });

  colorStatusColumn(taskSheet, 2, 2);
  taskSheet.getColumn(19).numFmt = "yyyy-mm-dd hh:mm";
  taskSheet.getColumn(20).numFmt = "yyyy-mm-dd hh:mm";
  autoFit(taskSheet);

  //
  // WORK LOGS
  //
  const workLogs = wb.addWorksheet("Work Logs");
  workLogs.views = [{ state: "frozen", ySplit: 1 }];
  const workLogsHeader = workLogs.addRow([
    "Record No",
    "Record Type",
    "Work Log Type",
    "Timestamp",
    "User",
    "Message",
  ]);
  styleHeader(workLogsHeader);
  workLogs.autoFilter = { from: "A1", to: "F1" };
  data.workLogs.forEach((log) => {
    const row = workLogs.addRow([
      log.parentRecordNo,
      log.recordType,
      log.type,
      log.createdAt,
      log.createdBy,
      log.message,
    ]);
    row.getCell(4).numFmt = "yyyy-mm-dd hh:mm";
  });
  autoFit(workLogs);

  //
  // TIMELINE
  //
  const timeline = wb.addWorksheet("Timeline");
  timeline.views = [{ state: "frozen", ySplit: 1 }];
  const timelineHeader = timeline.addRow([
    "Record No",
    "Timestamp",
    "Event Type",
    "Description",
    "User",
  ]);
  styleHeader(timelineHeader);
  timeline.autoFilter = { from: "A1", to: "E1" };
  [...data.assistance, ...data.tasks].forEach((record) => {
    (record.timelineSummary ?? []).forEach((event: any) => {
      const row = timeline.addRow([
        record.refNo,
        event.createdAt,
        event.title,
        event.description,
        event.user,
      ]);
      row.getCell(2).numFmt = "yyyy-mm-dd hh:mm";
    });
  });
  autoFit(timeline);

  return wb;
}
