"use client";

import { useEffect, useState } from "react";
import { Activity, CalendarDays, Download, Eye, FilePlus2, Search, Trash2, X } from "lucide-react";
import { PERIOD_OPTIONS, type Period } from "@/lib/period";

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

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [period, setPeriod] = useState<Period>("today");
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

const rowStyle = {
  transition: "all 0.2s ease",
  cursor: "pointer",
};

const activeCount =
  (search ? 1 : 0) +
  (actionFilter !== "ALL" ? 1 : 0) +
  (period !== "today" ? 1 : 0);
  
const filteredLogs = logs.filter((log) => {
  const term = search.toLowerCase();

const matchesSearch =
  !search ||
  String(log.id).toLowerCase().includes(term) ||
  (log.action ?? "").toLowerCase().includes(term) ||
  (log.entityType ?? "").toLowerCase().includes(term) ||
  (log.entityId ?? "").toLowerCase().includes(term) ||
  (log.details?.user ?? "").toLowerCase().includes(term) ||
  (log.details?.name ?? "").toLowerCase().includes(term) ||
  (log.details?.username ?? "").toLowerCase().includes(term);

  const matchesAction =
    actionFilter === "ALL" ||
    log.action === actionFilter;

  return (
    matchesSearch &&
    matchesAction
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
        @media(max-width:560px) { .audit-search,.audit-export { flex-basis:100%; } .audit-control { flex:1 1 calc(50% - 10px); min-width:0; } .audit-pagination { align-items:flex-start; } .audit-pagination-controls { width:100%; justify-content:space-between; } }
        .audit-kpi { position:relative; display:flex; flex-direction:column; overflow:hidden; min-height:102px; padding:14px 16px 12px 20px; border:1px solid color-mix(in srgb,var(--border) 70%,var(--muted)); border-radius:9px; background:var(--panel); box-shadow:0 3px 12px rgba(0,0,0,.12); transition:transform .18s ease,box-shadow .18s ease; }
        .audit-kpi:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.18); }
        .audit-kpi:before { position:absolute; inset:0 auto 0 0; width:4px; content:""; background:var(--kpi-accent); }
        .audit-kpi-top { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:12px; font-weight:650; }
        .audit-kpi-icon { display:grid; place-items:center; width:30px; height:30px; border-radius:7px; color:var(--kpi-accent); background:color-mix(in srgb,var(--kpi-accent) 15%,var(--panel)); }
        .audit-kpi strong { display:block; margin-top:7px; color:var(--text); font-size:27px; line-height:1; letter-spacing:0; }
        @media(max-width:760px) { .audit-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media(max-width:480px) { .audit-kpi { padding:13px 12px 12px 15px; } .audit-kpi strong { font-size:24px; } }
      `}</style>
      <section className="panel">
        <div className="panelhead">
          <div>
	    <h3>Audit Logs ({filteredLogs.length})</h3>
            <span className="muted">
              System activity and user actions
            </span>
          </div>
        </div>

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
    Action
    <select
      value={actionFilter}
      onChange={(e) => {
        setActionFilter(e.target.value);
        setCurrentPage(1);
      }}
    >
  <option value="ALL">All Actions</option>
  <option value="CREATE">CREATE</option>
  <option value="UPDATE">UPDATE</option>
  <option value="UPDATE_PROFILE">UPDATE_PROFILE</option>
  <option value="UPDATE_USER">UPDATE_USER</option>
  <option value="DELETE">DELETE</option>
  <option value="IMPORT">IMPORT</option>
  <option value="IMPORT_BOTH">IMPORT_BOTH</option>
  <option value="LOCK">LOCK</option>
  <option value="UNLOCK">UNLOCK</option>
  <option value="LOGIN">LOGIN</option>
  <option value="LOGOUT">LOGOUT</option>
  <option value="LOGIN_FAILED">LOGIN_FAILED</option>
  <option value="2FA_ENABLED">2FA_ENABLED</option>
  <option value="2FA_DISABLED">2FA_DISABLED</option>
  <option value="2FA_CODE_SENT">2FA_CODE_SENT</option>
  <option value="2FA_SUCCESS">2FA_SUCCESS</option>
  <option value="2FA_FAILURE">2FA_FAILURE</option>
  <option value="REPORT_EMAIL_SENT">REPORT_EMAIL_SENT</option>
  <option value="REPORT_EMAIL_FAILED">REPORT_EMAIL_FAILED</option>
  <option value="MASTERDATA_ADD">MASTERDATA_ADD</option>
  <option value="MASTERDATA_RETIRE">MASTERDATA_RETIRE</option>
  <option value="MASTERDATA_RESTORE">MASTERDATA_RESTORE</option>
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
        setActionFilter("ALL");
        setPeriod("today");
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
  <div className="tablewrap">
    <table className="table">
      <thead>
        <tr>
          <th>User</th>
          <th>Action</th>
          <th>Type</th>
          <th>Reference</th>
          <th>Date / Time</th>
          <th>Details</th>
        </tr>
      </thead>

      <tbody>
        {paginatedLogs.map((log) => {
          console.log("AUDIT LOG:", log);
          const userName =
            log.details?.actor ??
            log.details?.user ??
            log.details?.name ??
            log.details?.username ??
            (log.userId ? `User #${log.userId}` : "Anonymous");

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
                style={rowStyle}
                tabIndex={0}
                aria-label={`View audit details for ${log.action} by ${userName}`}
                onClick={() => setSelectedLog(log)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedLog(log);
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#f8fafc";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "";
                }}
              >
              <td>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#374151",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>

                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                      }}
                    >
                      {userName}
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      {log.entityType}
                    </div>
                  </div>
                </div>
              </td>

              <td>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background:
                      log.action.includes("DELETE") ||
                      log.action.includes("FAILED")
                        ? "#fee2e2"
                        : log.action.includes("CREATE") ||
                          log.action.includes("ADD")
                        ? "#dcfce7"
                        : log.action.includes("UPDATE")
                        ? "#dbeafe"
                        : log.action.includes("LOGIN")
                        ? "#f3e8ff"
                        : log.action.includes("LOGOUT")
                        ? "#f3f4f6"
                        : "#f3f4f6",

                    color:
                      log.action.includes("DELETE") ||
                      log.action.includes("FAILED")
                        ? "#b91c1c"
                        : log.action.includes("CREATE") ||
                          log.action.includes("ADD")
                        ? "#166534"
                        : log.action.includes("UPDATE")
                        ? "#1d4ed8"
                        : log.action.includes("LOGIN")
                        ? "#7e22ce"
                        : log.action.includes("LOGOUT")
                        ? "#4b5563"
                        : "#4b5563",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {log.action}
                </span>
              </td>

              <td
                style={{
                  fontWeight: 600,
                  textTransform: "uppercase",
                  color: "#374151",
                }}
              >
                {log.entityType}
              </td>

              <td>
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                    }}
                  >
                    {log.entityId || "-"}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    {log.action === "CREATE"
                      ? "Record Created"
                      : log.action === "UPDATE"
                      ? "Record Updated"
                      : log.action === "DELETE"
                      ? "Record Deleted"
                      : log.action === "LOGIN"
                      ? "User Authentication"
                      : log.action === "LOGOUT"
                      ? "Session Ended"
                      : log.action === "LOCK"
                      ? "Record Locked"
                      : log.action === "UNLOCK"
                      ? "Record Unlocked"
                      : log.entityType}
                  </div>
                </div>
              </td>

              <td>
                {new Date(log.createdAt).toLocaleString("en-PH", {
                  year: "numeric",
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td>
                <button
                  type="button"
                  className="chip"
                  aria-label={`View details for audit log ${log.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedLog(log);
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Eye size={14} aria-hidden="true" />
                  View Details
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
) : (
  <div className="empty">
    No audit activity found.
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
  const userName =
    detailObject.actor ??
    detailObject.user ??
    detailObject.name ??
    detailObject.username ??
    (selectedLog.userId ? `User #${selectedLog.userId}` : "Anonymous");
  const displayValue = (value: unknown) =>
    value === null || value === undefined || value === "" ? "-" : formatAuditValue(value);

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
        style={{
          width: "min(100%, 720px)",
          maxHeight: "min(85vh, 760px)",
          overflowY: "auto",
          padding: 24,
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--panel)",
          color: "var(--text)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.24)",
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
          <div>
            <h2 id="audit-details-title" style={{ margin: 0, fontSize: 20 }}>Audit Details</h2>
            <span className="muted">Log #{selectedLog.id}</span>
          </div>
          <button
            type="button"
            className="chip"
            aria-label="Close audit details"
            onClick={() => setSelectedLog(null)}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
          <div><strong>User</strong><div style={{ marginTop: 4, overflowWrap: "anywhere" }}>{displayValue(userName)}</div></div>
          <div><strong>Action</strong><div style={{ marginTop: 4, overflowWrap: "anywhere" }}>{displayValue(selectedLog.action)}</div></div>
          <div><strong>Type</strong><div style={{ marginTop: 4, overflowWrap: "anywhere" }}>{displayValue(selectedLog.entityType)}</div></div>
          <div><strong>Reference</strong><div style={{ marginTop: 4, overflowWrap: "anywhere" }}>{displayValue(selectedLog.entityId)}</div></div>
          <div><strong>Timestamp</strong><div style={{ marginTop: 4 }}>{selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }) : "-"}</div></div>
        </div>

        <div style={{ display: "grid", gap: 16, marginTop: 22 }}>
          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Changes</h3>
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
              <table className="table" style={{ margin: 0, minWidth: 480 }}>
                <thead>
                  <tr><th>Field</th><th>Old Value</th><th>New Value</th></tr>
                </thead>
                <tbody>
                  {changeRows.length ? changeRows.map((change, index) => (
                    <tr key={`${String(change.field)}-${index}`}>
                      <td style={{ overflowWrap: "anywhere" }}>{displayValue(change.field)}</td>
                      <td style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{displayValue(change.oldValue)}</td>
                      <td style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{displayValue(change.newValue)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={3} className="muted">No changes recorded</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>Metadata</h3>
            <pre style={{ margin: 0, padding: 12, border: "1px solid var(--border)", borderRadius: 6, background: "var(--background)", font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {formatAuditValue(
                typeof details === "object" && !Array.isArray(details)
                  ? Object.keys(metadata).length ? metadata : null
                  : details
              )}
            </pre>
          </section>
        </div>
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
