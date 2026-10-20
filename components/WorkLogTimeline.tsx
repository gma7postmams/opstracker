"use client";

import { useCallback, useEffect, useState } from "react";

type WorkLog = {
  id: number;
  type: "INVESTIGATION" | "RESOLUTION" | "REMARK";
  message: string;
  createdByName: string;
  createdAt: string;
};

const labels: Record<WorkLog["type"], string> = {
  INVESTIGATION: "Investigation",
  RESOLUTION: "Resolution",
  REMARK: "Remark",
};

const typeOrder: WorkLog["type"][] = ["INVESTIGATION", "RESOLUTION", "REMARK"];

export default function WorkLogTimeline({
  type,
  recordId,
  canAdd,
}: {
  type: string;
  recordId: string;
  canAdd: boolean;
}) {
  const [entries, setEntries] = useState<WorkLog[]>([]);
  const [entryType, setEntryType] = useState<WorkLog["type"]>("INVESTIGATION");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/records/${type}/${recordId}/work-logs`);
    if (res.ok) setEntries(await res.json());
  }, [type, recordId]);

  useEffect(() => { load(); }, [load]);

  const groupedEntries = typeOrder.map((entryType) => ({
    type: entryType,
    entries: entries.filter((entry) => entry.type === entryType),
  })).filter((group) => group.entries.length > 0);

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

  return (
    <div className="worklog-content">
      {canAdd && (
        <form className="worklog-form" onSubmit={submit}>
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
            rows={3}
            required
            placeholder="Add an investigation note or work update..."
          />
          {error && <p className="worklog-error" role="alert">{error}</p>}
          <button className="primary" type="submit" disabled={saving || !message.trim()}>
            {saving ? "Adding..." : "Add to work log"}
          </button>
        </form>
      )}
      {entries.length ? (
        <div className="timeline worklog-timeline">
          {groupedEntries.map((group) => (
            <section className="worklog-type-section" key={group.type}>
              <h4>{labels[group.type]}</h4>
              {group.entries.map((entry) => (
                <article className="event worklog-event" key={entry.id}>
                  <small>
                    {entry.createdByName} · {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.createdAt))}
                  </small>
                  <p>{entry.message}</p>
                </article>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <p className="muted worklog-empty">No work log entries yet.</p>
      )}
    </div>
  );
}