"use client";

import { useEffect, useState } from "react";
import Modal from "./Modal";
import SearchableMasterField from "./SearchableMasterField";

const nowHHMM = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
  canEditOriginal?: boolean;
  isAdmin: boolean;
  onMasterDataChange: (kind: "LOCATION" | "SHIFT" | "SHOW_GROUP" | "CATEGORY" | "ACTIVITY_TYPE", value: string) => void;
  onClose: () => void;
  onSaved: () => void;
}

export default function RecordForm({ type, singular, master, record, canEditOriginal = false, isAdmin, onMasterDataChange, onClose, onSaved }: Props) {
  const isAssistance = type === "assistance";

const [people, setPeople] = useState<string[]>([]);
const [errors, setErrors] = useState<Record<string, string>>({});
const [saving, setSaving] = useState(false);


  const [form, setForm] = useState<any>(() => ({
    startDate: record?.startDate
      ? String(record.startDate).slice(0, 10)
      : record?.date ? String(record.date).slice(0, 10) : todayLocal(),
    endDate: record?.endDate ? String(record.endDate).slice(0, 10) : "",
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


useEffect(() => {
  fetch("/api/users")
    .then((r) => r.json())
    .then((u) => setPeople(u.map((x: any) => x.name)));

  fetch("/api/users/me")
    .then((r) => r.json())
    .then((data) => {
      const name = data.currentUser?.name ?? "";
      if (!record && name) {
        setForm((f: any) => ({
          ...f,
          assigned: f.assigned || name,
          accountable: f.accountable || name,
        }));
      }
    });

}, []);

  // Defaults come from master data once it loads, so a new record opens with
  // the first valid option selected rather than an empty required field.
  useEffect(() => {
    if (record) return;
    let rememberedShift = "";
    try {
      rememberedShift = window.localStorage.getItem("record-form-last-shift") ?? "";
    } catch {}
    const shiftDefault = master.SHIFT?.includes(rememberedShift)
      ? rememberedShift
      : master.SHIFT?.[0] || "";
    setForm((f: any) => ({
      ...f,
      shift: f.shift || shiftDefault,
      category: f.category || master.CATEGORY?.[0] || "",
      activityType: f.activityType || master.ACTIVITY_TYPE?.[0] || "",
    }));
  }, [master, record]);

  const startAt = form.startDate && form.timeStarted
    ? new Date(`${form.startDate}T${form.timeStarted}:00`)
    : null;
  const endAt = form.endDate && form.timeEnded
    ? new Date(`${form.endDate}T${form.timeEnded}:00`)
    : null;
  const durationMinutes = startAt && endAt
    ? Math.max(0, Math.floor((endAt.getTime() - startAt.getTime()) / 60000))
    : null;
  const durationText = durationMinutes === null
    ? "Not ended"
    : durationMinutes < 60
      ? `${durationMinutes} ${durationMinutes === 1 ? "minute" : "minutes"}`
      : `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 ? ` ${durationMinutes % 60}m` : ""}`;
  const setCurrentTime = (field: "timeStarted" | "timeEnded") => {
    const now = new Date();
    set(field, `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
    if (field === "timeEnded" && !form.endDate) set("endDate", todayLocal());
  };


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});

	const payload = record && canEditOriginal
  ? {
      startDate: form.startDate,
      endDate: form.endDate || null,
      shift: form.shift,
      location: form.location,
      showGroup: form.showGroup || null,
      priority: form.priority,
      timeStarted: form.timeStarted,
      timeEnded: form.timeEnded || null,
      status: form.status,
      assigned: form.assigned,
      accountable: form.accountable,
      remarks: form.remarks,
      ...(isAssistance
    ? { clientName: form.clientName, problem: form.problem, category: form.category, resolution: form.resolution }
    : { activityType: form.activityType, description: form.description }),
    }
  : record
      ? {
          assigned: form.assigned,
          status: form.status,
          priority: form.priority,
          endDate: form.endDate || null,
          timeEnded: form.timeEnded || null,
        }
      : {
          ...form,
          endDate: form.endDate || null,
          timeEnded: form.timeEnded || null,
          showGroup: form.showGroup || null,
        };
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

        {record && !canEditOriginal ? (
          <>
            <div className="sectionlabel">Operational updates</div>
            <label>Assigned to
              <select value={form.assigned} onChange={(e) => set("assigned", e.target.value)} required>
                <option value="">Select a user</option>
                {form.assigned && !people.includes(form.assigned) && <option value={form.assigned}>{form.assigned}</option>}
                {people.map((person) => <option key={person} value={person}>{person}</option>)}
              </select>
              {err("assigned")}
            </label>
            <label>Status
              <select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {err("status")}
            </label>
            <label>End Date
              <input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
              {err("endDate")}
            </label>
            <label>End Time
              <span className="time-control">
                <input type="time" value={form.timeEnded ?? ""} onChange={(e) => set("timeEnded", e.target.value)} />
                <button type="button" className="secondary time-now" onClick={() => setCurrentTime("timeEnded")}>Now</button>
              </span>
              {err("timeEnded")}
            </label>
            <label>Priority
              <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0] + priority.slice(1).toLowerCase()}</option>)}
              </select>
              {err("priority")}
            </label>
          </>
        ) : (
          <>
        <div className="sectionlabel">Activity details</div>
        <label>Shift
          <SearchableMasterField
            kind="SHIFT"
            label="Shift"
            placeholder="Select a shift"
            options={master.SHIFT ?? []}
            value={form.shift}
            onChange={(value) => {
              set("shift", value);
              if (!record) {
                try { window.localStorage.setItem("record-form-last-shift", value); } catch {}
              }
            }}
            onCreated={onMasterDataChange}
          />{err("shift")}
        </label>
        <label>Location
          <SearchableMasterField
            kind="LOCATION"
            label="Location"
            placeholder="Select a location"
            options={master.LOCATION ?? []}
            value={form.location}
            onChange={(value) => set("location", value)}
            onCreated={onMasterDataChange}
          />{err("location")}
        </label>
        <label>Show / Group
          <SearchableMasterField
            kind="SHOW_GROUP"
            label="Show / Group"
            placeholder="Select a show or group"
            options={master.SHOW_GROUP ?? []}
            value={form.showGroup ?? ""}
            allowEmpty
            onChange={(value) => set("showGroup", value)}
            onCreated={onMasterDataChange}
          />
        </label>

        {isAssistance ? (
          <>
            <label>Client name<input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} required />{err("clientName")}</label>
            <label>Category
              <SearchableMasterField
                kind="CATEGORY"
                label="Category"
                placeholder="Select a category"
                options={master.CATEGORY ?? []}
                value={form.category}
                onChange={(value) => set("category", value)}
                onCreated={onMasterDataChange}
              />{err("category")}
            </label>

            <label className="full">Problem
              <textarea
                value={form.problem}
                onChange={(e) => set("problem", e.target.value)}
                readOnly={Boolean(record && !canEditOriginal)}
                placeholder="Describe the issue or request…"
                required
              />
              {err("problem")}
            </label>

<label className="full">
  Resolution

  <textarea
    value={form.resolution ?? ""}
    onChange={(e) =>
      set("resolution", e.target.value)
    }
    placeholder="Document the solution or action taken…"
  />

</label>

          </>
        ) : (
          <>
            <label>Activity type
              <SearchableMasterField
                kind="ACTIVITY_TYPE"
                label="Activity type"
                placeholder="Select an activity type"
                options={master.ACTIVITY_TYPE ?? []}
                value={form.activityType}
                onChange={(value) => set("activityType", value)}
                onCreated={onMasterDataChange}
              />{err("activityType")}
            </label>
            {isAdmin && <div />}

<label className="full">Description
  <textarea
    value={form.description}
    onChange={(e) => set("description", e.target.value)}
    placeholder="Describe the task performed…"
    required
  />
  {err("description")}
</label>

          </>
        )}

<label className="full">
  Remarks

  <textarea
    value={form.remarks ?? ""}
    onChange={(e) =>
      set("remarks", e.target.value)
    }
    placeholder="Additional notes, client confirmation, or follow-up..."
  />

</label>

        <div className="sectionlabel">Work timeline &amp; assignment</div>
        <label>Start Date
          <input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} required disabled={Boolean(record && !canEditOriginal)} />
          {err("startDate")}
        </label>
        <label>Start Time
          <span className="time-control">
            <input type="time" value={form.timeStarted} onChange={(e) => set("timeStarted", e.target.value)} required />
            <button type="button" className="secondary time-now" onClick={() => setCurrentTime("timeStarted")}>Now</button>
          </span>
          {err("timeStarted")}
        </label>
        <label>End Date
          <input type="date" value={form.endDate ?? ""} onChange={(e) => set("endDate", e.target.value)} />
          {err("endDate")}
        </label>
        <label>End Time
          <span className="time-control">
            <input type="time" value={form.timeEnded ?? ""} onChange={(e) => set("timeEnded", e.target.value)} />
            <button type="button" className="secondary time-now" onClick={() => setCurrentTime("timeEnded")}>Now</button>
          </span>
          {err("timeEnded")}
        </label>
        <div className="duration-display" aria-live="polite">
          <div className="duration-heading">🕒 Duration</div>
          <strong className="duration-value">{durationText}</strong>
          {durationMinutes !== null && durationMinutes > 12 * 60 && (
            <div className="duration-warning" role="status">
              <strong>⚠ Unusually long duration detected.</strong>
              <span>Please verify the start and end dates and times.</span>
            </div>
          )}
        </div>
        <label>Priority
          <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
          </select>
        </label>

	<label>Status
	  <select
	    value={form.status}

		onChange={(e) => {
		  set("status", e.target.value);
		}}

	  >
	    {STATUSES.map(([v, l]) => (
	      <option key={v} value={v}>
	        {l}
	      </option>
	    ))}
	  </select>
	  {err("status")}
	</label>

        <label>Assigned to
          <select value={form.assigned} onChange={(e) => set("assigned", e.target.value)} required>
            <option value="">Select a user</option>
            {form.assigned && !people.includes(form.assigned) && <option value={form.assigned}>{form.assigned}</option>}
            {people.map((person) => <option key={person} value={person}>{person}</option>)}
          </select>
          {err("assigned")}
        </label>
        <label>Accountable person
          <select value={form.accountable} onChange={(e) => set("accountable", e.target.value)} required>
            <option value="">Select a user</option>
            {form.accountable && !people.includes(form.accountable) && <option value={form.accountable}>{form.accountable}</option>}
            {people.map((person) => <option key={person} value={person}>{person}</option>)}
          </select>
          {err("accountable")}
        </label>
          </>
        )}
      </form>
    </Modal>
  );
}
