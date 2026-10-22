"use client";

import { useEffect, useState } from "react";
import { Activity, CalendarDays, Clock3, Download, Eye, FilePlus2, Search, Trash2, X } from "lucide-react";
import { PERIOD_OPTIONS, type Period } from "@/lib/period";
import { AUDIT_ACTIONS, AUDIT_ACTIONS_BY_CATEGORY, AUDIT_CATEGORIES, getAuditCategory, type AuditCategory } from "@/lib/auditCategories";

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "No details recorded";
  }

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATE: "Record Created",
  UPDATE: "Record Updated",
  UPDATE_PROFILE: "Profile Updated",
  UPDATE_USER: "User Updated",
  DELETE: "Record Deleted",
  IMPORT: "Records Imported",
  IMPORT_BOTH: "Both Record Types Imported",
  LOCK: "Record Locked",
  UNLOCK: "Record Unlocked",
  LOGIN: "Login Successful",
  LOGOUT: "Logout",
  LOGIN_FAILED: "Login Failed",
  "2FA_ENABLED": "2FA Enabled",
  "2FA_DISABLED": "2FA Disabled",
  "2FA_CODE_SENT": "Verification Code Sent",
  "2FA_SUCCESS": "2FA Verified",
  "2FA_FAILURE": "2FA Failed",
  REPORT_EMAIL_SENT: "Report Email Sent",
  REPORT_EMAIL_FAILED: "Report Email Failed",
  MASTERDATA_ADD: "Master Data Added",
  MASTERDATA_RETIRE: "Master Data Retired",
  MASTERDATA_RESTORE: "Master Data Restored",
};

function formatAuditAction(actionValue: unknown) {
  const action = String(actionValue ?? "").toUpperCase();
  return AUDIT_ACTION_LABELS[action] ?? (action
    ? String(actionValue).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_\s]+/g, " ").trim().toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "System Activity");
}

function getAuditUserName(log: any) {
  const details = log.details && typeof log.details === "object" && !Array.isArray(log.details)
    ? log.details
    : {};
  const fullName = [log.actorName, details.actor, details.name, details.user]
    .find((value) => typeof value === "string" && value.trim());
  if (fullName) return String(fullName).trim();

  const username = [log.actorUsername, details.username]
    .find((value) => typeof value === "string" && value.trim());
  return username ? String(username).trim() : "Unknown User";
}

function getAuditTone(actionValue: unknown) {
  const action = String(actionValue ?? "").toUpperCase();
  if (action.includes("FAILED") || action.includes("FAILURE")) return "failure";
  if (
    action === "LOGIN" || action === "2FA_SUCCESS" || action.includes("CREATE") ||
    action.endsWith("_ADD") || action.endsWith("_RESTORE") || action.includes("IMPORT") ||
    action === "UNLOCK" || action === "2FA_ENABLED" || action === "REPORT_EMAIL_SENT"
  ) return "success";
  if (action.includes("DELETE") || action === "LOCK" || action.endsWith("_RETIRE") || action === "2FA_DISABLED") return "warning";
  if (action.includes("UPDATE") || action === "2FA_CODE_SENT") return "information";
  return "neutral";
}

function getAuditStatusLabel(tone: string) {
  const labels: Record<string, string> = {
    success: "Success",
    information: "Information",
    warning: "Warning",
    failure: "Failure",
    neutral: "Recorded",
  };
  return labels[tone] ?? "Recorded";
}

function formatAuditFieldLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "ALL">("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [period, setPeriod] = useState<Period>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);


useEffect(() => {
  if (period === "custom" && (!fromDate || !toDate || fromDate > toDate)) {
    setLogs([]);
    return;
  }

  const controller = new AbortController();
  const params = new URLSearchParams({ period });
  if (period === "custom") {
    params.set("from", fromDate);
    params.set("to", toDate);
  }

  fetch(`/api/audit?${params}`, { signal: controller.signal })
    .then(async (r) => {
      if (!r.ok) throw new Error(`Audit API failed: ${r.status}`);
      const data = await r.json();

      setLogs(
        Array.isArray(data)
          ? data
          : []
      );
    })
    .catch(() => {
      if (!controller.signal.aborted) setLogs([]);
    });

  return () => controller.abort();
}, [period, fromDate, toDate]);

const cellStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const actionOptions = categoryFilter === "ALL"
  ? AUDIT_ACTIONS
  : AUDIT_ACTIONS_BY_CATEGORY[categoryFilter];

const activeCount =
  (search ? 1 : 0) +
  (categoryFilter !== "ALL" ? 1 : 0) +
  (actionFilter !== "ALL" ? 1 : 0) +
  (period !== "all" ? 1 : 0);
  
const filteredLogs = logs.filter((log) => {
  const term = search.toLowerCase();

const matchesSearch =
  !search ||
  String(log.id).toLowerCase().includes(term) ||
  (log.action ?? "").toLowerCase().includes(term) ||
  (log.entityType ?? "").toLowerCase().includes(term) ||
  (log.entityId ?? "").toLowerCase().includes(term) ||
  (log.actorName ?? "").toLowerCase().includes(term) ||
  (log.actorUsername ?? "").toLowerCase().includes(term) ||
  (log.details?.user ?? "").toLowerCase().includes(term) ||
  (log.details?.name ?? "").toLowerCase().includes(term) ||
  (log.details?.username ?? "").toLowerCase().includes(term);

  const matchesAction =
    actionFilter === "ALL" ||
    log.action === actionFilter;
  const matchesCategory =
    categoryFilter === "ALL" ||
    getAuditCategory(log) === categoryFilter;

  return (
    matchesSearch &&
    matchesAction &&
    matchesCategory
  );
});

const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
const pageStart = (currentPage - 1) * pageSize;
const paginatedLogs = filteredLogs.slice(pageStart, pageStart + pageSize);
const firstRecord = filteredLogs.length ? pageStart + 1 : 0;
const lastRecord = Math.min(pageStart + pageSize, filteredLogs.length);
const today = new Date().toDateString();
const todayCount = filteredLogs.filter(
  (log) => new Date(log.createdAt).toDateString() === today
).length;
const createCount = filteredLogs.filter((log) => {
  const action = String(log.action ?? "");
  return action.includes("CREATE") || action.endsWith("_ADD");
}).length;
const deleteCount = filteredLogs.filter((log) =>
  String(log.action ?? "").includes("DELETE")
).length;



  return (
    <div className="page audit-page">
      <style jsx>{`
        .audit-toolbar { display:flex; flex-wrap:wrap; align-items:end; gap:10px; margin-bottom:16px; padding:12px; border:1px solid var(--line); border-radius:10px; background:var(--panel); box-shadow:0 3px 12px rgba(18,38,63,.04); }
        .audit-search { position:relative; display:flex; align-items:center; flex:1 1 240px; min-width:0; margin-right:2px; }
        .audit-search-icon { position:absolute; left:12px; color:var(--muted); pointer-events:none; }
        .audit-search input { width:100%; padding:9px 11px 9px 38px; border:1px solid var(--line2); border-radius:9px; background:var(--input-bg); }
        .audit-control { display:grid; flex:0 1 150px; gap:4px; min-width:120px; color:var(--muted); font-size:11px; font-weight:650; }
        .audit-control select,.audit-control input { width:100%; height:36px; min-width:0; padding:0 9px; border-radius:6px; }
        .audit-export { display:inline-flex; align-items:center; justify-content:center; margin-left:auto; gap:7px; white-space:nowrap; }
        .audit-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0 20px; }
        .audit-pagination { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; margin-top:16px; padding-top:12px; border-top:1px solid var(--line); }
        .audit-pagination-controls { display:flex; align-items:center; gap:8px; }
        .audit-page-size { display:flex; align-items:center; gap:7px; color:var(--muted); font-size:13px; }
        .audit-page-size select { height:34px; padding:0 8px; border-radius:6px; }
        .audit-table-wrap { max-height:min(68vh,720px); overflow:auto; border:1px solid var(--line); border-radius:10px; }
        .audit-table-wrap :global(table) { min-width:760px; font-size:13px; }
        .audit-table-wrap :global(th) { top:0; z-index:2; padding:13px 16px; }
        .audit-table-wrap :global(td) { padding:15px 16px; vertical-align:middle; }
        .audit-row { cursor:pointer; transition:background-color .16s ease; }
        .audit-row:hover { background:var(--row-hover); }
        .audit-row:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
        .audit-avatar { display:grid; place-items:center; width:36px; height:36px; flex:none; border:1px solid var(--line); border-radius:50%; background:var(--barbg); color:var(--text); font-size:12px; font-weight:650; }
        .audit-user-name { color:var(--text); font-weight:650; }
        .audit-secondary { display:block; margin-top:4px; color:var(--muted); font-size:12px; }
        .audit-entity { color:var(--record-content); font-weight:600; }
        .audit-activity-context { display:block; margin-top:6px; color:var(--muted); font-size:12px; }
        .audit-datetime strong { display:block; color:var(--text); font-size:13px; font-weight:600; }
        .audit-datetime small { display:block; margin-top:4px; color:var(--muted); font-size:12px; }
        .audit-badge { display:inline-flex; align-items:center; min-height:25px; padding:4px 10px; border-radius:999px; font-size:12px; font-weight:650; line-height:1.2; white-space:nowrap; }
        .audit-badge--success { background:var(--chip-ok-bg); color:var(--chip-ok-fg); }
        .audit-badge--information { background:var(--pill-blue-bg); color:var(--chip-fg); }
        .audit-badge--warning { background:var(--pill-amber-bg); color:var(--pending); }
        .audit-badge--failure { background:var(--chip-bad-bg); color:var(--chip-bad-fg); }
        .audit-badge--neutral { background:var(--code-bg); color:var(--muted); }
        .audit-details-button { display:grid; place-items:center; width:34px; height:34px; border:1px solid var(--line2); border-radius:8px; background:var(--panel); color:var(--muted); cursor:pointer; transition:background-color .16s ease,color .16s ease,border-color .16s ease; }
        .audit-details-button:hover { border-color:var(--accent); background:var(--pill-blue-bg); color:var(--chip-fg); }
        .audit-empty { display:grid; justify-items:center; gap:6px; padding:38px 20px; border:1px dashed var(--line2); border-radius:10px; background:var(--hint-bg); color:var(--muted); text-align:center; }
        .audit-empty strong { color:var(--text); font-size:14px; }
        @media(max-width:560px) { .audit-search,.audit-export { flex-basis:100%; } .audit-control { flex:1 1 calc(50% - 10px); min-width:0; } .audit-pagination { align-items:flex-start; } .audit-pagination-controls { width:100%; justify-content:space-between; } }
        .audit-kpi { position:relative; display:flex; flex-direction:column; overflow:hidden; min-height:102px; padding:14px 16px 12px 20px; border:1px solid color-mix(in srgb,var(--border) 70%,var(--muted)); border-radius:9px; background:var(--panel); box-shadow:0 3px 12px rgba(0,0,0,.12); transition:transform .18s ease,box-shadow .18s ease; }
        .audit-kpi:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.18); }
        .audit-kpi:before { position:absolute; inset:0 auto 0 0; width:4px; content:""; background:var(--kpi-accent); }
        .audit-kpi-top { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:12px; font-weight:650; }
        .audit-kpi-icon { display:grid; place-items:center; width:30px; height:30px; border-radius:7px; color:var(--kpi-accent); background:color-mix(in srgb,var(--kpi-accent) 15%,var(--panel)); }
        .audit-kpi strong { display:block; margin-top:7px; color:var(--text); font-size:27px; line-height:1; letter-spacing:0; }
        .audit-dialog { width:min(100%,720px); max-height:min(85vh,760px); overflow-y:auto; padding:24px; border:1px solid var(--line); border-radius:8px; background:var(--panel); color:var(--text); box-shadow:0 20px 60px rgba(0,0,0,.24); }
        .audit-dialog-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:20px; }
        .audit-dialog-title-row { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
        .audit-dialog-title { margin:0; font-size:20px; line-height:1.3; font-weight:700; overflow-wrap:anywhere; }
        .audit-dialog-status { display:inline-flex; align-items:center; min-height:24px; padding:4px 9px; border-radius:999px; font-size:11px; font-weight:650; line-height:1.2; white-space:nowrap; }
        .audit-dialog-close { display:grid; place-items:center; width:34px; height:34px; flex:none; border:1px solid var(--line2); border-radius:8px; background:var(--panel); color:var(--muted); cursor:pointer; }
        .audit-dialog-summary { display:grid; gap:12px; padding:16px; border:1px solid var(--line); border-radius:8px; background:var(--hint-bg); }
        .audit-dialog-summary h3 { margin:0; color:var(--text); font-size:14px; font-weight:650; }
        .audit-dialog-summary-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 20px; }
        .audit-dialog-label { color:var(--muted); font-size:11px; font-weight:650; }
        .audit-dialog-value { margin-top:4px; color:var(--text); font-size:13px; font-weight:550; overflow-wrap:anywhere; }
        .audit-dialog-datetime { display:flex; align-items:center; gap:6px; }
        .audit-dialog-section { margin-top:20px; }
        .audit-dialog-section h3 { margin:0 0 9px; color:var(--text); font-size:14px; font-weight:650; }
        .audit-dialog-table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:7px; }
        .audit-dialog-table { width:100%; min-width:440px; margin:0; }
        .audit-dialog-table :global(th),.audit-dialog-table :global(td) { padding:10px 12px; }
        .audit-dialog-table :global(td) { overflow-wrap:anywhere; white-space:pre-wrap; }
        .audit-dialog-metadata { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 18px; padding:14px 16px; border:1px solid var(--line); border-radius:7px; background:var(--panel); }
        .audit-dialog-raw-detail { margin:0; padding:14px 16px; border:1px solid var(--line); border-radius:7px; background:var(--panel); font-size:13px; line-height:1.55; white-space:pre-wrap; overflow-wrap:anywhere; }
        @media(max-width:560px) { .audit-dialog { padding:18px; } .audit-dialog-summary-grid,.audit-dialog-metadata { grid-template-columns:1fr; gap:13px; } }
        @media(max-width:760px) { .audit-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media(max-width:480px) { .audit-kpi { padding:13px 12px 12px 15px; } .audit-kpi strong { font-size:24px; } }
      `}</style>
      <section className="panel">
<div className="audit-toolbar">
  <label className="audit-search">
    <Search className="audit-search-icon" size={17} aria-hidden="true" />
    <input
      type="search"
      aria-label="Search audit logs"
      placeholder="Search audit logs"
      value={search}
      onChange={(e) => {
        setSearch(e.target.value);
        setCurrentPage(1);
      }}
    />
  </label>

  <label className="audit-control">
    Period
    <select
      value={period}
      onChange={(e) => {
        const nextPeriod = e.target.value as Period;
        setPeriod(nextPeriod);
        setCurrentPage(1);
        if (nextPeriod !== "custom") {
          setFromDate("");
          setToDate("");
        }
      }}
    >
      {PERIOD_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </label>

  <label className="audit-control">
    Category
    <select
      value={categoryFilter}
      onChange={(e) => {
        setCategoryFilter(e.target.value as AuditCategory | "ALL");
        setActionFilter("ALL");
        setCurrentPage(1);
      }}
    >
      <option value="ALL">All Categories</option>
      {AUDIT_CATEGORIES.map((category) => (
        <option key={category.value} value={category.value}>{category.label}</option>
      ))}
    </select>
  </label>

  <label className="audit-control">
    Action
    <select
      value={actionFilter}
      onChange={(e) => {
        setActionFilter(e.target.value);
        setCurrentPage(1);
      }}
    >
  <option value="ALL">All Actions</option>
  {actionOptions.map((action) => (
    <option key={action} value={action}>{formatAuditAction(action)}</option>
  ))}
    </select>
  </label>

  {period === "custom" && (
    <>
      <label className="audit-control">
        From
        <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }} />
      </label>
      <label className="audit-control">
        To
        <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }} />
      </label>
    </>
  )}

  <button
    className="primary audit-export"
    onClick={() => {
      const p = new URLSearchParams();

      if (search) p.set("search", search);
      if (actionFilter !== "ALL")
        p.set("action", actionFilter);
      if (categoryFilter !== "ALL")
        p.set("category", categoryFilter);
      if (fromDate) p.set("from", fromDate);
      if (toDate) p.set("to", toDate);

      window.location.href =
        `/api/audit/export?${p.toString()}`;
    }}
  >
    <Download size={16} aria-hidden="true" />
    Export Excel
  </button>
</div>

{activeCount > 0 && (
  <div style={{ marginTop: -6, marginBottom: 14 }}>
    <button
      className="chip"
      onClick={() => {
        setSearch("");
        setCategoryFilter("ALL");
        setActionFilter("ALL");
        setPeriod("all");
        setFromDate("");
        setToDate("");
        setCurrentPage(1);
      }}
    >
      Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
    </button>
  </div>
)}

<div className="audit-kpis" aria-label="Audit log summary">
  <div className="audit-kpi" style={{ "--kpi-accent": "#2563eb" } as React.CSSProperties}>
    <div className="audit-kpi-top"><span>Total Logs</span><span className="audit-kpi-icon"><Activity size={16} aria-hidden="true" /></span></div>
    <strong>{filteredLogs.length}</strong>
  </div>
  <div className="audit-kpi" style={{ "--kpi-accent": "#0891b2" } as React.CSSProperties}>
    <div className="audit-kpi-top"><span>Today's Activities</span><span className="audit-kpi-icon"><CalendarDays size={16} aria-hidden="true" /></span></div>
    <strong>{todayCount}</strong>
  </div>
  <div className="audit-kpi" style={{ "--kpi-accent": "#16a34a" } as React.CSSProperties}>
    <div className="audit-kpi-top"><span>Create Actions</span><span className="audit-kpi-icon"><FilePlus2 size={16} aria-hidden="true" /></span></div>
    <strong>{createCount}</strong>
  </div>
  <div className="audit-kpi" style={{ "--kpi-accent": "#dc2626" } as React.CSSProperties}>
    <div className="audit-kpi-top"><span>Delete Actions</span><span className="audit-kpi-icon"><Trash2 size={16} aria-hidden="true" /></span></div>
    <strong>{deleteCount}</strong>
  </div>
</div>

{filteredLogs.length ? (
  <div className="audit-table-wrap">
    <table className="table">
      <colgroup>
        <col style={{ width: "20%" }} />
        <col style={{ width: "46%" }} />
        <col style={{ width: "24%" }} />
        <col style={{ width: "10%" }} />
      </colgroup>
      <thead>
        <tr>
          <th>Date &amp; Time</th>
          <th>Activity</th>
          <th>User</th>
          <th>Details</th>
        </tr>
      </thead>

      <tbody>
        {paginatedLogs.map((log) => {
          const userName = getAuditUserName(log);

          const initials = String(userName)
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
              <tr
                key={log.id}
                className="audit-row"
                tabIndex={0}
                aria-label={`${formatAuditAction(log.action)} by ${userName}; view audit details`}
                onClick={() => setSelectedLog(log)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedLog(log);
                  }
                }}
              >
              <td>
                <div className="audit-datetime">
                  <strong>{new Date(log.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" })}</strong>
                  <small>{new Date(log.createdAt).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</small>
                </div>
              </td>

              <td>
                <span className={`audit-badge audit-badge--${getAuditTone(log.action)}`}>
                  {formatAuditAction(log.action)}
                </span>
                <small className="audit-activity-context">
                  {[log.entityType ? formatAuditAction(log.entityType) : "System", log.entityId ? `Ref ${log.entityId}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </td>

              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div className="audit-avatar">{initials}</div>
                  <div className="audit-user-name">{userName}</div>
                </div>
              </td>

              <td>
                <button
                  type="button"
                  className="audit-details-button"
                  aria-label={`View details for audit log ${log.id}`}
                  title="View details"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLog(log);
                  }}
                >
                  <Eye size={16} aria-hidden="true" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
) : (
  <div className="audit-empty" role="status">
    <Activity size={22} aria-hidden="true" />
    <strong>No audit activity found</strong>
    <span>Try adjusting your search or filters.</span>
  </div>
)}

{selectedLog && (() => {
  const details = selectedLog.details;
  const detailObject = details && typeof details === "object" && !Array.isArray(details)
    ? details
    : {};
  const changeKeys = ["changes", "change", "diff", "before", "after"];
  const explicitChanges = detailObject.changes ?? detailObject.change ?? detailObject.diff;
  const changes = explicitChanges ?? (
    detailObject.before !== undefined || detailObject.after !== undefined
      ? { before: detailObject.before, after: detailObject.after }
      : null
  );
  const changeRows = Array.isArray(changes)
    ? changes.map((change, index) => ({
        field: change?.field ?? change?.key ?? change?.name ?? `Change ${index + 1}`,
        oldValue: change?.oldValue ?? change?.old ?? change?.before ?? change?.from,
        newValue: change?.newValue ?? change?.new ?? change?.after ?? change?.to,
      }))
    : changes && typeof changes === "object"
    ? (() => {
        const changeObject = changes as Record<string, unknown>;
        const before = changeObject.before;
        const after = changeObject.after;
        if (
          (before && typeof before === "object") ||
          (after && typeof after === "object")
        ) {
          const beforeValues = before && typeof before === "object" ? before as Record<string, unknown> : {};
          const afterValues = after && typeof after === "object" ? after as Record<string, unknown> : {};
          return [...new Set([...Object.keys(beforeValues), ...Object.keys(afterValues)])].map((field) => ({
            field,
            oldValue: beforeValues[field],
            newValue: afterValues[field],
          }));
        }
        return Object.entries(changeObject).map(([field, value]) => {
          const entry = value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
          return {
            field,
            oldValue: entry?.oldValue ?? entry?.old ?? entry?.before ?? entry?.from,
            newValue: entry
              ? entry.newValue ?? entry.new ?? entry.after ?? entry.to
              : value,
          };
        });
      })()
    : [];
  const additionalMetadata = Object.fromEntries(
    Object.entries(detailObject).filter(([key]) =>
      !["actor", "user", "name", "username", "metadata", "meta", ...changeKeys].includes(key)
    )
  );
  const explicitMetadata = detailObject.metadata ?? detailObject.meta;
  const metadata = {
    ...(explicitMetadata && typeof explicitMetadata === "object" && !Array.isArray(explicitMetadata)
      ? explicitMetadata
      : explicitMetadata !== undefined ? { value: explicitMetadata } : {}),
    ...additionalMetadata,
  };
  const userName = getAuditUserName(selectedLog);
  const displayValue = (value: unknown) =>
    value === null || value === undefined || value === "" ? "-" : formatAuditValue(value);
  const hasDetailValue = (value: unknown) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return true;
  };
  const metadataEntries = Object.entries(metadata).filter(([, value]) => hasDetailValue(value));
  const hasRawDetails = details !== null && details !== undefined && details !== "" &&
    (typeof details !== "object" || Array.isArray(details)) && hasDetailValue(details);
  const hasMetadata = metadataEntries.length > 0 || hasRawDetails;
  const actionTone = getAuditTone(selectedLog.action);
  const tone = actionTone === "neutral" ? "information" : actionTone;
  const timestamp = selectedLog.createdAt
    ? new Date(selectedLog.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
    : "Time not recorded";

  return (
    <div
      role="presentation"
      onClick={() => setSelectedLog(null)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgba(15, 23, 42, 0.52)",
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-details-title"
        onClick={(event) => event.stopPropagation()}
        className="audit-dialog"
      >
        <header className="audit-dialog-header">
          <div>
            <div className="audit-dialog-title-row">
              <h2 id="audit-details-title" className="audit-dialog-title">{formatAuditAction(selectedLog.action)}</h2>
              <span className={`audit-dialog-status audit-badge--${tone}`}>{getAuditStatusLabel(tone)}</span>
            </div>
          </div>
          <button
            type="button"
            className="audit-dialog-close"
            aria-label="Close audit details"
            onClick={() => setSelectedLog(null)}
            title="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <section className="audit-dialog-summary" aria-labelledby="audit-summary-title">
          <h3 id="audit-summary-title">Activity Summary</h3>
          <div className="audit-dialog-summary-grid">
            <div><div className="audit-dialog-label">Event</div><div className="audit-dialog-value">{formatAuditAction(selectedLog.action)}</div></div>
            <div><div className="audit-dialog-label">Category</div><div className="audit-dialog-value">{selectedLog.entityType ? formatAuditAction(selectedLog.entityType) : "System"}</div></div>
            <div><div className="audit-dialog-label">User</div><div className="audit-dialog-value">{displayValue(userName)}</div></div>
            <div><div className="audit-dialog-label">Date &amp; Time</div><div className="audit-dialog-value audit-dialog-datetime"><Clock3 size={14} aria-hidden="true" />{timestamp}</div></div>
          </div>
        </section>

        {changeRows.length > 0 && (
          <section className="audit-dialog-section">
            <h3>Changes</h3>
            <div className="audit-dialog-table-wrap">
              <table className="table audit-dialog-table">
                <thead>
                  <tr><th>Field</th><th>Previous</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {changeRows.map((change, index) => (
                    <tr key={`${String(change.field)}-${index}`}>
                      <td style={{ overflowWrap: "anywhere" }}>{displayValue(change.field)}</td>
                      <td style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{displayValue(change.oldValue)}</td>
                      <td style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{displayValue(change.newValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        {hasMetadata && (
          <section className="audit-dialog-section">
            <h3>Additional details</h3>
            {metadataEntries.length > 0 ? (
              <div className="audit-dialog-metadata">
                {metadataEntries.map(([key, value]) => (
                  <div key={key}>
                    <div className="audit-dialog-label">{formatAuditFieldLabel(key)}</div>
                    <div className="audit-dialog-value">{value === null || value === undefined || value === "" ? "Not provided" : formatAuditValue(value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="audit-dialog-raw-detail">{formatAuditValue(details)}</p>
            )}
          </section>
        )}
      </section>
    </div>
  );
})()}

  <div className="audit-pagination">
    <span className="muted">
      Showing {firstRecord}-{lastRecord} of {filteredLogs.length} records
    </span>
    <div className="audit-pagination-controls">
      <label className="audit-page-size">
        Rows
        <select
          aria-label="Rows per page"
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value));
            setCurrentPage(1);
          }}
        >
          {[10, 20, 50, 100].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
      <button
        className="chip"
        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
        disabled={currentPage === 1}
      >
        Previous
      </button>
      <span aria-current="page" style={{ minWidth: 72, textAlign: "center", fontSize: 13, fontWeight: 600 }}>
        Page {currentPage} of {totalPages}
      </span>
      <button
        className="chip"
        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
        disabled={currentPage === totalPages}
      >
        Next
      </button>
    </div>
  </div>
      </section>
    </div>
  );
}
