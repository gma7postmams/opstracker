"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { priorityLabel } from "@/lib/recordTypes";
import { useSession } from "next-auth/react";
import { Activity, CheckCircle2, ClipboardList, CircleDot, Clock3, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PERIOD_OPTIONS, type Period } from "@/lib/period";

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

type DashboardUser = {
  id: number;
  firstName: string;
  middleInitial: string | null;
  surname: string;
};

function AnimatedCount({ value, prefersReducedMotion }: { value: number; prefersReducedMotion: boolean }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(value);
      return;
    }

    setDisplayValue(0);
    let startedAt: number | undefined;
    let frame = 0;
    const animate = (timestamp: number) => {
      startedAt ??= timestamp;
      const progress = Math.min((timestamp - startedAt) / 600, 1);
      setDisplayValue(Math.round(value * progress));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [prefersReducedMotion, value]);

  return <>{displayValue}</>;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [d, setD] = useState<any>(null);
  const [dashboardDataRevision, setDashboardDataRevision] = useState(0);
  const [animateDashboardEntrance, setAnimateDashboardEntrance] = useState(false);
  const hasRenderedDashboard = useRef(false);
  const [period, setPeriod] = useState<Period>("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [ownershipUsernames, setOwnershipUsernames] = useState<Record<string, string>>({});
  const [typedGreeting, setTypedGreeting] = useState("");
  const [isTypingGreeting, setIsTypingGreeting] = useState(true);
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

  useEffect(() => {
    if (prefersReducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setTypedGreeting(fullGreeting);
      setIsTypingGreeting(false);
      return;
    }

    setTypedGreeting("");
    setIsTypingGreeting(true);
    let startedAt: number | undefined;
    let frame = 0;
    const typeNextCharacter = (timestamp: number) => {
      startedAt ??= timestamp;
      const progress = Math.min((timestamp - startedAt) / 1100, 1);
      setTypedGreeting(fullGreeting.slice(0, Math.floor(progress * fullGreeting.length)));

      if (progress < 1) {
        frame = window.requestAnimationFrame(typeNextCharacter);
      } else {
        setTypedGreeting(fullGreeting);
        setIsTypingGreeting(false);
      }
    };

    frame = window.requestAnimationFrame(typeNextCharacter);
    return () => window.cancelAnimationFrame(frame);
  }, [fullGreeting, prefersReducedMotion]);

  useEffect(() => {
    if (!isAdmin) {
      setUsers([]);
      setSelectedUserId("");
      return;
    }

    const controller = new AbortController();
    fetch("/api/users/report-filter", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`User filter API failed: ${r.status}`);
        return r.json();
      })
      .then((result: DashboardUser[]) => setUsers(result))
      .catch((err) => {
        if (!controller.signal.aborted) console.error("Dashboard user filter load failed:", err);
      });

    return () => controller.abort();
  }, [isAdmin]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/users", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`User API failed: ${r.status}`);
        return r.json();
      })
      .then((result: { name?: string; username?: string }[]) => {
        setOwnershipUsernames(Object.fromEntries(
          result
            .filter((user) => user.name && user.username)
            .map((user) => [user.name!.trim().toLowerCase(), user.username!])
        ));
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error("Ownership username load failed:", err);
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (period === "custom" && (!fromDate || !toDate || fromDate > toDate)) {
      setD(null);
      return () => controller.abort();
    }

    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", fromDate);
      params.set("to", toDate);
    }
    if (isAdmin && selectedUserId) params.set("userId", selectedUserId);

    fetch(`/api/dashboard?${params}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Dashboard API failed: ${r.status}`);
        }

        return r.json();
      })
      .then((result) => {
        setAnimateDashboardEntrance(!hasRenderedDashboard.current);
        hasRenderedDashboard.current = true;
        setD(result);
        setDashboardDataRevision((revision) => revision + 1);
      })
      .catch((err) => {
        if (!controller.signal.aborted) console.error("Dashboard load failed:", err);
      });
    return () => controller.abort();
  }, [fromDate, isAdmin, period, selectedUserId, toDate]);

  const open = d ? d.assistance.OPEN + d.tasks.OPEN : 0;
  const pending = d ? d.assistance.CLOSE_PENDING + d.tasks.CLOSE_PENDING : 0;
  const closed = d ? d.assistance.CLOSED + d.tasks.CLOSED : 0;
  const total = open + pending + closed;
  const catMax = Math.max(1, ...(d?.categories ?? []).map((c: any) => c.count));
  const trendData = d?.trend ?? [];
  const showDailyLabels = period === "today" || period === "yesterday" || period === "thisWeek";
  const showHistoricalValueLabels = showDailyLabels || period === "thisMonth" || period === "custom";
  const todayDate = new Date().toISOString().slice(0, 10);
  const peak = Math.max(1, ...trendData.flatMap((point: any) => [point.assistanceCount, point.taskCount]));
  const chartWidth = Math.max(700, trendData.length * 56);
  const chartLeft = 42;
  const chartRight = chartWidth - 22;
  const chartTop = 20;
  const chartBottom = 166;
  const chartHeight = chartBottom - chartTop;
  const trendPoints = trendData.map((point: any, index: number) => {
    const x = trendData.length === 1
      ? (chartLeft + chartRight) / 2
      : chartLeft + (index * (chartRight - chartLeft)) / (trendData.length - 1);
    const assistanceVisual = peak === 1 && point.assistanceCount === 0 ? 4 / chartHeight : point.assistanceCount / peak;
    const taskVisual = peak === 1 && point.taskCount === 0 ? 4 / chartHeight : point.taskCount / peak;
    const valuesAreClose = Math.abs(assistanceVisual - taskVisual) * chartHeight < 22;
    const assistanceValueY = Math.max(14, Math.min(188, chartBottom - assistanceVisual * chartHeight + (valuesAreClose && assistanceVisual < taskVisual ? 17 : -8)));
    const taskValueY = Math.max(14, Math.min(188, chartBottom - taskVisual * chartHeight + (valuesAreClose && taskVisual <= assistanceVisual ? 17 : -8)));
    return {
      ...point,
      x,
      showValueLabels: showHistoricalValueLabels ? point.date <= todayDate : point.highlighted,
      valueLabelX: trendData.length === 1 ? x : index === trendData.length - 1 ? x - 9 : x + 9,
      valueLabelAnchor: trendData.length === 1 ? "middle" : index === trendData.length - 1 ? "end" : "start",
      weekdayLabel: showDailyLabels
        ? new Date(`${point.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
        : "",
      dayLabel: showDailyLabels ? new Date(`${point.date}T00:00:00Z`).getUTCDate() : "",
      assistanceY: chartBottom - assistanceVisual * chartHeight,
      taskY: chartBottom - taskVisual * chartHeight,
      assistanceValueY,
      taskValueY,
    };
  });
  const assistancePath = trendPoints.map((point: any, index: number) => `${index ? "L" : "M"}${point.x},${point.assistanceY}`).join(" ");
  const taskPath = trendPoints.map((point: any, index: number) => `${index ? "L" : "M"}${point.x},${point.taskY}`).join(" ");
  const areaPath = (valueKey: "assistanceY" | "taskY") => trendPoints.length
    ? `${trendPoints.map((point: any, index: number) => `${index ? "L" : "M"}${point.x},${point[valueKey]}`).join(" ")} L${trendPoints[trendPoints.length - 1].x},${chartBottom} L${trendPoints[0].x},${chartBottom} Z`
    : "";
  const assistanceAreaPath = areaPath("assistanceY");
  const taskAreaPath = areaPath("taskY");
  const hasActiveFilters = period !== "today" || (isAdmin && selectedUserId !== "");

  function clearFilters() {
    setPeriod("today");
    setSelectedUserId("");
    setFromDate("");
    setToDate("");
  }

  function selectPeriod(nextPeriod: Period) {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") {
      setFromDate("");
      setToDate("");
    }
  }

  const card = (n: number, label: string, tone: string, Icon: LucideIcon) => (
    <div className={`dashboard-kpi dashboard-glass ${tone}`} key={label}>
      <div className="dashboard-kpi-head">
        <span className="dashboard-kpi-icon"><Icon size={16} aria-hidden="true" /></span>
        <span className="dashboard-kpi-label">{label}</span>
      </div>
      <strong className="dashboard-kpi-value"><AnimatedCount key={dashboardDataRevision} value={n} prefersReducedMotion={prefersReducedMotion} /></strong>
    </div>
  );

  return (
    <div className="page">

      <div className="panel spaced dashboard-glass dashboard-enter dashboard-enter-1">
        <div className="dashboard-heading">
          <div>
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
              {typedGreeting}
              {isTypingGreeting && <span aria-hidden="true">|</span>}
            </h2>

            <p
              style={{
                marginTop: "12px",
                fontStyle: "italic",
                color: "var(--muted)",
                opacity: !isTypingGreeting && quoteVisible ? 1 : 0,
                transition: prefersReducedMotion ? "none" : "opacity 350ms ease-in-out",
              }}
            >
              "{QUOTES[quoteIndex]}"
            </p>
          </div>
        </div>
      </div>

      <div className="filters dashboard-filter-bar dashboard-glass dashboard-enter dashboard-enter-2" aria-label="Dashboard filters">
        <label className="flabel">
          Period
          <select value={period} onChange={(event) => selectPeriod(event.target.value as Period)}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        {period === "custom" && (
          <>
            <label className="flabel">
              From
              <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </label>
            <label className="flabel">
              To
              <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
            </label>
          </>
        )}
        {isAdmin && (
          <label className="flabel">
            User
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              <option value="">All Users</option>
              {users.map((dashboardUser) => (
                <option key={dashboardUser.id} value={dashboardUser.id}>
                  {[dashboardUser.firstName, dashboardUser.middleInitial, dashboardUser.surname].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
          </label>
        )}
        {hasActiveFilters && <button className="chip dashboard-clear" type="button" onClick={clearFilters}>Clear</button>}
      </div>

      {d ? <>
      <div className={`dashboard-summaries${animateDashboardEntrance ? " dashboard-enter dashboard-enter-3" : ""}`}>
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

      <section className={`panel spaced dashboard-glass${animateDashboardEntrance ? " dashboard-enter dashboard-enter-4" : ""}`}>
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
        <section className={`panel dashboard-glass${animateDashboardEntrance ? " dashboard-enter dashboard-enter-4" : ""}`}>
          <div className="panelhead"><div><h3>Activity trend</h3>
            <span className="muted">{d.trendSubtitle}</span></div></div>
          <div style={{ overflowX: "auto" }}>
            <svg
              role="img"
              aria-label={`Activity trend: ${d.trendSubtitle}`}
              viewBox={`0 0 ${chartWidth} 230`}
              style={{ display: "block", width: "100%", minWidth: `${chartWidth}px`, height: "230px" }}
            >
              {[0, 1, 2, 3].map((step) => {
                const y = chartTop + (chartHeight * step) / 3;
                return <line key={step} x1={chartLeft} x2={chartRight} y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 5" />;
              })}
              {assistanceAreaPath && <path key={`assistance-area-${dashboardDataRevision}`} className="dashboard-trend-area dashboard-trend-area-assistance" d={assistanceAreaPath} />}
              {taskAreaPath && <path key={`task-area-${dashboardDataRevision}`} className="dashboard-trend-area dashboard-trend-area-task" d={taskAreaPath} />}
              {assistancePath && <>
                <path key={`assistance-${dashboardDataRevision}`} className="dashboard-trend-line" pathLength="1" d={assistancePath} fill="none" stroke="#06aed4" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                <path key={`assistance-glow-${dashboardDataRevision}`} className="dashboard-trend-glow" pathLength="1" d={assistancePath} fill="none" stroke="var(--trend-highlight)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
              </>}
              {taskPath && <>
                <path key={`tasks-${dashboardDataRevision}`} className="dashboard-trend-line" pathLength="1" d={taskPath} fill="none" stroke="#f79009" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                <path key={`tasks-glow-${dashboardDataRevision}`} className="dashboard-trend-glow" pathLength="1" d={taskPath} fill="none" stroke="var(--trend-highlight)" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
              </>}
              <g key={`trend-points-${dashboardDataRevision}`} className="dashboard-trend-points">
                {trendPoints.map((point: any) => (
                <g key={point.date}>
                  <title>{`${point.tooltip}: Technical Assistance ${point.assistanceCount}, Other Tasks ${point.taskCount}`}</title>
                  {point.highlighted && <>
                    <circle className="trend-point-pulse" cx={point.x} cy={point.assistanceY} r="5" fill="none" stroke="var(--trend-highlight)" strokeWidth="2" />
                    <circle className="trend-point-pulse" cx={point.x} cy={point.taskY} r="5" fill="none" stroke="var(--trend-highlight)" strokeWidth="2" />
                  </>}
                  <circle cx={point.x} cy={point.assistanceY} r={point.highlighted ? 5.5 : 3.5} fill={point.highlighted ? "var(--trend-highlight)" : "var(--panel)"} stroke="#06aed4" strokeWidth="2" />
                  <circle cx={point.x} cy={point.taskY} r={point.highlighted ? 5.5 : 3.5} fill={point.highlighted ? "var(--trend-highlight)" : "var(--panel)"} stroke="#f79009" strokeWidth="2" />
                  {point.showValueLabels && <>
                    <text className="trend-value trend-value-assistance" x={point.valueLabelX} y={point.assistanceValueY} textAnchor={point.valueLabelAnchor}>{point.assistanceCount}</text>
                    <text className="trend-value trend-value-task" x={point.valueLabelX} y={point.taskValueY} textAnchor={point.valueLabelAnchor}>{point.taskCount}</text>
                  </>}
                  {showDailyLabels ? <>
                    <text className={point.highlighted ? "trend-label-pulse" : undefined} x={point.x} y="196" textAnchor="middle" fill={point.highlighted ? "var(--trend-highlight)" : "var(--muted)"} fontSize="11" fontWeight={point.highlighted ? 600 : 500}>{point.weekdayLabel}</text>
                    <text className={point.highlighted ? "trend-label-pulse" : undefined} x={point.x} y="212" textAnchor="middle" fill={point.highlighted ? "var(--trend-highlight)" : "var(--muted)"} fontSize="11" fontWeight={point.highlighted ? 600 : 500}>{point.dayLabel}</text>
                  </> : <text x={point.x} y="204" textAnchor="middle" fill={point.highlighted ? "var(--trend-highlight)" : "var(--muted)"} fontSize="11" fontWeight={point.highlighted ? 600 : 500}>{point.label}</text>}
                </g>
                ))}
              </g>
            </svg>
          </div>
          <div className="trend-legend" aria-label="Activity trend series">
            <span><i style={{ background: "#06aed4" }} />Technical Assistance</span>
            <span><i style={{ background: "#f79009" }} />Other Tasks</span>
          </div>
        </section>

        <section className={`panel dashboard-glass${animateDashboardEntrance ? " dashboard-enter dashboard-enter-5" : ""}`}>
          <div className="panelhead"><div><h3>Needs attention</h3>
            <span className="muted">All open and close-pending records</span></div></div>
          {d.attention.length ? d.attention.map((r: any) => {
            const ownershipFlow = r.ownershipFlow.map((owner: string) =>
              ownershipUsernames[owner.trim().toLowerCase()] ?? "Unknown"
            );
            return (
            <div className="issue attention-item" key={r.type + r.id}>
              <div className="attention-meta">
                <span className={`attention-status ${r.status === "OPEN" ? "attention-status-open" : "attention-status-pending"}`}>
                  {r.status === "OPEN" ? "Open" : "Close Pending"}
                </span>
                <span className="attention-age">{r.ageDays} {r.ageDays === 1 ? "day" : "days"} old</span>
                {r.locked && <span className="pill blue">Locked</span>}
                <span className={`pill ${r.priority === "CRITICAL" || r.priority === "HIGH" ? "red" : r.priority === "LOW" ? "blue" : "amber"}`}>
                  {priorityLabel(r.priority)}
                </span>
              </div>
              <b><Link href={`/records/${r.type}/${r.id}`}>{r.refNo}</Link><span className="attention-subject">{r.subject}{r.type === "assistance" && <> / {r.showGroup || "No group"} / {r.location}</>}</span></b>
              <small>{r.body}</small>
              <div className="ownership-flow" title={ownershipFlow.join(" → ")} aria-label={`Ownership: ${ownershipFlow.join(" to ")}`}>
                {ownershipFlow.length > 0 && <span aria-hidden="true">- </span>}
                {ownershipFlow.length > 1 && <span className="ownership-flow-history">{ownershipFlow.slice(0, -1).join(" → ")} →</span>}
                {ownershipFlow.length > 0 && <strong className="ownership-flow-current">{ownershipFlow[ownershipFlow.length - 1]}</strong>}
              </div>
            </div>
            );
          }) : <div className="empty"><b>Nothing open</b>Every record is closed.</div>}
        </section>
      </div>

      <div className="grid">
        <section className={`panel dashboard-glass${animateDashboardEntrance ? " dashboard-enter dashboard-enter-5" : ""}`}>
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

        <section className={`panel dashboard-glass${animateDashboardEntrance ? " dashboard-enter dashboard-enter-5" : ""}`}>
          <div className="panelhead"><h3>Quick actions</h3></div>
          <div className="quick">
            <Link href="/assistance">◉ Record technical assistance</Link>
            <Link href="/tasks">☷ Record other task</Link>
            <Link href="/reports">▤ View reports</Link>
            {isAdmin && <Link href="/admin">⚙ Manage master data</Link>}
          </div>
        </section>
      </div>

  <section className={`panel spaced dashboard-glass${animateDashboardEntrance ? " dashboard-enter dashboard-enter-5" : ""}`}>
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

      </> : (
        <div className="muted dashboard-load-state">
          {period === "custom" && (!fromDate || !toDate || fromDate > toDate)
            ? "Choose a valid From and To date to view dashboard data."
            : "Loading…"}
        </div>
      )}
    </div>
  );
}
