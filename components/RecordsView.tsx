"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import RecordForm from "./RecordForm";
import BatchEditDialog from "./BatchEditDialog";
import ImportDialog from "./ImportDialog";
import ConfirmDialog from "./ConfirmDialog";
import { useToast } from "./Toast";
import { statusLabel, priorityLabel } from "@/lib/recordTypes";
import {
  Activity,
  ArrowDownWideNarrow,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  MapPin,
  Plus,
  Search,
  Upload,
  UserRound,
} from "lucide-react";

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [users, setUsers] = useState<any[]>([]);
  const [userFilter, setUserFilter] = useState(isAdmin ? "all" : String(session?.user?.id ?? ""));

  useEffect(() => {
    fetch(
      isAdmin
        ? "/api/users/report-filter"
        : "/api/users/filter"
    )
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []));
  }, [isAdmin]);


  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [data, setData] = useState<any>({ rows: [], total: 0, unfiltered: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [master, setMaster] = useState<Master>({});
  const [showForm, setShowForm] = useState<null | { record?: any }>(null);
  const [showBatch, setShowBatch] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; onYes: () => void }>(null);

  const defaultUserFilter =
    isAdmin ? "all" : String(session?.user?.id ?? "");

  const activeCount = useMemo(
    () =>
      (Object.keys(emptyFilters) as (keyof typeof emptyFilters)[])
        .filter((k) => filters[k] && filters[k] !== "all").length +
      (userFilter !== defaultUserFilter ? 1 : 0),
    [filters, userFilter, defaultUserFilter]
  );

  const load = useCallback(async () => {
    setLoading(true);

    const p = new URLSearchParams({ sort: sort.key, dir: sort.dir });

    if (userFilter) {p.set("userId", userFilter);}
 
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") p.set(k, v); });
    const res = await fetch(`/api/records/${type}?${p}`);
    setData(await res.json());
    setLoading(false);
  }, [type, filters, sort, userFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/masterdata").then((r) => r.json()).then((d) => setMaster(d.grouped ?? {}));
  }, []);

  // Selection is per result set — changing a filter must not leave hidden rows
  // silently selected and then act on them.
  const setFilter = (k: string, v: string) => {
    setSelected(new Set());
    setPage(1);
    setFilters((f) => ({ ...f, [k]: v }));
  };

  const clearFilters = () => {
    setSelected(new Set());
    setPage(1);
    setFilters(emptyFilters);
    setUserFilter(defaultUserFilter);
  };

  const toggleSort = (key: string) => {
    setPage(1);
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "date" ? "desc" : "asc" }));
  };

  const rows: any[] = data.rows ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const statusCounts = rows.reduce((counts: Record<string, number>, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});
  const allOn = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((current) => {
      const next = new Set(current);
      visibleRows.forEach((row) => (allOn ? next.delete(row.id) : next.add(row.id)));
      return next;
    });
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
      {key === "date" && <CalendarDays size={14} aria-hidden="true" />}
      {key === "location" && <MapPin size={14} aria-hidden="true" />}
      {key === "priority" && <ArrowDownWideNarrow size={14} aria-hidden="true" />}
      {key === "status" && <CircleDot size={14} aria-hidden="true" />}
      {key === "assigned" && <UserRound size={14} aria-hidden="true" />}
      {text}<span className="arr">{sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  );

  return (
    <div className="page">
      <div className="toolbar">
        <div className="search">
          <Search size={16} aria-hidden="true" />
          <input
            placeholder="Search records…"
            aria-label="Search records"
            value={filters.q}
            onChange={(e) => { setPage(1); setFilters((f) => ({ ...f, q: e.target.value })); }}
          />
        </div>
        <button className="secondary" onClick={() => setImporting(true)}><Upload size={16} aria-hidden="true" /> Import mine</button>
        <button className="primary" onClick={() => setShowForm({})}><Plus size={16} aria-hidden="true" /> New {singular}</button>
      </div>

      <div className="filters">

        <label className="flabel">
          <span className="crm-filter-label"><UserRound size={14} aria-hidden="true" /> USER</span>

          <select
            value={userFilter}
            onChange={(e) => { setPage(1); setUserFilter(e.target.value); }}
          >
            <option value="all">
              All Users
            </option>

            {users.map((u) => (
              <option
                key={u.id}
                value={u.id}
              >
                {u.firstName} {u.middleInitial ?? ""} {u.surname}
              </option>
            ))}
          </select>
        </label>

        <label className="flabel"><span className="crm-filter-label"><CircleDot size={14} aria-hidden="true" /> STATUS</span>
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="all">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
        </label>
        <label className="flabel"><span className="crm-filter-label"><MapPin size={14} aria-hidden="true" /> LOCATION</span>
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
        <label className="flabel"><span className="crm-filter-label"><CalendarDays size={14} aria-hidden="true" /> FROM</span>
          <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
        </label>
        <label className="flabel"><span className="crm-filter-label"><CalendarDays size={14} aria-hidden="true" /> TO</span>
          <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
        </label>
        {activeCount > 0 && (
          <button className="chip" onClick={clearFilters}>
            ✕ Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      <section className="crm-kpis" aria-label="Record summary">
        <article className="crm-kpi crm-kpi-total">
          <span className="crm-kpi-icon"><Activity size={17} aria-hidden="true" /></span>
          <span className="crm-kpi-label">Total Records</span>
          <strong>{rows.length}</strong>
        </article>
        <article className="crm-kpi crm-kpi-open">
          <span className="crm-kpi-icon"><CircleDot size={17} aria-hidden="true" /></span>
          <span className="crm-kpi-label">Open</span>
          <strong>{statusCounts.OPEN ?? 0}</strong>
        </article>
        <article className="crm-kpi crm-kpi-pending">
          <span className="crm-kpi-icon"><Clock3 size={17} aria-hidden="true" /></span>
          <span className="crm-kpi-label">Close Pending</span>
          <strong>{statusCounts.CLOSE_PENDING ?? 0}</strong>
        </article>
        <article className="crm-kpi crm-kpi-closed">
          <span className="crm-kpi-icon"><CheckCircle2 size={17} aria-hidden="true" /></span>
          <span className="crm-kpi-label">Closed</span>
          <strong>{statusCounts.CLOSED ?? 0}</strong>
        </article>
      </section>

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
        {loading ? "Loading…" : `Showing ${rows.length ? (currentPage - 1) * pageSize + 1 : 0}–${Math.min(currentPage * pageSize, rows.length)} of ${rows.length} record${rows.length === 1 ? "" : "s"}`}
      </div>

      <section className="panel table crm-table-wrap">
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
              {visibleRows.map((r) => (
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
                  <td className="crm-activity-cell">
                    <b className="crm-title-clamp">{r[subjectField]}</b>
                    <small className="crm-description-clamp">{r[bodyField]}</small>
                    {r.remarks && <small className="crm-remarks-clamp"><strong>Remarks:</strong> {r.remarks}</small>}
                  </td>
                  <td><span className={`crm-priority crm-priority-${String(r.priority).toLowerCase()}`}><ArrowDownWideNarrow size={13} aria-hidden="true" />{priorityLabel(r.priority)}</span></td>
                  <td>{r.timeEnded ? `${r.timeStarted} – ${r.timeEnded}` : `Since ${r.timeStarted}`}</td>
                  <td><span className={`crm-status crm-status-${String(r.status).toLowerCase()}`}><CircleDot size={13} aria-hidden="true" />{statusLabel(r.status)}</span></td>
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

      <footer className="crm-pagination" aria-label="Table pagination">
        <span className="crm-pagination-total">{rows.length} total records</span>
        <label className="crm-page-size">Rows per page
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <span className="crm-page-indicator">Page {currentPage} of {pageCount}</span>
        <button type="button" className="crm-page-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>Previous</button>
        <button type="button" className="crm-page-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount}>Next</button>
      </footer>

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
      <style jsx>{`
        .crm-filter-label { display: inline-flex; align-items: center; gap: 5px; }
        .toolbar :global(button) { display: inline-flex; align-items: center; justify-content: center; gap: 7px; transition: transform 180ms ease, box-shadow 180ms ease; }
        .toolbar :global(button:hover:not(:disabled)) { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(27, 47, 72, 0.12); }
        .search { display: flex; align-items: center; gap: 9px; }
        .search :global(svg) { flex: 0 0 auto; color: #64748b; }
        .crm-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
        .crm-kpi { position: relative; display: grid; grid-template-columns: 34px 1fr; grid-template-rows: auto auto; align-items: center; column-gap: 11px; min-height: 88px; padding: 15px 18px; overflow: hidden; border: 1px solid #e5eaf0; border-radius: 10px; background: linear-gradient(145deg, #fff, #f8fafc); box-shadow: 0 3px 12px rgba(31, 48, 68, 0.06); transition: transform 180ms ease, box-shadow 180ms ease; }
        .crm-kpi::before { position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--kpi-accent); content: ""; }
        .crm-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(31, 48, 68, 0.1); }
        .crm-kpi-icon { grid-row: 1 / span 2; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; color: var(--kpi-accent); background: var(--kpi-tint); }
        .crm-kpi-label { color: #637083; font-size: 12px; font-weight: 600; }
        .crm-kpi strong { color: #182536; font-size: 22px; line-height: 1.15; }
        .crm-kpi-total { --kpi-accent: #64748b; --kpi-tint: #f1f5f9; }
        .crm-kpi-open { --kpi-accent: #2563eb; --kpi-tint: #eff6ff; }
        .crm-kpi-pending { --kpi-accent: #d97706; --kpi-tint: #fffbeb; }
        .crm-kpi-closed { --kpi-accent: #16a34a; --kpi-tint: #f0fdf4; }
        .crm-table-wrap { max-height: 70vh; overflow: auto; border: 1px solid #e5eaf0; border-radius: 10px; box-shadow: 0 4px 16px rgba(31, 48, 68, 0.06); }
        .crm-table-wrap table { border-collapse: separate; border-spacing: 0; }
        .crm-table-wrap thead { position: sticky; top: 0; z-index: 2; }
        .crm-table-wrap thead th { background: #f7f9fc; box-shadow: 0 1px 0 #e5eaf0; }
        .crm-table-wrap tbody tr { transition: background-color 150ms ease; }
        .crm-table-wrap tbody tr:hover { background: #f5f9ff; }
        .crm-activity-cell { min-width: 240px; max-width: 360px; }
        .crm-title-clamp, .crm-description-clamp, .crm-remarks-clamp { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; }
        .crm-title-clamp { -webkit-line-clamp: 1; line-clamp: 1; }
        .crm-description-clamp { margin-top: 4px; color: #64748b; -webkit-line-clamp: 2; line-clamp: 2; }
        .crm-remarks-clamp { margin-top: 5px; color: #667085; font-size: 11px; -webkit-line-clamp: 2; line-clamp: 2; }
        .crm-remarks-clamp :global(strong) { color: #475569; }
        .crm-status, .crm-priority { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border: 1px solid transparent; border-radius: 999px; font-size: 11px; font-weight: 650; white-space: nowrap; }
        .crm-status-open, .crm-priority-normal { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
        .crm-status-close_pending { color: #b45309; border-color: #fde68a; background: #fffbeb; }
        .crm-status-closed { color: #15803d; border-color: #bbf7d0; background: #f0fdf4; }
        .crm-priority-low { color: #475569; border-color: #e2e8f0; background: #f1f5f9; }
        .crm-priority-high { color: #c2410c; border-color: #fed7aa; background: #fff7ed; }
        .crm-priority-critical { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
        .crm-pagination { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 12px; padding: 10px 12px; border: 1px solid #e5eaf0; border-radius: 9px; background: #fff; color: #64748b; font-size: 12px; }
        .crm-pagination-total { margin-right: auto; font-weight: 600; }
        .crm-page-size { display: inline-flex; align-items: center; gap: 7px; }
        .crm-page-size select, .crm-page-button { min-height: 32px; padding: 5px 9px; border: 1px solid #dce3eb; border-radius: 6px; background: #fff; color: #344256; }
        .crm-page-button { cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease; }
        .crm-page-button:hover:not(:disabled) { border-color: #9db2cc; background: #f5f8fc; }
        .crm-page-button:disabled { cursor: not-allowed; opacity: 0.45; }
        @media (max-width: 700px) {
          .crm-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
          .crm-kpi { min-height: 78px; padding: 11px; }
          .crm-pagination { flex-wrap: wrap; justify-content: flex-start; }
          .crm-pagination-total { flex-basis: 100%; }
        }
      `}</style>
    </div>
  );
}
