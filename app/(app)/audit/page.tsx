"use client";

import { useEffect, useState } from "react";

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");


  useEffect(() => {
    fetch("/api/audit")
      .then((r) => r.json())
      .then(setLogs);
  }, []);

const cellStyle = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const filterStyle = {
  height: "40px",
  padding: "0 12px",
  borderRadius: "6px",
};

const filteredLogs = logs.filter((log) => {
  const term = search.toLowerCase();

  const matchesSearch =
    !search ||
    String(log.id).toLowerCase().includes(term) ||
    (log.action ?? "").toLowerCase().includes(term) ||
    (log.entityType ?? "").toLowerCase().includes(term) ||
    (log.entityId ?? "").toLowerCase().includes(term) ||
    (log.details?.name ?? "").toLowerCase().includes(term);

  const matchesAction =
    actionFilter === "ALL" ||
    log.action === actionFilter;

  const logDate = new Date(log.createdAt);

  const matchesFrom =
    !fromDate ||
    logDate >= new Date(fromDate);

  const matchesTo =
    !toDate ||
    logDate <= new Date(`${toDate}T23:59:59`);

  return (
    matchesSearch &&
    matchesAction &&
    matchesFrom &&
    matchesTo
  );
});



  return (
    <div className="page">
      <section className="panel">
        <div className="panelhead">
          <div>
	    <h3>Audit Logs ({filteredLogs.length})</h3>
            <span className="muted">
              System activity and user actions
            </span>
          </div>
        </div>

<div
  style={{
    display: "flex",
    gap: "12px",
    marginBottom: "16px",
    flexWrap: "wrap",
    alignItems: "center",
  }}
>

<input
  type="text"
  placeholder="Search action, user, reference, or type..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    ...filterStyle,
    minWidth: "300px",
  }}
/>

<select
  value={actionFilter}
  onChange={(e) => setActionFilter(e.target.value)}
  style={{
    padding: "8px 12px",
  }}
>
  <option value="ALL">All Actions</option>
  <option value="CREATE">CREATE</option>
  <option value="UPDATE">UPDATE</option>
  <option value="DELETE">DELETE</option>
  <option value="LOCK">LOCK</option>
  <option value="UNLOCK">UNLOCK</option>
  <option value="LOGIN">LOGIN</option>
  <option value="LOGOUT">LOGOUT</option>
  <option value="LOGIN_FAILED">LOGIN_FAILED</option>
  <option value="MASTERDATA_ADD">MASTERDATA_ADD</option>
  <option value="MASTERDATA_RETIRE">MASTERDATA_RETIRE</option>
  <option value="MASTERDATA_RESTORE">MASTERDATA_RESTORE</option>
</select>

<input
  type="date"
  value={fromDate}
  onChange={(e) => setFromDate(e.target.value)}
  style={filterStyle}
/>

<input
  type="date"
  value={toDate}
  onChange={(e) => setToDate(e.target.value)}
  style={filterStyle}
/>

<button
  className="secondary"
  style={{
    height: "40px",
    padding: "0 12px",
  }}
  onClick={() => {
    setSearch("");
    setActionFilter("ALL");
    setFromDate("");
    setToDate("");
  }}
>
  Clear Filters
</button>

</div>


       {filteredLogs.length ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
		  "220px 200px 140px 220px 180px",
                gap: "12px",
                padding: "12px",
                fontWeight: 600,
                borderBottom: "2px solid #d1d5db",
              }}
            >
              <span>Date/Time</span>
              <span>Action</span>
              <span>Type</span>
              <span>Reference</span>
              <span>User</span>
            </div>

	    {filteredLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
		    "220px 200px 140px 220px 180px",
                  gap: "12px",
                  padding: "12px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <span>
                  {new Date(log.createdAt).toLocaleString()}
                </span>

		<span style={cellStyle}>{log.action}</span>

                <span>{log.entityType}</span>

                <span>{log.entityId}</span>

		<span>
		  {log.details?.name ??
		    log.details?.username ??
		    (log.userId ? `User #${log.userId}` : "Anonymous")}
		</span>


              </div>
            ))}
          </>
        ) : (
          <div className="empty">
            No audit activity found.
          </div>
        )}
      </section>
    </div>
  );
}
