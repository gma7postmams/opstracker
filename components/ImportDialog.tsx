"use client";

import { useState } from "react";
import Modal from "./Modal";
import { useToast } from "./Toast";

interface Props {
  /** "self" forces every row onto the importer; "admin" honours the people columns. */
  scope: "self" | "admin";
  /** Set by the record pages so the dialog imports into that page's table only. */
  fixedType?: "assistance" | "tasks";
  onClose: () => void;
  onDone: () => void;
}

export default function ImportDialog({ scope, fixedType, onClose, onDone }: Props) {
  const toast = useToast();
  const [type, setType] = useState(fixedType ?? "assistance");
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  function reset(f: File | null) {
    setFile(f);
    setSheet("");
    setPreview(null);
  }

  async function run(dryRun: boolean, opts?: { type?: string; sheet?: string }) {
    if (!file) { toast("Choose a file first"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", opts?.type ?? type);
    fd.append("scope", scope);
    fd.append("dryRun", String(dryRun));
    const s = opts?.sheet ?? sheet;
    if (s) fd.append("sheet", s);

    const res = await fetch("/api/import", { method: "POST", body: fd });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { toast(out.error ?? "Import failed"); return; }
    if (dryRun) { setPreview(out); return; }
    toast(`${out.imported} record${out.imported === 1 ? "" : "s"} imported` +
      (out.failed ? `, ${out.failed} skipped` : ""));
    onDone();
  }

  function pickSheet(name: string) {
    setSheet(name);
    run(true, { sheet: name });
  }

  // Changing the record type re-validates the file already chosen, rather than
  // clearing the preview and leaving no way to re-run it.
  function changeType(next: string) {
    setType(next as any);
    setPreview(null);
    if (file) run(true, { type: next });
  }

  const label = type === "assistance" ? "Technical Assistance" : "Other Tasks";

  return (
    <Modal
      title={scope === "self" ? `Import my ${label.toLowerCase()}` : "Import records"}
      subtitle={scope === "self"
        ? "Excel or CSV — every row is logged under your name"
        : "Excel or CSV — the Assigned To and Accountable columns are honoured"}
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
        • Accepts <code>.xlsx</code>, <code>.xlsm</code> and <code>.csv</code>, up to 10 MB.<br />
        {scope === "self" ? (
          <>
            • Every row is assigned and accountable to <b>you</b> — any people columns
            in the file are ignored.<br />
            • To import work done by other people, ask an administrator.<br />
          </>
        ) : (
          <>
            • <b>Assigned To</b> and <b>Accountable Person</b> are read from the file.<br />
            • Rows without those columns fall back to your name.<br />
          </>
        )}
        • Records are owned by you either way, so you can correct them afterwards.<br />
        • Reference numbers are generated fresh — the file does not supply them.<br />
        • Rows that fail validation are reported and skipped; the rest still import.
      </div>

      <div className="form">
        {!fixedType && (
          <label>Record type
            <select value={type} onChange={(e) => changeType(e.target.value)} disabled={busy}>
              <option value="assistance">Technical Assistance</option>
              <option value="tasks">Other Tasks</option>
            </select>
          </label>
        )}
        <label className={fixedType ? "full" : ""}>File
          <input type="file"
            accept=".xlsx,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => reset(e.target.files?.[0] ?? null)} />
        </label>

        {preview?.sheets?.length > 1 && (
          <label className="full">Sheet
            <select value={preview.sheetUsed ?? ""} onChange={(e) => pickSheet(e.target.value)} disabled={busy}>
              {preview.sheets.map((s: any) => (
                <option key={s.name} value={s.name}>{s.name} ({s.rowCount} rows)</option>
              ))}
            </select>
            <span className="muted">This workbook has several tabs — pick the one holding the log.</span>
          </label>
        )}
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
          </div>

          {preview.overriddenColumns?.length > 0 && (
            <p className="muted">
              {preview.overriddenColumns.join(" and ")} in the file {preview.overriddenColumns.length > 1 ? "are" : "is"} ignored —
              every row will be logged under {preview.importerName}.
            </p>
          )}
          {preview.unknownColumns?.length > 0 && (
            <p className="muted">Ignored columns: {preview.unknownColumns.join(", ")}</p>
          )}

          {preview.valid > 0 && preview.sample?.length > 0 && (
            <table className="minitable spacedtop">
              <thead><tr><th>Date</th><th>Location</th><th>Started</th><th>Status</th><th>Assigned</th></tr></thead>
              <tbody>
                {preview.sample.map((r: any, i: number) => (
                  <tr key={i}>
                    <td>{r.date}</td><td>{r.location}</td><td>{r.timeStarted}</td>
                    <td>{r.status}</td><td>{r.assigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {preview.errors.length > 0 && (
            <ul className="errlist">
              {preview.errors.map((e: any, i: number) => <li key={i}>Row {e.row}: {e.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}
