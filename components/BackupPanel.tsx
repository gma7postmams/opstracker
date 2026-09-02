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
      ?? "opslog-backup.json";
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
          <div><h3>Backup &amp; restore</h3>
            <span className="muted">Full export of users, records, master data and branding</span></div>
        </div>
        <div className="hint spacedbottom">
          <b>Before you restore</b><br />
          • The backup file contains password hashes — store it somewhere private.<br />
          • Uploaded images live in <code>public/uploads</code> and are <b>not</b> inside the JSON.
          Copy that folder alongside the file for a complete backup.<br />
          • <b>Merge</b> adds anything missing and leaves existing rows untouched.
          <b> Replace</b> deletes all current data first.
        </div>
        <div className="row-actions">
          <button className="primary" onClick={download} disabled={downloading}>
            {downloading ? "Preparing…" : "⇩ Download backup"}
          </button>
          <button className="secondary" onClick={() => setRestoring(true)}>⇧ Restore from backup</button>
        </div>
      </section>

      {restoring && (
        <RestoreDialog
          onClose={() => setRestoring(false)}
          onDone={() => { setRestoring(false); router.refresh(); }}
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
    toast(`Restored — ${out.usersAdded} user(s), ${out.assistanceAdded} assistance, ${out.tasksAdded} task(s)`);
    onDone();
  }

  return (
    <>
      <Modal title="Restore from backup" subtitle="Check the summary before committing"
        onClose={onClose} width={600}
        footer={<>
          <button className="secondary" onClick={onClose}>Cancel</button>
          {!preview
            ? <button className="primary" onClick={() => send(true)} disabled={busy || !file}>
                {busy ? "Reading…" : "Check file"}
              </button>
            : <button className={`primary${mode === "replace" ? " destructive" : ""}`}
                onClick={() => mode === "replace" ? setConfirm(true) : send(false)} disabled={busy}>
                {busy ? "Restoring…" : mode === "replace" ? "Replace all data" : "Merge into database"}
              </button>}
        </>}>
        <div className="form">
          <label className="full">Backup file
            <input type="file" accept="application/json,.json"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
          </label>
          <label className="full">Mode
            <select value={mode} onChange={(e) => { setMode(e.target.value); setPreview(null); }}>
              <option value="merge">Merge — add what is missing, keep existing rows</option>
              <option value="replace">Replace — delete all current data first</option>
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
                <tr><td>Users</td><td>{preview.incoming.users}</td><td>{preview.existing.users}</td></tr>
                <tr><td>Assistance</td><td>{preview.incoming.assistance}</td><td>{preview.existing.assistance}</td></tr>
                <tr><td>Tasks</td><td>{preview.incoming.tasks}</td><td>{preview.existing.tasks}</td></tr>
              </tbody>
            </table>
            {mode === "replace" && (
              <div className="err spacedtop">
                Replace deletes all {preview.existing.users + preview.existing.assistance + preview.existing.tasks} existing
                row(s) before loading the backup. This cannot be undone.
              </div>
            )}
          </div>
        )}
      </Modal>

      {confirm && (
        <ConfirmDialog
          title="Replace all data?"
          body="Every user, record and master-data entry is deleted first, then the backup is loaded."
          onCancel={() => setConfirm(false)}
          onYes={() => { setConfirm(false); send(false); }} />
      )}
    </>
  );
}
