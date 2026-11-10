"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ImageUpload from "@/components/ImageUpload";
import BackupPanel from "@/components/BackupPanel";
import AdminImportPanel from "@/components/AdminImportPanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Activity, Clock3, HardDrive, Layers3, MapPin, Palette, Save, Tags, Upload, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AdminTab = "system" | "branding" | "backup";

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: "system", label: "System" },
  { id: "branding", label: "Branding" },
  { id: "backup", label: "Backup" },
];

type MasterdataKind = "LOCATION" | "SHIFT" | "SHOW_GROUP" | "CATEGORY" | "ACTIVITY_TYPE";
type MasterdataSort = "alphabetical" | "most-used" | "least-used" | "recent";
type UsageLookup = {
  value: string;
  usageCount: number;
  records: { refNo: string; recordType: string; date: string; details: string }[];
  configured: { value: string; active: boolean } | null;
};
type CsvPreview = {
  kind: MasterdataKind;
  label: string;
  fileName: string;
  csv: string;
  added: number;
  skipped: number;
  values: string[];
  skippedValues: string[];
};

const KINDS: [MasterdataKind, string][] = [
  ["LOCATION", "Locations"], ["SHIFT", "Shifts"], ["SHOW_GROUP", "Shows / Groups"],
  ["CATEGORY", "Assistance categories"], ["ACTIVITY_TYPE", "Activity types"],
];

const MASTERDATA_ICONS: Record<MasterdataKind, LucideIcon> = {
  LOCATION: MapPin,
  SHIFT: Clock3,
  SHOW_GROUP: Layers3,
  CATEGORY: Tags,
  ACTIVITY_TYPE: Activity,
};

export default function Admin() {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const isAdmin = session?.user.role === "ADMIN";

  const [b, setB] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("system");
  const [rows, setRows] = useState<any[]>([]);
  const [editing, setEditing] = useState<{ id: number; value: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [sortModes, setSortModes] = useState<Record<string, MasterdataSort>>({});
  const [usageHints, setUsageHints] = useState<Record<string, UsageLookup>>({});
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [importing, setImporting] = useState<MasterdataKind | null>(null);
  const [resetting, setResetting] = useState(false);

  const [saving, setSaving] = useState(false);

  const loadMaster = useCallback(async () => {
    const d = await (await fetch("/api/masterdata")).json();
    setRows(d.rows ?? []);
  }, []);

useEffect(() => {
  loadMaster();

  fetch("/api/branding")
    .then((res) => {
      if (!res.ok) throw new Error("Could not load branding");
      return res.json();
    })
    .then((data) => setB(data))
    .catch(() => toast("Could not load branding"));

}, [loadMaster]);

useEffect(() => {
  const controller = new AbortController();
  const timers = KINDS.map(([kind]) => {
    const value = (adding[kind] ?? "").trim();
    if (!value) return undefined;
    return window.setTimeout(() => {
      const params = new URLSearchParams({ kind, value });
      fetch(`/api/masterdata?${params}`, { signal: controller.signal })
        .then((res) => res.ok ? res.json() : null)
        .then((result) => {
          if (result) setUsageHints((hints) => ({ ...hints, [kind]: { value, ...result } }));
        })
        .catch(() => undefined);
    }, 250);
  });
  return () => {
    controller.abort();
    timers.forEach((timer) => timer !== undefined && window.clearTimeout(timer));
  };
}, [adding]);

  async function saveBranding() {
    setSaving(true);
    const res = await fetch("/api/branding", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: b.title, tagline: b.tagline, logoUrl: b.logoUrl, faviconUrl: b.faviconUrl }),
    });
    const out = await res.json();
    setSaving(false);
    if (!res.ok) { toast(out.fields?.title ?? out.error ?? "Could not save"); return; }
    setB(out);
    toast("Branding updated");
    router.refresh();   // repaint the sidebar and tab title
  }

  async function resetBranding() {
    const res = await fetch("/api/branding", { method: "DELETE" });
    setB(await res.json());
    setResetting(false);
    toast("Branding reset");
    router.refresh();
  }

  async function addValue(kind: string) {
    const value = (adding[kind] ?? "").trim();
    if (!value) return;
    const lookup = usageHints[kind];
    if (lookup?.value !== value) {
      toast("Checking existing records. Try again in a moment.");
      return;
    }
    const duplicate = rows.find((row) => row.kind === kind && row.value.trim().toLocaleLowerCase() === value.toLocaleLowerCase());
    if (duplicate) {
      toast(`Already exists. Used by ${duplicate.usageCount ?? 0} records.`);
      return;
    }
    const res = await fetch("/api/masterdata", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, value }),
    });
    const out = await res.json();
    if (!res.ok) { toast(out.fields?.value ?? out.error ?? "Could not add"); return; }
    const restored = res.status !== 201;
    setAdding((a) => ({ ...a, [kind]: "" }));
    setUsageHints((hints) => {
      const next = { ...hints };
      delete next[kind];
      return next;
    });
    await loadMaster();
    toast(restored ? "Master data value restored" : "Master data value added");
  }

  async function renameValue(id: number) {
    if (!editing || editing.id !== id) return;
    const value = editing.value.trim();
    if (!value) {
      toast("Value is required");
      return;
    }
    const duplicate = rows.find((row) => row.id !== id
      && row.value.trim().toLocaleLowerCase() === value.toLocaleLowerCase());
    if (duplicate) {
      toast("That entry already exists");
      return;
    }

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/masterdata/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const out = await res.json();
      if (!res.ok) {
        toast(out.fields?.value ?? out.error ?? "Could not rename");
        return;
      }
      setEditing(null);
      await loadMaster();
      toast(out.affectedRecords ? `Renamed value in ${out.affectedRecords} records` : "Master data value renamed");
    } catch {
      toast("Could not rename");
    } finally {
      setSavingEdit(false);
    }
  }

  async function previewCsv(kind: MasterdataKind, label: string, input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("CSV files must be 10 MB or smaller");
      input.value = "";
      return;
    }
    setImporting(kind);
    try {
      const csv = await file.text();
      const res = await fetch("/api/masterdata", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, csv, preview: true }),
      });
      const out = await res.json();
      if (!res.ok) { toast(out.fields?.kind ?? out.error ?? "Could not preview CSV"); return; }
      setCsvPreview({ kind, label, fileName: file.name, csv, ...out });
    } catch {
      toast("Could not preview CSV");
    } finally {
      setImporting(null);
      input.value = "";
    }
  }

  async function commitCsvImport() {
    if (!csvPreview) return;
    const preview = csvPreview;
    setImporting(preview.kind);
    try {
      const res = await fetch("/api/masterdata", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: preview.kind, csv: preview.csv }),
      });
      const out = await res.json();
      if (!res.ok) { toast(out.error ?? "Could not import CSV"); return; }
      setCsvPreview(null);
      toast(`CSV import complete: ${out.added} added, ${out.skipped} skipped`);
      await loadMaster();
    } catch {
      toast("Could not import CSV");
    } finally {
      setImporting(null);
    }
  }

  async function retire(id: number) {
    await fetch(`/api/masterdata/${id}`, { method: "DELETE" });
    loadMaster();
    toast("Entry retired");
  }

  if (!isAdmin) {
    return <div className="page"><div className="empty"><b>Administrators only</b>
      You do not have access to this page.</div></div>;
  }

  return (
    <div className="page admin-page">
      <div className="admin-tabs-wrap">
        <div className="admin-tabs" role="tablist" aria-label="Administration sections">
          {ADMIN_TABS.map(({ id, label }) => (
            <button
              key={id}
              id={`admin-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={activeTab === id ? "admin-panel" : undefined}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div
        className="admin-tab-content"
        id="admin-panel"
        role="tabpanel"
        aria-labelledby={`admin-tab-${activeTab}`}
        tabIndex={0}
      >
      {(activeTab === "system" || activeTab === "branding") && <section className={`admin-section admin-${activeTab}`}>
        {activeTab === "system" && <AdminImportPanel />}
        {activeTab === "branding" && b && (
          <section className="panel admin-branding-panel">
            <div className="panelhead">
              <div className="admin-ai-heading">
                <span className="admin-ai-icon"><Palette size={17} /></span>
                <div><h3>Branding</h3>
                  <span className="muted">Shown on the sign-in screen, sidebar, and browser tab</span></div>
              </div>
            </div>
            <div className="admin-ai-grid">
              <label className="admin-ai-field">Title
                <input value={b.title} maxLength={48} onChange={(e) => setB({ ...b, title: e.target.value })} />
              </label>
              <label className="admin-ai-field">Tagline
                <input value={b.tagline} maxLength={60} onChange={(e) => setB({ ...b, tagline: e.target.value })} />
              </label>
              <div className="full admin-ai-grid brandassets">
                <div className="admin-ai-field">
                  <div>Logo Upload</div>
                  <ImageUpload kind="logo" value={b.logoUrl} hint="Square PNG or SVG, up to 2 MB"
                    onChange={(url) => setB({ ...b, logoUrl: url })} />
                </div>
                <div className="admin-ai-field">
                  <div>Favicon Upload</div>
                  <ImageUpload kind="favicon" value={b.faviconUrl} hint="32×32 or 64×64 works best"
                    onChange={(url) => setB({ ...b, faviconUrl: url })} />
                </div>
              </div>
              <div className="admin-ai-actions full">
                <button className="primary" onClick={saveBranding} disabled={saving}>
                  <Save size={15} />{saving ? "Saving…" : "Save Branding"}
                </button>
                <button className="secondary" onClick={() => setResetting(true)}>Reset Branding</button>
              </div>
            </div>
          </section>
        )}
        {activeTab === "system" && <div className="system-masterdata-grid">
          {KINDS.map(([kind, label]) => {
            const sortMode = sortModes[kind] ?? "alphabetical";
            const items = rows.filter((r) => r.kind === kind).sort((a, b) => {
              if (sortMode === "most-used" && a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
              if (sortMode === "least-used" && a.usageCount !== b.usageCount) return a.usageCount - b.usageCount;
              if (sortMode === "recent" && a.id !== b.id) return b.id - a.id;
              return a.value.localeCompare(b.value, undefined, { sensitivity: "base" });
            });
            const Icon = MASTERDATA_ICONS[kind];
            const value = (adding[kind] ?? "").trim();
            const filteredItems = items.filter((r) => r.value.toLocaleLowerCase().includes(value.toLocaleLowerCase()));
            const duplicate = value ? items.find((r) => r.value.trim().toLocaleLowerCase() === value.toLocaleLowerCase()) : undefined;
            const lookup = usageHints[kind]?.value === value ? usageHints[kind] : undefined;
            const liveUsageCount = lookup?.usageCount ?? duplicate?.usageCount ?? 0;
            const retiredMatch = lookup?.configured && !lookup.configured.active ? lookup.configured : null;
            return (
              <section className="panel system-tile" key={kind}>
                <div className="panelhead system-tile-head">
                  <div className="system-tile-heading">
                    <span className="system-tile-icon"><Icon size={17} /></span>
                    <div>
                      <h3>{label}</h3>
                      <span className="muted">{items.length} {items.length === 1 ? "value" : "values"}</span>
                    </div>
                  </div>
                  <span className="system-tile-count" aria-label={`${items.length} configured values`}>{items.length}</span>
                </div>
                <div className="system-sort-tools">
                  <label className="system-sort">
                    <span>Sort by</span>
                    <select aria-label={`Sort ${label}`} value={sortMode}
                      onChange={(e) => setSortModes((modes) => ({ ...modes, [kind]: e.target.value as MasterdataSort }))}>
                      <option value="alphabetical">Alphabetical</option>
                      <option value="most-used">Most Used</option>
                      <option value="least-used">Least Used</option>
                      <option value="recent">Recently Added</option>
                    </select>
                  </label>
                  <label className={`secondary system-csv-import${importing === kind ? " is-importing" : ""}`}>
                    <Upload size={14} />{importing === kind ? "Importing…" : "Import CSV"}
                    <input type="file" accept=".csv,text/csv" disabled={importing !== null}
                      aria-label={`Import ${label} from CSV`} onChange={(e) => previewCsv(kind, label, e.currentTarget)} />
                  </label>
                </div>
                <div className="adminlist system-tile-list">
                  {filteredItems.length ? filteredItems.map((r) => (
                    <div className="adminrow" key={r.id}>
                      {editing?.id === r.id ? (
                        <div className="system-row-editor">
                          <div className="system-row-input-wrap">
                            <input autoFocus aria-label={`Rename ${r.value}`} value={editing?.value ?? ""}
                              onChange={(e) => setEditing((current) => current
                                ? { ...current, value: e.target.value }
                                : current)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") renameValue(r.id);
                                if (e.key === "Escape") setEditing(null);
                              }} />
                            {rows.some((row) => row.id !== r.id
                              && row.value.trim().toLocaleLowerCase() === (editing?.value ?? "").trim().toLocaleLowerCase())
                              && <span className="system-duplicate-warning" role="status">That entry already exists.</span>}
                          </div>
                          <div className="system-row-actions">
                            <button className="primary" onClick={() => renameValue(r.id)} disabled={savingEdit || !(editing?.value ?? "").trim()}>
                              <Save size={13} />Save
                            </button>
                            <button className="secondary" onClick={() => setEditing(null)} disabled={savingEdit}>
                              <X size={13} />Cancel
                            </button>
                          </div>
                        </div>
                      ) : <>
                        <button type="button" className="system-value-trigger"
                          aria-label={`Edit ${r.value}`} onClick={() => setEditing({ id: r.id, value: r.value })}>
                          <span className="system-value">{r.value}<small>Used by {r.usageCount ?? 0} records</small></span>
                        </button>
                        <button className="linkbtn" onClick={() => retire(r.id)}
                          title="Retire this entry — existing records keep their value">Retire</button>
                      </>}
                    </div>
                  )) : <div className="muted">{items.length ? "No matching values." : "Nothing yet."}</div>}
                </div>
                <div className="addrow">
                  <input aria-label={`Find or add ${label}`} placeholder={`Find or add ${label.toLowerCase()}`}
                    value={adding[kind] ?? ""}
                    onChange={(e) => {
                      setAdding((a) => ({ ...a, [kind]: e.target.value }));
                      setUsageHints((hints) => {
                        const next = { ...hints };
                        delete next[kind];
                        return next;
                      });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && addValue(kind)} />
                  <button className="secondary" onClick={() => addValue(kind)} disabled={!value || Boolean(duplicate) || !lookup}>
                    {retiredMatch ? "Restore" : "Add"}
                  </button>
                </div>
                {duplicate && <div className="system-duplicate-warning" role="status">
                  “{duplicate.value}” already exists. Used by {liveUsageCount} records.
                </div>}
                {!duplicate && retiredMatch && <div className="system-duplicate-warning" role="status">
                  Retired value “{retiredMatch.value}” found. Saving restores it; used by {liveUsageCount} records.
                </div>}
                {value && !lookup && <div className="system-usage-hint" role="status">Checking existing records…</div>}
                {lookup && liveUsageCount > 0 && <div className="system-usage-preview" role="status">
                  {!duplicate && <div className="system-usage-hint">Already used by {liveUsageCount} records</div>}
                  {!!lookup.records.length && <>
                    <b>Recent matching records</b>
                    <ul>{lookup.records.map((record) => (
                      <li key={`${record.recordType}-${record.refNo}`}>
                        <strong>{record.refNo}</strong><span>{record.recordType} · {record.date}</span>
                        {record.details && <small>{record.details}</small>}
                      </li>
                    ))}</ul>
                  </>}
                </div>}
                {!duplicate && lookup && liveUsageCount === 0 && !retiredMatch && <div className="system-usage-hint" role="status">
                  No existing records use this value.
                </div>}
              </section>
            );
          })}
        </div>}
      </section>}

      {activeTab === "backup" && <section className="admin-section admin-backup">
        <div className="admin-backup-card">
          <div className="panelhead">
            <div className="admin-ai-heading">
              <span className="admin-ai-icon"><HardDrive size={17} /></span>
              <div><h3>Backup &amp; Restore</h3>
                <span className="muted">Full export of users, records, master data and branding</span></div>
            </div>
          </div>
          <BackupPanel />
        </div>
      </section>}

      </div>

      {resetting && (
        <ConfirmDialog title="Reset branding?"
          body="Title, tagline, logo and favicon return to defaults."
          onCancel={() => setResetting(false)} onYes={resetBranding} />
      )}
      {csvPreview && <div className="system-import-backdrop" role="presentation">
        <section className="system-import-dialog" role="dialog" aria-modal="true" aria-labelledby="csv-preview-title">
          <div className="panelhead">
            <div><h3 id="csv-preview-title">Import {csvPreview.label}</h3>
              <span className="muted">{csvPreview.fileName}</span></div>
          </div>
          <div className="system-import-summary">
            <span><b>{csvPreview.added}</b> ready to add</span>
            <span><b>{csvPreview.skipped}</b> duplicates or blank rows to skip</span>
          </div>
          {csvPreview.values.length > 0 && <div className="system-import-values">
            <b>Values to add{csvPreview.added > csvPreview.values.length ? ` (first ${csvPreview.values.length})` : ""}</b>
            <ul>{csvPreview.values.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
          </div>}
          {csvPreview.skippedValues.length > 0 && <div className="system-import-values is-skipped">
            <b>Skipped duplicates{csvPreview.skipped > csvPreview.skippedValues.length ? ` (first ${csvPreview.skippedValues.length})` : ""}</b>
            <ul>{csvPreview.skippedValues.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
          </div>}
          <div className="system-import-actions">
            <button className="secondary" onClick={() => setCsvPreview(null)} disabled={importing !== null}>Cancel</button>
            <button className="primary" onClick={commitCsvImport} disabled={importing !== null || csvPreview.added === 0}>
              {importing === csvPreview.kind ? "Importing…" : `Add ${csvPreview.added} values`}
            </button>
          </div>
        </section>
      </div>}
      <style jsx global>{`
        .admin-page { display: grid; gap: 18px; color: var(--text); }
        .admin-tabs-wrap { min-width: 0; overflow-x: auto; }
        .admin-tabs { display: flex; width: max-content; min-width: 100%; gap: 4px; padding: 4px; border: 1px solid var(--line); border-radius: 10px; background: var(--hint-bg); }
        .admin-tabs button { flex: 0 0 auto; padding: 9px 14px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--muted); font: inherit; font-size: 13px; font-weight: 600; white-space: nowrap; cursor: pointer; transition: color 160ms ease, background 160ms ease, box-shadow 160ms ease; }
        .admin-tabs button:hover { color: var(--text); }
        .admin-tabs button[aria-selected="true"] { border-color: var(--line); background: var(--input-bg); color: var(--text); box-shadow: 0 1px 3px rgb(0 0 0 / 10%); }
        .admin-tabs button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .admin-tab-content { display: grid; align-content: start; gap: 18px; min-width: 0; }
        .admin-section { display: grid; gap: 12px; min-width: 0; }
        .admin-system .panel { border-top: 3px solid var(--card-g-fg); }
        .admin-branding-panel { border-top: 3px solid var(--card-o-fg); }
        .admin-backup-card { padding: 19px; border: 1px solid var(--line); border-top: 3px solid var(--card-y-fg); border-radius: 14px; background: var(--panel); box-shadow: var(--shadow); }
        .system-masterdata-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; gap: 14px; }
        .system-tile { display: grid; align-content: start; gap: 12px; min-width: 0; border: 1px solid var(--line); transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease; }
        .system-tile:hover { transform: translateY(-2px); border-color: var(--line2); box-shadow: 0 8px 20px rgb(0 0 0 / 8%); }
        .system-tile-head { align-items: center; gap: 10px; }
        .system-tile-heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .system-tile-heading > div { display: grid; gap: 3px; min-width: 0; }
        .system-tile-heading h3 { margin: 0; color: var(--text); font-size: 13px; font-weight: 700; }
        .system-tile-heading .muted { font-size: 11px; }
        .system-tile-icon { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border-radius: 9px; background: var(--pill-blue-bg); color: var(--accent); }
        .system-tile-count { display: grid; place-items: center; min-width: 28px; height: 28px; padding: 0 7px; border-radius: 999px; background: var(--hint-bg); color: var(--muted); font-size: 12px; font-weight: 700; }
        .system-tile-list { max-height: 220px; overflow-y: auto; overscroll-behavior: contain; }
        .system-tile .adminrow > span { min-width: 0; overflow-wrap: anywhere; }
        .system-value-trigger { min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: text; }
        .system-value-trigger:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }
        .system-row-editor { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: 7px; width: 100%; }
        .system-row-input-wrap { display: grid; gap: 4px; min-width: 0; }
        .system-row-input-wrap input { width: 100%; min-width: 0; padding: 7px 9px; border: 1px solid var(--line2); border-radius: 7px; background: var(--input-bg); color: var(--text); font: inherit; }
        .system-row-input-wrap input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
        .system-row-actions { display: flex; flex-wrap: wrap; gap: 5px; }
        .system-row-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-height: 34px; padding: 0 8px; font-size: 11px; }
        .system-sort-tools { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 7px; min-width: 0; }
        .system-sort { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--muted); font-size: 11px; }
        .system-sort select { min-width: 0; height: 34px; padding: 0 8px; border: 1px solid var(--line2); border-radius: 8px; background: var(--input-bg); color: var(--text); font: inherit; font-size: 11px; }
        .system-csv-import { position: relative; display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 36px; padding: 0 9px; border: 1px solid var(--line2); border-radius: 8px; background: var(--panel); color: var(--text); font-size: 11px; font-weight: 600; white-space: nowrap; cursor: pointer; }
        .system-csv-import:hover { background: var(--hint-bg); }
        .system-csv-import:focus-within { outline: 2px solid var(--accent); outline-offset: 2px; }
        .system-csv-import input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
        .system-csv-import.is-importing { opacity: .65; }
        .system-value { display: grid; gap: 2px; }
        .system-value small { color: var(--muted); font-size: 10px; font-weight: 400; }
        .system-duplicate-warning { color: var(--card-r-fg); font-size: 11px; line-height: 1.4; }
        .system-usage-hint { color: var(--muted); font-size: 11px; line-height: 1.4; }
        .system-usage-preview { display: grid; gap: 7px; color: var(--muted); font-size: 11px; }
        .system-usage-preview > b { color: var(--text); font-size: 11px; }
        .system-usage-preview ul, .system-import-values ul { display: grid; gap: 6px; max-height: 160px; margin: 0; padding: 0; overflow: auto; list-style: none; }
        .system-usage-preview li { display: grid; gap: 2px; padding: 7px 8px; border-left: 2px solid var(--accent); background: var(--hint-bg); }
        .system-usage-preview li strong { color: var(--text); font-size: 11px; }
        .system-usage-preview li span, .system-usage-preview li small { font-size: 10px; }
        .system-import-backdrop { position: fixed; z-index: 1000; inset: 0; display: grid; place-items: center; padding: 18px; background: rgb(0 0 0 / 55%); }
        .system-import-dialog { display: grid; gap: 14px; width: min(520px, 100%); max-height: min(720px, 90vh); padding: 18px; overflow: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--text); box-shadow: var(--shadow); }
        .system-import-dialog .panelhead { margin: 0; }
        .system-import-dialog h3 { margin: 0 0 4px; font-size: 15px; }
        .system-import-summary { display: flex; flex-wrap: wrap; gap: 8px 18px; color: var(--muted); font-size: 12px; }
        .system-import-summary b { color: var(--text); }
        .system-import-values { display: grid; gap: 7px; min-width: 0; font-size: 11px; }
        .system-import-values > b { color: var(--text); }
        .system-import-values li { overflow-wrap: anywhere; padding: 5px 7px; border-radius: 4px; background: var(--hint-bg); color: var(--text); }
        .system-import-values.is-skipped li { color: var(--muted); }
        .system-import-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
        .admin-section-title { display: grid; gap: 3px; padding: 2px 1px; }
        .admin-section-title h2 { margin: 0; color: var(--text); font-size: 16px; font-weight: 700; }
        .admin-section-title > span { font-size: 12px; }
        .admin-ai-heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .admin-ai-icon { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 9px; color: var(--accent); background: var(--pill-blue-bg); }
        .admin-ai-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 13px; }
        .admin-ai-grid .full { grid-column: 1 / -1; }
        .admin-ai-field { display: grid; align-content: start; gap: 6px; min-width: 0; color: var(--muted); font-size: 11px; font-weight: 700; }
        .admin-ai-field input, .admin-ai-field select { width: 100%; min-width: 0; min-height: 42px; padding: 9px 11px; border: 1px solid var(--line2); border-radius: 9px; background: var(--input-bg); color: var(--text); }
        .admin-ai-field input:focus, .admin-ai-field select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
        .admin-ai-toggle { display: flex; align-items: center; gap: 11px; min-width: 0; padding: 11px 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--hint-bg); color: var(--text); cursor: pointer; }
        .admin-ai-toggle input { width: 17px; height: 17px; flex: none; margin: 0; accent-color: var(--accent); }
        .admin-ai-toggle span { display: grid; gap: 3px; min-width: 0; }
        .admin-ai-toggle b { font-size: 12px; }
        .admin-ai-toggle small { color: var(--muted); font-size: 11px; line-height: 1.4; }
        .admin-ai-actions { display: flex; flex-wrap: wrap; gap: 8px; padding-top: 2px; }
        .admin-ai-actions button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; }
        .admin-ai-note { margin: -5px 0 0; color: var(--muted); font-size: 11px; line-height: 1.45; }
        .admin-page .form label > input, .admin-page .addrow input { min-width: 0; border: 1px solid var(--line2); border-radius: 9px; background: var(--input-bg); color: var(--text); }
        .admin-page .form label > input:focus, .admin-page .addrow input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
        @media (max-width: 720px) {
          .admin-page { gap: 14px; }
          .admin-page .grid.even { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 900px) {
          .system-masterdata-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) { .system-masterdata-grid { grid-template-columns: minmax(0, 1fr); } }
      `}</style>
    </div>
  );
}
