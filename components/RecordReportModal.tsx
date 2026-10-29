"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Mail, Printer } from "lucide-react";
import Modal from "@/components/Modal";

type WorkLog = {
  id: number;
  type: "INVESTIGATION" | "RESOLUTION" | "REMARK";
  message: string;
  createdByName: string;
  createdAt: string;
};

type SystemEvent = {
  id: string | number;
  title: string;
  description: string;
  createdAt: string;
};

const workLogLabels: Record<WorkLog["type"], string> = {
  INVESTIGATION: "Investigation",
  RESOLUTION: "Resolution",
  REMARK: "Remarks",
};

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function formatDate(value: unknown) {
  if (!hasValue(value)) return "";
  const raw = String(value).slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return `${dateFormat.format(date)} ${timeFormat.format(date)}`;
}

function recordDateTime(date: unknown, time: unknown) {
  if (!hasValue(date) || !hasValue(time)) return null;
  const parsed = new Date(`${String(date).slice(0, 10)}T${String(time)}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function durationLabel(minutes: number) {
  const roundedMinutes = Math.max(0, minutes);
  return `${roundedMinutes} ${roundedMinutes === 1 ? "Minute" : "Minutes"}`;
}

async function createReportPdf(record: any, workLogs: WorkLog[], systemEvents: SystemEvent[], type: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const filename = `${type === "assistance" ? "TA" : "OT"}-${record.refNo.split("-").slice(1).join("-")}.pdf`;
  let y = margin;

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 18) {
      pdf.addPage();
      y = margin;
    }
  };

  const section = (title: string) => {
    ensureSpace(12);
    y += 3;
    pdf.setFillColor(232, 241, 239);
    pdf.rect(margin, y - 5, contentWidth, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(22, 93, 89);
    pdf.text(title.toUpperCase(), margin + 2, y);
    y += 8;
  };

  const paragraph = (label: string, value: unknown, indent = 0) => {
    if (!hasValue(value)) return false;
    const text = label ? `${label}: ${String(value).trim()}` : String(value).trim();
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(text, contentWidth - indent - 2) as string[];
    pdf.setTextColor(38, 52, 61);
    for (const line of lines) {
      ensureSpace(6.5);
      pdf.text(line, margin + indent + 1, y);
      y += 4.5;
    }
    y += 2;
    return true;
  };

  const detailBlock = (label: string, value: unknown) => {
    if (!hasValue(value)) return false;
    ensureSpace(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(38, 52, 61);
    pdf.text(label, margin + 1, y);
    y += 5;
    paragraph("", String(value).trim(), 5);
    return true;
  };

  const subheading = (title: string) => {
    ensureSpace(9);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(22, 93, 89);
    pdf.text(title.toUpperCase(), margin + 1, y);
    y += 6;
  };

  const wrappedLines = (value: string, indent: number, fontSize = 9) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(value, contentWidth - indent - 2) as string[];
    pdf.setTextColor(38, 52, 61);
    for (const line of lines) {
      ensureSpace(6.5);
      pdf.text(line, margin + indent + 1, y);
      y += 4.5;
    }
  };

  const isAssistance = type === "assistance";
  const ownerName = record.owner
    ? [record.owner.firstName, record.owner.middleInitial ? `${record.owner.middleInitial}.` : "", record.owner.surname].filter(Boolean).join(" ")
    : "a deleted user";

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.setTextColor(22, 93, 89);
  pdf.text("OpsTracker", margin, y + 2);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(75, 91, 101);
  pdf.text(isAssistance ? "Technical Assistance Report" : "Other Task Report", margin, y + 8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(38, 52, 61);
  pdf.text(record.refNo, pageWidth - margin, y + 3, { align: "right" });
  y += 17;

  const information: [string, unknown][] = [
    ["Reference No", record.refNo],
    ["Record Type", isAssistance ? "Technical Assistance" : "Other Task"],
    ["Date", formatDate(record.startDate)],
    ["Shift", record.shift],
    ...(isAssistance
      ? [["Location", record.location], ["Show / Group", record.showGroup], ["Client", record.clientName], ["Category", record.category]] as [string, unknown][]
      : [["Activity Type", record.activityType]] as [string, unknown][]),
    ["Priority", record.priority],
    ["Status", record.status === "CLOSE_PENDING" ? "Close Pending" : record.status],
  ];
  if (information.some(([, value]) => hasValue(value))) {
    section("Record Information");
    for (const [label, value] of information) paragraph(label, value);
  }

  section("Work Summary");
  const startedAt = recordDateTime(record.startDate, record.timeStarted);
  const endedAt = recordDateTime(record.endDate ?? record.startDate, record.timeEnded);
  const elapsedMinutes = startedAt
    ? Math.floor(((record.status === "OPEN" ? Date.now() : endedAt?.getTime() ?? startedAt.getTime()) - startedAt.getTime()) / 60000)
    : 0;
  paragraph("Started", startedAt ? formatDateTime(startedAt) : "Not recorded");
  paragraph("Ended", record.status === "OPEN" ? "Ongoing" : endedAt ? formatDateTime(endedAt) : "Not recorded");
  paragraph("Duration", durationLabel(elapsedMinutes));

  const issueDetails: [string, unknown][] = [
    [isAssistance ? "Problem" : "Description", isAssistance ? record.problem : record.description],
    ...(isAssistance ? [["Cause", record.cause] as [string, unknown]] : []),
    ["Resolution", record.resolution],
    ["Remarks", record.remarks],
  ];
  if (issueDetails.some(([, value]) => hasValue(value))) {
    section("Issue Details");
    for (const [label, value] of issueDetails) detailBlock(label, value);
  }

  const workLogGroups = (["INVESTIGATION", "RESOLUTION", "REMARK"] as const)
    .map((typeName) => ({ typeName, entries: workLogs.filter((entry) => entry.type === typeName) }))
    .filter(({ entries }) => entries.length > 0);
  if (workLogGroups.length) section("Work Log Details");
  for (const typeName of ["INVESTIGATION", "RESOLUTION", "REMARK"] as const) {
    const entries = workLogs.filter((entry) => entry.type === typeName);
    if (!entries.length) continue;
    subheading(workLogLabels[typeName]);
    for (const entry of entries) {
      ensureSpace(11);
      wrappedLines(`${formatDateTime(entry.createdAt)} | ${entry.createdByName}`, 5);
      wrappedLines(entry.message, 9);
      y += 2;
      ensureSpace(5);
      pdf.setDrawColor(190, 201, 202);
      pdf.line(margin + 5, y, pageWidth - margin, y);
      y += 5;
    }
  }

  const events = [
    ...systemEvents.map((event) => ({
      createdAt: event.createdAt,
      title: event.title,
      description: event.title === "Reopened" ? "Record reopened" : event.description,
    })),
    ...workLogs.map((entry) => ({
      createdAt: entry.createdAt,
      description: `${workLogLabels[entry.type]} by ${entry.createdByName}: ${entry.message}`,
    })),
  ].sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  if (events.length) {
    section("Activity Timeline");
    for (const event of events) {
      wrappedLines(`${formatDateTime(event.createdAt)} | ${event.description}`, 0);
      y += 2;
    }
  }

  const ownership: [string, unknown][] = [
    ["Record Owner", ownerName],
    ["Current Assignee", record.assigned],
    ["Accountable Person", record.accountable],
  ];
  if (ownership.some(([, value]) => hasValue(value))) {
    section("Ownership");
    for (const [label, value] of ownership) paragraph(label, value);
  }

  ensureSpace(30);
  y += 4;
  pdf.setDrawColor(150, 164, 166);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(75, 91, 101);
  pdf.text("Generated from OpsTracker", margin + 1, y);
  y += 6;
  paragraph("Reference", record.refNo);
  paragraph("Generated", formatDateTime(new Date()));

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(110, 122, 129);
    pdf.text(`${record.refNo}  |  Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: "center" });
  }

  return { blob: pdf.output("blob") as Blob, filename };
}

export default function RecordReportModal({
  type,
  recordId,
  record,
  systemEvents,
  onClose,
}: {
  type: string;
  recordId: string;
  record: any;
  systemEvents: SystemEvent[];
  onClose: () => void;
}) {
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState<{ recipients: string; sentAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const systemEventsKey = JSON.stringify(systemEvents);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const loadReport = async () => {
      try {
        const includeAllUserOwned = new URLSearchParams(window.location.search).get("userId") === "all";
        const scope = includeAllUserOwned ? "?userId=all" : "";
        const response = await fetch(`/api/records/${type}/${recordId}/work-logs${scope}`);
        if (!response.ok) throw new Error("Could not load work log details");
        const entries: WorkLog[] = await response.json();
        const report = await createReportPdf(record, entries, JSON.parse(systemEventsKey), type);
        objectUrl = URL.createObjectURL(report.blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setWorkLogs(entries);
        setFilename(report.filename);
        setPreviewUrl(objectUrl);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not generate the report");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReport();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [type, recordId, record, systemEventsKey]);

  async function emailReport() {
    if (!previewUrl || sending) return;
    setSending(true);
    setError("");
    try {
      const pdfResponse = await fetch(previewUrl);
      const pdfBlob = await pdfResponse.blob();
      const formData = new FormData();
      formData.append("file", pdfBlob, filename);
      const includeAllUserOwned = new URLSearchParams(window.location.search).get("userId") === "all";
      const scope = includeAllUserOwned ? "?userId=all" : "";
      const response = await fetch(`/api/records/${type}/${recordId}/report-email${scope}`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not email report");
      setEmailSuccess({ recipients: result.recipients, sentAt: result.sentAt });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not email report");
    } finally {
      setSending(false);
    }
  }

  const title = `${type === "assistance" ? "TA" : "OT"}-${record.refNo.split("-").slice(1).join("-")}.pdf`;
  return (
    <Modal
      title="PDF Preview"
      subtitle={title}
      width={1000}
      onClose={() => { if (!emailSuccess) onClose(); }}
      footer={(
        <>
          <button className="secondary" type="button" disabled={!previewUrl || loading} onClick={() => frameRef.current?.contentWindow?.print()}>
            <Printer size={16} aria-hidden="true" /> Print
          </button>
          <button className="secondary" type="button" disabled={!previewUrl || loading} onClick={() => {
            const link = document.createElement("a");
            link.href = previewUrl;
            link.download = filename;
            link.click();
          }}>
            <Download size={16} aria-hidden="true" /> Download PDF
          </button>
          <button className="primary" type="button" disabled={!previewUrl || loading || sending} onClick={() => void emailReport()}>
            <Mail size={16} aria-hidden="true" /> {sending ? "Sending..." : "Email PDF"}
          </button>
        </>
      )}
    >
      {loading && <p className="muted">Generating report preview...</p>}
      {error && <p className="worklog-error" role="alert">{error}</p>}
      {previewUrl && <iframe className="record-report-preview" ref={frameRef} src={previewUrl} title={`${title} preview`} />}
      <span className="visually-hidden">{workLogs.length} work log entries included</span>
      {emailSuccess && (
        <div className="record-report-success-backdrop">
          <section className="record-report-success" role="alertdialog" aria-modal="true" aria-labelledby="report-success-title">
            <CheckCircle2 className="record-report-success-icon" size={48} aria-hidden="true" />
            <h2 id="report-success-title">Report Sent Successfully</h2>
            <dl>
              <dt>File</dt>
              <dd>{filename}</dd>
              <dt>Recipients</dt>
              <dd>{emailSuccess.recipients}</dd>
              <dt>Sent On</dt>
              <dd>{formatDateTime(emailSuccess.sentAt)}</dd>
            </dl>
            <button className="primary" type="button" autoFocus onClick={() => setEmailSuccess(null)}>Close</button>
          </section>
        </div>
      )}
    </Modal>
  );
}