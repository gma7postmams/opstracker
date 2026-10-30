import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { buildReportWorkbook } from "@/lib/reportExcel";
import { addReportTimelineSummaries, addReportWorkLogSummaries, getReportContributionSummary, getReportWorkLogsForExport } from "@/lib/reports";
import { isRecordType, SortKey } from "@/lib/recordTypes";
import { listRecords } from "@/lib/records";

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const user = await currentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRecordType(type)) return NextResponse.json({ error: "Unknown record type" }, { status: 404 });

  const search = req.nextUrl.searchParams;
  const selectedUserId = search.get("userId");
  const query = {
    q: search.get("q") ?? undefined,
    status: search.get("status") ?? undefined,
    location: type === "assistance" ? search.get("location") ?? undefined : undefined,
    category: type === "assistance" ? search.get("category") ?? undefined : undefined,
    shift: search.get("shift") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
    userId: selectedUserId === "all"
      ? "all" as const
      : selectedUserId
        ? Number(selectedUserId)
        : undefined,
    sort: (search.get("sort") as SortKey) ?? "date",
    dir: search.get("dir") === "asc" ? "asc" as const : "desc" as const,
  };

  const pageSize = 200;
  const firstPage = await listRecords(type, { ...query, page: 1, perPage: pageSize }, user);
  const records = [...firstPage.rows];
  for (let page = 2; page <= Math.ceil(firstPage.total / pageSize); page++) {
    const result = await listRecords(type, { ...query, page, perPage: pageSize }, user);
    records.push(...result.rows);
  }

  const withWorkLogs = await addReportWorkLogSummaries(records, type);
  const withTimeline = await addReportTimelineSummaries(withWorkLogs, type);
  const [assistance, tasks] = type === "assistance"
    ? [withTimeline, []]
    : [[], withTimeline];
  const contributionSummary = await getReportContributionSummary(
    { id: { in: records.map((record) => record.id) } },
    user,
    type,
    selectedUserId,
  );
  const workbook = await buildReportWorkbook({
    range: {
      from: query.from || "Current View",
      to: query.to || "",
    },
    assistance,
    tasks,
    workLogs: await getReportWorkLogsForExport(assistance, tasks),
    contributionSummary,
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `OpsTracker_${type === "assistance" ? "Technical_Assistance" : "Other_Tasks"}_Current_View.xlsx`;

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}