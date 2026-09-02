"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import StatusBadge from "./StatusBadge";
import RecordForm from "./RecordForm";
import BatchEditDialog from "./BatchEditDialog";
import ImportDialog from "./ImportDialog";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./Toast";
import { statusLabel, priorityLabel } from "@/lib/recordTypes";

type Master = Record<string, string[]>;

interface Props {
  type: "assistance" | "tasks";
  label: string;
  singular: string;
  subjectHeader: string;
  subjectField: string;
  bodyField: string;
}

const STATUSES = ["OPEN", "CLOSE_PENDING", "CLOSED"];
const emptyFilters = { q: "", status: "all", location: "all", shift: "all", from: "", to: "" };

export default function RecordsView(props: Props) {
  const { type, label, singular, subjectHeader, subjectField, bodyField } = props;
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const toast = useToast();

  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [data, setData] = useState<any>({ rows: [], total: 0, unfiltered: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [master, setMaster] = useState<Master>({});
  const [showForm, setShowForm] = useState<null | { record?: any }>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; onYes: () => void }>(null);

  const activeCount = useMemo(
    () => (Object.keys(emptyFilters) as (keyof typeof emptyFilters)[])
      .filter((k) => filters[k] && filters[k] !== "all").length,
    [filters]
  );

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ sort: sort.key, dir: sort.dir });
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") p.set(k, v); });
    const res = await fetch(`/api/records/${type}?${p}`);
    setData(await res.json());
    setLoading(false);
  }, [type, filters, sort]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/masterdata").then((r) => r.json()).then((d) => setMaster(d.grouped ?? {}));
  }, []);

  // Selection is per result set — changing a filter must not leave hidden rows
  // silently selected and then act on them.
  const setFilter = (k: string, v: string) => {
    setSelected(new Set());
    setFilters((f) => ({ ...f, [k]: v }));
  };
  const clearFilters = () => { setSelected(new Set()); setFilters(emptyFilters); };

  const toggleSort = (key: string) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" ? "desc" : "asc" }));

  const rows: any[] = data.rows ?? [];
  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function batch(action: string, patch?: any) {
    const res = await fetch(`/api/records/${type}/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: [...selected], patch }),
    });
    const out = await res.json();
    if (!res.ok) { toast(out.error ?? "That did not work"); return; }
    toast(
      `${out.applied} record${out.applied === 1 ? "" : "s"} ${action === "delete" ? "deleted" : action === "update" ? "updated" : action + "ed"}` +
      (out.skipped ? `, ${out.skipped} skipped` : "")
    );
    setSelected(new Set());
    setShowBatch(false);
    load();
  }

  function confirmDelete() {
    const n = selected.size;
    setConfirm({
      title: `Delete ${n} record${n === 1 ? "" : "s"}?`,
      body: isAdmin
        ? "This cannot be undone."
        : "Records you did not enter, or that are locked, will be skipped.",
      onYes: () => { setConfirm(null); batch("delete"); },
    });
  }

  const th = (key: string, text: string) => (
    <th
      className={`sortable${sort.key === key ? " sorted" : ""}`}
      onClick={() => toggleSort(key)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && toggleSort(key)}
    >
      {text}<span className="arr">{sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  );

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search">
          <span aria-hidden>⌕</span>
          <input
            placeholder="Search records…"
            aria-label="Search records"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <button className="secondary" onClick={() => setImporting(true)}>⇧ Import mine</button>
        <button className="primary" onClick={() => setShowForm({})}>＋ New {singular}</button>
      </div>

      <div className="filters">
        <label className="flabel">STATUS
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="all">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="flabel">LOCATION
          <select value={filters.location} onChange={(e) => setFilter("location", e.target.value)}>
            <option value="all">All Locations</option>
            {(master.LOCATION ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="flabel">SHIFT
          <select value={filters.shift} onChange={(e) => setFilter("shift", e.target.value)}>
            <option value="all">All Shifts</option>
            {(master.SHIFT ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label className="flabel">FROM
          <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
        </label>
        <label className="flabel">TO
          <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
        </label>
        {activeCount > 0 && (
          <button className="chip" onClick={clearFilters}>
            ✕ Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="bulkbar">
          <b>{selected.size} selected</b>
          <button onClick={() => setShowBatch(true)}>✎ Edit</button>
          {isAdmin && <button onClick={() => batch("lock")}>🔒 Lock</button>}
          {isAdmin && <button onClick={() => batch("unlock")}>🔓 Unlock</button>}
          <button className="danger" onClick={confirmDelete}>🗑 Delete</button>
          <button className="x" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}

      <div className="muted resultline">
        {loading ? "Loading…" : `Showing ${rows.length} of ${data.unfiltered} record${data.unfiltered === 1 ? "" : "s"}`}
      </div>

      <section className="panel table">
        {rows.length ? (
          <table>
            <thead>
              <tr>
                <th className="selcol">
                  <input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all visible records" />
                </th>
                {th("refNo", "ID")}
                {th("date", "Date")}
                {th("location", "Location")}
                {th("subject", subjectHeader)}
                {th("priority", "Priority")}
                {th("timeStarted", "Duration")}
                {th("status", "Status")}
                {th("assigned", "Assigned")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={selected.has(r.id) ? "selected" : ""}>
                  <td className="selcol">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.refNo}`}
                    />
                  </td>
                  <td>
                    <b><Link href={`/records/${type}/${r.id}`}>{r.refNo}</Link></b>
                    {r.locked && <small>🔒 Locked</small>}
                  </td>
                  <td>{String(r.date).slice(0, 10)}<small>{r.shift}</small></td>
                  <td>{r.location}<small>{r.showGroup}</small></td>
                  <td><b>{r[subjectField]}</b><small>{r[bodyField]}</small></td>
                  <td><span className="priority">{priorityLabel(r.priority)}</span></td>
                  <td>{r.timeEnded ? `${r.timeStarted} – ${r.timeEnded}` : `Since ${r.timeStarted}`}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : !loading ? (
          <div className="empty">
            <b>No records match</b>
            {activeCount ? "Try widening or clearing the filters." : `Create the first ${singular.toLowerCase()} to get started.`}
          </div>
        ) : null}
      </section>

      {showForm && (
        <RecordForm
          type={type} singular={singular} master={master} record={showForm.record}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); load(); toast("Record saved"); }}
        />
      )}
      {showBatch && (
        <BatchEditDialog
          count={selected.size} master={master}
          onClose={() => setShowBatch(false)}
          onApply={(patch) => batch("update", patch)}
        />
      )}
      {confirm && (
        <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />
      )}
      {importing && (
        <ImportDialog
          scope="self" fixedType={type}
          onClose={() => setImporting(false)}
          onDone={() => { setImporting(false); load(); }}
        />
      )}
    </div>
  );
}
