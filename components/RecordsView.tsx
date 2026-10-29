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
import { formatTime12Hour, fullName } from "@/lib/format";
import { PERIOD_OPTIONS, periodDateFilters, type Period } from "@/lib/period";
import { useRecordEvents } from "@/components/useRecordEvents";
import {
  Activity,
  ArrowDownWideNarrow,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Download,
  MapPin,
  Plus,
  Search,
  Tag,
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
const emptyFilters = { q: "", status: "all", location: "all", category: "all", shift: "all", from: "", to: "" };

function formatElapsedMinutes(startAt: Date, endAt: number) {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt)) return "—";

  const totalMinutes = Math.max(0, Math.floor((endAt - startAt.getTime()) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];

  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);

  return parts.join(" ");
}

function formatListDate(date: Date | string, includeYear = true) {
  const value = (typeof date === "string" ? date : date.toISOString()).slice(0, 10);
  const [year, month, day] = value.split("-").map(Number);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  if (includeYear) options.year = "numeric";
  return new Intl.DateTimeFormat("en-US", options).format(new Date(Date.UTC(year, month - 1, day)));
}

function assistanceDuration(record: any, now: number) {
  const startDate = String(record.startDate).slice(0, 10);
  const startAt = new Date(`${startDate}T${record.timeStarted}:00`);
  if (record.status === "OPEN") {
    return { elapsed: formatElapsedMinutes(startAt, now), range: null };
  }
  const endDate = record.timeEnded ? String(record.endDate ?? record.startDate).slice(0, 10) : null;
  const endAt = endDate ? new Date(`${endDate}T${record.timeEnded}:00`) : new Date(now);
  const validEndAt = Number.isNaN(endAt.getTime()) ? null : endAt;
  const elapsed = formatElapsedMinutes(startAt, validEndAt?.getTime() ?? now);
  const rangeEndDate = endDate ?? (validEndAt
    ? `${validEndAt.getFullYear()}-${String(validEndAt.getMonth() + 1).padStart(2, "0")}-${String(validEndAt.getDate()).padStart(2, "0")}`
    : startDate);
  const rangeEndTime = record.timeEnded ?? (validEndAt
    ? `${String(validEndAt.getHours()).padStart(2, "0")}:${String(validEndAt.getMinutes()).padStart(2, "0")}`
    : record.timeStarted);
  const range = rangeEndDate === startDate
    ? `${formatTime12Hour(record.timeStarted)} → ${formatTime12Hour(rangeEndTime)}`
    : `${formatListDate(startDate, false)} ${formatTime12Hour(record.timeStarted)}\n→ ${formatListDate(rangeEndDate, false)} ${formatTime12Hour(rangeEndTime)}`;

  return { elapsed, range };
}

function summaryMessage(workLogMessage?: string | null, legacyMessage?: string | null) {
  return workLogMessage?.trim() || legacyMessage?.trim() || "";
}

export default function RecordsView(props: Props) {
  const { type, label, singular, subjectField, bodyField } = props;
  const showLocation = type === "assistance";
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const toast = useToast();

  const [period, setPeriod] = useState<Period>("today");
  const [filters, setFilters] = useState(() => ({ ...emptyFilters, ...periodDateFilters("today") }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [now, setNow] = useState(() => Date.now());

  const [users, setUsers] = useState<any[]>([]);
  const [userFilter, setUserFilter] = useState<string | null>(null);

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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const defaultUserFilter = session?.user.id != null ? String(session.user.id) : "all";
  const activeUserFilter = userFilter ?? defaultUserFilter;

  const activeCount = useMemo(
    () =>
      (Object.keys(emptyFilters) as (keyof typeof emptyFilters)[])
        .filter((k) => k !== "from" && k !== "to" && filters[k] && filters[k] !== "all").length +
      (period !== "today" ? 1 : 0) +
      (activeUserFilter !== defaultUserFilter ? 1 : 0),
    [filters, period, activeUserFilter, defaultUserFilter]
  );

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);

    const p = new URLSearchParams({ sort: sort.key, dir: sort.dir });

    if (activeUserFilter) {p.set("userId", activeUserFilter);}
 
    Object.entries(filters).forEach(([k, v]) => { if (v && v !== "all") p.set(k, v); });
    const res = await fetch(`/api/records/${type}?${p}`);
    setData(await res.json());
    setLoading(false);
  }, [type, filters, sort, activeUserFilter, session]);

  useRecordEvents(() => { void load(); });

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
    setPeriod("today");
    setFilters({ ...emptyFilters, ...periodDateFilters("today") });
    setUserFilter(null);
  };

  const changePeriod = (nextPeriod: Period) => {
    setSelected(new Set());
    setPage(1);
    setPeriod(nextPeriod);
    if (nextPeriod === "custom") {
      setFilters((current) => ({ ...current, from: "", to: "" }));
    } else {
      setFilters((current) => ({ ...current, ...periodDateFilters(nextPeriod) }));
    }
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

  function exportMine() {
    const params = new URLSearchParams({ scope: "mine", ownerOnly: "true" });
    window.open(`/api/reports/excel?${params}`, "_blank");
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
      {key === "category" && <Tag size={14} aria-hidden="true" />}
      {key === "location" && <MapPin size={14} aria-hidden="true" />}
      {key === "priority" && <ArrowDownWideNarrow size={14} aria-hidden="true" />}
      {key === "status" && <CircleDot size={14} aria-hidden="true" />}
      {key === "assigned" && <UserRound size={14} aria-hidden="true" />}
      {text}<span className="arr">{sort.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  );

  return (
    <div className="page records-page">
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
        <button className="secondary" onClick={exportMine}><Download size={16} aria-hidden="true" /> Export mine</button>
        <button className="primary" onClick={() => setShowForm({})}><Plus size={16} aria-hidden="true" /> New {singular}</button>
      </div>

      <div className="filters">
        <label className="flabel"><span className="crm-filter-label"><CalendarDays size={14} aria-hidden="true" /> PERIOD</span>
          <select value={period} onChange={(e) => changePeriod(e.target.value as Period)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="flabel">
          <span className="crm-filter-label"><UserRound size={14} aria-hidden="true" /> USER</span>

          <select
            value={activeUserFilter}
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
        {showLocation && (
          <label className="flabel"><span className="crm-filter-label"><MapPin size={14} aria-hidden="true" /> LOCATION</span>
            <select value={filters.location} onChange={(e) => setFilter("location", e.target.value)}>
              <option value="all">All Locations</option>
              {(master.LOCATION ?? []).map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
        )}
        {showLocation && (
          <label className="flabel"><span className="crm-filter-label"><Tag size={14} aria-hidden="true" /> CATEGORY</span>
            <select value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
              <option value="all">All Categories</option>
              {(master.CATEGORY ?? []).map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
        )}
        <label className="flabel">SHIFT
          <select value={filters.shift} onChange={(e) => setFilter("shift", e.target.value)}>
            <option value="all">All Shifts</option>
            {(master.SHIFT ?? []).map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        {period === "custom" && (
          <>
            <label className="flabel"><span className="crm-filter-label"><CalendarDays size={14} aria-hidden="true" /> FROM</span>
              <input type="date" value={filters.from} onChange={(e) => setFilter("from", e.target.value)} />
            </label>
            <label className="flabel"><span className="crm-filter-label"><CalendarDays size={14} aria-hidden="true" /> TO</span>
              <input type="date" value={filters.to} onChange={(e) => setFilter("to", e.target.value)} />
            </label>
          </>
        )}
        {activeCount > 0 && (
          <button className="chip" onClick={clearFilters}>
            ✕ Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      <section className="crm-kpis" aria-label="Record summary">
        <article className="crm-kpi crm-kpi-total">
          <span className="crm-kpi-top"><span>Total Records</span><span className="crm-kpi-icon"><Activity size={16} aria-hidden="true" /></span></span>
          <strong>{rows.length}</strong>
        </article>
        <article className="crm-kpi crm-kpi-open">
          <span className="crm-kpi-top"><span>Open</span><span className="crm-kpi-icon"><CircleDot size={16} aria-hidden="true" /></span></span>
          <strong>{statusCounts.OPEN ?? 0}</strong>
        </article>
        <article className="crm-kpi crm-kpi-pending">
          <span className="crm-kpi-top"><span>Close Pending</span><span className="crm-kpi-icon"><Clock3 size={16} aria-hidden="true" /></span></span>
          <strong>{statusCounts.CLOSE_PENDING ?? 0}</strong>
        </article>
        <article className="crm-kpi crm-kpi-closed">
          <span className="crm-kpi-top"><span>Closed</span><span className="crm-kpi-icon"><CheckCircle2 size={16} aria-hidden="true" /></span></span>
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
          <table className={showLocation ? "crm-assistance-table" : "crm-task-table"}>
            <colgroup>
              <col className="crm-col-select" />
              <col className={showLocation ? "crm-col-assistance-id" : "crm-col-task-id"} />
              <col className={showLocation ? "crm-col-assistance-date" : "crm-col-task-date"} />
              {showLocation && <col className="crm-col-category" />}
              {showLocation && <col className="crm-col-assistance-location" />}
              {!showLocation && <col className="crm-col-task-type" />}
              <col className={showLocation ? "crm-col-assistance-activity" : "crm-col-task-description"} />
              <col className={showLocation ? "crm-col-assistance-priority" : "crm-col-task-priority"} />
              <col className={showLocation ? "crm-col-assistance-status" : "crm-col-task-status"} />
              <col className={showLocation ? "crm-col-assistance-duration" : "crm-col-task-duration"} />
              <col className={showLocation ? "crm-col-assistance-assigned" : "crm-col-task-assigned"} />
              <col className={showLocation ? "crm-col-assistance-accountable" : "crm-col-task-accountable"} />
            </colgroup>
            <thead>
              <tr>
                <th className="selcol">
                  <input type="checkbox" checked={allOn} onChange={toggleAll} aria-label="Select all visible records" />
                </th>
                {th("refNo", "ID")}
                {th("date", "Date / Shift")}
                {showLocation && th("category", "Category")}
                {showLocation && th("location", "Location / Show")}
                {!showLocation && th("category", "Activity Type")}
                {showLocation ? th("subject", "Client / Problem") : <th>Description</th>}
                {th("priority", "Priority")}
                {th("status", "Status")}
                {th("timeStarted", "Duration")}
                {th("assigned", "Assigned To")}
                <th>Accountable Person</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const isOwner = r.assigned === r.accountable;
                const summarySections = showLocation
                  ? [
                      { label: "Problem", value: summaryMessage(null, r[bodyField]) },
                      { label: "Cause", value: summaryMessage(null, r.cause) },
                      ...(!isOwner ? [{ label: "Investigation", value: summaryMessage(r.latestInvestigationWorkLog?.message) }] : []),
                      { label: "Resolution", value: summaryMessage(r.latestResolutionWorkLog?.message, r.resolution) },
                      { label: "Remark", value: summaryMessage(r.latestRemarkWorkLog?.message, r.remarks) },
                    ]
                  : [
                      { label: "Description", value: summaryMessage(null, r[bodyField]) },
                      ...(!isOwner ? [
                        { label: "Investigation", value: summaryMessage(r.latestInvestigationWorkLog?.message) },
                        { label: "Resolution", value: summaryMessage(r.latestResolutionWorkLog?.message, r.resolution) },
                      ] : []),
                      { label: "Remark", value: summaryMessage(r.latestRemarkWorkLog?.message, r.remarks) },
                    ];

                return (
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
                    <b><Link href={`/records/${type}/${r.id}${activeUserFilter === "all" ? "?userId=all" : ""}`}>{r.refNo}</Link></b>
                    {r.locked && <small>🔒 Locked</small>}
                  </td>
                  <td>{formatListDate(r.startDate)}<small>{r.shift}</small></td>
                  {showLocation && <td><span className="crm-category" title={r.category ?? ""}>{r.category || "—"}</span></td>}
                  {showLocation && <td>{r.location}<small>{r.showGroup}</small></td>}
                  {!showLocation && <td><span className="crm-category" title={r.activityType ?? ""}>{r.activityType || "—"}</span></td>}
                    <td className="crm-activity-cell">
                      {showLocation && <b className="crm-title-clamp">{r[subjectField]}</b>}
                      {summarySections.filter(({ value }) => value).map(({ label, value }) => (
                        <small
                          key={label}
                          className={label === "Remark" ? "crm-remarks-clamp" : "crm-description-clamp"}
                        >
                          <strong className={label === "Remark" ? undefined : "crm-content-label"}>{label}:</strong> {value}
                        </small>
                      ))}
                    </td>
                  <td><span className={`crm-priority crm-priority-${String(r.priority).toLowerCase()}`}><ArrowDownWideNarrow size={13} aria-hidden="true" />{priorityLabel(r.priority)}</span></td>
                  <td><span className={`crm-status crm-status-${String(r.status).toLowerCase()}`}><CircleDot size={13} aria-hidden="true" />{statusLabel(r.status)}</span></td>
                  <td>{(() => {
                    const duration = assistanceDuration(r, now);
                    return <><strong className="crm-duration-value">{duration.elapsed}</strong>{duration.range && <small className="crm-duration-range">{duration.range}</small>}</>;
                  })()}</td>
                  <td>{r.assigned}</td>
                  <td>{fullName(r.owner)}</td>
                </tr>
                );
              })}
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
          isAdmin={isAdmin}
          onMasterDataChange={(kind, value) => setMaster((current) => ({
            ...current,
            [kind]: Array.from(new Set([...(current[kind] ?? []), value])),
          }))}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); load(); toast("Record saved"); }}
        />
      )}
      {showBatch && (
        <BatchEditDialog
          count={selected.size} master={master}
          showLocation={showLocation}
          onClose={() => setShowBatch(false)}
          onApply={(patch) => batch("update", patch)}
        />
      )}
      {confirm && (
        <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />
      )}
      {importing && (
        <ImportDialog
          scope="self"
          onClose={() => setImporting(false)}
          onDone={() => { setImporting(false); load(); }}
        />
      )}
      <style jsx>{`
        .records-page { width: 100%; max-width: none; min-width: 0; margin: 0; padding: 0; }
        .records-page > .toolbar, .records-page > .filters, .records-page > .crm-kpis, .records-page > .resultline, .records-page > .crm-table-wrap, .records-page > .crm-pagination { width: 100%; min-width: 0; box-sizing: border-box; margin-left: 0; margin-right: 0; }
        .crm-filter-label { display: inline-flex; align-items: center; gap: 5px; }
        .toolbar { margin-bottom: 12px; }
        .toolbar :global(button) { display: inline-flex; align-items: center; justify-content: center; gap: 7px; transition: transform 180ms ease, box-shadow 180ms ease; }
        .toolbar :global(button:hover:not(:disabled)) { transform: translateY(-1px); box-shadow: 0 5px 14px rgba(27, 47, 72, 0.12); }
        .search { display: flex; align-items: center; gap: 9px; }
        .search :global(svg) { flex: 0 0 auto; color: #64748b; }
        .filters { margin-bottom: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel); box-shadow: 0 3px 12px rgba(18, 38, 63, 0.04); align-items: end; }
        .filters input:disabled { cursor: not-allowed; opacity: 0.55; }
        .crm-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 12px 0; }
        .crm-kpi { position: relative; display: flex; flex-direction: column; min-height: 102px; padding: 14px 16px 12px 20px; overflow: hidden; border: 1px solid color-mix(in srgb, var(--border) 70%, var(--muted)); border-radius: 9px; background: var(--panel); box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12); transition: transform 180ms ease, box-shadow 180ms ease; }
        .crm-kpi::before { position: absolute; inset: 0 auto 0 0; width: 4px; background: var(--kpi-accent); content: ""; }
        .crm-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.18); }
        .crm-kpi-top { display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 12px; font-weight: 650; }
        .crm-kpi-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; color: var(--kpi-accent); background: color-mix(in srgb, var(--kpi-accent) 15%, var(--panel)); }
        .crm-kpi strong { display: block; margin-top: 7px; color: var(--text); font-size: 27px; line-height: 1; }
        .crm-kpi-total { --kpi-accent: #64748b; --kpi-tint: #f1f5f9; }
        .crm-kpi-open { --kpi-accent: #2563eb; --kpi-tint: #eff6ff; }
        .crm-kpi-pending { --kpi-accent: #d97706; --kpi-tint: #fffbeb; }
        .crm-kpi-closed { --kpi-accent: #16a34a; --kpi-tint: #f0fdf4; }
        .crm-table-wrap { max-height: 70vh; overflow: auto; padding: 0; border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 4px 16px rgba(31, 48, 68, 0.06); }
        .crm-table-wrap table { width: 100%; min-width: 960px; table-layout: fixed; border-collapse: separate; border-spacing: 0; }
        .crm-col-select { width: 3%; }
        .crm-col-id { width: 8%; }
        .crm-col-date { width: 8%; }
        .crm-col-location { width: 11%; }
        .crm-col-activity { width: 28%; }
        .crm-col-assistance-id { width: 7%; }
        .crm-col-assistance-date { width: 9%; }
        .crm-col-assistance-location { width: 9%; }
        .crm-col-assistance-activity { width: 28%; }
        .crm-col-category { width: 7%; }
        .crm-col-priority { width: 7%; }
        .crm-col-assistance-priority { width: 6%; }
        .crm-col-assistance-status { width: 7%; }
        .crm-col-duration { width: 8%; }
        .crm-col-assistance-duration { width: 8%; }
        .crm-col-status { width: 9%; }
        .crm-col-assigned { width: 9%; }
        .crm-col-accountable { width: 9%; }
        .crm-col-assistance-assigned { width: 8%; }
        .crm-col-assistance-accountable { width: 8%; }
        .crm-col-task-id { width: 8%; }
        .crm-col-task-date { width: 9%; }
        .crm-col-task-type { width: 10%; }
        .crm-col-task-description { width: 36%; }
        .crm-col-task-priority { width: 7%; }
        .crm-col-task-status { width: 8%; }
        .crm-col-task-duration { width: 9%; }
        .crm-col-task-assigned { width: 8%; }
        .crm-col-task-accountable { width: 9%; }
        .crm-task-table { min-width: 1180px !important; }
        .crm-table-wrap thead { position: sticky; top: 0; z-index: 2; }
        .crm-table-wrap thead th { background: var(--panel); box-shadow: 0 1px 0 var(--border); }
        .crm-table-wrap .selcol input[type="checkbox"] { appearance: none; display: inline-grid; place-content: center; width: 16px; height: 16px; margin: 0; border: 1px solid color-mix(in srgb, var(--border) 55%, var(--text)); border-radius: 4px; background: color-mix(in srgb, var(--panel) 94%, #237a75); color: #fff; cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease; }
        .crm-table-wrap thead .selcol input[type="checkbox"] { width: 18px; height: 18px; border-width: 1.5px; }
        .crm-table-wrap .selcol input[type="checkbox"]::before { width: 8px; height: 4px; border: solid currentColor; border-width: 0 0 2px 2px; content: ""; transform: rotate(-45deg) scale(0); }
        .crm-table-wrap .selcol input[type="checkbox"]:checked { border-color: #237a75; background: #237a75; }
        .crm-table-wrap .selcol input[type="checkbox"]:checked::before { transform: rotate(-45deg) scale(1); }
        .crm-table-wrap .selcol input[type="checkbox"]:hover { border-color: #237a75; box-shadow: 0 0 0 3px color-mix(in srgb, #237a75 18%, transparent), 0 0 7px color-mix(in srgb, #237a75 20%, transparent); }
        .crm-table-wrap .selcol input[type="checkbox"]:focus-visible { outline: 2px solid #237a75; outline-offset: 2px; }
        .crm-table-wrap tbody tr { transition: background-color 180ms ease; }
        .crm-table-wrap tbody tr:hover { background: color-mix(in srgb, #237a75 12%, var(--panel)); }
        .crm-activity-cell { min-width: 0; }
        .crm-title-clamp, .crm-description-clamp, .crm-remarks-clamp { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; }
        .crm-title-clamp { color: var(--text); font-size: 14px; font-weight: 650; line-height: 1.35; -webkit-line-clamp: 1; line-clamp: 1; }
        .crm-description-clamp { margin-top: 4px; color: var(--record-content); font-size: 13px; line-height: 1.4; -webkit-line-clamp: 2; line-clamp: 2; }
        .crm-remarks-clamp { margin-top: 5px; color: var(--record-content); font-size: 13px; line-height: 1.4; -webkit-line-clamp: 2; line-clamp: 2; }
        .crm-duration-value { display: block; color: var(--text); font-size: 13px; }
        .crm-duration-range { display: block; margin-top: 4px; color: var(--muted); line-height: 1.4; white-space: pre-line; }
        .crm-content-label, .crm-remarks-clamp :global(strong) { color: var(--record-label); font-weight: 650; }
        .crm-status, .crm-priority { display: inline-flex; align-items: center; gap: 5px; padding: 4px 8px; border: 1px solid transparent; border-radius: 999px; font-size: 11px; font-weight: 650; white-space: nowrap; }
        .crm-category { display: inline-block; max-width: 100%; overflow: hidden; padding: 4px 7px; border: 1px solid var(--border); border-radius: 999px; background: color-mix(in srgb, #237a75 10%, var(--panel)); color: var(--text); font-size: 11px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
        .crm-priority-normal { color: #1d4ed8; border-color: #bfdbfe; background: #eff6ff; }
        .crm-priority-low { color: #475569; border-color: #e2e8f0; background: #f1f5f9; }
        .crm-priority-high { color: #c2410c; border-color: #fed7aa; background: #fff7ed; }
        .crm-priority-critical { color: #b91c1c; border-color: #fecaca; background: #fef2f2; }
        .crm-pagination { display: flex; align-items: center; justify-content: flex-end; gap: 10px; margin-top: 12px; padding: 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--panel); color: var(--text); font-size: 12px; }
        .crm-pagination-total { margin-right: auto; font-weight: 600; }
        .crm-page-size { display: inline-flex; align-items: center; gap: 7px; }
        .crm-page-size select, .crm-page-button { min-height: 32px; padding: 5px 9px; border: 1px solid var(--border); border-radius: 6px; background: var(--panel); color: var(--text); }
        .crm-page-button { cursor: pointer; transition: background-color 150ms ease, border-color 150ms ease; }
        .crm-page-size select:hover, .crm-page-button:hover:not(:disabled) { border-color: #237a75; background: color-mix(in srgb, #237a75 12%, var(--panel)); }
        .crm-page-button:disabled { cursor: not-allowed; opacity: 0.45; }
        .crm-page-indicator { color: var(--text); font-weight: 600; }
        @media (max-width: 700px) {
          .crm-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
          .crm-kpi { min-height: 88px; padding: 11px 12px 11px 16px; }
          .crm-pagination { flex-wrap: wrap; justify-content: flex-start; }
          .crm-pagination-total { flex-basis: 100%; }
        }
      `}</style>
    </div>
  );
}
