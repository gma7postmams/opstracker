"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Mail, Printer } from "lucide-react";
import Modal from "@/components/Modal";
import { getRecordReportFilename } from "@/lib/recordReport";
import { createRecordReportPdf } from "@/lib/recordReportPdf";
import type { RecordType } from "@/lib/recordTypes";

type WorkLog = Parameters<typeof createRecordReportPdf>[1][number];
type SystemEvent = Parameters<typeof createRecordReportPdf>[2][number];

function formatDateTime(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
        const brandingResponse = await fetch("/api/branding").catch(() => null);
        const branding = brandingResponse?.ok ? await brandingResponse.json().catch(() => ({})) : {};
        const report = await createRecordReportPdf(record, entries, JSON.parse(systemEventsKey), type as RecordType, branding);
        objectUrl = URL.createObjectURL(report.blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setWorkLogs(entries);
        setFilename(getRecordReportFilename(type as RecordType, record.refNo));
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

  const title = getRecordReportFilename(type as RecordType, record.refNo);
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