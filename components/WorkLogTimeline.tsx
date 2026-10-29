"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

type WorkLog = {
  id: number;
  type: "INVESTIGATION" | "RESOLUTION" | "REMARK";
  message: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
  canDelete: boolean;
};

type SystemEvent = {
  id: string | number;
  title: string;
  description: string;
  createdAt: string;
};

type TimelineEvent = {
  id: string;
  source: "system" | "worklog";
  title: string;
  description?: string;
  message?: string;
  actor?: string;
  createdAt: string;
};

const labels: Record<WorkLog["type"], string> = {
  INVESTIGATION: "Investigation",
  RESOLUTION: "Resolution",
  REMARK: "Remark",
};

const typeOrder: WorkLog["type"][] = ["INVESTIGATION", "RESOLUTION", "REMARK"];
const placeholders: Record<WorkLog["type"], string> = {
  INVESTIGATION: "Describe what you checked, what you found, and any next steps...",
  RESOLUTION: "Describe the fix or outcome and how it was verified...",
  REMARK: "Add a relevant note or update for this record...",
};
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});
const timelineDrawDuration = 1600;

export default function RecordTimeline({
  type,
  recordId,
  canAdd,
  systemEvents,
}: {
  type: string;
  recordId: string;
  canAdd: boolean;
  systemEvents: SystemEvent[];
}) {
  const [entries, setEntries] = useState<WorkLog[]>([]);
  const [entryType, setEntryType] = useState<WorkLog["type"]>("INVESTIGATION");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WorkLog | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [savingEditId, setSavingEditId] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const timelineNodes = useRef<(HTMLSpanElement | null)[]>([]);
  const [railGeometry, setRailGeometry] = useState({ key: "", path: "", width: 0, height: 0, delays: [] as number[] });

  const load = useCallback(async () => {
    const includeAllUserOwned = new URLSearchParams(window.location.search).get("userId") === "all";
    const scope = includeAllUserOwned ? "?userId=all" : "";
    const res = await fetch(`/api/records/${type}/${recordId}/work-logs${scope}`);
    if (res.ok) {
      const fetchedEntries: WorkLog[] = await res.json();
      setEntries([...fetchedEntries].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)));
    }
  }, [type, recordId]);

  useEffect(() => { load(); }, [load]);

  const timelineEvents: TimelineEvent[] = [
    ...systemEvents.map((event) => ({
      id: `system-${event.id}`,
      source: "system" as const,
      title: event.title,
      description: event.description,
      createdAt: event.createdAt,
    })),
    ...entries.map((entry) => ({
      id: `worklog-${entry.id}`,
      source: "worklog" as const,
      title: labels[entry.type],
      message: entry.message,
      actor: entry.createdByName,
      createdAt: entry.createdAt,
    })),
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const timelineKey = timelineEvents.map((event) => event.id).join("|");

  useEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    const measureRail = () => {
      const timelineBounds = timeline.getBoundingClientRect();
      const points = timelineEvents.map((_, index) => {
        const node = timelineNodes.current[index];
        if (!node) return null;
        const bounds = node.getBoundingClientRect();
        return {
          x: bounds.left + bounds.width / 2 - timelineBounds.left,
          y: bounds.top + bounds.height / 2 - timelineBounds.top,
        };
      });
      if (points.some((point) => point === null)) return;

      const measuredPoints = points as { x: number; y: number }[];
      const distances = [0];
      for (let index = 1; index < measuredPoints.length; index += 1) {
        const previous = measuredPoints[index - 1];
        const current = measuredPoints[index];
        distances.push(distances[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y));
      }
      const totalDistance = distances[distances.length - 1] ?? 0;
      const path = measuredPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
      const delays = distances.map((distance) => totalDistance ? Math.round(distance / totalDistance * timelineDrawDuration) : 0);
      setRailGeometry((current) => {
        if (
          current.key === timelineKey && current.path === path && current.width === timelineBounds.width && current.height === timelineBounds.height &&
          current.delays.length === delays.length && current.delays.every((delay, index) => delay === delays[index])
        ) return current;
        return { key: timelineKey, path, width: timelineBounds.width, height: timelineBounds.height, delays };
      });
    };

    measureRail();
    const observer = new ResizeObserver(measureRail);
    observer.observe(timeline);
    timeline.querySelectorAll(".record-timeline-item").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [timelineKey]);

  const timelineReady = railGeometry.key === timelineKey && Boolean(railGeometry.path);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch(`/api/records/${type}/${recordId}/work-logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: entryType, message }),
    });
    const result = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(result.error ?? "Could not add work log");
      return;
    }
    setMessage("");
    await load();
  }

  async function removeEntry() {
    if (!confirmDelete || deletingId !== null) return;
    const entry = confirmDelete;
    setDeletingId(entry.id);
    setError("");
    try {
      const res = await fetch(`/api/records/${type}/${recordId}/work-logs?id=${entry.id}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "Could not delete timeline entry");
        setConfirmDelete(null);
        return;
      }
      setEntries((current) => current.filter((currentEntry) => currentEntry.id !== entry.id));
      setConfirmDelete(null);
    } catch {
      setError("Could not delete timeline entry. Check your connection and try again.");
      setConfirmDelete(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function saveEdit(entry: WorkLog) {
    if (savingEditId !== null || !editMessage.trim()) return;
    setSavingEditId(entry.id);
    setError("");
    try {
      const res = await fetch(`/api/records/${type}/${recordId}/work-logs`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id, message: editMessage }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(result.error ?? "Could not update timeline entry");
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setError("Could not update timeline entry. Check your connection and try again.");
    } finally {
      setSavingEditId(null);
    }
  }

  return (
    <div className="record-timeline-content">
      {canAdd && (
        <form className="worklog-form" onSubmit={submit}>
          <h4>Add Timeline Entry</h4>
          <label htmlFor="worklog-type">Entry type</label>
          <select id="worklog-type" value={entryType} onChange={(event) => setEntryType(event.target.value as WorkLog["type"])}>
            {typeOrder.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
          </select>
          <label htmlFor="worklog-message">Update</label>
          <textarea
            id="worklog-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={10000}
            rows={5}
            required
            placeholder={placeholders[entryType]}
          />
          <button className="primary" type="submit" disabled={saving || !message.trim()}>
            {saving ? "Adding..." : "Add Entry"}
          </button>
        </form>
      )}
      {error && <p className="worklog-error" role="alert">{error}</p>}
      {timelineEvents.length ? (
        <div className={`timeline record-timeline${timelineReady ? " record-timeline-ready" : ""}`} ref={timelineRef}>
          {timelineReady && (
            <svg
              className="record-timeline-rail"
              viewBox={`0 0 ${railGeometry.width} ${railGeometry.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={railGeometry.path} pathLength="1" />
            </svg>
          )}
          {timelineEvents.map((event, index) => {
            const entry = event.source === "worklog"
              ? entries.find((candidate) => `worklog-${candidate.id}` === event.id)
              : undefined;
            return (
              <div className="record-timeline-item" key={event.id}>
                <span
                  className={`record-timeline-node${index === timelineEvents.length - 1 ? " record-timeline-node-latest" : ""}`}
                  ref={(node) => { timelineNodes.current[index] = node; }}
                  style={{ animationDelay: `${timelineReady ? railGeometry.delays[index] ?? 0 : 0}ms` }}
                  aria-hidden="true"
                />
                <div
                  className="record-timeline-reveal"
                  style={{ animationDelay: `${timelineReady ? railGeometry.delays[index] ?? 0 : 0}ms` }}
                >
                <article
                  className="event record-timeline-card"
                >
                <div className="record-timeline-card-head">
                  <span className="record-timeline-type">{event.source === "system" ? "System Event" : event.title}</span>
                  <time dateTime={event.createdAt}>{dateTimeFormatter.format(new Date(event.createdAt))}</time>
                </div>
                {entry && (entry.canEdit || entry.canDelete) && editingId !== entry.id && (
                  <div className="record-timeline-actions">
                    {entry.canEdit && (
                      <button
                        className="record-timeline-action"
                        type="button"
                        aria-label={`Edit ${labels[entry.type].toLowerCase()} entry`}
                        title="Edit entry"
                        onClick={() => { setEditingId(entry.id); setEditMessage(entry.message); }}
                      >
                        <Pencil aria-hidden="true" size={15} />
                      </button>
                    )}
                    {entry.canDelete && (
                      <button
                        className="record-timeline-action record-timeline-delete"
                        type="button"
                        aria-label={`Delete ${labels[entry.type].toLowerCase()} entry`}
                        title="Delete entry"
                        disabled={deletingId === entry.id}
                        onClick={() => setConfirmDelete(entry)}
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </button>
                    )}
                  </div>
                )}
                {event.source === "worklog" ? (
                  <>
                    <small>By {event.actor}</small>
                    {editingId === entry?.id && entry ? (
                      <form className="record-timeline-edit" onSubmit={(submitEvent) => { submitEvent.preventDefault(); void saveEdit(entry); }}>
                        <textarea
                          aria-label="Edit timeline message"
                          value={editMessage}
                          onChange={(changeEvent) => setEditMessage(changeEvent.target.value)}
                          maxLength={10000}
                          rows={4}
                          required
                        />
                        <div className="record-timeline-edit-actions">
                          <button className="record-timeline-action" type="submit" aria-label="Save changes" title="Save changes" disabled={savingEditId === entry.id || !editMessage.trim()}>
                            <Save aria-hidden="true" size={15} />
                          </button>
                          <button className="record-timeline-action" type="button" aria-label="Cancel editing" title="Cancel" disabled={savingEditId === entry.id} onClick={() => setEditingId(null)}>
                            <X aria-hidden="true" size={15} />
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p>{event.message}</p>
                    )}
                    {entry && Date.parse(entry.updatedAt) > Date.parse(entry.createdAt) && (
                      <small className="record-timeline-edited">Edited {dateTimeFormatter.format(new Date(entry.updatedAt))}</small>
                    )}
                  </>
                ) : (
                  <small><b>{event.title}</b>{event.description ? ` · ${event.description}` : ""}</small>
                )}
                </article>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted worklog-empty">No timeline events yet.</p>
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete timeline entry?"
          body="This entry will be permanently removed from the record timeline and related participation reports."
          yesText={deletingId === confirmDelete.id ? "Deleting..." : "Delete Entry"}
          onCancel={() => deletingId === null && setConfirmDelete(null)}
          onYes={removeEntry}
        />
      )}
    </div>
  );
}