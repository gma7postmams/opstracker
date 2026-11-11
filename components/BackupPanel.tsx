"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./Toast";

type RestoreCount = {
  added: number;
  skipped: number;
  total: number;
};

type RestoreSummary = {
  mode: "merge" | "replace";
  filename: string;
  users: RestoreCount;
  assistance: RestoreCount;
  tasks: RestoreCount;
  workLogs: RestoreCount;
  masterData: RestoreCount;
  auditLogs: RestoreCount;
};

export default function BackupPanel() {
  const toast = useToast();
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);

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
          onSuccess={(summary) => {
            setRestoring(false);
            setRestoreSummary(summary);
          }}
        />
      )}

      {restoreSummary && (
        <Modal
          title="Restore completed"
          subtitle="The backup was restored successfully."
          onClose={() => { setRestoreSummary(null); router.refresh(); }}
          width={720}
          footer={<button className="primary" onClick={() => { setRestoreSummary(null); router.refresh(); }}>Done</button>}>
          <div className="importresult">
            <p><b>Mode:</b> {restoreSummary.mode === "merge" ? "Merge" : "Replace"}</p>
            <p><b>Backup file:</b> {restoreSummary.filename}</p>
            <table className="minitable">
              <thead><tr><th>Restored data</th><th>Added / restored</th><th>Skipped / existing</th><th>In backup</th></tr></thead>
              <tbody>
                <tr><td>Users</td><td>{restoreSummary.users.added}</td><td>{restoreSummary.users.skipped}</td><td>{restoreSummary.users.total}</td></tr>
                <tr><td>Technical assistance</td><td>{restoreSummary.assistance.added}</td><td>{restoreSummary.assistance.skipped}</td><td>{restoreSummary.assistance.total}</td></tr>
                <tr><td>Other tasks</td><td>{restoreSummary.tasks.added}</td><td>{restoreSummary.tasks.skipped}</td><td>{restoreSummary.tasks.total}</td></tr>
                <tr><td>Work logs</td><td>{restoreSummary.workLogs.added}</td><td>{restoreSummary.workLogs.skipped}</td><td>{restoreSummary.workLogs.total}</td></tr>
                <tr><td>Master data</td><td>{restoreSummary.masterData.added}</td><td>{restoreSummary.masterData.skipped}</td><td>{restoreSummary.masterData.total}</td></tr>
                <tr><td>Audit logs</td><td>{restoreSummary.auditLogs.added}</td><td>{restoreSummary.auditLogs.skipped}</td><td>{restoreSummary.auditLogs.total}</td></tr>
              </tbody>
            </table>
            <p className="muted">Restored includes newly added rows and retired master data reactivated during Merge.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

function RestoreDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (summary: RestoreSummary) => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<RestoreSummary["mode"]>("merge");
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
    toast(`Backup restored successfully (${mode === "merge" ? "Merge" : "Replace"})`);
    onSuccess({
      mode,
      filename: file.name,
      users: { added: out.usersAdded, skipped: preview.incoming.users - out.usersAdded, total: preview.incoming.users },
      assistance: { added: out.assistanceAdded, skipped: preview.incoming.assistance - out.assistanceAdded, total: preview.incoming.assistance },
      tasks: { added: out.tasksAdded, skipped: preview.incoming.tasks - out.tasksAdded, total: preview.incoming.tasks },
      workLogs: { added: out.workLogsAdded, skipped: preview.incoming.workLogs - out.workLogsAdded, total: preview.incoming.workLogs },
      masterData: { added: out.masterAdded, skipped: preview.incoming.masterData - out.masterAdded, total: preview.incoming.masterData },
      auditLogs: { added: out.auditAdded, skipped: preview.incoming.auditLogs - out.auditAdded, total: preview.incoming.auditLogs },
    });
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
            <select value={mode} onChange={(e) => { setMode(e.target.value as RestoreSummary["mode"]); setPreview(null); }}>
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
