import type { RecordType } from "./recordTypes";

function safeFilenamePart(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");
}

export function getRecordReportFilename(type: RecordType, refNo: string) {
  const safeRefNo = safeFilenamePart(refNo) || (type === "assistance" ? "TA-record" : "OT-record");
  const reportType = type === "assistance" ? "Technical-Assistance-Report" : "Other-Task-Report";
  return `${safeRefNo}_${reportType}.pdf`;
}