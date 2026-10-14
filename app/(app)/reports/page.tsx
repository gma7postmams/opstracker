"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";
import { useSession } from "next-auth/react";


const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type DateRangePreset = "today" | "week" | "month" | "custom";

function getDateRange(preset: Exclude<DateRangePreset, "custom">) {
  const end = new Date();
  const start = new Date(end);

  if (preset === "week") {
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  } else if (preset === "month") {
    start.setDate(1);
  }

  return { from: formatDate(start), to: formatDate(end) };
}

const defaultFilters = {
  from: "",
  to: "",
  activity: "all",
  status: "all",
  userId: "all",
};

function getReportFilters(filters: typeof defaultFilters, preset: DateRangePreset) {
  return preset === "custom" ? filters : { ...filters, ...getDateRange(preset) };
}

interface Row {
  user: string; total: number; closed: number; open: number; pending: number;
  avgPerDay: string; avgMinutes: number | null;
}


function Tally({ title, note, rows, accent, days }: {
  title: string; note: string; rows: Row[]; accent: string; days: number;
}) {
  const sum = rows.reduce(
    (a, r) => ({ total: a.total + r.total, closed: a.closed + r.closed, open: a.open + r.open, pending: a.pending + r.pending }),
    { total: 0, closed: 0, open: 0, pending: 0 }
  );
  return (
    <div className="panel spaced report-history" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="panelhead">
        <div><h3>{title}</h3><span className="muted">{note}</span></div>
        <span className="chip">{sum.total} record{sum.total === 1 ? "" : "s"}</span>
      </div>
      <div className="table">
        {rows.length ? (
          <table>
            <thead><tr>
		<th>User</th>
		<th>Total</th>
		<th className="statuscol">Completed</th>
		<th className="statuscol">Open</th>
		<th className="statuscol">Pending</th>
		<th>Avg / day</th>
		<th>Avg. handling</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user}>
                  <td><b>{r.user}</b></td>
                  <td><b>{r.total}</b></td>

<td className="statuscol">
  <span className="status closed">{r.closed}</span>
</td>

<td className="statuscol">
  <span className="status open">{r.open}</span>
</td>

<td className="statuscol">
  <span className="status pending">{r.pending}</span>
</td>


                  <td><b>{r.avgPerDay}</b></td>
                  <td>{r.avgMinutes === null ? "—" : `${r.avgMinutes} min`}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
		<td><b>All users</b></td>
		<td><b>{sum.total}</b></td>

		<td className="statuscol"><b>{sum.closed}</b></td>
		<td className="statuscol"><b>{sum.open}</b></td>
		<td className="statuscol"><b>{sum.pending}</b></td>

              <td><b>{(sum.closed / days).toFixed(2)}</b></td><td />
            </tr></tfoot>
          </table>
        ) : <div className="empty"><b>No records in this range</b>Adjust the dates or filters above.</div>}
      </div>
    </div>
  );
}

export default function Reports() {

  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";

  const toast = useToast();

  const [f, setF] = useState(defaultFilters);
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>("today");
  const isReportRangeValid = dateRangePreset !== "custom" || Boolean(f.from && f.to && f.from <= f.to);

  useEffect(() => {
    if (!isAdmin) return;

    fetch("/api/users/report-filter")
      .then((r) => r.json())
      .then((d) => setUsers(Array.isArray(d) ? d : []));
  }, [isAdmin]);

  const [d, setD] = useState<any>(null);

  const [users, setUsers] = useState<any[]>([]);

  const load = useCallback(async (q: typeof f) => {
    const res = await fetch(`/api/reports?${new URLSearchParams(q)}`);
    const out = await res.json();
    if (!res.ok) { toast(out.error ?? "Could not build the report"); return; }
    setD(out);
  }, [toast]);

  useEffect(() => {
    if (dateRangePreset === "custom" && (!f.from || !f.to || f.from > f.to)) return;
    load(getReportFilters(f, dateRangePreset));
  }, [load, f, dateRangePreset]);


const [emailResult, setEmailResult] = useState<{
  success: boolean;
  message: string;
} | null>(null);

const [sendingEmail, setSendingEmail] = useState(false);
const [preview, setPreview] = useState<any>(null);
const [sendingPreview, setSendingPreview] = useState(false);

async function previewEmail() {
  setSendingPreview(true);

  try {
    const res = await fetch("/api/reports/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...getReportFilters(f, dateRangePreset),
        preview: true,
      }),
    });

    const out = await res.json();

    if (!res.ok) {
      toast(out.error || "Unable to generate preview");
      return;
    }

    setPreview(out);
  } finally {
    setSendingPreview(false);
  }
}


async function sendEmail() {
  setSendingEmail(true);

  try {
    const res = await fetch("/api/reports/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(getReportFilters(f, dateRangePreset)),
    });

    const out = await res.json();

    if (!res.ok) {
      setEmailResult({
        success: false,
        message: out.error || "Failed to send email",
      });
      return;
    }

    setEmailResult({
      success: true,
      message: out.message || "Report emailed successfully",
    });

  } finally {
    setSendingEmail(false);
  }
}

function clearFilters() {
  setF(defaultFilters);
  setDateRangePreset("today");
}

function selectDateRange(preset: DateRangePreset) {
  setDateRangePreset(preset);
  if (preset !== "custom" && (f.from || f.to)) {
    setF({ ...f, from: "", to: "" });
  }
}

function exportExcel() {
  const url =
    `/api/reports/excel?${new URLSearchParams(getReportFilters(f, dateRangePreset))}`;

  window.open(url, "_blank");
}

const activeFilters =
  (dateRangePreset !== "today" ? 1 : 0) +
  (f.activity !== "all" ? 1 : 0) +
  (f.status !== "all" ? 1 : 0) +
  (isAdmin && f.userId !== "all" ? 1 : 0);

  const s = d?.summary;
  const totalRecords = (s?.assistance ?? 0) + (s?.tasks ?? 0);

  return (
    <div className="page report-page">
      <style jsx global>{`
        .report-page { color: var(--text); }
        .report-page .report-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin:0 0 20px; }
        .report-page .report-eyebrow { color:#237a75; font-size:11px; font-weight:750; letter-spacing:.08em; text-transform:uppercase; }
        .report-page .report-heading h1 { margin:4px 0 5px; font-size:26px; line-height:1.2; }
        .report-page .report-subtitle { color:var(--muted); font-size:14px; }
        .report-page .filters { border:1px solid var(--border); border-radius:10px; padding:16px; background:var(--panel); box-shadow:0 3px 12px rgba(18,38,63,.04); align-items:end; }
        .report-page .flabel { font-size:10px; font-weight:750; letter-spacing:.055em; }
        .report-page .report-actions { display:flex; flex-wrap:wrap; gap:8px; align-self:end; }
        .report-page .report-kpis { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); grid-auto-rows:1fr; gap:12px; margin:18px 0 12px; }
        .report-page .report-kpi { position:relative; display:flex; flex-direction:column; overflow:hidden; min-height:112px; padding:16px 17px 14px 20px; border:1px solid var(--border); border-radius:9px; background:linear-gradient(145deg,var(--panel),rgba(255,255,255,.72)); box-shadow:0 4px 14px rgba(18,38,63,.06); transition:transform .18s ease,box-shadow .18s ease; }
        .report-page .report-kpi:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(18,38,63,.1); }
        .report-page .report-kpi:before { position:absolute; inset:0 auto 0 0; width:4px; content:""; background:var(--kpi-accent); }
        .report-page .report-kpi-top { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:12px; font-weight:650; }
        .report-page .report-kpi-icon { display:grid; place-items:center; width:30px; height:30px; border-radius:7px; color:var(--kpi-accent); background:color-mix(in srgb,var(--kpi-accent) 11%,transparent); }
        .report-page .report-kpi strong { display:block; margin-top:7px; font-size:27px; line-height:1; letter-spacing:0; }
        .report-page .report-kpi small { display:block; margin-top:auto; padding-top:7px; color:var(--muted); font-size:11px; }
        .report-page .report-history { overflow:hidden; border-radius:9px; box-shadow:0 3px 12px rgba(18,38,63,.04); }
        .report-page .report-history .panelhead { padding:17px 18px; border-bottom:1px solid var(--border); }
        .report-page .report-history .panelhead h3 { margin:0 0 3px; font-size:15px; }
        .report-page .report-history .table { overflow:auto; }
        .report-page .report-history table { width:100%; border-collapse:collapse; }
        .report-page .report-history thead { position:sticky; top:0; z-index:1; }
        .report-page .report-history th { padding:11px 14px; background:var(--hint-bg); color:var(--muted); font-size:10px; font-weight:750; letter-spacing:.045em; text-transform:uppercase; white-space:nowrap; }
        .report-page .report-history td { padding:12px 14px; border-bottom:1px solid var(--border); font-size:13px; }
        .report-page .report-history tbody tr:hover { background:rgba(35,122,117,.045); }
        .report-page .report-history tfoot td { background:var(--hint-bg); }
        .report-page .email-preview-frame { display:block; width:100%; height:70vh; min-height:520px; border:1px solid #dfe5eb; }
        @media(max-width:760px) { .report-page .report-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .report-page .report-heading { display:block; } .report-page .report-actions { margin-top:12px; } }
        @media(max-width:480px) { .report-page .report-heading h1 { font-size:22px; } .report-page .report-kpi { padding:13px 12px 12px 15px; } .report-page .report-kpi strong { font-size:24px; } }
      `}</style>
      <div className="report-heading">
        <div>
          <div className="report-eyebrow">Operations intelligence</div>
          <h1>Reporting &amp; Analytics</h1>
          <div className="report-subtitle">Track workload, resolution, and team activity across your selected period.</div>
        </div>
        <div className="report-actions">
          <button className="secondary" onClick={exportExcel} disabled={!d || !isReportRangeValid}>Export Excel</button>
          <button className="primary" onClick={previewEmail} disabled={!d || !isReportRangeValid || sendingPreview}>
            {sendingPreview ? "Generating preview..." : "Preview email"}
          </button>
        </div>
      </div>

      <div className="filters">
        <label className="flabel">PERIOD
          <select value={dateRangePreset} onChange={(e) => selectDateRange(e.target.value as DateRangePreset)}>
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="flabel">FROM<input type="date" value={f.from} disabled={dateRangePreset !== "custom"} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flabel">TO<input type="date" value={f.to} disabled={dateRangePreset !== "custom"} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <label className="flabel">ACTIVITY
          <select value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })}>
            <option value="all">Assistance + Tasks</option>
            <option value="assistance">Technical Assistance</option>
            <option value="tasks">Other Tasks</option>
          </select>
        </label>
        <label className="flabel">STATUS
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="all">All Status</option>
            <option value="OPEN">Open</option>
            <option value="CLOSE_PENDING">Close Pending</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>

        {isAdmin && (
          <label className="flabel">
            USER

            <select
              value={f.userId}
              onChange={(e) =>
                setF({ ...f, userId: e.target.value })
              }
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
        )}

        {activeFilters > 0 && (
          <button
            className="chip"
            onClick={clearFilters}
          >
            ✕ Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}
          </button>
        )}

      </div>

      {!isReportRangeValid ? <div className="empty">Choose a valid From and To date to run this report.</div> : !d ? <div className="muted">Loading…</div> : (
        <>
          <div className="report-kpis">
            <div className="report-kpi" style={{ "--kpi-accent": "#237a75" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Total records</span><span className="report-kpi-icon">◎</span></div>
              <strong>{totalRecords}</strong><small>{s.assistance} assistance · {s.tasks} other tasks</small>
            </div>
            <div className="report-kpi" style={{ "--kpi-accent": "#3478c8" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Open</span><span className="report-kpi-icon">◷</span></div>
              <strong>{s.open}</strong><small>Awaiting resolution</small>
            </div>
            <div className="report-kpi" style={{ "--kpi-accent": "#c38321" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Close pending</span><span className="report-kpi-icon">◌</span></div>
              <strong>{s.pending}</strong><small>Pending completion review</small>
            </div>
            <div className="report-kpi" style={{ "--kpi-accent": "#34845e" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Closed</span><span className="report-kpi-icon">✓</span></div>
              <strong>{s.closed}</strong><small>{s.avgPerDay} average completed per day</small>
            </div>
          </div>

          {d.tallies.assistance && (
            <Tally title="Technical Assistance tally" note="Per-user assistance workload"
              rows={d.tallies.assistance} accent="#3b82f6" days={d.range.days} />
          )}
          {d.tallies.tasks && (
            <Tally title="Other Task tally" note="Per-user task workload"
              rows={d.tallies.tasks} accent="#7f56d9" days={d.range.days} />
          )}
          {d.tallies.combined && (
            <Tally title="Combined tally" note="Assistance and tasks together"
              rows={d.tallies.combined} accent="#06aed4" days={d.range.days} />
          )}
        </>
      )}

{preview && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999,
    }}
  >
  <div
    style={{
      background: "var(--panel)",
      color: "var(--text)",
      width: "95%",
      maxWidth: "1000px",
      maxHeight: "94vh",
      overflow: "auto",
      borderRadius: "8px",
      padding: "12px",
      boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
    }}
  >

  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "12px",
    }}
  >
  <h2 style={{ color: "var(--text)" }}>
    Email Preview
  </h2>

  <button
    onClick={() => setPreview(null)}
    style={{
      border: "none",
      background: "transparent",
      fontSize: "24px",
      cursor: "pointer",
      color: "var(--muted)",
      padding: 0,
    }}
  >

    ✖
  </button>

  </div>

  <div
    className="hint spacedbottom"
    style={{
      background: "var(--hint-bg)",
    }}
  >
    <b>Recipients:</b> {preview.recipients}
  </div>

  <p>
    <strong>Subject:</strong> {preview.subject}
  </p>

  <hr
    style={{
      border: "none",
      borderTop: "1px solid var(--border)",
    }}
  />

        <iframe
          title="Email report preview"
          srcDoc={preview.html}
          className="email-preview-frame email-preview-content"
          sandbox=""
          style={{ border: "1px solid #dfe5eb" }}
        />


      <div
        style={{
          marginTop: 20,
          display: "flex",
          gap: 10,
          justifyContent: "flex-end",
        }}
      >
        <button
          className="secondary"
          onClick={() => setPreview(null)}
        >
          Close
        </button>

	<button
	  className="primary"
	  disabled={sendingEmail}
	  onClick={async () => {
	    await sendEmail();

	    setPreview(null);
	  }}
	>
	  {sendingEmail
	    ? "📧 Generating report and sending email..."
	    : "Send Email"}
	</button>

      </div>

        {sendingEmail && (
          <div
            style={{
              marginTop: 10,
              color: "var(--muted)",
              fontSize: "14px",
            }}
          >
            Preparing attachment and sending email...
          </div>
        )}


    </div>
  </div>
)}


{emailResult && (
  <div
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
    }}
  >
  <div
    style={{
      background: "var(--panel)",
      color: "var(--text)",
      padding: "24px",
      borderRadius: "12px",
      minWidth: "420px",
      maxWidth: "600px",
      boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
    }}
  >

    <h3>
      {emailResult.success
        ? "✅ Email Delivered"
        : "❌ Email Delivery Failed"}
    </h3>

    <p>
      {emailResult.success
        ? "Your MAMS Support Activity Report has been sent successfully."
        : emailResult.message}
    </p>

    {emailResult.success && (

      <p
        style={{
          marginTop: "10px",
          marginBottom: "24px",
          padding: "8px 12px",
          background: "var(--hint-bg)",
          borderRadius: "8px",
        }}
      >
        📧 {emailResult.message.replace("Report emailed successfully to ", "")}
      </p>

    )}

    <button
      className="primary"
      onClick={() => setEmailResult(null)}
    >
      Close
    </button>
      
    </div>
  </div>
)}


    </div>
  );
}
