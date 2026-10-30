"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, XCircle } from "lucide-react";
import Modal from "./Modal";
import { useToast } from "./Toast";

type PreviewRecordType = "assistance" | "tasks";

const PREVIEW_SHEET_NAMES: Record<PreviewRecordType, string> = {
  assistance: "Technical Assistance",
  tasks: "Other Tasks",
};

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
  const previewRecordTypes: PreviewRecordType[] = type === "both" ? ["assistance", "tasks"] : [type];
  const previewSheets = preview ? previewRecordTypes.map((recordType) => {
    const sheetName = PREVIEW_SHEET_NAMES[recordType];
    const summary = preview.sheetSummaries?.find((item: any) => item.sheet === sheetName)
      ?? (type !== "both" ? preview.sheetSummaries?.find((item: any) => item.sheet === "CSV") : undefined);
    return {
      recordType,
      sheetName,
      summary,
    };
  }) : [];
  const warningCount = preview?.warnings?.length ?? 0;
  const errorCount = preview?.errors?.length ?? 0;

  const previewStatus = preview && preview.valid > 0
    ? errorCount > 0 || warningCount > 0
      ? {
          kind: "review",
            title: "Review Recommended",
          message: `${preview.valid} record${preview.valid === 1 ? "" : "s"} can be imported.` +
            (errorCount > 0 ? ` ${errorCount} invalid row${errorCount === 1 ? " will" : "s will"} be skipped.` : "") +
            (warningCount > 0 ? ` ${warningCount} warning${warningCount === 1 ? "" : "s"} detected.` : ""),
        }
      : {
          kind: "ready",
          title: "Ready to Import",
          message: `${preview.valid} record${preview.valid === 1 ? "" : "s"} will be imported successfully.`,
        }
    : {
        kind: "blocked",
        title: errorCount > 0 ? "Import Blocked" : "Nothing to Import",
        message: errorCount > 0
          ? `${errorCount} row${errorCount === 1 ? " contains" : "s contain"} errors. Fix the errors to continue.`
          : "No valid records were found in this file.",
      };

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
      title={scope === "self" ? "Import My Records" : "Import Records (All Users)"}
      subtitle={scope === "admin" ? "Excel or CSV; records may be assigned to any user" : undefined}
      onClose={onClose} width={640}
      footer={<>
        <button className="secondary" onClick={onClose}>Cancel</button>
        {!preview
          ? <button className="primary" onClick={() => run(true)} disabled={busy || !file}>
              {busy ? "Checking…" : "Preview Import"}
            </button>
          : <button className="primary" onClick={() => run(false)} disabled={busy || !preview.valid}>
              {busy ? "Importing…" : preview.valid
                ? `Import ${preview.valid} record${preview.valid === 1 ? "" : "s"}`
                : "Nothing to import"}
            </button>}
      </>}>

      <a href="/templates/OpsTracker_Import_Template.xlsx" download className="import-template-link">
        <Download size={16} aria-hidden="true" /> Download Workbook Template
      </a>

      <div className="form single import-form">
        <label>Import Scope
          <select value={type} onChange={(e) => changeType(e.target.value)} disabled={busy}>
            <option value="assistance">Technical Assistance Only</option>
            <option value="tasks">Other Tasks Only</option>
            <option value="both">Technical Assistance &amp; Other Tasks</option>
          </select>
        </label>
        <div className="import-file-field">
          <label htmlFor="import-file">Upload File</label>
          <div className="import-file-control">
            <input id="import-file" className="import-file-input" type="file"
            accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => reset(e.target.files?.[0] ?? null)} />
            <label className="import-file-browse" htmlFor="import-file">Browse Files</label>
            <span className="import-file-name" aria-live="polite">{file?.name ?? "No file selected"}</span>
          </div>
          <span className="muted import-file-help">Excel or CSV, up to 10 MB</span>
        </div>
      </div>

      <section className="import-notes" aria-labelledby="import-notes-title">
        <h4 id="import-notes-title">Important Notes</h4>
        <ul>
          {scope === "admin"
            ? <li>Accountable Person is matched from the workbook when possible; blank or unmatched values default to the importing administrator.</li>
            : <li>Accountable Person is always your account; workbook values are ignored.</li>}
          <li>Validation is performed before import.</li>
          <li>Invalid rows are skipped and reported.</li>
        </ul>
      </section>

      {preview && (
        <div className="importresult">
          <section className={`import-status import-status-${previewStatus.kind}`} role="status">
            <div className="import-status-message">
              {previewStatus.kind === "ready"
                ? <CheckCircle2 size={21} aria-hidden="true" />
                : previewStatus.kind === "review"
                  ? <AlertTriangle size={21} aria-hidden="true" />
                  : <XCircle size={21} aria-hidden="true" />}
              <div>
                <h4>{previewStatus.title}</h4>
                <p>{previewStatus.message}</p>
              </div>
            </div>
            <div className="import-accountability">
              {scope === "admin" ? <>
                <span>Accountable Person</span>
                <strong>Matched from workbook when possible.</strong>
                <span>Fallback</span>
                <strong>Importing Administrator ({preview.importerName})</strong>
              </> : <>
                <span>Accountable</span>
                <strong>{preview.importerName} <span>(Importer)</span></strong>
              </>}
            </div>
          </section>

          <div className="import-summary-grid" aria-label="Import summary">
            <div className="import-summary-card"><span>Total Rows</span><strong>{preview.detected}</strong></div>
            <div className="import-summary-card import-summary-valid"><span>Valid Rows</span><strong>{preview.valid}</strong></div>
            <div className="import-summary-card import-summary-warnings"><span>Warnings</span><strong>{warningCount}</strong></div>
            <div className="import-summary-card import-summary-errors"><span>Errors</span><strong>{errorCount}</strong></div>
          </div>

          {previewSheets.map(({ recordType, sheetName, summary }) => (
            <section className="import-sheet-preview" key={recordType}>
              <header className="import-sheet-heading">
                <h4>{sheetName}</h4>
                <p>
                  {(summary?.detected ?? 0) === 0
                    ? "No records found"
                    : `${summary?.valid ?? 0} valid record${summary?.valid === 1 ? "" : "s"} ready for import`}
                </p>
              </header>
            </section>
          ))}

          <section className="import-feedback-section" aria-labelledby="import-matches-title">
            <h4 id="import-matches-title">Valid User Matches</h4>
            <div className="import-match-groups">
              <div>
                <strong>Assigned To</strong>
                {preview.assignedMatches?.length
                  ? <ul>{preview.assignedMatches.map((match: any) => (
                      <li key={match.name}>{match.name} <span>({match.count} valid {match.count === 1 ? "row" : "rows"})</span></li>
                    ))}</ul>
                  : <p className="import-feedback-empty">No valid matches.</p>}
              </div>
              {scope === "admin" && <div>
                <strong>Accountable Person</strong>
                {preview.accountableMatches?.length
                  ? <ul>{preview.accountableMatches.map((match: any) => (
                      <li key={match.name}>{match.name} <span>({match.count} valid {match.count === 1 ? "row" : "rows"})</span></li>
                    ))}</ul>
                  : <p className="import-feedback-empty">No valid matches.</p>}
              </div>}
            </div>
          </section>

          {scope === "admin" && preview.accountabilityDiagnostics?.length > 0 && (
            <details className="import-feedback-section import-accountability-diagnostics">
              <summary>Temporary Accountability Diagnostics · Scope: {preview.scope} ({preview.accountabilityDiagnostics.length} rows)</summary>
              <ul>
                {preview.accountabilityDiagnostics.map((diagnostic: any) => (
                  <li key={`${diagnostic.sheet}-${diagnostic.row}`}>
                    <strong>{diagnostic.sheet} · Row {diagnostic.row}</strong>
                    <p>Workbook Accountable Person: {diagnostic.workbookValue || "(blank)"}</p>
                    <p>Matched User: {diagnostic.matchedUser ?? "No match"}</p>
                    <p>Matched User ID: {diagnostic.matchedUserId ?? "None"}</p>
                    <p>Match Count: {diagnostic.matchCount}</p>
                    <p>Warning Generated: {diagnostic.warningGenerated ? "Yes" : "No"}</p>
                    <p>Validated Accountable: {diagnostic.validatedAccountable ?? "Not validated (invalid row)"}</p>
                    <p>Final Accountable (would save): {diagnostic.finalAccountable ?? "Not saved (invalid row)"}</p>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <section className="import-feedback-section import-warnings-section" aria-labelledby="import-warnings-title">
            <h4 id="import-warnings-title">Warnings ({warningCount})</h4>
            {warningCount > 0 ? (
              <ul>
                {preview.warnings.map((warning: any, index: number) => (
                  <li key={`${warning.sheet ?? ""}-${warning.row}-${index}`}>
                    <AlertTriangle size={16} aria-hidden="true" />
                    <div>
                      <strong>{warning.sheet ? `${warning.sheet} · ` : ""}Row {warning.row}</strong>
                      <p>{warning.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="import-feedback-empty">No warnings.</p>}
          </section>

          <section className="import-feedback-section import-errors-section" aria-labelledby="import-errors-title">
            <h4 id="import-errors-title">Errors ({errorCount})</h4>
            {errorCount > 0 ? (
              <ul>
                {preview.errors.map((error: any, index: number) => (
                  <li key={`${error.sheet ?? ""}-${error.row}-${index}`}>
                    <XCircle size={16} aria-hidden="true" />
                    <div>
                      <strong>{error.sheet ? `${error.sheet} · ` : ""}Row {error.row}</strong>
                      <p>{error.message}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="import-feedback-empty">No errors.</p>}
          </section>

          {(preview.ignoredSheets?.length > 0 || preview.overriddenColumns?.length > 0 || preview.unknownColumns?.length > 0) && (
            <div className="import-preview-notes">
              {preview.ignoredSheets?.length > 0 && <p>Ignored worksheets: {preview.ignoredSheets.join(", ")}</p>}
              {preview.overriddenColumns?.length > 0 && (
                <p>{preview.overriddenColumns.join(" and ")} in the file {preview.overriddenColumns.length > 1 ? "are" : "is"} ignored.</p>
              )}
              {preview.unknownColumns?.length > 0 && <p>Ignored columns: {preview.unknownColumns.join(", ")}</p>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
