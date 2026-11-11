"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RotateCcw, Trash2 } from "lucide-react";
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
  includesUploads: boolean;
  users: RestoreCount;
  assistance: RestoreCount;
  tasks: RestoreCount;
  workLogs: RestoreCount;
  masterData: RestoreCount;
  auditLogs: RestoreCount;
};

type BackupHistoryItem = {
  filename: string;
  createdAt: string;
  source: "Manual" | "Scheduled";
  formatVersion: number;
  fileSize: number | null;
  status: "Success" | "Failed" | "Running";
  error: string | null;
  includesUploads: boolean;
  encrypted: boolean;
};

type BackupSchedule = {
  enabled: boolean;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  backupTime: string;
  weeklyDay: number | null;
  monthlyDay: number | null;
  retentionCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastStatus: "RUNNING" | "SUCCESS" | "FAILED" | null;
  lastError: string | null;
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BackupPanel() {
  const toast = useToast();
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [restoreSummary, setRestoreSummary] = useState<RestoreSummary | null>(null);

  async function refreshHistory() {
    const res = await fetch("/api/backup/history", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load backup history");
    setHistory(await res.json());
    setHistoryError("");
  }

  useEffect(() => {
    refreshHistory().catch(() => setHistoryError("Could not load backup history"));
    fetch("/api/backup/schedule", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load backup schedule");
        setSchedule(await res.json());
      })
      .catch(() => toast("Could not load backup schedule"));
  }, []);

  async function saveSchedule() {
    if (!schedule) return;
    setScheduleSaving(true);
    try {
      const res = await fetch("/api/backup/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: schedule.enabled,
          frequency: schedule.frequency,
          backupTime: schedule.backupTime,
          timezone: "Asia/Manila",
          weeklyDay: schedule.weeklyDay,
          monthlyDay: schedule.monthlyDay,
          retentionCount: schedule.retentionCount,
        }),
      });
      const out = await res.json();
      if (!res.ok) { toast(out.error ?? "Could not save schedule"); return; }
      setSchedule(out);
      toast("Backup schedule saved");
    } catch {
      toast("Could not save schedule");
    } finally {
      setScheduleSaving(false);
    }
  }

  async function download(filename: string) {
    setDownloading(true);
    try {
      const res = await fetch(`/api/backup/history/${encodeURIComponent(filename)}`);
      if (!res.ok) {
        const out = await res.json().catch(() => ({}));
        toast(out.error ?? "Backup download failed");
        return;
      }
      const blob = await res.blob();
      const name = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? filename;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast("Backup downloaded");
    } finally {
      setDownloading(false);
    }
  }

  async function createBackup() {
    setCreating(true);
    try {
      const res = await fetch("/api/backup/history", { method: "POST" });
      const out = await res.json();
      if (!res.ok) {
        toast(out.error ?? "Backup failed");
        await refreshHistory();
        return;
      }
      await refreshHistory();
      toast("Backup created");
      await download(out.filename);
    } catch {
      toast("Backup failed");
    } finally {
      setCreating(false);
    }
  }

  async function deleteBackup(filename: string) {
    const res = await fetch(`/api/backup/history/${encodeURIComponent(filename)}`, { method: "DELETE" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(out.error ?? "Could not delete backup");
      return;
    }
    setDeleteTarget(null);
    await refreshHistory();
    toast("Backup deleted");
  }

  return (
    <>
      <section className="panel spaced">
        <div className="panelhead">
          <div><h3>OpsTracker Backup &amp; restore</h3>
                <span className="muted">Export of users, records, work logs, master data, audit history, branding and uploaded files</span></div>
        </div>
        <div className="hint spacedbottom">
          Backup files contain account credentials and are stored in the persistent backup volume. Treat downloads as sensitive.
          <br />New packages include all regular files under the configured uploads directory when files are present.
          <br /><b>Merge</b> adds missing rows, reactivates matched retired master data and updates branding.
          <b> Replace</b> clears backup-managed tables first and clears pending email verification codes.
        </div>
        <div className="row-actions">
          <button className="primary" onClick={createBackup} disabled={creating || downloading}>
            {creating ? "Creating…" : "Backup Now"}
          </button>
          <button className="secondary" onClick={() => setRestoring(true)}>⇧ Restore OpsTracker Backup</button>
        </div>
        <section className="backup-last-summary spacedtop" aria-labelledby="last-backup-title">
          <div className="panelhead"><h4 id="last-backup-title">Last Backup</h4></div>
          {history[0] ? <div className="backup-last-content">
            <div className="backup-last-primary">
              <code>{history[0].filename}</code>
              <span className="backup-history-meta">
                Version {history[0].formatVersion} • {history[0].source} • {history[0].includesUploads ? "Uploads Included" : "No Uploads"} • {history[0].encrypted ? "Encrypted" : "Not encrypted"}
              </span>
            </div>
            <div className="backup-last-facts">
              <div><span>Created</span><strong>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(history[0].createdAt))}</strong></div>
              <div><span>Size</span><strong>{history[0].fileSize === null ? "Not available" : `${(history[0].fileSize / 1024 / 1024).toFixed(2)} MB`}</strong></div>
              <div><span>Status</span><strong>{history[0].status}</strong></div>
            </div>
          </div> : <p className="muted">No backups have been created yet.</p>}
        </section>
        <section className="spacedtop" aria-labelledby="backup-schedule-title">
          <div className="panelhead">
            <h4 id="backup-schedule-title">Automatic backup schedule</h4>
            <label className="row-actions">
              <input type="checkbox" checked={schedule?.enabled ?? false} disabled={!schedule}
                onChange={(event) => setSchedule((current) => current ? { ...current, enabled: event.target.checked } : current)} />
              Enabled
            </label>
          </div>
          {schedule && <>
            <div className="form">
              <label>Frequency
                <select value={schedule.frequency} onChange={(event) => setSchedule({ ...schedule, frequency: event.target.value as BackupSchedule["frequency"] })}>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </label>
              {schedule.frequency === "WEEKLY" && <label>Day of week
                <select value={schedule.weeklyDay ?? 0} onChange={(event) => setSchedule({ ...schedule, weeklyDay: Number(event.target.value) })}>
                  {WEEKDAYS.map((day, index) => <option value={index} key={day}>{day}</option>)}
                </select>
              </label>}
              {schedule.frequency === "MONTHLY" && <label>Day of month
                <select value={schedule.monthlyDay ?? 1} onChange={(event) => setSchedule({ ...schedule, monthlyDay: Number(event.target.value) })}>
                  {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option value={day} key={day}>{day}</option>)}
                </select>
              </label>}
              <label>Backup time
                <input type="time" value={schedule.backupTime} onChange={(event) => setSchedule({ ...schedule, backupTime: event.target.value })} />
              </label>
              <div className="schedule-timezone"><span>Timezone</span><strong>Asia/Manila</strong></div>
              <label>Scheduled backup retention
                <input type="number" min={1} max={1000} value={schedule.retentionCount}
                  onChange={(event) => setSchedule({ ...schedule, retentionCount: Number(event.target.value) })} />
              </label>
            </div>
            <div className="importresult spacedtop">
              <p><b>Last run:</b> {schedule.lastRunAt ? new Date(schedule.lastRunAt).toLocaleString() : "Never"}</p>
              <p><b>Next run:</b> {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : "Not scheduled"}</p>
              <p><b>Last status:</b> {schedule.lastStatus ?? "Not run"}</p>
              {schedule.lastError && <p className="err"><b>Last error:</b> {schedule.lastError}</p>}
            </div>
            <div className="row-actions spacedtop">
              <button className="primary" onClick={saveSchedule} disabled={scheduleSaving}>
                {scheduleSaving ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </>}
        </section>
        <section className="spacedtop" aria-labelledby="backup-history-title">
          <div className="panelhead"><h4 id="backup-history-title">Backup History</h4><span className="muted">{history.length} backup{history.length === 1 ? "" : "s"}</span></div>
          {historyError && <p className="err" role="alert">{historyError}</p>}
          <div className="table-wrap">
            <table className="minitable backup-history-table">
              <thead><tr><th>Backup</th><th>Created</th><th>Size</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.filename}>
                    <td className="backup-history-file">
                      <code>{item.filename}</code>
                      <span className="backup-history-meta">
                        Version {item.formatVersion} • {item.source} • {item.includesUploads ? "Uploads Included" : "No Uploads"} • {item.encrypted ? "Encrypted" : "Not encrypted"}
                      </span>
                      {item.error && <div className="err">{item.error}</div>}
                    </td>
                    <td>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</td>
                    <td>{item.fileSize === null ? "-" : `${(item.fileSize / 1024 / 1024).toFixed(2)} MB`}</td>
                    <td>{item.status}</td>
                    <td>
                      <div className="row-actions">
                        {item.status === "Success" && <>
                          <button type="button" className="secondary" title="Download backup" aria-label={`Download ${item.filename}`} disabled={downloading}
                            onClick={() => download(item.filename)}><Download size={15} /></button>
                          <button type="button" className="secondary" onClick={() => { setRestoreTarget(item.filename); setRestoring(true); }}>
                            <RotateCcw size={15} /> Restore
                          </button>
                        </>}
                        <button type="button" className="secondary" title="Delete backup" aria-label={`Delete ${item.filename}`}
                          onClick={() => setDeleteTarget(item.filename)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!history.length && !historyError && <tr><td colSpan={5} className="muted">No stored backups yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {restoring && (
        <RestoreDialog
          key={restoreTarget ?? "upload"}
          initialStoredFilename={restoreTarget ?? undefined}
          onClose={() => { setRestoring(false); setRestoreTarget(null); }}
          onSuccess={(summary) => {
            setRestoring(false);
            setRestoreTarget(null);
            setRestoreSummary(summary);
          }}
        />
      )}

      {deleteTarget && <Modal title="Delete Backup" onClose={() => setDeleteTarget(null)} width={430}
        footer={<>
          <button className="secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="primary" onClick={() => { void deleteBackup(deleteTarget); }}>Delete</button>
        </>}>
        <p><b>Filename:</b></p>
        <code style={{ overflowWrap: "anywhere" }}>{deleteTarget}</code>
        <p>This action cannot be undone.</p>
      </Modal>}

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
            <p><b>Uploaded files:</b> {restoreSummary.includesUploads ? "Included" : "Not included; existing uploads were left unchanged."}</p>
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

function RestoreDialog({ onClose, onSuccess, initialStoredFilename }: {
  onClose: () => void;
  onSuccess: (summary: RestoreSummary) => void;
  initialStoredFilename?: string;
}) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [storedFilename, setStoredFilename] = useState(initialStoredFilename ?? "");
  const [mode, setMode] = useState<RestoreSummary["mode"]>("merge");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  async function send(dryRun: boolean) {
    if (!file && !storedFilename) { toast("Choose a backup file first"); return; }
    setBusy(true);
    const fd = new FormData();
    if (file) fd.append("file", file);
    else fd.append("storedFilename", storedFilename);
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
      filename: file?.name ?? storedFilename,
      includesUploads: Boolean(preview.includesUploads),
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
            ? <button className="primary" onClick={() => send(true)} disabled={busy || (!file && !storedFilename)}>
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
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setStoredFilename(""); setPreview(null); }} />
            {storedFilename && <span className="muted">Selected stored backup: {storedFilename}</span>}
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
            <p><b>Uploaded files:</b> {preview.includesUploads ? "Included in this package" : "Not included; existing uploads remain unchanged"}</p>
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
          body={preview?.includesUploads
            ? "Backed-up database rows and uploaded files are replaced, and pending email verification codes are cleared. This cannot be undone."
            : "Backed-up database rows are replaced, and pending email verification codes are cleared. Uploaded files are left untouched."}
          onCancel={() => setConfirm(false)}
          onYes={() => { setConfirm(false); send(false); }} />
      )}
    </>
  );
}
