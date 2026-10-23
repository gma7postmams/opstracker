"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ImageUpload from "@/components/ImageUpload";
import BackupPanel from "@/components/BackupPanel";
import AdminImportPanel from "@/components/AdminImportPanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Activity, Clock3, HardDrive, Layers3, MapPin, Palette, Save, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AdminTab = "system" | "branding" | "backup";

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: "system", label: "System" },
  { id: "branding", label: "Branding" },
  { id: "backup", label: "Backup" },
];

type MasterdataKind = "LOCATION" | "SHIFT" | "SHOW_GROUP" | "CATEGORY" | "ACTIVITY_TYPE";

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
  const [adding, setAdding] = useState<Record<string, string>>({});
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
    const res = await fetch("/api/masterdata", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, value }),
    });
    const out = await res.json();
    if (!res.ok) { toast(out.fields?.value ?? out.error ?? "Could not add"); return; }
    setAdding((a) => ({ ...a, [kind]: "" }));
    loadMaster();
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
            const items = rows.filter((r) => r.kind === kind);
            const Icon = MASTERDATA_ICONS[kind];
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
                <div className="adminlist system-tile-list">
                  {items.length ? items.map((r) => (
                    <div className="adminrow" key={r.id}>
                      <span>{r.value}</span>
                      <button className="linkbtn" onClick={() => retire(r.id)}
                        title="Retire this entry — existing records keep their value">Retire</button>
                    </div>
                  )) : <div className="muted">Nothing yet.</div>}
                </div>
                <div className="addrow">
                  <input placeholder={`Add ${label.replace(/s$/, "").toLowerCase()}`}
                    value={adding[kind] ?? ""}
                    onChange={(e) => setAdding((a) => ({ ...a, [kind]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && addValue(kind)} />
                  <button className="secondary" onClick={() => addValue(kind)}>Add</button>
                </div>
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
