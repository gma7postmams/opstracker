"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";

const nowHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "CRITICAL"];
const STATUSES = [
  ["OPEN", "Open"], ["CLOSE_PENDING", "Close Pending"], ["CLOSED", "Closed"],
];

interface Props {
  type: "assistance" | "tasks";
  singular: string;
  master: Record<string, string[]>;
  record?: any;
  onClose: () => void;
  onSaved: () => void;
}

export default function RecordForm({ type, singular, master, record, onClose, onSaved }: Props) {
  const isAssistance = type === "assistance";

const [people, setPeople] = useState<string[]>([]);
const [errors, setErrors] = useState<Record<string, string>>({});
const [saving, setSaving] = useState(false);

const [aiLoading, setAiLoading] = useState(false);
const [aiSuggestion, setAiSuggestion] = useState("");
const [aiEnabled, setAiEnabled] = useState(true);

  const [form, setForm] = useState<any>(() => ({
    date: record?.date ? String(record.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    shift: record?.shift ?? "",
    location: record?.location ?? "",
    showGroup: record?.showGroup ?? "",
    priority: record?.priority ?? "NORMAL",
    timeStarted: record?.timeStarted ?? nowHHMM(),
    timeEnded: record?.timeEnded ?? "",
    status: record?.status ?? "OPEN",
    assigned: record?.assigned ?? "",
    accountable: record?.accountable ?? "",
    remarks: record?.remarks ?? "",
    clientName: record?.clientName ?? "",
    problem: record?.problem ?? "",
    category: record?.category ?? "",
    resolution: record?.resolution ?? "",
    activityType: record?.activityType ?? "",
    description: record?.description ?? "",
  }));


const set = (k: string, v: any) =>
  setForm((f: any) => ({ ...f, [k]: v }));

async function improveProblem() {
  if (!form.problem?.trim()) {
    alert("Please enter a problem description first.");
    return;
  }

  try {
    setAiLoading(true);

    const res = await fetch("/api/ai/improve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: form.problem,
      }),
    });

    const data = await res.json();

    if (data.suggestion) {
      setAiSuggestion(data.suggestion);
    } else {
      alert(data.error ?? "No suggestion returned.");
    }
  } catch (err) {
    console.error(err);
    alert("AI improvement failed.");
  } finally {
    setAiLoading(false);
  }
}


useEffect(() => {
  fetch("/api/users")
    .then((r) => r.json())
    .then((u) => setPeople(u.map((x: any) => x.name)));

  fetch("/api/admin/ai")
    .then((r) => r.json())
    .then((cfg) => {
      setAiEnabled(cfg.enabled);
    });
}, []);

  // Defaults come from master data once it loads, so a new record opens with
  // the first valid option selected rather than an empty required field.
  useEffect(() => {
    setForm((f: any) => ({
      ...f,
      shift: f.shift || master.SHIFT?.[0] || "",
      location: f.location || master.LOCATION?.[0] || "",
      category: f.category || master.CATEGORY?.[0] || "",
      activityType: f.activityType || master.ACTIVITY_TYPE?.[0] || "",
    }));
  }, [master]);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const payload = { ...form, timeEnded: form.timeEnded || null, showGroup: form.showGroup || null };
    const url = record ? `/api/records/${type}/${record.id}` : `/api/records/${type}`;
    const res = await fetch(url, {
      method: record ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) return onSaved();
    const out = await res.json();
    setErrors(out.fields ?? { _: out.error ?? "Could not save" });
  }

  const err = (k: string) => errors[k] && <span className="fielderr">{errors[k]}</span>;

  return (
    <Modal
      title={`${record ? "Edit" : "New"} ${isAssistance ? "Technical Assistance" : "Other Task"}`}
      subtitle={record ? record.refNo : "Capture complete operational activity"}
      onClose={onClose}
      width={760}
      footer={
        <>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" form="recordform" disabled={saving}>
            {saving ? "Saving…" : record ? "Update record" : "Save record"}
          </button>
        </>
      }
    >
      <form id="recordform" onSubmit={submit} className="form">
        {errors._ && <div className="err">{errors._}</div>}

        <div className="sectionlabel">Activity details</div>
        <label>Date<input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />{err("date")}</label>
        <label>Shift
          <select value={form.shift} onChange={(e) => set("shift", e.target.value)}>
            {(master.SHIFT ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>{err("shift")}
        </label>
        <label>Location
          <select value={form.location} onChange={(e) => set("location", e.target.value)}>
            {(master.LOCATION ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>{err("location")}
        </label>
        <label>Show / Group
          <select value={form.showGroup ?? ""} onChange={(e) => set("showGroup", e.target.value)}>
            <option value="">— none —</option>
            {(master.SHOW_GROUP ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>

        {isAssistance ? (
          <>
            <label>Client name<input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} required />{err("clientName")}</label>
            <label>Category
              <select value={form.category} onChange={(e) => set("category", e.target.value)}>
                {(master.CATEGORY ?? []).map((v) => <option key={v}>{v}</option>)}
              </select>{err("category")}
            </label>

<label className="full">
  Problem

  <textarea
    value={form.problem}
    onChange={(e) => set("problem", e.target.value)}
    placeholder="Describe the issue or request…"
    required
  />

{aiEnabled && (
  <div style={{ marginTop: 8 }}>
    <button
      type="button"
      className="secondary"
      onClick={improveProblem}
      disabled={aiLoading}
    >
      {aiLoading ? "⏳ Improving..." : "✨ Improve with AI"}
    </button>
  </div>
)}


{aiEnabled && aiSuggestion && aiSuggestion !== form.problem && (

  <div className="ai-ready">
    <strong>✅ Suggested Improvement</strong>

    <div className="ai-preview">
      {aiSuggestion}
    </div>

    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
      <button
        type="button"
        className="primary"
        onClick={() => {
          set("problem", aiSuggestion);
          setAiSuggestion("");
        }}
      >
        Apply
      </button>

      <button
        type="button"
        className="secondary"
        onClick={() => setAiSuggestion("")}
      >
        Dismiss
      </button>
    </div>
  </div>
)}

  {err("problem")}
</label>


            <label className="full">Resolution
              <textarea value={form.resolution ?? ""} onChange={(e) => set("resolution", e.target.value)}
                placeholder="Document the solution or action taken…" />
            </label>
          </>
        ) : (
          <>
            <label>Activity type
              <select value={form.activityType} onChange={(e) => set("activityType", e.target.value)}>
                {(master.ACTIVITY_TYPE ?? []).map((v) => <option key={v}>{v}</option>)}
              </select>{err("activityType")}
            </label>
            <div />
            <label className="full">Description
              <textarea value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Describe the task performed…" required />{err("description")}
            </label>
          </>
        )}

        <label className="full">Remarks
          <textarea value={form.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)}
            placeholder="Additional notes, client confirmation, or follow-up…" />
        </label>

        <div className="sectionlabel">Time &amp; assignment</div>
        <label>Time started<input type="time" value={form.timeStarted} onChange={(e) => set("timeStarted", e.target.value)} required />{err("timeStarted")}</label>
        <label>Time ended<input type="time" value={form.timeEnded ?? ""} onChange={(e) => set("timeEnded", e.target.value)} />{err("timeEnded")}</label>
        <label>Priority
          <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
          </select>
        </label>
        <label>Status
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>{err("status")}
        </label>
        <label>Assigned to
          <input list="people" value={form.assigned} onChange={(e) => set("assigned", e.target.value)} required />
          {err("assigned")}
        </label>
        <label>Accountable person
          <input list="people" value={form.accountable} onChange={(e) => set("accountable", e.target.value)} required />
          {err("accountable")}
        </label>
        <datalist id="people">{people.map((p) => <option key={p} value={p} />)}</datalist>
      </form>
    </Modal>
  );
}
