"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { priorityLabel } from "@/lib/recordTypes";
import { useSession } from "next-auth/react";
import { Activity, CheckCircle2, ClipboardList, CircleDot, Clock3, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const PALETTE = ["#3b82f6", "#7f56d9", "#06aed4", "#f79009", "#12b76a", "#f04438", "#ee46bc"];

const QUOTES = [
  "Small progress is still progress.",
  "Focus on what you can control.",
  "Done is better than perfect.",
  "Consistency beats intensity.",
  "Every accomplishment starts with the decision to try.",
  "Productivity is never an accident.",
  "The secret of getting ahead is getting started.",
  "Success is the sum of small efforts repeated day after day.",
  "Stay positive, work hard, make it happen.",
  "Quality means doing it right when no one is looking.",
];


export default function Dashboard() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [d, setD] = useState<any>(null);
  const [typedGreeting, setTypedGreeting] = useState("");
  const [isTypingGreeting, setIsTypingGreeting] = useState(false);
  const hasAnimatedGreeting = useRef(false);
  const [quoteIndex, setQuoteIndex] = useState(() => new Date().getDate() % QUOTES.length);
  const [quoteVisible, setQuoteVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setPrefersReducedMotion(motionPreference.matches);
    let rotationTimeout: number;
    let swapTimeout: number | undefined;

    updateMotionPreference();
    motionPreference.addEventListener("change", updateMotionPreference);

    const rotateQuote = () => {
      if (motionPreference.matches) {
        setQuoteIndex((current) => (current + 1) % QUOTES.length);
        rotationTimeout = window.setTimeout(rotateQuote, 18000);
        return;
      }

      setQuoteVisible(false);
      swapTimeout = window.setTimeout(() => {
        setQuoteIndex((current) => (current + 1) % QUOTES.length);
        setQuoteVisible(true);
        rotationTimeout = window.setTimeout(rotateQuote, 18000);
      }, 350);
    };

    rotationTimeout = window.setTimeout(rotateQuote, 18000);

    return () => {
      window.clearTimeout(rotationTimeout);
      if (swapTimeout !== undefined) window.clearTimeout(swapTimeout);
      motionPreference.removeEventListener("change", updateMotionPreference);
    };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";
  const name = session?.user?.name?.trim() ?? "";
  const givenName = name.includes(",") ? name.slice(name.indexOf(",") + 1).trim() : name;
  const firstName = givenName.split(/\s+/)[0] ?? "";
  const formattedFirstName = firstName
    ? firstName[0].toUpperCase() + firstName.slice(1).toLowerCase()
    : "";
  const fullGreeting = `${greeting}, ${formattedFirstName} 👋`;
  const shouldAnimateGreeting = Boolean(session?.user);

  useEffect(() => {
    console.log("Dashboard greeting values:", {
      name: session?.user?.name,
      firstName,
      shouldAnimateGreeting,
    });

    if (!d || !shouldAnimateGreeting || hasAnimatedGreeting.current) return;

    hasAnimatedGreeting.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedGreeting(fullGreeting);
      return;
    }

    setIsTypingGreeting(true);
    let startedAt: number | undefined;
    let frame = 0;
    let completed = false;
    const typeNextCharacter = (timestamp: number) => {
      startedAt ??= timestamp;
      const progress = Math.min((timestamp - startedAt) / 1100, 1);
      setTypedGreeting(fullGreeting.slice(0, Math.floor(progress * fullGreeting.length)));

      if (progress < 1) {
        frame = window.requestAnimationFrame(typeNextCharacter);
      } else {
        setTypedGreeting(fullGreeting);
        setIsTypingGreeting(false);
        completed = true;
      }
    };

    frame = window.requestAnimationFrame(typeNextCharacter);
    return () => {
      window.cancelAnimationFrame(frame);
      if (!completed) hasAnimatedGreeting.current = false;
    };
  }, [d, firstName, fullGreeting, session?.user?.name, shouldAnimateGreeting]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Dashboard API failed: ${r.status}`);
        }

        return r.json();
      })
      .then(setD)
      .catch((err) => {
        console.error("Dashboard load failed:", err);
      });
  }, []);

  if (!d) {
    return (
      <div className="page">
        <div className="muted">Loading…</div>
      </div>
    );
  }  

  const open = d.assistance.OPEN + d.tasks.OPEN;
  const pending = d.assistance.CLOSE_PENDING + d.tasks.CLOSE_PENDING;
  const closed = d.assistance.CLOSED + d.tasks.CLOSED;
  const total = open + pending + closed;
  const peak = Math.max(1, ...d.trend.map((t: any) => t.count));
  const catMax = Math.max(1, ...d.categories.map((c: any) => c.count));

  const card = (n: number, label: string, tone: string, Icon: LucideIcon) => (
    <div className={`dashboard-kpi ${tone}`} key={label}>
      <div className="dashboard-kpi-head">
        <span className="dashboard-kpi-icon"><Icon size={16} aria-hidden="true" /></span>
        <span className="dashboard-kpi-label">{label}</span>
      </div>
      <strong className="dashboard-kpi-value">{n}</strong>
    </div>
  );

  return (
    <div className="page">

      <div className="panel spaced">
        <h2
          aria-label={fullGreeting}
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
            fontSize: "34px",
            fontWeight: 400,
            letterSpacing: "normal",
            lineHeight: 1.2,
          }}
        >
          {shouldAnimateGreeting ? typedGreeting : fullGreeting}
          {isTypingGreeting && <span aria-hidden="true">|</span>}
        </h2>

        <p
          style={{
            marginTop: "12px",
            fontStyle: "italic",
            color: "var(--muted)",
            opacity: quoteVisible ? 1 : 0,
            transition: prefersReducedMotion ? "none" : "opacity 350ms ease-in-out",
          }}
        >
          "{QUOTES[quoteIndex]}"
        </p>
      </div>

      <div className="dashboard-summaries">
        <section className="dashboard-summary" aria-labelledby="activity-summary-title">
          <h3 id="activity-summary-title">Activity Summary</h3>
          <div className="dashboard-kpis">
            {card(total, "Total Records", "cb", Activity)}
            {card(d.assistance.total, "Technical Assistance", "cc", Wrench)}
            {card(d.tasks.total, "Other Tasks", "cy", ClipboardList)}
          </div>
        </section>
        <section className="dashboard-summary" aria-labelledby="status-summary-title">
          <h3 id="status-summary-title">Status Summary</h3>
          <div className="dashboard-kpis">
            {card(open, "Open", "cb", CircleDot)}
            {card(pending, "Close Pending", "cy", Clock3)}
            {card(closed, "Closed", "cg", CheckCircle2)}
          </div>
        </section>
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

		<div>
		  <small>{t.date.slice(5)}</small>
		  <br />
		  <small>{t.label}</small>
		</div>

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
            {isAdmin && <Link href="/admin">⚙ Manage master data</Link>}
          </div>
        </section>
      </div>

	<section className="panel spaced">
	  <div className="panelhead">
	    <div>
	      <h3>Recent Activity</h3>
	      <span className="muted">
	        Latest audit events
	      </span>
	    </div>
	  </div>

	  {d.recentActivity?.length ? (
	    d.recentActivity.map((a: any) => (
	      <div className="issue" key={a.id}>
	        <b>{a.action}</b>

	        <small>{a.entityId}</small>

	        <small>
	          {(a.details as any)?.user ?? "System"} •{" "}
	          {new Date(a.createdAt).toLocaleString()}
	        </small>
	      </div>
	    ))
	  ) : (
	    <div className="empty">
	      <b>No Recent Activity</b>
	      Nothing has been logged yet.
	    </div>
	  )}
	</section>

    </div>
  );
}
