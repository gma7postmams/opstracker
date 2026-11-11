"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./Toast";

export default function BackupPanel() {
  const toast = useToast();
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    const res = await fetch("/api/backup");
    setDownloading(false);
    if (!res.ok) {
      const out = await res.json().catch(() => ({}));
      toast(out.error ?? "Backup failed");
      return;
    }
    const blob = await res.blob();
    const name = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1]
      ?? `opstracker-backup-v2-${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}.opsbackup`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
    toast("Backup downloaded");
  }

  return (
    <>
      <section className="panel spaced">
        <div className="panelhead">
          <div><h3>OpsTracker Backup &amp; restore</h3>
            <span className="muted">Export of users, records, work logs, master data, audit history and branding</span></div>
        </div>
        <div className="hint spacedbottom">
          <b>Before you restore</b><br />
          • The backup file contains password hashes and saved SMTP passwords — store it somewhere private.<br />
          • The backup contents are JSON. Uploaded images live in <code>public/uploads</code> and are <b>not</b> inside the backup.
          Copy that folder alongside the file for a complete backup.<br />
          • <b>Merge</b> adds missing rows, reactivates matched retired master data and updates branding.
          <b> Replace</b> clears backup-managed tables first and clears pending email verification codes; uploaded files remain untouched.
        </div>
        <div className="row-actions">
          <button className="primary" onClick={download} disabled={downloading}>
            {downloading ? "Preparing…" : "⇩ Download OpsTracker Backup"}
          </button>
          <button className="secondary" onClick={() => setRestoring(true)}>⇧ Restore OpsTracker Backup</button>
        </div>
      </section>

      {restoring && (
        <RestoreDialog
          onClose={() => setRestoring(false)}

          onDone={() => {
            setRestoring(false);
            router.refresh();
            window.location.reload();
          }}

        />
      )}
    </>
  );
}

function RestoreDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState("merge");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function send(dryRun: boolean) {
    if (!file) { toast("Choose a backup file first"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mode", mode);
    fd.append("dryRun", String(dryRun));
    const res = await fetch("/api/backup", { method: "POST", body: fd });
    const out = await res.json();
    setBusy(false);
    if (!res.ok) { toast(out.error ?? "Restore failed"); return; }
    if (dryRun) { setPreview(out); return; }
    toast(`Restored — ${out.usersAdded} user(s), ${out.assistanceAdded} assistance, ${out.tasksAdded} task(s), ${out.workLogsAdded} work log(s)`);
    onDone();
  }

  return (
    <>
      <Modal title="Restore OpsTracker Backup" subtitle="Check the summary before committing"
        onClose={onClose} width={600}
        footer={<>
          <button className="secondary" onClick={onClose}>Cancel</button>
          {!preview
            ? <button className="primary" onClick={() => send(true)} disabled={busy || !file}>
                {busy ? "Reading…" : "Check file"}
              </button>
            : <button className={`primary${mode === "replace" ? " destructive" : ""}`}
                onClick={() => mode === "replace" ? setConfirm(true) : send(false)} disabled={busy}>
                {busy ? "Restoring…" : mode === "replace" ? "Replace database data" : "Merge into database"}
              </button>}
        </>}>
        <div className="form">
          <label className="full">Backup file
            <input type="file" accept=".opsbackup,.json,application/json"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
            <span className="muted">Accepted formats: .opsbackup and .json (legacy).</span>
          </label>
          <label className="full">Mode
            <select value={mode} onChange={(e) => { setMode(e.target.value); setPreview(null); }}>
              <option value="merge">Merge — add what is missing, keep existing rows</option>
              <option value="replace">Replace — clear backup-managed tables first</option>
            </select>
          </label>
        </div>

        {preview && (
          <div className="importresult">
            <p className="muted">
              Taken {String(preview.exportedAt).slice(0, 19).replace("T", " ")} by {preview.exportedBy}
            </p>
            <table className="minitable">
              <thead><tr><th /><th>In backup</th><th>In database now</th></tr></thead>

	<tbody>
	  <tr>
	    <td>Users</td>
	    <td>{preview.incoming.users}</td>
	    <td>{preview.existing.users}</td>
	  </tr>

	  <tr>
	    <td>Assistance</td>
	    <td>{preview.incoming.assistance}</td>
	    <td>{preview.existing.assistance}</td>
	  </tr>

	  <tr>
	    <td>Tasks</td>
	    <td>{preview.incoming.tasks}</td>
	    <td>{preview.existing.tasks}</td>
	  </tr>

    <tr>
      <td>Work Logs</td>
      <td>{preview.incoming.workLogs}</td>
      <td>{preview.existing.workLogs}</td>
    </tr>

    <tr>
      <td>Master Data</td>
      <td>{preview.incoming.masterData}</td>
      <td>{preview.existing.masterData}</td>
    </tr>

    <tr>
      <td>Audit Logs</td>
      <td>{preview.incoming.auditLogs}</td>
      <td>{preview.existing.auditLogs}</td>
    </tr>

	</tbody>


            </table>
            {mode === "replace" && (
              <div className="err spacedtop">
                Replace removes the existing backed-up rows before loading this file. This cannot be undone.
              </div>
            )}
            {mode === "replace" && preview.format === 1 && (
              <div className="err spacedtop">
                This version 1 backup has no Work Logs. Replace will remove the {preview.existing.workLogs} existing work log(s).
              </div>
            )}
          </div>
        )}
      </Modal>

      {confirm && (
        <ConfirmDialog
          title="Replace database data?"
          body="Backed-up database rows are replaced, and pending email verification codes are cleared. Uploaded files are left untouched."
          onCancel={() => setConfirm(false)}
          onYes={() => { setConfirm(false); send(false); }} />
      )}
    </>
  );
}
