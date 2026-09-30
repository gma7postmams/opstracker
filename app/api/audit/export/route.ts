import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(req: NextRequest) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);

  const search = searchParams.get("search") ?? "";
  const action = searchParams.get("action") ?? "ALL";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const logs = await prisma.auditLog.findMany({
    where: {
      ...(user.role !== "ADMIN"
        ? { userId: user.id }
        : {}),

      ...(action !== "ALL"
        ? { action }
        : {}),
    },

    orderBy: {
      createdAt: "desc",
    },
  });

  const filtered = logs.filter((log) => {
    const term = search.toLowerCase();

    const matchesSearch =
      !search ||
      String(log.id).toLowerCase().includes(term) ||
      (log.action ?? "").toLowerCase().includes(term) ||
      (log.entityType ?? "").toLowerCase().includes(term) ||
      (log.entityId ?? "").toLowerCase().includes(term) ||
      (log.details as any)?.user
        ?.toLowerCase()
        .includes(term) ||
      (log.details as any)?.name
        ?.toLowerCase()
        .includes(term) ||
      (log.details as any)?.username
        ?.toLowerCase()
        .includes(term);

    const logDate = new Date(log.createdAt);

    const matchesFrom =
      !from || logDate >= new Date(from);

    const matchesTo =
      !to ||
      logDate <= new Date(`${to}T23:59:59`);

    return (
      matchesSearch &&
      matchesFrom &&
      matchesTo
    );
  });

const workbook = new ExcelJS.Workbook();

workbook.creator = "MAMS Support Operations Tracker";

const sheet = workbook.addWorksheet("Audit Logs");

sheet.mergeCells("A1:F1");

const titleCell = sheet.getCell("A1");

titleCell.value =
  "MAMS Support Operations Tracker - Audit Logs";

titleCell.font = {
  bold: true,
  size: 16,
  color: { argb: "FFFFFF" },
};

titleCell.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "1E40AF" },
};

titleCell.alignment = {
  horizontal: "center",
};

sheet.columns = [
  { header: "Date / Time", key: "datetime", width: 24 },
  { header: "User", key: "user", width: 30 },
  { header: "Action", key: "action", width: 22 },
  { header: "Type", key: "type", width: 18 },
  { header: "Reference", key: "reference", width: 25 },
  { header: "Details", key: "details", width: 60 },
];

sheet.getRow(3).values = [
  "Date / Time",
  "User",
  "Action",
  "Type",
  "Reference",
  "Details",
];

const headerRow = sheet.getRow(3);

headerRow.font = {
  bold: true,
  color: { argb: "FFFFFF" },
};

headerRow.fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "2563EB" },
};

filtered.forEach((log) => {
  const userName =
    (log.details as any)?.actor ??
    (log.details as any)?.user ??
    (log.details as any)?.name ??
    (log.details as any)?.username ??
    (log.userId
      ? `User #${log.userId}`
      : "Anonymous");

  sheet.addRow({
    datetime: new Date(log.createdAt).toLocaleString(
      "en-PH"
    ),
    user: userName,
    action: log.action,
    type: log.entityType,
    reference: log.entityId,
    details: JSON.stringify(log.details),
  });
});

sheet.eachRow((row, rowNumber) => {
  if (rowNumber <= 3) return;

  if (rowNumber % 2 === 0) {
    row.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F8FAFC" },
    };
  }

  const actionCell = row.getCell(3);

  const value = String(
    actionCell.value ?? ""
  ).toUpperCase();

  if (
    value.includes("DELETE") ||
    value.includes("FAILED")
  ) {
    actionCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FEE2E2" },
    };
  } else if (
    value.includes("CREATE") ||
    value.includes("ADD")
  ) {
    actionCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "DCFCE7" },
    };
  } else if (
    value.includes("LOGIN")
  ) {
    actionCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "DBEAFE" },
    };
  }
});

sheet.views = [
  {
    state: "frozen",
    ySplit: 3,
  },
];

sheet.autoFilter = {
  from: "A3",
  to: "F3",
};

const buffer = Buffer.from(
  await workbook.xlsx.writeBuffer()
);

return new NextResponse(buffer, {
  headers: {
    "Content-Type":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

    "Content-Disposition":
      `attachment; filename="audit-logs-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
  },
});
}
