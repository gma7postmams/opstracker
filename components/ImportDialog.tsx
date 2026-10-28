"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./Toast";
import { formatTime12Hour } from "@/lib/format";

interface Props {
  /** "self" forces every row onto the importer; "admin" honours the people columns. */
  scope: "self" | "admin";
  onClose: () => void;
  onDone: () => void;
}

export default function ImportDialog({ scope, onClose, onDone }: Props) {
  const toast = useToast();
  const [type, setType] = useState<"assistance" | "tasks" | "both">("both");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const showLocationInPreview = preview?.sample?.some((row: any) => row.type === "assistance");

  function reset(f: File | null) {
    setFile(f);
    setPreview(null);
  }

  async function run(dryRun: boolean, opts?: { type?: string }) {
    if (!file) { toast("Choose a file first"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", opts?.type ?? type);
    fd.append("scope", scope);
    fd.append("dryRun", String(dryRun));

    const res = await fetch("/api/import", { method: "POST", body: fd });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { toast(out.error ?? "Import failed"); return; }
    if (dryRun) { setPreview(out); return; }
    const breakdown = out.sheetSummaries
      ?.map((summary: any) => `${summary.sheet}: ${summary.imported} imported`)
      .join("; ");
    toast(`${out.imported} record${out.imported === 1 ? "" : "s"} imported` +
      (breakdown ? ` (${breakdown})` : "") +
      (out.failed ? `, ${out.failed} skipped` : ""));
    onDone();
  }

  // Changing scope re-validates the selected file before import.
  function changeType(next: string) {
    setType(next as "assistance" | "tasks" | "both");
    setPreview(null);
    if (file) run(true, { type: next });
  }

  return (
    <Modal
      title={scope === "self" ? "Import my records" : "Import Records (All Users)"}
      subtitle={scope === "self"
        ? "Excel or CSV — every row is logged under your name"
        : "Excel or CSV — imports may be assigned to any user"}
      onClose={onClose} width={640}
      footer={<>
        <button className="secondary" onClick={onClose}>Cancel</button>
        {!preview
          ? <button className="primary" onClick={() => run(true)} disabled={busy || !file}>
              {busy ? "Checking…" : "Preview import"}
            </button>
          : <button className="primary" onClick={() => run(false)} disabled={busy || !preview.valid}>
              {busy ? "Importing…" : preview.valid
                ? `Import ${preview.valid} record${preview.valid === 1 ? "" : "s"}`
                : "Nothing to import"}
            </button>}
      </>}>

      <div className="hint spacedbottom">
        <b>Import rules</b><br />
        <a href="/templates/OpsTracker_Import_Template.xlsx" download className="button">
          ⬇ Download Workbook Template
        </a>
        <br />
        • Accepts <code>.xlsx</code>, <code>.xlsm</code> and <code>.csv</code>, up to 10 MB.<br />
        • Imported records are owned by the importing user.<br />
        • <b>Assigned To</b> is optional. Enter a user's full name; OpsTracker attempts to match and assign that user.<br />
        • Unknown or ambiguous assignee names are left unassigned and shown as warnings.<br />
        • <b>Accountable Person</b> is ignored; during Import Mine, accountability is set to you.<br />
        • Only <b>Technical Assistance</b> and <b>Other Tasks</b> worksheets are processed. Additional worksheets, including WorkLogs, are ignored.<br />
        {scope === "self" && <>• To import work on behalf of another user, ask an administrator.<br /></>}
        • Reference numbers are generated fresh — the file does not supply them.<br />
        • Rows that fail validation are reported and skipped; the rest still import.
      </div>

      <div className="form">
        <label>Import Scope
          <select value={type} onChange={(e) => changeType(e.target.value)} disabled={busy}>
            <option value="assistance">Technical Assistance Only</option>
            <option value="tasks">Other Tasks Only</option>
            <option value="both">Both Worksheets</option>
          </select>
        </label>
        <label>File
          <input type="file"
            accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => reset(e.target.files?.[0] ?? null)} />
        </label>

      </div>

      {preview && (
        <div className="importresult">
          <div className="statline">
            {preview.format === "excel"
              ? <span className="chip">Excel · {preview.sheetUsed}</span>
              : <span className="chip">CSV</span>}
            <span className="chip">{preview.detected} row{preview.detected === 1 ? "" : "s"} found</span>
            <span className="chip ok">{preview.valid} valid</span>
            {preview.errors.length > 0 && (
              <span className="chip bad">{preview.errors.length} with problems</span>
            )}
            {preview.warnings?.length > 0 && (
              <span className="chip">{preview.warnings.length} warning{preview.warnings.length === 1 ? "" : "s"}</span>
            )}
          </div>

          {preview.sheetSummaries?.length > 0 && (
            <div className="statline" aria-label="Worksheet import summary">
              {preview.sheetSummaries.map((summary: any) => (
                <span className="chip" key={summary.sheet}>
                  {summary.sheet}: {summary.detected} found, {summary.valid} valid, {summary.failed} with problems, {summary.warnings} warnings
                </span>
              ))}
            </div>
          )}

          {preview.ignoredSheets?.length > 0 && (
            <p className="muted">Ignored worksheets: {preview.ignoredSheets.join(", ")}</p>
          )}

          {preview.overriddenColumns?.length > 0 && (
            <p className="muted">
              {preview.overriddenColumns.join(" and ")} in the file {preview.overriddenColumns.length > 1 ? "are" : "is"} ignored —
              records remain owned by {preview.importerName} and accountability is set to them.
            </p>
          )}
          {preview.unknownColumns?.length > 0 && (
            <p className="muted">Ignored columns: {preview.unknownColumns.join(", ")}</p>
          )}

          {preview.valid > 0 && preview.sample?.length > 0 && (
            <table className="minitable spacedtop">
              <thead><tr><th>Date</th>{showLocationInPreview && <th>Location</th>}<th>Started</th><th>Status</th><th>Assigned</th></tr></thead>
              <tbody>
                {preview.sample.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{String(r.startDate ?? r.date ?? "").slice(0, 10)}</td>{showLocationInPreview && <td>{r.type === "assistance" ? r.location : ""}</td>}<td>{formatTime12Hour(r.timeStarted)}</td>
                    <td>{r.status}</td><td>{r.assigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {preview.errors.length > 0 && (
            <ul className="errlist">
              {preview.errors.map((e: any, i: number) => (
                <li key={i}>{e.sheet ? `${e.sheet} · ` : ""}Row {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
          {preview.warnings?.length > 0 && (
            <ul className="errlist">
              {preview.warnings.map((warning: any, i: number) => (
                <li key={i}>
                  {warning.sheet ? `${warning.sheet} · ` : ""}Row {warning.row}: {warning.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
