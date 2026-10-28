"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import StatusBadge from "@/components/StatusBadge";
import RecordForm from "@/components/RecordForm";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { statusLabel, priorityLabel } from "@/lib/recordTypes";
import { formatTime12Hour } from "@/lib/format";
import WorkLogTimeline from "@/components/WorkLogTimeline";

function formatElapsedDuration(startAt: Date, now: Date) {
  const totalSeconds = Math.max(0, Math.floor((now.getTime() - startAt.getTime()) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || hours || days) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

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
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  function closeActions(event: { currentTarget: HTMLButtonElement }) {
    event.currentTarget.closest("details")?.removeAttribute("open");
  }

const ownerName = r.owner
  ? [
      r.owner.firstName,
      r.owner.middleInitial
        ? r.owner.middleInitial + "."
        : "",
      r.owner.surname,
    ]
      .filter(Boolean)
      .join(" ")
  : "a deleted user";  

const startDateText = String(r.startDate).slice(0, 10);
const startAt = r.timeStarted
  ? new Date(`${startDateText}T${r.timeStarted}:00`)
  : null;
const endDateText = r.endDate ? String(r.endDate).slice(0, 10) : null;
const recordedEndAt = r.timeEnded
  ? endDateText ? new Date(`${endDateText}T${r.timeEnded}:00`) : null
  : null;
const endAt = recordedEndAt ?? (r.status === "OPEN" ? new Date() : null);
const isOngoing = r.status === "OPEN" && !recordedEndAt;
const displayDate = (date: Date) => new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", year: "numeric",
}).format(date);
const duration = startAt && endAt
  ? (() => {
      const totalMinutes = Math.max(0, Math.floor((endAt.getTime() - startAt.getTime()) / 60000));
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      if (days) return `${days}d ${hours}h ${minutes}m`;
      if (hours) return `${hours}h ${minutes}m`;
      return `${minutes}m`;
    })()
  : "—";

const historyEvents = (r.activityHistory ?? []).flatMap((entry: any) => {
  const details = entry.details ?? {};
  const at = new Date(entry.createdAt);
  const createdAt = at.toISOString();
  const actor = details.name ? ` by ${details.name}` : "";

  if (entry.action === "CREATE") {
    return [
      { id: `${entry.id}-reported`, createdAt, title: "Reported", description: `Record created by ${details.name ?? ownerName}` },
      { id: `${entry.id}-assigned`, createdAt, title: "Assigned", description: `Assigned to ${details.assigned ?? r.assigned}` },
    ];
  }
  if (entry.action === "STATUS_CHANGE") {
    const title = details.nextStatus === "CLOSE_PENDING"
      ? "Close Pending"
      : details.nextStatus === "CLOSED"
        ? "Closed"
        : "Reopened";
    const previousCompletion = details.previousEndDate && details.previousTimeEnded
      ? ` Previous completion: ${String(details.previousEndDate).slice(0, 10)} ${formatTime12Hour(details.previousTimeEnded)}.`
      : details.previousTimeEnded ? ` Previous completion time: ${formatTime12Hour(details.previousTimeEnded)}.` : "";
    const description = title === "Close Pending"
      ? "Work completed and awaiting approval"
      : title === "Closed"
        ? "Approved and closed"
        : `Manager requested additional work.${previousCompletion}`;
    return [{ id: entry.id, createdAt, title, description: `${description}${actor}` }];
  }
  if (entry.action === "ENDORSED" || entry.action === "ASSIGNMENT_CHANGE") {
    return [{
      id: entry.id,
      createdAt,
      title: "Endorsed",
      description: `Reassigned from ${details.previousAssigned || "unassigned"} to ${details.assigned}${actor}`,
    }];
  }
  return [];
});

if (!historyEvents.some((event: any) => event.title === "Reported")) {
  const createdAt = r.createdAt ?? startAt?.toISOString() ?? new Date(0).toISOString();
  historyEvents.unshift({
    id: "reported-fallback",
    createdAt,
    title: "Reported",
    description: `Record created by ${ownerName}`,
  });
  historyEvents.push({
    id: "assigned-fallback",
    createdAt,
    title: "Assigned",
    description: `Assigned to ${r.assigned}`,
  });
}

  const fields: [string, any][] = [
    ["Start Date", startDateText],
    ["Shift", r.shift],
    ...(isAssistance ? [["Location", r.location] as [string, any]] : []),
    ...(isAssistance ? [["Show / Group", r.showGroup] as [string, any]] : []),
    isAssistance ? ["Client", r.clientName] : ["Activity type", r.activityType],
    isAssistance ? ["Category", r.category] : ["Priority", priorityLabel(r.priority)],
    ...(isAssistance ? [["Priority", priorityLabel(r.priority)] as [string, any]] : []),
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
                {r.createdAt ? ` · created ${displayDate(new Date(r.createdAt))}` : ""}
              </span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <StatusBadge status={r.status} />
              {r.locked && <span className="pill blue">Locked</span>}
            </div>
          </div>

          <div className="detail">
            {fields.map(([k, v]) => (
              <div className="field" key={k}><label>{k}</label><b>{v || "—"}</b></div>
            ))}
          </div>

          <div className="detail-sections spacedtop">
            <section className="detail-section">
              <h4>Work Summary</h4>
              <div className="detail-summary">
                <div className="field"><label>Started</label><b>{startAt ? `${displayDate(startAt)} • ${formatTime12Hour(r.timeStarted)}` : "—"}</b></div>
                {isOngoing ? (
                  <div className="field"><label>Elapsed Time</label><b>{startAt ? formatElapsedDuration(startAt, now) : "—"}</b></div>
                ) : (
                  <>
                    <div className="field"><label>Ended</label><b>{endAt ? `${displayDate(endAt)} • ${formatTime12Hour(r.timeEnded)}` : "—"}</b></div>
                    <div className="field"><label>Duration</label><b>{duration}</b></div>
                  </>
                )}
              </div>
            </section>

            <section className="detail-section">
              <h4>Ownership</h4>
              <div className="detail-summary">
                <div className="field"><label>Record Owner</label><b>{ownerName}</b></div>
                <div className="field"><label>Current Assignee</label><b>{r.assigned || "—"}</b></div>
                <div className="field"><label>Accountable Person</label><b>{r.accountable || "—"}</b></div>
              </div>
            </section>
          </div>

          <hr />
          <div className="field record-copy">
            <label>{isAssistance ? "Problem" : "Description"}</label>
            <b>{isAssistance ? r.problem : r.description}</b>
          </div>
          {isAssistance && (
            <div className="field record-copy spacedtop"><label>Resolution</label><b>{r.resolution || "—"}</b></div>
          )}
          <div className="field record-copy spacedtop"><label>Remarks</label><b>{r.remarks || "—"}</b></div>


<hr />

<div className="toolbar flat quick-actions">
  <div className="quick-actions-info">
    <h4>Quick Actions</h4>
  </div>

  <details className="actions-dropdown">
    <summary className="secondary action-control actions-trigger">
      Actions <span aria-hidden="true">▼</span>
    </summary>
    <div className="actions-menu">
      {r.status === "OPEN" && (
        <button
          className="actions-menu-item"
          disabled={!r.canEdit}
          onClick={(event) => {
            closeActions(event);
            patch({ status: "CLOSE_PENDING" }, "Status set to Close Pending");
          }}
        >
          Move to Close Pending
        </button>
      )}
      {r.status === "CLOSE_PENDING" && <>
        <button
          className="actions-menu-item"
          disabled={!r.canEdit}
          onClick={(event) => {
            closeActions(event);
            patch({ status: "CLOSED" }, "Record approved and closed");
          }}
        >
          Approve &amp; Close
        </button>
        <button
          className="actions-menu-item"
          disabled={!r.canEdit}
          onClick={(event) => {
            closeActions(event);
            patch({ status: "OPEN" }, "Record reopened");
          }}
        >
          Reopen
        </button>
      </>}
      {r.status === "CLOSED" && (
        <button
          className="actions-menu-item"
          disabled={!r.canEdit}
          onClick={(event) => {
            closeActions(event);
            patch({ status: "OPEN" }, "Record reopened");
          }}
        >
          Reopen
        </button>
      )}

      <div className="actions-menu-divider" />
      <button
        className="actions-menu-item"
        disabled={!r.canEdit}
        title={r.canEdit ? "" : r.locked
          ? "This record is locked by an administrator"
          : "Only the person who entered this record can edit it"}
        onClick={(event) => {
          closeActions(event);
          setEditing(true);
        }}
      >
        Edit Record
      </button>

      {isAdmin && (
        <button
          className="actions-menu-item"
          onClick={(event) => {
            closeActions(event);
            patch(
              { locked: !r.locked },
              r.locked ? "Record unlocked" : "Record locked"
            );
          }}
        >
          {r.locked ? "Unlock Record" : "Lock Record"}
        </button>
      )}

      <button
        className="actions-menu-item destructive-text"
        disabled={!r.canEdit}
        onClick={(event) => {
          closeActions(event);
          setConfirm(true);
        }}
      >
        Delete Record
      </button>
    </div>
  </details>
</div>

        </section>

        <section className="panel">
          <div className="panelhead"><h3>Record Timeline</h3></div>
          <WorkLogTimeline type={type} recordId={id} canAdd={r.canEdit} systemEvents={historyEvents} />
        </section>
      </div>

      {editing && (
        <RecordForm
          type={type as any} singular={isAssistance ? "Assistance" : "Task"}
          master={master} record={r} canEditOriginal={r.canEditOriginal}
          isAdmin={isAdmin}
          onMasterDataChange={(kind, value) => setMaster((current) => ({
            ...current,
            [kind]: Array.from(new Set([...(current[kind] ?? []), value])),
          }))}
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
