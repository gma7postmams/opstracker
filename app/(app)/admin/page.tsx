"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ImageUpload from "@/components/ImageUpload";
import BackupPanel from "@/components/BackupPanel";
import AdminImportPanel from "@/components/AdminImportPanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { Activity, Bot, CheckCircle2, CircleAlert, Clock3, FlaskConical, HardDrive, Layers3, MapPin, Palette, Save, Server, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AISettings = {
  enabled: boolean;
  url: string;
  model: string;
  timeout: number;
  maco: {
    enabled: boolean;
    model: string;
    temperature: number;
    searchRecords: boolean;
    showRelatedRecords: boolean;
  };
};

type AdminTab = "system" | "ai-maco" | "branding" | "backup";

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: "system", label: "System" },
  { id: "ai-maco", label: "AI & MACO" },
  { id: "branding", label: "Branding" },
  { id: "backup", label: "Backup" },
];

const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: true,
  url: "http://172.30.10.76:11434",
  model: "gpt-oss:20b",
  timeout: 30000,
  maco: {
    enabled: true,
    model: "qwen3:8b",
    temperature: 0.2,
    searchRecords: true,
    showRelatedRecords: true,
  },
};

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
  const [ai, setAi] = useState<AISettings>(DEFAULT_AI_SETTINGS);
  const [models, setModels] = useState<string[]>([]);
  const [testingAI, setTestingAI] = useState(false);
  const [savingAI, setSavingAI] = useState(false);
  const [aiConnection, setAiConnection] = useState<"unknown" | "connected" | "failed">("unknown");

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

  fetch("/api/admin/ai")
    .then((res) => res.json())
    .then((data) => setAi({
      enabled: data.enabled ?? DEFAULT_AI_SETTINGS.enabled,
      url: data.url ?? DEFAULT_AI_SETTINGS.url,
      model: data.model ?? DEFAULT_AI_SETTINGS.model,
      timeout: data.timeout ?? DEFAULT_AI_SETTINGS.timeout,
      maco: {
        enabled: data.maco?.enabled ?? DEFAULT_AI_SETTINGS.maco.enabled,
        model: data.maco?.model ?? DEFAULT_AI_SETTINGS.maco.model,
        temperature: data.maco?.temperature ?? DEFAULT_AI_SETTINGS.maco.temperature,
        searchRecords: data.maco?.searchRecords ?? DEFAULT_AI_SETTINGS.maco.searchRecords,
        showRelatedRecords: data.maco?.showRelatedRecords ?? DEFAULT_AI_SETTINGS.maco.showRelatedRecords,
      },
    }))
    .catch(() => toast("Could not load AI settings"));

  fetch("/api/admin/ai/test")
    .then((res) => res.json())
    .then((data) => {
      if (data.ok) {
        setModels(data.models ?? []);
        setAiConnection("connected");
      } else {
        setAiConnection("failed");
      }
    })
    .catch(() => setAiConnection("failed"));

}, [loadMaster]);

  async function saveAI() {
    setSavingAI(true);
    try {
      const res = await fetch("/api/admin/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ai),
      });
      if (!res.ok) {
        toast("Unable to save AI settings");
        return;
      }
      toast("AI settings saved");
    } catch {
      toast("Unable to save AI settings");
    } finally {
      setSavingAI(false);
    }
  }

  async function testAI() {
    setTestingAI(true);
    try {
      const res = await fetch("/api/admin/ai/test");
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setModels([]);
        setAiConnection("failed");
        toast("Connection failed");
        return;
      }
      const availableModels = data.models ?? [];
      setModels(availableModels);
      setAiConnection("connected");
      toast(`Connected. Found ${availableModels.length} models.`);
    } catch {
      setModels([]);
      setAiConnection("failed");
      toast("Connection failed");
    } finally {
      setTestingAI(false);
    }
  }

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

      {activeTab === "ai-maco" && <div className="grid even admin-ai-panels">
        <section className="panel admin-ai-settings-panel">
          <div className="panelhead">
            <div className="admin-ai-heading">
              <span className="admin-ai-icon"><Server size={17} /></span>
              <div><h3>AI Settings</h3>
                <span className="muted">Configure Ollama writing assistance</span></div>
            </div>
            <span className={`chip ${aiConnection === "connected" ? "ok" : aiConnection === "failed" ? "bad" : ""}`}>
              {aiConnection === "connected" ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
              {aiConnection === "connected" ? `Connected · ${models.length} models` : aiConnection === "failed" ? "Disconnected" : "Not tested"}
            </span>
          </div>

          <div className="admin-ai-grid">
            <label className="admin-ai-toggle full">
              <input type="checkbox" checked={ai.enabled}
                onChange={(e) => setAi({ ...ai, enabled: e.target.checked })} />
              <span><b>Enable AI Assistance</b><small>Allow AI-powered writing assistance in record forms.</small></span>
            </label>
            <label className="admin-ai-field full">Ollama URL
              <input type="url" value={ai.url}
                onChange={(e) => setAi({ ...ai, url: e.target.value })} />
            </label>
            <label className="admin-ai-field">Model
              <select value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })}>
                {[...new Set([ai.model, ...models])].filter(Boolean).map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </label>
            <label className="admin-ai-field">Timeout (ms)
              <input type="number" min="1" step="1000" value={ai.timeout}
                onChange={(e) => setAi({ ...ai, timeout: Number(e.target.value) })} />
            </label>
            <div className="admin-ai-actions full">
              <button className="secondary" onClick={testAI} disabled={testingAI}>
                <FlaskConical size={15} />{testingAI ? "Testing..." : "Test Connection"}
              </button>
              <button className="primary" onClick={saveAI} disabled={savingAI}>
                <Save size={15} />{savingAI ? "Saving..." : "Save AI Settings"}
              </button>
            </div>
            <p className="admin-ai-note full">Connection tests use the saved Ollama URL. Save changes before testing a new URL.</p>
          </div>
        </section>

        <section className="panel admin-maco-panel">
          <div className="panelhead">
            <div className="admin-ai-heading">
              <span className="admin-ai-icon maco"><Bot size={17} /></span>
              <div><h3>MACO Configuration</h3>
                <span className="muted">MAMS Support Operations Tracker Copilot</span></div>
            </div>
          </div>

          <div className="admin-ai-grid">
            <label className="admin-ai-toggle full">
              <input type="checkbox" checked={ai.maco.enabled}
                onChange={(e) => setAi({ ...ai, maco: { ...ai.maco, enabled: e.target.checked } })} />
              <span><b>Enable MACO</b><small>Make the support operations copilot available.</small></span>
            </label>
            <label className="admin-ai-field">Model
              <select value={ai.maco.model}
                onChange={(e) => setAi({ ...ai, maco: { ...ai.maco, model: e.target.value } })}>
                {[...new Set([ai.maco.model, ...models])].filter(Boolean).map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </label>
            <label className="admin-ai-field">Temperature
              <input type="number" min="0" max="1" step="0.1" value={ai.maco.temperature}
                onChange={(e) => setAi({ ...ai, maco: { ...ai.maco, temperature: Number(e.target.value) } })} />
            </label>
            <label className="admin-ai-toggle full">
              <input type="checkbox" checked={ai.maco.searchRecords}
                onChange={(e) => setAi({ ...ai, maco: { ...ai.maco, searchRecords: e.target.checked } })} />
              <span><b>Search Records</b><small>Allow MACO to search assistance and task records.</small></span>
            </label>
            <label className="admin-ai-toggle full">
              <input type="checkbox" checked={ai.maco.showRelatedRecords}
                onChange={(e) => setAi({ ...ai, maco: { ...ai.maco, showRelatedRecords: e.target.checked } })} />
              <span><b>Show Related Records</b><small>Include related records with MACO responses.</small></span>
            </label>
            <div className="admin-ai-actions full">
              <button className="primary" onClick={saveAI} disabled={savingAI}>
                <Save size={15} />{savingAI ? "Saving..." : "Save MACO Settings"}
              </button>
            </div>
          </div>
        </section>
      </div>}

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
        .admin-ai-settings-panel { border-top: 3px solid var(--card-b-fg); }
        .admin-maco-panel { border-top: 3px solid var(--card-c-fg); }
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
        .admin-ai-panels { grid-template-columns: minmax(0, 1fr); align-items: stretch; max-width: 960px; }
        .admin-ai-panels > .panel { min-width: 0; }
        .admin-ai-heading { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .admin-ai-icon { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 9px; color: var(--accent); background: var(--pill-blue-bg); }
        .admin-ai-icon.maco { color: var(--card-c-fg); background: var(--card-c-bg); }
        .admin-ai-panels .panelhead { align-items: flex-start; }
        .admin-ai-panels .chip { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
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
          .admin-page .grid.even, .admin-ai-panels { grid-template-columns: minmax(0, 1fr); }
        }
        @media (max-width: 900px) { .system-masterdata-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px) { .system-masterdata-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 560px) { .admin-ai-grid { grid-template-columns: minmax(0, 1fr); } .admin-ai-grid .full { grid-column: auto; } }
      `}</style>
    </div>
  );
}
