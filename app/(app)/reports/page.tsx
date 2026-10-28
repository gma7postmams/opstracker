"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { useSession } from "next-auth/react";
import { Activity, AlertCircle, Check, CheckCircle2, CircleDot, Clock3, LoaderCircle, Send, UsersRound } from "lucide-react";


const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type DateRangePreset = "today" | "week" | "month" | "custom";
type ReportScope = "mine" | "all";

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

function getReportFilters(filters: typeof defaultFilters, preset: DateRangePreset, scope: ReportScope) {
  return { ...(preset === "custom" ? filters : { ...filters, ...getDateRange(preset) }), scope };
}

interface Row {
  owner: string; assigned: string; total: number; closed: number; open: number; pending: number;
  avgPerDay: string; avgMinutes: number | null;
}

function ReportDetailContent({ details }: {
  details: { header: string; sections: Array<{ label: string; value: string }> };
}) {
  return (
    <>
      {details.header && <strong>{details.header}</strong>}
      {details.sections.map((section) => (
        <div key={section.label}><b>{section.label}:</b> {section.value}</div>
      ))}
    </>
  );
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
		<th>Owner</th>
		<th>Assigned</th>
		<th>Total</th>
		<th className="statuscol">Completed</th>
		<th className="statuscol">Open</th>
		<th className="statuscol">Pending</th>
		<th>Avg / day</th>
		<th>Avg. handling</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.owner}-${r.assigned}`}>
                  <td><b>{r.owner}</b></td>
                  <td><b>{r.assigned}</b></td>
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
		<td colSpan={2}><b>All records</b></td>
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
  const [selectedScope, setSelectedScope] = useState<ReportScope | null>(null);
  const scope = selectedScope ?? (isAdmin ? "all" : "mine");

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
    load(getReportFilters(f, dateRangePreset, scope));
  }, [load, f, dateRangePreset, scope]);


const [emailResult, setEmailResult] = useState<{
  success: true;
  recipient: string;
  sentAt: string;
  assistance: number;
  tasks: number;
  participation: number;
} | {
  success: false;
  message: string;
  details?: string;
} | null>(null);

const [sendingEmail, setSendingEmail] = useState(false);
const [sendProgress, setSendProgress] = useState(0);
const sendingEmailRef = useRef(false);
const sendDialogRef = useRef<HTMLDivElement>(null);
const [preview, setPreview] = useState<any>(null);
const [sendingPreview, setSendingPreview] = useState(false);

useEffect(() => {
  if (!sendingEmail && !emailResult) return;
  const dialog = sendDialogRef.current;
  if (!dialog) return;
  dialog.focus();

  const handleDialogKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!sendingEmail) {
        setEmailResult(null);
        setPreview(null);
      }
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
      event.preventDefault();
      first.focus();
    }
  };

  document.addEventListener("keydown", handleDialogKeyDown);
  return () => document.removeEventListener("keydown", handleDialogKeyDown);
}, [sendingEmail, emailResult]);

async function previewEmail() {
  setSendingPreview(true);

  try {
    const res = await fetch("/api/reports/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...getReportFilters(f, dateRangePreset, scope),
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
  if (sendingEmailRef.current) return;
  sendingEmailRef.current = true;
  setSendingEmail(true);
  setEmailResult(null);
  setSendProgress(0);

  const progressAnimation = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    setSendProgress(1);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setSendProgress(2);
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  try {
    const request = fetch("/api/reports/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(getReportFilters(f, dateRangePreset, scope)),
    }).then(async (res) => ({ res, out: await res.json() }))
      .catch((requestError) => ({ requestError }));
    const [response] = await Promise.all([request, progressAnimation()]);

    if ("requestError" in response) throw response.requestError;
    const { res, out } = response;

    if (!res.ok) {
      setEmailResult({
        success: false,
        message: out.error || "Failed to send email",
        details: out.details,
      });
      return;
    }

    setSendProgress(3);
    setEmailResult({
      success: true,
      recipient: preview?.recipients ?? "",
      sentAt: new Date().toLocaleString(),
      assistance: s?.assistance ?? 0,
      tasks: s?.tasks ?? 0,
      participation: d?.contributionSummary?.participationCount ?? 0,
    });
    setPreview(null);
    toast(`✅ Activity Report Sent · Delivered to: ${preview?.recipients ?? "recipient"}`);
  } catch (error) {
    setEmailResult({
      success: false,
      message: error instanceof Error ? error.message : "Unable to complete email delivery.",
    });
  } finally {
    setSendingEmail(false);
    sendingEmailRef.current = false;
  }
}

function clearFilters() {
  setF(defaultFilters);
  setDateRangePreset("today");
  setSelectedScope(null);
}

function selectDateRange(preset: DateRangePreset) {
  setDateRangePreset(preset);
  if (preset !== "custom" && (f.from || f.to)) {
    setF({ ...f, from: "", to: "" });
  }
}

function exportExcel() {
  const url =
    `/api/reports/excel?${new URLSearchParams(getReportFilters(f, dateRangePreset, scope))}`;

  window.open(url, "_blank");
}

const activeFilters =
  (dateRangePreset !== "today" ? 1 : 0) +
  (f.activity !== "all" ? 1 : 0) +
  (f.status !== "all" ? 1 : 0) +
  (scope !== (isAdmin ? "all" : "mine") ? 1 : 0) +
  (isAdmin && f.userId !== "all" ? 1 : 0);

  const s = d?.summary;
  const totalRecords = (s?.assistance ?? 0) + (s?.tasks ?? 0);

  return (
    <div className="page report-page">
      <style jsx global>{`
        .report-page { color: var(--text); }
        .report-page .filters { border:1px solid var(--border); border-radius:10px; padding:12px; background:var(--panel); box-shadow:0 3px 12px rgba(18,38,63,.04); align-items:end; }
        .report-page .report-actions { display:flex; flex-direction:row; flex-shrink:0; gap:8px; margin-left:auto; }
        .report-page .flabel { font-size:10px; font-weight:750; letter-spacing:.055em; }
        .report-page .report-kpis { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); grid-auto-rows:1fr; gap:12px; margin:12px 0 12px; }
        .report-page .report-kpi { position:relative; display:flex; flex-direction:column; overflow:hidden; min-height:102px; padding:14px 16px 12px 20px; border:1px solid color-mix(in srgb,var(--border) 70%,var(--muted)); border-radius:9px; background:var(--panel); box-shadow:0 3px 12px rgba(0,0,0,.12); transition:transform .18s ease,box-shadow .18s ease; }
        .report-page .report-kpi:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.18); }
        .report-page .report-kpi:before { position:absolute; inset:0 auto 0 0; width:4px; content:""; background:var(--kpi-accent); }
        .report-page .report-kpi-top { display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:12px; font-weight:650; }
        .report-page .report-kpi-icon { display:grid; place-items:center; width:30px; height:30px; border-radius:7px; color:var(--kpi-accent); background:color-mix(in srgb,var(--kpi-accent) 15%,var(--panel)); }
        .report-page .report-kpi strong { display:block; margin-top:7px; color:var(--text); font-size:27px; line-height:1; letter-spacing:0; }
        .report-page .report-kpi small { display:block; margin-top:auto; padding-top:7px; color:var(--muted); font-size:11px; }
        .report-page .report-history { overflow:hidden; border-radius:9px; box-shadow:0 3px 12px rgba(18,38,63,.04); }
        .report-page .report-history .panelhead { padding:17px 18px; border-bottom:1px solid var(--border); }
        .report-page .report-history .panelhead h3 { margin:0 0 3px; font-size:15px; }
        .report-page .report-history .table { overflow:auto; }
        .report-page .report-history table { width:100%; border-collapse:collapse; }
        .report-page .report-history thead { position:sticky; top:0; z-index:1; }
        .report-page .report-history th { padding:11px 14px; background:var(--hint-bg); color:var(--muted); font-size:10px; font-weight:750; letter-spacing:.045em; text-transform:uppercase; white-space:nowrap; }
        .report-page .report-history td { padding:12px 14px; border-bottom:1px solid var(--border); font-size:13px; }
        .report-page .report-history tbody tr { transition:background-color .18s ease; }
        .report-page .report-history tbody tr:hover { background:color-mix(in srgb,#237a75 12%,var(--panel)); }
        .report-page .report-history .status { display:inline-flex; align-items:center; justify-content:center; min-width:24px; padding:3px 8px; border:1px solid transparent; border-radius:999px; font-size:11px; font-weight:650; }
        .report-page .report-history .status.open { color:#1d4ed8; border-color:#bfdbfe; background:#eff6ff; }
        .report-page .report-history .status.pending { color:#b45309; border-color:#fde68a; background:#fffbeb; }
        .report-page .report-history .status.closed { color:#15803d; border-color:#bbf7d0; background:#f0fdf4; }
        .report-page .report-history tfoot td { background:var(--hint-bg); }
        .report-page .report-participation td:last-child,.report-page .report-participation th:last-child { text-align:right; }
        .report-page .report-details-content { min-width:260px; white-space:normal; line-height:1.55; }
        .report-page .report-details-content > strong { display:block; margin-bottom:3px; }
        .report-page .participation-detail summary { cursor:pointer; color:var(--accent); font-weight:650; }
        .report-page .participation-detail-list { margin:8px 0 0; padding:0; list-style:none; text-align:left; }
        .report-page .participation-detail-list li { padding:8px 0; border-top:1px solid var(--border); }
        .report-page .participation-detail-list li > strong { display:block; margin-bottom:3px; }
        .report-page .email-preview-frame { display:block; width:100%; height:70vh; min-height:520px; border:1px solid #dfe5eb; }
        .report-page .send-overlay { position:fixed; inset:0; z-index:10001; display:grid; place-items:center; padding:20px; background:rgba(9,16,29,.58); animation:send-fade-in .2s ease both; }
        .report-page .send-dialog { width:min(440px,100%); padding:28px; border:1px solid var(--border); border-radius:14px; background:var(--panel); color:var(--text); box-shadow:0 24px 70px rgba(0,0,0,.28); animation:send-scale-in .24s cubic-bezier(.2,.8,.2,1) both; outline:none; }
        .report-page .send-title { display:flex; align-items:center; gap:11px; margin:0; font-size:19px; line-height:1.3; }
        .report-page .send-title-icon { display:grid; flex:0 0 38px; width:38px; height:38px; place-items:center; border-radius:10px; color:#087f72; background:color-mix(in srgb,#0b8d7e 14%,var(--panel)); }
        .report-page .send-steps { display:grid; gap:16px; margin:27px 0 23px; padding:0; list-style:none; }
        .report-page .send-step { display:flex; align-items:center; gap:11px; min-height:22px; color:var(--muted); font-size:14px; }
        .report-page .send-step.is-done { color:var(--text); }
        .report-page .send-step.is-active { color:var(--text); font-weight:650; }
        .report-page .send-step-icon { display:grid; flex:0 0 22px; width:22px; height:22px; place-items:center; border:1px solid var(--border); border-radius:50%; color:var(--muted); }
        .report-page .send-step.is-done .send-step-icon { border-color:#0b8d7e; color:#0b8d7e; background:color-mix(in srgb,#0b8d7e 13%,var(--panel)); }
        .report-page .send-step.is-active .send-step-icon { border-color:color-mix(in srgb,#0b8d7e 55%,var(--border)); color:#0b8d7e; }
        .report-page .send-spinner { animation:send-spin .9s linear infinite; }
        .report-page .send-recipient { overflow-wrap:anywhere; padding-top:15px; border-top:1px solid var(--border); color:var(--muted); font-size:12px; }
        .report-page .send-recipient strong { display:block; margin-top:5px; color:var(--text); font-size:13px; font-weight:600; }
        .report-page .delivery-result { text-align:center; }
        .report-page .delivery-icon { display:grid; width:62px; height:62px; margin:0 auto 16px; place-items:center; border-radius:50%; color:#07856f; background:color-mix(in srgb,#0b9a7a 15%,var(--panel)); animation:send-success-pop .42s cubic-bezier(.2,.8,.2,1) both; }
        .report-page .delivery-icon.is-error { color:var(--err-fg); background:var(--err-bg); animation:none; }
        .report-page .delivery-result h3 { margin:0; font-size:20px; }
        .report-page .delivery-result > p { margin:8px 0 18px; color:var(--muted); line-height:1.5; overflow-wrap:anywhere; }
        .report-page .delivery-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:18px 0; text-align:left; }
        .report-page .delivery-stat { min-width:0; padding:11px 9px; border:1px solid var(--border); border-radius:8px; background:var(--hint-bg); }
        .report-page .delivery-stat span { display:block; color:var(--muted); font-size:10px; line-height:1.35; }
        .report-page .delivery-stat strong { display:block; margin-top:5px; font-size:18px; }
        .report-page .delivery-sent { margin:0 0 18px; color:var(--muted); font-size:12px; }
        .report-page .delivery-error-detail { padding:11px 12px; border:1px solid color-mix(in srgb,var(--err-fg) 30%,var(--border)); border-radius:8px; background:var(--err-bg); color:var(--err-fg); font-size:12px; text-align:left; overflow-wrap:anywhere; }
        .report-page .delivery-actions { display:flex; justify-content:center; gap:9px; margin-top:22px; }
        .toastwrap { z-index:10002; }
        @keyframes send-fade-in { from { opacity:0; } to { opacity:1; } }
        @keyframes send-scale-in { from { opacity:0; transform:translateY(8px) scale(.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes send-success-pop { 0% { opacity:0; transform:scale(.62); } 70% { transform:scale(1.08); } 100% { opacity:1; transform:scale(1); } }
        @keyframes send-spin { to { transform:rotate(360deg); } }
        @media(prefers-reduced-motion:reduce) { .report-page .send-overlay,.report-page .send-dialog,.report-page .delivery-icon,.report-page .send-spinner { animation:none; } }
        @media(max-width:760px) { .report-page .report-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); } .report-page .report-actions { flex-direction:row; flex-wrap:wrap; width:100%; justify-content:flex-end; } }
        @media(max-width:480px) { .report-page .report-kpi { padding:13px 12px 12px 15px; } .report-page .report-kpi strong { font-size:24px; } }
      `}</style>
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
          <label className="flabel">REPORT SCOPE
            <select value={scope} onChange={(e) => setSelectedScope(e.target.value as ReportScope)}>
              <option value="mine">My Records</option>
              <option value="all">All Records</option>
            </select>
          </label>
        )}

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

        <div className="report-actions">
          <button className="secondary" onClick={exportExcel} disabled={!d || !isReportRangeValid}>Export Excel</button>
          <button className="primary" onClick={previewEmail} disabled={!d || !isReportRangeValid || sendingPreview}>
            {sendingPreview ? "Generating preview..." : "Preview email"}
          </button>
        </div>

      </div>

      {!isReportRangeValid ? <div className="empty">Choose a valid From and To date to run this report.</div> : !d ? <div className="muted">Loading…</div> : (
        <>
          <div className="report-kpis">
            <div className="report-kpi" style={{ "--kpi-accent": "#64748b" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Total records</span><span className="report-kpi-icon"><Activity size={16} aria-hidden="true" /></span></div>
              <strong>{totalRecords}</strong><small>{s.assistance} assistance · {s.tasks} other tasks</small>
            </div>
            <div className="report-kpi" style={{ "--kpi-accent": "#0f766e" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Participation Count</span><span className="report-kpi-icon"><UsersRound size={16} aria-hidden="true" /></span></div>
              <strong>{d.contributionSummary.participationCount}</strong><small>Assigned to this user, excluding the accountable person</small>
            </div>
            <div className="report-kpi" style={{ "--kpi-accent": "#2563eb" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Open</span><span className="report-kpi-icon"><CircleDot size={16} aria-hidden="true" /></span></div>
              <strong>{s.open}</strong><small>Awaiting resolution</small>
            </div>
            <div className="report-kpi" style={{ "--kpi-accent": "#d97706" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Close pending</span><span className="report-kpi-icon"><Clock3 size={16} aria-hidden="true" /></span></div>
              <strong>{s.pending}</strong><small>Pending completion review</small>
            </div>
            <div className="report-kpi" style={{ "--kpi-accent": "#16a34a" } as React.CSSProperties}>
              <div className="report-kpi-top"><span>Closed</span><span className="report-kpi-icon"><CheckCircle2 size={16} aria-hidden="true" /></span></div>
              <strong>{s.closed}</strong><small>{s.avgPerDay} average completed per day</small>
            </div>
          </div>

          {d.tallies.assistance && (
            <Tally title="Technical Assistance tally" note="By record owner and assignee"
              rows={d.tallies.assistance} accent="#3b82f6" days={d.range.days} />
          )}
          {d.tallies.tasks && (
            <Tally title="Other Task tally" note="By record owner and assignee"
              rows={d.tallies.tasks} accent="#7f56d9" days={d.range.days} />
          )}
          {d.tallies.combined && (
            <Tally title="Combined tally" note="Assistance and tasks by owner and assignee"
              rows={d.tallies.combined} accent="#06aed4" days={d.range.days} />
          )}
          <div className="panel spaced report-history">
            <div className="panelhead"><div><h3>Report Details</h3></div></div>
            <div className="table">
              {d.reportRecords.length ? (
                <table>
                  <thead><tr><th>Ref No</th><th>Activity</th><th>Status</th><th>Owner</th><th>Assigned</th><th>Details</th></tr></thead>
                  <tbody>
                    {d.reportRecords.map((record: {
                      refNo: string; recordType: string; status: string; owner: string; assigned: string;
                      details: { header: string; sections: Array<{ label: string; value: string }> };
                    }) => (
                      <tr key={`${record.recordType}-${record.refNo}`}>
                        <td><b>{record.refNo}</b></td>
                        <td>{record.recordType}</td>
                        <td>{record.status}</td>
                        <td>{record.owner}</td>
                        <td>{record.assigned}</td>
                        <td className="report-details-content"><ReportDetailContent details={record.details} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="empty">No records in this range.</div>}
            </div>
          </div>
          <div className="panel spaced report-history report-participation">
            <div className="panelhead"><div><h3>Participation Summary</h3></div></div>
            <div className="table">
              {d.participationSummary.length ? (
                <table>
                  <thead><tr><th>User</th><th>Owned Records</th><th>Participation Count</th><th>Delegated Work Details</th></tr></thead>
                  <tbody>
                    {d.participationSummary.map((row: {
                      userName: string; owned: number; participationCount: number;
                      delegatedWork: Array<{
                        refNo: string; recordType: "assistance" | "tasks"; header: string;
                        sections: Array<{ label: string; value: string }>;
                      }>;
                    }) => (
                      <tr key={row.userName}>
                        <td><b>{row.userName}</b></td>
                        <td>{row.owned}</td>
                        <td>{row.participationCount}</td>
                        <td>
                          {row.delegatedWork.length ? (
                            <details className="participation-detail">
                              <summary>View {row.delegatedWork.length} record{row.delegatedWork.length === 1 ? "" : "s"}</summary>
                              <ul className="participation-detail-list">
                                {row.delegatedWork.map((work) => (
                                  <li key={`${work.recordType}-${work.refNo}`}>
                                    <strong>{work.refNo} · {work.recordType === "assistance" ? "Technical Assistance" : "Other Tasks"}</strong>
                                    <ReportDetailContent details={work} />
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="empty">No owned records or participation counts in this range.</div>}
            </div>
          </div>
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
    type="button"
    disabled={sendingEmail}
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
          disabled={sendingEmail}
          onClick={() => setPreview(null)}
        >
          Close
        </button>

	<button
	  className="primary"
    disabled={sendingEmail || sendingEmailRef.current}
	  onClick={async () => {
      await sendEmail();
	  }}
	>
    <Send size={15} aria-hidden="true" /> Send Email
	</button>

      </div>

    </div>
  </div>
)}


{sendingEmail && (
  <div className="send-overlay">
    <div
      ref={sendDialogRef}
      className="send-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-dialog-title"
      aria-describedby="send-dialog-recipient"
      aria-busy="true"
      tabIndex={-1}
    >
      <h2 className="send-title" id="send-dialog-title">
        <span className="send-title-icon"><Send size={19} aria-hidden="true" /></span>
        Sending Activity Report
      </h2>
      <ol className="send-steps" aria-live="polite">
        {["Preparing report data", "Building report", "Sending email"].map((step, index) => {
          const complete = sendProgress > index;
          const active = sendProgress === index;
          return (
            <li
              className={`send-step${complete ? " is-done" : ""}${active ? " is-active" : ""}`}
              key={step}
              aria-label={`${step}: ${complete ? "complete" : active ? "in progress" : "waiting"}`}
            >
              <span className="send-step-icon" aria-hidden="true">
                {complete ? <Check size={14} /> : active ? <LoaderCircle size={14} className="send-spinner" /> : null}
              </span>
              <span>{step}</span>
            </li>
          );
        })}
      </ol>
      <div className="send-recipient" id="send-dialog-recipient">
        Recipient
        <strong>{preview?.recipients}</strong>
      </div>
    </div>
  </div>
)}

{emailResult && (
  <div className="send-overlay">
    <div
      ref={sendDialogRef}
      className="send-dialog delivery-result"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-result-title"
      tabIndex={-1}
    >
      {emailResult.success ? (
        <>
          <div className="delivery-icon" aria-hidden="true"><CheckCircle2 size={34} /></div>
          <h3 id="delivery-result-title">Report Delivered</h3>
          <p>Delivered to {emailResult.recipient}</p>
          <div className="delivery-stats" aria-label="Report summary">
            <div className="delivery-stat"><span>Technical Assistance</span><strong>{emailResult.assistance}</strong></div>
            <div className="delivery-stat"><span>Other Tasks</span><strong>{emailResult.tasks}</strong></div>
            <div className="delivery-stat"><span>Participation</span><strong>{emailResult.participation}</strong></div>
          </div>
          <div className="delivery-sent">Sent: <time>{emailResult.sentAt}</time></div>
          <div className="delivery-actions">
            <button className="primary" onClick={() => setEmailResult(null)}>Close</button>
          </div>
        </>
      ) : (
        <>
          <div className="delivery-icon is-error" aria-hidden="true"><AlertCircle size={34} /></div>
          <h3 id="delivery-result-title">Unable to Send Report</h3>
          <p>{emailResult.message}</p>
          {emailResult.details && <div className="delivery-error-detail">Server response: {emailResult.details}</div>}
          <div className="delivery-actions">
            <button className="primary" onClick={sendEmail}>Retry</button>
            <button className="secondary" onClick={() => { setEmailResult(null); setPreview(null); }}>Close</button>
          </div>
        </>
      )}
    </div>
  </div>
)}


    </div>
  );
}
