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
    .then(async (r) => {
      const data = await r.json();

      setLogs(
        Array.isArray(data)
          ? data
          : []
      );
    })
    .catch(() => setLogs([]));
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

const rowStyle = {
  transition: "all 0.2s ease",
  cursor: "default",
};

const activeCount =
  (search ? 1 : 0) +
  (actionFilter !== "ALL" ? 1 : 0) +
  (fromDate ? 1 : 0) +
  (toDate ? 1 : 0);
  
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    marginBottom: "16px",
  }}
>
  <div
    style={{
      display: "flex",
      gap: "12px",
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >


<input
  type="text"
  placeholder="Search audit logs..."
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
    ...filterStyle,
    minWidth: "180px",
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
  <option value="REPORT_EMAIL_SENT">REPORT_EMAIL_SENT</option>
  <option value="REPORT_EMAIL_FAILED">REPORT_EMAIL_FAILED</option>
  <option value="MASTERDATA_ADD">MASTERDATA_ADD</option>
  <option value="MASTERDATA_RETIRE">MASTERDATA_RETIRE</option>
  <option value="MASTERDATA_RESTORE">MASTERDATA_RESTORE</option>
</select>

<div
  style={{
    display: "flex",
    alignItems: "center",
    gap: "8px",
  }}
>
  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      color: "#6b7280",
    }}
  >
    FROM
  </span>

  <input
    type="date"
    value={fromDate}
    onChange={(e) => setFromDate(e.target.value)}
    style={filterStyle}
  />

  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      color: "#6b7280",
    }}
  >
    TO
  </span>

  <input
    type="date"
    value={toDate}
    onChange={(e) => setToDate(e.target.value)}
    style={filterStyle}
  />
</div>


{activeCount > 0 && (
  <button
    className="chip"
    onClick={() => {
      setSearch("");
      setActionFilter("ALL");
      setFromDate("");
      setToDate("");
    }}
  >
    ✕ Clear {activeCount} filter{activeCount > 1 ? "s" : ""}
  </button>
)}
  </div>

  <button
    className="primary"
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
    ⬇ Export Excel
  </button>
</div>

<div className="muted resultline">
  Showing {filteredLogs.length} audit log
  {filteredLogs.length === 1 ? "" : "s"}
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
        </tr>
      </thead>

      <tbody>
        {filteredLogs.map((log) => {
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
                        : log.action.includes("LOGIN")
                        ? "#dbeafe"
                        : "#eef2ff",

                    color:
                      log.action.includes("DELETE") ||
                      log.action.includes("FAILED")
                        ? "#b91c1c"
                        : log.action.includes("CREATE") ||
                          log.action.includes("ADD")
                        ? "#166534"
                        : log.action.includes("LOGIN")
                        ? "#1d4ed8"
                        : "#4338ca",
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
      </section>
    </div>
  );
}
