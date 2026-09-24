"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ImageUpload from "@/components/ImageUpload";
import BackupPanel from "@/components/BackupPanel";
import AdminImportPanel from "@/components/AdminImportPanel";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const KINDS: [string, string][] = [
  ["LOCATION", "Locations"], ["SHIFT", "Shifts"], ["SHOW_GROUP", "Shows / Groups"],
  ["CATEGORY", "Assistance categories"], ["ACTIVITY_TYPE", "Activity types"],
];

export default function Admin() {
  const { data: session } = useSession();
  const router = useRouter();
  const toast = useToast();
  const isAdmin = session?.user.role === "ADMIN";

  const [b, setB] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState<Record<string, string>>({});
  const [resetting, setResetting] = useState(false);

const [saving, setSaving] = useState(false);

const [ai, setAi] = useState({
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
});

const [models, setModels] = useState<string[]>([]);
const [testingAI, setTestingAI] = useState(false);


  const loadMaster = useCallback(async () => {
    const d = await (await fetch("/api/masterdata")).json();
    setRows(d.rows ?? []);
  }, []);

useEffect(() => {
  loadMaster();

  fetch("/api/admin/ai")
    .then((r) => r.json())
    .then((data) => {
      setAi({
        enabled: data.enabled ?? true,
        url: data.url ?? "http://172.30.10.76:11434",
        model: data.model ?? "gpt-oss:20b",
        timeout: data.timeout ?? 30000,

        maco: {
          enabled: data.maco?.enabled ?? true,
          model: data.maco?.model ?? "qwen3:8b",
          temperature: data.maco?.temperature ?? 0.2,
          searchRecords: data.maco?.searchRecords ?? true,
          showRelatedRecords:
            data.maco?.showRelatedRecords ?? true,
        },
      });
    });

  fetch("/api/admin/ai/test")
    .then((r) => r.json())
    .then((data) => {
      if (data.ok) {
        setModels(data.models);
      }
    });
}, [loadMaster]);

async function saveAI() {
  const res = await fetch("/api/admin/ai", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ai),
  });

  if (res.ok) {
    toast("AI settings saved");
  } else {
    toast("Unable to save AI settings");
  }
}

async function testAI() {
  try {
    setTestingAI(true);

    const res = await fetch("/api/admin/ai/test");
    const data = await res.json();

    if (data.ok) {
      setModels(data.models);

      if (
        data.models.length &&
        !data.models.includes(ai.model)
      ) {
        setAi({
          ...ai,
          model: data.models[0],
        });
      }

      toast(`Connected. Found ${data.models.length} models.`);
    } else {
      toast("Connection failed");
    }
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
    <div className="page">
      {b && (
        <section className="panel spaced">
          <div className="panelhead">
            <div><h3>Branding</h3>
              <span className="muted">Shown on the sign-in screen, sidebar, and browser tab</span></div>
          </div>
          <div className="form">
            <label>Title
              <input value={b.title} maxLength={48} onChange={(e) => setB({ ...b, title: e.target.value })} />
            </label>
            <label>Tagline
              <input value={b.tagline} maxLength={60} onChange={(e) => setB({ ...b, tagline: e.target.value })} />
            </label>
            <div className="full brandassets">
              <div>
                <div className="flabel spacedbottom-sm">LOGO</div>
                <ImageUpload kind="logo" value={b.logoUrl} hint="Square PNG or SVG, up to 2 MB"
                  onChange={(url) => setB({ ...b, logoUrl: url })} />
              </div>
              <div>
                <div className="flabel spacedbottom-sm">FAVICON</div>
                <ImageUpload kind="favicon" value={b.faviconUrl} hint="32×32 or 64×64 works best"
                  onChange={(url) => setB({ ...b, faviconUrl: url })} />
              </div>
            </div>
            <div className="full row-actions">
              <button className="primary" onClick={saveBranding} disabled={saving}>
                {saving ? "Saving…" : "Save branding"}
              </button>
              <button className="secondary" onClick={() => setResetting(true)}>Reset to default</button>
            </div>
          </div>
        </section>
      )}

  <div className="grid even">

    <section className="panel spaced">
      <div className="panelhead">
        <div>
          <h3>AI Settings</h3>

          <span className="muted">
            Configure Ollama integration for writing assistance
          </span>
        </div>
      </div>

    <div className="ai-card">

    <div className="ai-status-card">
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontWeight: 600,
          marginBottom: 6,
        }}
      >
        <input
          type="checkbox"
          checked={ai.enabled}
          onChange={(e) =>
            setAi({
              ...ai,
              enabled: e.target.checked,
            })
          }
        />
        Enable AI Assistance
      </label>

      <div className="muted">
        {ai.enabled
          ? "🟢 AI writing assistance is enabled"
          : "🔴 AI writing assistance is disabled"}
      </div>
    </div>

    <label>
      Ollama URL
      <input
        value={ai.url}
        onChange={(e) =>
          setAi({
            ...ai,
            url: e.target.value,
          })
        }
      />
    </label>

    <div className="ai-status-card">
      <div>
        <strong>
          {models.length
            ? "🟢 Ollama Connected"
            : "🔴 Ollama Disconnected"}
        </strong>
      </div>

      <div className="muted">
        {models.length
          ? `${models.length} model(s) available`
          : "No models detected"}
      </div>
    </div>

    <label>
      Available Model
      <select
        value={ai.model}
        onChange={(e) =>
          setAi({
            ...ai,
            model: e.target.value,
          })
        }
      >
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <div
        className="muted"
        style={{ marginTop: 6 }}
      >
        {models.length
          ? `🟢 Connected • ${models.length} model(s) available`
          : "🔴 Not connected"}
      </div>
    </label>

    <div>
      <div className="flabel">Timeout (ms)</div>

      <input
        type="number"
        value={ai.timeout}
        onChange={(e) =>
          setAi({
            ...ai,
            timeout: Number(e.target.value),
          })
        }
      />
    </div>

    <div
      style={{
        display: "flex",
        gap: 10,
      }}
    >
      <button
        className="secondary"
        onClick={testAI}
        disabled={testingAI}
      >
        {testingAI ? "Testing..." : "Test Connection"}
      </button>

      <button
        className="primary"
        onClick={saveAI}
      >
        Save AI Settings
      </button>
    </div>


      </div>
    </section>

    <section className="panel spaced">
      <div className="panelhead">
        <div>
          <h3>🤖 MACO Configuration</h3>

          <span className="muted">
            MAMS Support Operations Tracker Copilot
          </span>
        </div>
      </div>

      <div className="ai-card">

        <div className="ai-status-card">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            <input
              type="checkbox"
              checked={ai.maco.enabled}
              onChange={(e) =>
                setAi({
                  ...ai,
                  maco: {
                    ...ai.maco,
                    enabled: e.target.checked,
                  },
                })
              }
            />

            Enable MACO
          </label>

          <div className="muted">
            {ai.maco.enabled
              ? "🟢 MACO is enabled"
              : "🔴 MACO is disabled"}
          </div>
        </div>

        <label>
          Preferred Model

          <select
            value={ai.maco.model}
            onChange={(e) =>
              setAi({
                ...ai,
                maco: {
                  ...ai.maco,
                  model: e.target.value,
                },
              })
            }
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="flabel">
            Temperature
          </div>

          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={ai.maco.temperature}
            onChange={(e) =>
              setAi({
                ...ai,
                maco: {
                  ...ai.maco,
                  temperature: Number(e.target.value),
                },
              })
            }
          />
        </div>

        <div className="ai-status-card">
          <div className="muted">
            🤖 MACO can search Technical Assistance
            and Other Tasks records, find similar
            incidents, answer workflow questions,
            and provide troubleshooting guidance.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            marginTop: 12,
          }}
        >
          <button
            className="primary"
            onClick={saveAI}
          >
            Save MACO Settings
          </button>
        </div>

      </div>
    </section>

  </div>




      <AdminImportPanel />

      <BackupPanel />


      <div className="grid even">
        {KINDS.map(([kind, label]) => {
          const items = rows.filter((r) => r.kind === kind);
          return (
            <section className="panel" key={kind}>
              <div className="panelhead"><h3>{label}</h3></div>
              <div className="adminlist">
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
      </div>

      {resetting && (
        <ConfirmDialog title="Reset branding?"
          body="Title, tagline, logo and favicon return to defaults."
          onCancel={() => setResetting(false)} onYes={resetBranding} />
      )}
    </div>
  );
}
