"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import StatusBadge from "@/components/StatusBadge";
import RecordForm from "@/components/RecordForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { statusLabel, priorityLabel } from "@/lib/recordTypes";

const STATUSES = ["OPEN", "CLOSE_PENDING", "CLOSED"];

export default function RecordDetail() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const toast = useToast();
  const isAdmin = session?.user.role === "ADMIN";

  const [r, setR] = useState<any>(null);
  const [master, setMaster] = useState<Record<string, string[]>>({});
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/records/${type}/${id}`);
    if (!res.ok) return router.push(`/${type === "assistance" ? "assistance" : "tasks"}`);
    setR(await res.json());
  }, [type, id, router]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/masterdata").then((x) => x.json()).then((d) => setMaster(d.grouped ?? {}));
  }, []);

  if (!r) return <div className="page"><div className="muted">Loading…</div></div>;

  const isAssistance = type === "assistance";

  async function patch(body: any, okMsg: string) {
    const res = await fetch(`/api/records/${type}/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const out = await res.json();
    if (!res.ok) { toast(out.error ?? "That did not work"); return; }
    toast(okMsg);
    load();
  }

  async function remove() {
    const res = await fetch(`/api/records/${type}/${id}`, { method: "DELETE" });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) { toast(out.error ?? "Could not delete"); return; }
    toast("Record deleted");
    router.push(type === "assistance" ? "/assistance" : "/tasks");
  }

const ownerName = r.owner
  ? [r.owner.firstName, r.owner.middleInitial ? r.owner.middleInitial + "." : "", r.owner.surname]
      .filter(Boolean)
      .join(" ")
  : "a deleted user";
  
const duration =   
  r.timeEnded
    ? (() => {
        const [sh, sm] = r.timeStarted.split(":").map(Number);
        const [eh, em] = r.timeEnded.split(":").map(Number);

        const start = sh * 60 + sm;
        const end = eh * 60 + em;
  
        return `${end - start} min`;
      })()
    : "Ongoing";

  const fields: [string, any][] = [
    ["Date", String(r.date).slice(0, 10)],
    ["Shift", r.shift],
    ["Location", r.location],
    ["Show / Group", r.showGroup],
    isAssistance ? ["Client", r.clientName] : ["Activity type", r.activityType],
    isAssistance ? ["Category", r.category] : ["Priority", priorityLabel(r.priority)],
    ...(isAssistance ? [["Priority", priorityLabel(r.priority)] as [string, any]] : []),
    ["Assigned to", r.assigned],
    ["Accountable", r.accountable],
    ["Time", r.timeEnded ? `${r.timeStarted} – ${r.timeEnded}` : `${r.timeStarted} – ongoing`],
    ["Duration", duration],
  ];


  return (
    <div className="page">
      <button className="secondary" onClick={() => router.back()}>← Back</button>

      <div className="grid detailgrid">
        <section className="panel">
          <div className="panelhead">
            <div><h3>{r.refNo}</h3>
              <span className="muted">
                {isAssistance ? "Technical Assistance" : "Other Task"} · entered by {ownerName}
              </span></div>
            <StatusBadge status={r.status} />
          </div>

          <div className="detail">
            {fields.map(([k, v]) => (
              <div className="field" key={k}><label>{k}</label><b>{v || "—"}</b></div>
            ))}
          </div>

	{r.status === "OPEN" && r.timeEnded && (
	  <div className="warning-hint spacedtop">
	    ⚠ This record was reopened after work had previously been completed at {r.timeEnded}.
	  </div>
	)}

          <hr />
          <div className="field">
            <label>{isAssistance ? "Problem" : "Description"}</label>
            <b>{isAssistance ? r.problem : r.description}</b>
          </div>
          {isAssistance && (
            <div className="field spacedtop"><label>Resolution</label><b>{r.resolution || "—"}</b></div>
          )}
          <div className="field spacedtop"><label>Remarks</label><b>{r.remarks || "—"}</b></div>


<hr />

<div className="toolbar flat">

  <div style={{ width: "100%" }}>
    <h4
      style={{
        marginBottom: 12,
        color: "var(--muted)",
      }}
    >
      Quick Actions
    </h4>

{r.status === "OPEN" && !r.timeEnded && (
  <div
    className="warning-hint"
    style={{ marginBottom: 10 }}
  >
    ⚠ Time Ended is required before setting this record to
    Close Pending or Closed.
  </div>
)}

  </div>


  <label className="flabel">
    STATUS

    <select
      value={r.status}
      className="action-control"
      disabled={!r.canEdit}
      onChange={(e) => {
        const status = e.target.value;

        if (
          (status === "CLOSED" ||
            status === "CLOSE_PENDING") &&
          !r.timeEnded
        ) {
          toast(
            "Please click Edit and enter Time Ended before changing this record to Close Pending or Closed."
          );
          return;
        }

        patch(
          { status },
          `Status set to ${statusLabel(status)}`
        );
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {statusLabel(s)}
        </option>
      ))}
    </select>

  </label>

  <button
    className="secondary alignend action-control"
    disabled={!r.canEdit}
    title={
      r.canEdit
        ? ""
        : r.locked
        ? "This record is locked by an administrator"
        : "Only the person who entered this record can edit it"
    }
    onClick={() => setEditing(true)}
  >
    {r.canEdit ? "✏ Edit Record" : "🔒 Edit locked"}
  </button>

  {isAdmin && (
    <button
      className="secondary alignend action-control"
      onClick={() =>
        patch(
          { locked: !r.locked },
          r.locked
            ? "Record unlocked"
            : "Record locked"
        )
      }
    >
      {r.locked
        ? "🔓 Unlock Record"
        : "🔒 Lock Record"}
    </button>
  )}

  <button
    className="secondary alignend action-control"
    disabled={!r.canEdit}
    onClick={() => setConfirm(true)}
  >
    🗑 Delete Record
  </button>

</div>

        </section>

        <section className="panel">
          <div className="panelhead"><h3>Activity history</h3></div>
          <div className="timeline">
            <div className="event"><b>{r.timeStarted} · Reported</b>
              <small>Record created by {ownerName}.</small></div>
            <div className="event"><b>Assigned</b><small>Assigned to {r.assigned}.</small></div>
            {r.timeEnded && (
              <div className="event"><b>{r.timeEnded} · Work completed</b>
                <small>Work activity completed.</small></div>
            )}
            {r.locked && (
              <div className="event"><b>Locked</b>
                <small>Locked by {r.lockedBy ? `${r.lockedBy.firstName} ${r.lockedBy.surname}` : "an administrator"} — edits disabled.</small></div>
            )}
            <div className="event"><b>Current · {statusLabel(r.status)}</b>
              <small>Last updated {String(r.updatedAt).slice(0, 10)}.</small></div>
          </div>
        </section>
      </div>

      {editing && (
        <RecordForm
          type={type as any} singular={isAssistance ? "Assistance" : "Task"}
          master={master} record={r}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); toast("Record updated"); }}
        />
      )}
      {confirm && (
        <ConfirmDialog title={`Delete ${r.refNo}?`} body="This cannot be undone."
          onCancel={() => setConfirm(false)} onYes={() => { setConfirm(false); remove(); }} />
      )}
    </div>
  );
}
