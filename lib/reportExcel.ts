import ExcelJS from "exceljs";

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
}) {
  const wb = new ExcelJS.Workbook();

  wb.creator = "OpsLog";
  wb.created = new Date();

  //
  // SUMMARY
  //
  const summary = wb.addWorksheet("Summary");

  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "OpsLog Productivity Report";
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
    "Location",
    "Show Group",
    "Client Name",
    "Problem",
    "Category",
    "Resolution",
    "Priority",
    "Status",
    "Assigned",
    "Accountable",
    "Remarks",
  ]);

  styleHeader(taHeader);

  ta.autoFilter = {
    from: "A1",
    to: "N1",
  };

  data.assistance.forEach((r) => {
    ta.addRow([
      r.refNo,
      new Date(r.date).toLocaleDateString(),
      r.shift,
      r.location,
      r.showGroup,
      r.clientName,
      r.problem,
      r.category,
      r.resolution,
      r.priority,
      r.status,
      r.assigned,
      r.accountable,
      r.remarks,
    ]);
  });

  colorStatusColumn(ta, 11, 2);
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
    "Location",
    "Show Group",
    "Activity Type",
    "Description",
    "Priority",
    "Status",
    "Assigned",
    "Accountable",
    "Remarks",
  ]);

  styleHeader(taskHeader);

  taskSheet.autoFilter = {
    from: "A1",
    to: "L1",
  };

  data.tasks.forEach((r) => {
    taskSheet.addRow([
      r.refNo,
      new Date(r.date).toLocaleDateString(),
      r.shift,
      r.location,
      r.showGroup,
      r.activityType,
      r.description,
      r.priority,
      r.status,
      r.assigned,
      r.accountable,
      r.remarks,
    ]);
  });

  colorStatusColumn(taskSheet, 9, 2);
  autoFit(taskSheet);

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
    "Assigned",
    "Description",
  ]);

  styleHeader(combinedHeader);

  data.assistance.forEach((r) => {
    combined.addRow([
      r.refNo,
      "Technical Assistance",
      new Date(r.date).toLocaleDateString(),
      r.status,
      r.priority,
      r.location,
      r.assigned,
      r.problem,
    ]);
  });

  data.tasks.forEach((r) => {
    combined.addRow([
      r.refNo,
      "Other Task",
      new Date(r.date).toLocaleDateString(),
      r.status,
      r.priority,
      r.location,
      r.assigned,
      r.description,
    ]);
  });

  combined.autoFilter = {
    from: "A1",
    to: "H1",
  };

  colorStatusColumn(combined, 4, 2);
  autoFit(combined);

  return wb;
}
