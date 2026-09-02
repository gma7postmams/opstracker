"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/Toast";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

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
    <div className="panel spaced" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="panelhead">
        <div><h3>{title}</h3><span className="muted">{note}</span></div>
        <span className="chip">{sum.total} record{sum.total === 1 ? "" : "s"}</span>
      </div>
      <div className="table">
        {rows.length ? (
          <table>
            <thead><tr>
              <th>User</th><th>Total</th><th>Completed</th><th>Open</th><th>Pending</th>
              <th>Avg / day</th><th>Avg. handling</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.user}>
                  <td><b>{r.user}</b></td>
                  <td><b>{r.total}</b></td>
                  <td><span className="status closed">{r.closed}</span></td>
                  <td><span className="status open">{r.open}</span></td>
                  <td><span className="status pending">{r.pending}</span></td>
                  <td><b>{r.avgPerDay}</b></td>
                  <td>{r.avgMinutes === null ? "—" : `${r.avgMinutes} min`}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr>
              <td><b>All users</b></td><td><b>{sum.total}</b></td><td><b>{sum.closed}</b></td>
              <td><b>{sum.open}</b></td><td><b>{sum.pending}</b></td>
              <td><b>{(sum.closed / days).toFixed(2)}</b></td><td />
            </tr></tfoot>
          </table>
        ) : <div className="empty"><b>No records in this range</b>Adjust the dates or filters above.</div>}
      </div>
    </div>
  );
}

export default function Reports() {
  const toast = useToast();
  const [f, setF] = useState({ from: monthStart(), to: today(), activity: "all", status: "all" });
  const [applied, setApplied] = useState(f);
  const [d, setD] = useState<any>(null);

  const load = useCallback(async (q: typeof f) => {
    const res = await fetch(`/api/reports?${new URLSearchParams(q)}`);
    const out = await res.json();
    if (!res.ok) { toast(out.error ?? "Could not build the report"); return; }
    setD(out);
  }, [toast]);

  useEffect(() => { load(applied); }, [load, applied]);

  function apply() {
    if (f.from > f.to) { toast("From date must be on or before To date"); return; }
    setApplied({ ...f });
  }

  function exportCsv() {
    if (!d) return;
    const sections: string[] = [];
    const block = (name: string, rows: Row[] | null) => {
      if (!rows) return;
      sections.push(name);
      sections.push("User,Total,Completed,Open,Pending,Avg per day,Avg handling minutes");
      rows.forEach((r) => sections.push(
        [r.user, r.total, r.closed, r.open, r.pending, r.avgPerDay, r.avgMinutes ?? ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
      ));
      sections.push("");
    };
    sections.push(`Productivity tally,${d.range.from} to ${d.range.to},${d.range.days} days`, "");
    block("Technical Assistance", d.tallies.assistance);
    block("Other Tasks", d.tallies.tasks);
    block("Combined", d.tallies.combined);

    const url = URL.createObjectURL(new Blob([sections.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `productivity-${d.range.from}-to-${d.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const s = d?.summary;

  return (
    <div className="page">
      <div className="filters">
        <label className="flabel">FROM<input type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flabel">TO<input type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
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
        <button className="primary" onClick={apply}>Apply filters</button>
        <div className="btngroup">
          <button className="secondary" onClick={exportCsv} disabled={!d}>Export CSV</button>
        </div>
      </div>

      {!d ? <div className="muted">Loading…</div> : (
        <>
          <div className="cards">
            <div className="card cb"><div className="ico i-cb">◉</div><div><strong>{s.assistance}</strong><span>Technical Assistance</span></div></div>
            <div className="card cp"><div className="ico i-cp">☷</div><div><strong>{s.tasks}</strong><span>Other Tasks</span></div></div>
            <div className="card cg"><div className="ico i-cg">✓</div><div><strong>{s.closed}</strong><span>Completed</span></div></div>
            <div className="card cy"><div className="ico i-cy">◑</div><div><strong>{s.pending}</strong><span>Close Pending</span></div></div>
            <div className="card co"><div className="ico i-co">!</div><div><strong>{s.open}</strong><span>Open</span></div></div>
            <div className="card cc"><div className="ico i-cc">↗</div><div><strong>{s.avgPerDay}</strong><span>Avg. completed / day</span></div></div>
          </div>

          <div className="muted rangeline">
            {d.range.from} to {d.range.to} · {d.range.days} calendar day{d.range.days === 1 ? "" : "s"} · tallied by Assigned To
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

    </div>
  );
}
