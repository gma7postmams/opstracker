import ExcelJS from "exceljs";
import { buildReportRecordDetails, formatReportOwner, formatReportRecordDetails, ReportContributionSummary } from "@/lib/reports";

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
    createdAt: Date;
    createdBy: string;
    investigate: string;
    resolution: string;
    remarks: string;
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
  summary.addRow(["Reporting Period", `${data.range.from} to ${data.range.to}`]);
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
    "Ref No",
    "Date",
    "Shift",
    "Category",
    "Priority",
    "Status",
    "Owner",
    "Assigned",
    "Accountable",
    "Details",
  ]);

  styleHeader(taHeader);

  ta.autoFilter = {
    from: "A1",
    to: "J1",
  };

  data.assistance.forEach((r) => {
    ta.addRow([
      r.refNo,
      new Date(r.startDate).toLocaleDateString(),
      r.shift,
      r.category,
      r.priority,
      r.status,
      formatReportOwner(r.owner),
      r.assigned,
      r.accountable,
      formatReportRecordDetails(buildReportRecordDetails(r, "assistance")),
    ]);
  });

  colorStatusColumn(ta, 6, 2);
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
    "Ref No",
    "Date",
    "Shift",
    "Priority",
    "Status",
    "Owner",
    "Assigned",
    "Accountable",
    "Details",
  ]);

  styleHeader(taskHeader);

  taskSheet.autoFilter = {
    from: "A1",
    to: "I1",
  };

  data.tasks.forEach((r) => {
    taskSheet.addRow([
      r.refNo,
      new Date(r.startDate).toLocaleDateString(),
      r.shift,
      r.priority,
      r.status,
      formatReportOwner(r.owner),
      r.assigned,
      r.accountable,
      formatReportRecordDetails(buildReportRecordDetails(r, "tasks")),
    ]);
  });

  colorStatusColumn(taskSheet, 5, 2);
  autoFit(taskSheet);

  //
  // WORK LOGS
  //
  const workLogs = wb.addWorksheet("WorkLogs");
  workLogs.views = [{ state: "frozen", ySplit: 1 }];
  const workLogsHeader = workLogs.addRow([
    "Parent Record No",
    "Record Type",
    "Created At",
    "Created By",
    "Investigate",
    "Resolution",
    "Remarks",
  ]);
  styleHeader(workLogsHeader);
  workLogs.autoFilter = { from: "A1", to: "G1" };
  data.workLogs.forEach((log) => {
    const row = workLogs.addRow([
      log.parentRecordNo,
      log.recordType,
      log.createdAt,
      log.createdBy,
      log.investigate,
      log.resolution,
      log.remarks,
    ]);
    row.getCell(3).numFmt = "yyyy-mm-dd hh:mm";
  });
  autoFit(workLogs);

  //
  // COMBINED SHEET
  //
  const combined = wb.addWorksheet("Combined Records");

  combined.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];

  const combinedHeader = combined.addRow([
    "Ref No",
    "Type",
    "Date",
    "Status",
    "Priority",
    "Location",
    "Owner",
    "Assigned",
    "Details",
  ]);

  styleHeader(combinedHeader);

  data.assistance.forEach((r) => {
    combined.addRow([
      r.refNo,
      "Technical Assistance",
      new Date(r.startDate).toLocaleDateString(),
      r.status,
      r.priority,
      r.location,
      formatReportOwner(r.owner),
      r.assigned,
      formatReportRecordDetails(buildReportRecordDetails(r, "assistance")),
    ]);
  });

  data.tasks.forEach((r) => {
    combined.addRow([
      r.refNo,
      "Other Task",
      new Date(r.startDate).toLocaleDateString(),
      r.status,
      r.priority,
      "",
      formatReportOwner(r.owner),
      r.assigned,
      formatReportRecordDetails(buildReportRecordDetails(r, "tasks")),
    ]);
  });

  combined.autoFilter = {
    from: "A1",
    to: "I1",
  };

  colorStatusColumn(combined, 4, 2);
  autoFit(combined);

  return wb;
}
