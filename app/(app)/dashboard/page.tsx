"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { priorityLabel } from "@/lib/recordTypes";

const PALETTE = ["#3b82f6", "#7f56d9", "#06aed4", "#f79009", "#12b76a", "#f04438", "#ee46bc"];

export default function Dashboard() {
  const [d, setD] = useState<any>(null);

  useEffect(() => { fetch("/api/dashboard").then((r) => r.json()).then(setD); }, []);
  if (!d) return <div className="page"><div className="muted">Loading…</div></div>;

  const open = d.assistance.OPEN + d.tasks.OPEN;
  const pending = d.assistance.CLOSE_PENDING + d.tasks.CLOSE_PENDING;
  const closed = d.assistance.CLOSED + d.tasks.CLOSED;
  const total = open + pending + closed;
  const peak = Math.max(1, ...d.trend.map((t: any) => t.count));
  const catMax = Math.max(1, ...d.categories.map((c: any) => c.count));

  const card = (n: number, label: string, tone: string, icon: string) => (
    <div className={`card ${tone}`} key={label}>
      <div className={`ico i-${tone}`}>{icon}</div>
      <div><strong>{n}</strong><span>{label}</span></div>
    </div>
  );

  return (
    <div className="page">
      <div className="cards">
        {card(d.assistance.total, "Technical Assistance", "cb", "◉")}
        {card(d.tasks.total, "Other Tasks", "cp", "☷")}
        {card(total, "Total Activity", "cc", "∑")}
        {card(open, "Open", "co", "!")}
        {card(pending, "Close Pending", "cy", "◑")}
        {card(closed, "Closed", "cg", "✓")}
      </div>

      <section className="panel spaced">
        <div className="panelhead">
          <div><h3>Status distribution</h3>
            <span className="muted">{total} record{total === 1 ? "" : "s"} across assistance and tasks</span></div>
        </div>
        <div className="splitbar">
          {total === 0
            ? <i style={{ width: "100%", background: "#eaecf0" }} />
            : ([[open, "#f04438"], [pending, "#f79009"], [closed, "#12b76a"]] as [number, string][])
                .filter(([n]) => n > 0)
                .map(([n, c], i) => <i key={i} style={{ width: `${(n / total) * 100}%`, background: c }} />)}
        </div>
        <div className="legend">
          <span><i className="dot" style={{ background: "#f04438" }} />Open · {open}</span>
          <span><i className="dot" style={{ background: "#f79009" }} />Close Pending · {pending}</span>
          <span><i className="dot" style={{ background: "#12b76a" }} />Closed · {closed}</span>
        </div>
      </section>

      <div className="grid">
        <section className="panel">
          <div className="panelhead"><div><h3>Activity trend</h3>
            <span className="muted">Records logged, last 7 days</span></div></div>
          <div className="trend">
            {d.trend.map((t: any) => (
              <div className="col" key={t.date}>
                <b>{t.count}</b>
                <i style={{
                  height: `${Math.round((t.count / peak) * 100)}%`,
                  background: t.count === peak && t.count > 0 ? "#7f56d9" : "#3b82f6",
                }} />
                {t.label}
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panelhead"><div><h3>Needs attention</h3>
            <span className="muted">Open and close-pending records</span></div></div>
          {d.attention.length ? d.attention.map((r: any) => (
            <div className="issue" key={r.type + r.id}>
              <span className={`pill ${r.priority === "CRITICAL" || r.priority === "HIGH" ? "red" : r.priority === "LOW" ? "blue" : "amber"}`}>
                {priorityLabel(r.priority)}
              </span>
              <b><Link href={`/records/${r.type}/${r.id}`}>{r.refNo}</Link></b>
              <small>{r.body}</small>
            </div>
          )) : <div className="empty"><b>Nothing open</b>Every record is closed.</div>}
        </section>
      </div>

      <div className="grid">
        <section className="panel">
          <div className="panelhead"><div><h3>Assistance by category</h3>
            <span className="muted">{d.assistance.total} record{d.assistance.total === 1 ? "" : "s"}</span></div></div>
          {d.categories.length ? d.categories.map((c: any, i: number) => (
            <div className="barrow" key={c.name}>
              <span>{c.name}</span>
              <div className="bar"><i style={{ width: `${(c.count / catMax) * 100}%`, background: PALETTE[i % PALETTE.length] }} /></div>
              <b>{c.count}</b>
            </div>
          )) : <div className="empty"><b>No assistance records</b>Log one to see the breakdown.</div>}
        </section>

        <section className="panel">
          <div className="panelhead"><h3>Quick actions</h3></div>
          <div className="quick">
            <Link href="/assistance">◉ Record technical assistance</Link>
            <Link href="/tasks">☷ Record other task</Link>
            <Link href="/reports">▤ View reports</Link>
            <Link href="/admin">⚙ Manage master data</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
