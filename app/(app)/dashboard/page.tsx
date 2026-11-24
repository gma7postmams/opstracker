"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { priorityLabel } from "@/lib/recordTypes";
import { useSession } from "next-auth/react";
import { Activity, Archive, BarChart3, CheckCircle2, ClipboardList, Clock3, Cpu, CircleDot, Database, HardDrive, MemoryStick, Server, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PERIOD_OPTIONS, type Period } from "@/lib/period";
import { useRecordEvents } from "@/components/useRecordEvents";

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

type DashboardWorkloadUser = {
  id: number;
  name: string;
  technicalAssistanceCount: number;
  otherTasksCount: number;
};

type DashboardBackupSchedule = {
  enabled: boolean;
  retentionCount: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: "RUNNING" | "SUCCESS" | "FAILED" | null;
};

type DashboardStorageStatus = {
  available: boolean;
  totalBytes: string | null;
  freeBytes: string | null;
  usedPercent: number | null;
};

type DashboardSystemHealth = {
  database: boolean;
  cpuUsagePercent: number | null;
  memory: {
    usedBytes: string;
    totalBytes: string;
    usedPercent: number | null;
  };
  storage: DashboardStorageStatus;
  backupStorage: DashboardStorageStatus | null;
  backupHealth: {
    lastSuccessfulAt: string | null;
    status: "SUCCESS" | "FAILED" | "RUNNING" | null;
    availableCount: number | null;
  };
};

type HealthLevel = "healthy" | "warning" | "critical" | "unknown";

function healthColor(level: HealthLevel) {
  return level === "healthy" ? "var(--closed)"
    : level === "warning" ? "var(--pending)"
      : level === "critical" ? "var(--open)" : "var(--muted)";
}

function HealthIndicator({ level, label }: { level: HealthLevel; label: string }) {
  const colors: Record<HealthLevel, { foreground: string; background: string }> = {
    healthy: { foreground: "var(--closed)", background: "var(--badge-closed-bg)" },
    warning: { foreground: "var(--pending)", background: "var(--badge-pending-bg)" },
    critical: { foreground: "var(--open)", background: "var(--badge-open-bg)" },
    unknown: { foreground: "var(--muted)", background: "var(--barbg)" },
  };
  const color = colors[level];

  return <span style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    borderRadius: "999px",
    padding: "3px 9px",
    color: color.foreground,
    background: color.background,
    fontSize: "12px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  }}>
    <span aria-hidden="true" style={{ width: "7px", height: "7px", borderRadius: "50%", background: color.foreground }} />
    {label}
  </span>;
}

function ResourceGauge({
  label,
  icon,
  value,
  level,
  currentValue,
  totalValue,
  detail,
}: {
  label: string;
  icon: LucideIcon;
  value: number | null | undefined;
  level: HealthLevel;
  currentValue: string;
  totalValue: string;
  detail?: string;
}) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  const percent = hasValue ? `${value.toFixed(1)}%` : "--";
  const progress = hasValue ? Math.max(0, Math.min(value, 100)) : 0;
  const color = healthColor(level);
  const statusLabel = level === "healthy" ? "Healthy"
    : level === "warning" ? "Warning"
      : level === "critical" ? "Critical" : "Unavailable";
  const Icon = icon;

  return <div style={{
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    gap: "16px",
    minWidth: 0,
    padding: "20px 14px",
    border: "1px solid var(--line2)",
    borderRadius: "12px",
    background: "var(--panel)",
    textAlign: "center",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "9px", color: "var(--text)" }}>
      <Icon aria-hidden="true" size={19} color={color} strokeWidth={2.2} />
      <strong style={{ fontSize: "14px" }}>{label}</strong>
    </div>
    <div
      role="img"
      aria-label={`${label}: ${hasValue ? percent : "Unavailable"}`}
      style={{
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: `conic-gradient(from -90deg, ${color} ${progress}%, var(--barbg) ${progress}%)`,
        filter: level === "unknown" ? "saturate(.6)" : undefined,
      }}
    >
      <div aria-hidden="true" style={{
        width: "130px",
        height: "130px",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: "var(--panel)",
        color: hasValue ? "var(--text)" : "var(--muted)",
        fontSize: "24px",
        fontWeight: 800,
        fontVariantNumeric: "tabular-nums",
      }}>
        {percent}
      </div>
    </div>
    <div style={{ display: "grid", justifyItems: "center", gap: "4px", minWidth: 0 }}>
      <strong style={{ color: "var(--text)", fontSize: "14px", lineHeight: 1.4, fontVariantNumeric: "tabular-nums" }}>{currentValue}</strong>
      <span className="muted" style={{ fontSize: "12px", lineHeight: 1.4 }}>{totalValue}</span>
      {detail && <span className="muted" style={{ fontSize: "11px", lineHeight: 1.4 }}>{detail}</span>}
      <HealthIndicator level={level} label={statusLabel} />
    </div>
  </div>;
}

function ServiceStatusCard({
  icon,
  label,
  level,
  status,
  detail,
  detailLevel,
}: {
  icon: LucideIcon;
  label: string;
  level: HealthLevel;
  status: string;
  detail?: string;
  detailLevel?: HealthLevel;
}) {
  const Icon = icon;
  const color = healthColor(level);

  return <div style={{
    display: "grid",
    alignContent: "start",
    gap: "14px",
    minWidth: 0,
    minHeight: "118px",
    padding: "16px",
    border: "1px solid var(--line2)",
    borderRadius: "11px",
    background: "var(--panel)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
      <span aria-hidden="true" style={{
        width: "42px",
        height: "42px",
        flex: "none",
        display: "grid",
        placeItems: "center",
        borderRadius: "11px",
        color,
        background: level === "healthy" ? "var(--badge-closed-bg)"
          : level === "warning" ? "var(--badge-pending-bg)"
            : level === "critical" ? "var(--badge-open-bg)" : "var(--barbg)",
      }}>
        <Icon size={20} strokeWidth={2} />
      </span>
      <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
        <span className="muted" style={{ fontSize: "11px" }}>{label}</span>
        <strong style={{ color, fontSize: "14px", lineHeight: 1.3, overflowWrap: "anywhere" }}>{status}</strong>
      </div>
    </div>
    {detail && <span style={{
      color: healthColor(detailLevel ?? "unknown"),
      fontSize: "11px",
      lineHeight: 1.4,
    }}>{detail}</span>}
  </div>;
}

function usageHealth(value: number | null | undefined, warningThreshold: number): HealthLevel {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  if (value > 90) return "critical";
  if (value > warningThreshold) return "warning";
  return "healthy";
}

function formatBytes(value: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

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
  const [realtimeRevision, setRealtimeRevision] = useState(0);
  const [animateDashboardEntrance, setAnimateDashboardEntrance] = useState(false);
  const hasRenderedDashboard = useRef(false);
  const [period, setPeriod] = useState<Period>("today");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [backupSchedule, setBackupSchedule] = useState<DashboardBackupSchedule | null>(null);
  const [systemHealth, setSystemHealth] = useState<DashboardSystemHealth | null>(null);
  const [systemHealthLoaded, setSystemHealthLoaded] = useState(false);
  const [dashboardApiHealthy, setDashboardApiHealthy] = useState<boolean | null>(null);
  const [workloadUsers, setWorkloadUsers] = useState<DashboardWorkloadUser[]>([]);
  const [workloadState, setWorkloadState] = useState<"loading" | "loaded" | "error">("loading");
  const trendChartContainerRef = useRef<HTMLDivElement>(null);
  const [trendChartContainerWidth, setTrendChartContainerWidth] = useState(0);
  const [isCompactDashboard, setIsCompactDashboard] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 820px)").matches
  );
  const [ownershipUsernames, setOwnershipUsernames] = useState<Record<string, string>>({});
  const [typedGreeting, setTypedGreeting] = useState("");
  const [isTypingGreeting, setIsTypingGreeting] = useState(true);
  const [quoteIndex, setQuoteIndex] = useState(() => new Date().getDate() % QUOTES.length);
  const [quoteVisible, setQuoteVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useRecordEvents(() => setRealtimeRevision((revision) => revision + 1));

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
      setBackupSchedule(null);
      setSystemHealth(null);
      setSystemHealthLoaded(false);
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
    if (!isAdmin) return;

    const controller = new AbortController();
    setSystemHealthLoaded(false);
    const fetchJson = async <T,>(url: string): Promise<T> => {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error(`Dashboard health API failed: ${response.status}`);
      return response.json();
    };

    Promise.all([
      fetchJson<DashboardBackupSchedule>("/api/backup/schedule").catch(() => null),
      fetchJson<DashboardSystemHealth>("/api/dashboard/system-health").catch(() => null),
    ]).then(([schedule, health]) => {
      if (controller.signal.aborted) return;
      setBackupSchedule(schedule);
      setSystemHealth(health);
      setSystemHealthLoaded(true);
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
    setDashboardApiHealthy(null);
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
        setDashboardApiHealthy(true);
        setDashboardDataRevision((revision) => revision + 1);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setDashboardApiHealthy(false);
          console.error("Dashboard load failed:", err);
        }
      });
    return () => controller.abort();
  }, [fromDate, isAdmin, period, realtimeRevision, selectedUserId, toDate]);

  useEffect(() => {
    if (!isAdmin) {
      setWorkloadUsers([]);
      setWorkloadState("loaded");
      return;
    }

    const controller = new AbortController();
    if (period === "custom" && (!fromDate || !toDate || fromDate > toDate)) {
      setWorkloadUsers([]);
      setWorkloadState("loaded");
      return () => controller.abort();
    }

    setWorkloadState("loading");
    const params = new URLSearchParams({ period });
    if (period === "custom") {
      params.set("from", fromDate);
      params.set("to", toDate);
    }

    fetch(`/api/dashboard/workload?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Workload request failed");
        return response.json() as Promise<{ users: DashboardWorkloadUser[] }>;
      })
      .then((result) => {
        setWorkloadUsers(result.users);
        setWorkloadState("loaded");
      })
      .catch(() => {
        if (!controller.signal.aborted) setWorkloadState("error");
      });

    return () => controller.abort();
  }, [fromDate, isAdmin, period, realtimeRevision, toDate]);

  useEffect(() => {
    const container = trendChartContainerRef.current;
    if (!container) return;

    const compactViewport = window.matchMedia("(max-width: 820px)");
    const updateChartSize = () => {
      setTrendChartContainerWidth(Math.floor(container.getBoundingClientRect().width));
      setIsCompactDashboard(compactViewport.matches);
    };
    const observer = new ResizeObserver(updateChartSize);

    observer.observe(container);
    compactViewport.addEventListener("change", updateChartSize);
    updateChartSize();

    return () => {
      observer.disconnect();
      compactViewport.removeEventListener("change", updateChartSize);
    };
  }, [d]);

  const open = d ? d.assistance.OPEN + d.tasks.OPEN : 0;
  const pending = d ? d.assistance.CLOSE_PENDING + d.tasks.CLOSE_PENDING : 0;
  const closed = d ? d.assistance.CLOSED + d.tasks.CLOSED : 0;
  const total = open + pending + closed;
  const catMax = Math.max(1, ...(d?.categories ?? []).map((c: any) => c.count));
  const activityTypeMax = Math.max(1, ...(d?.activityTypes ?? []).map((activityType: any) => activityType.count));
  const trendData = d?.trend ?? [];
  const showDailyLabels = period === "today" || period === "yesterday" || period === "thisWeek";
  const showHistoricalValueLabels = showDailyLabels || period === "thisMonth" || period === "thisYear" || period === "all" || period === "custom";
  const todayDate = new Date().toISOString().slice(0, 10);
  const peak = Math.max(1, ...trendData.flatMap((point: any) => [point.assistanceCount, point.taskCount]).filter((count: number | null) => count !== null));
  const chartWidth = isCompactDashboard && trendChartContainerWidth > 0
    ? trendChartContainerWidth
    : Math.max(700, trendData.length * 56);
  const chartLeft = isCompactDashboard ? 28 : 42;
  const chartRight = chartWidth - (isCompactDashboard ? 14 : 22);
  const compactLabelStride = isCompactDashboard
    ? Math.max(1, Math.ceil(trendData.length / Math.max(1, Math.floor((chartRight - chartLeft) / 36))))
    : 1;
  const workloadSummary = workloadUsers.reduce(
    (summary, user) => ({
      activeUsers: summary.activeUsers + 1,
      technicalAssistanceRecords: summary.technicalAssistanceRecords + user.technicalAssistanceCount,
      otherTasksRecords: summary.otherTasksRecords + user.otherTasksCount,
    }),
    { activeUsers: 0, technicalAssistanceRecords: 0, otherTasksRecords: 0 }
  );
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
    const showValueLabels = (showHistoricalValueLabels ? point.date <= todayDate : point.highlighted)
      && (!isCompactDashboard || index % compactLabelStride === 0 || point.highlighted || index === trendData.length - 1);
    return {
      ...point,
      x,
      showAssistanceValueLabel: showValueLabels || (period === "thisYear" && point.date <= todayDate && point.assistanceCount === 0),
      showTaskValueLabel: showValueLabels || (period === "thisYear" && point.date <= todayDate && point.taskCount === 0),
      showAxisLabel: period === "thisYear" || !isCompactDashboard || index % compactLabelStride === 0 || index === trendData.length - 1,
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
  const assistancePoints = trendPoints.filter((point: any) => point.assistanceCount !== null);
  const taskPoints = trendPoints.filter((point: any) => point.taskCount !== null);
  const linePath = (points: any[], valueKey: "assistanceY" | "taskY") => {
    const lastPoint = points[points.length - 1];
    const futurePoints = lastPoint
      ? trendPoints.filter((point: any) => point.x > lastPoint.x).map((point: any) => ({ ...point, [valueKey]: lastPoint[valueKey] }))
      : [];
    return [...points, ...futurePoints].map((point, index) => `${index ? "L" : "M"}${point.x},${point[valueKey]}`).join(" ");
  };
  const assistancePath = linePath(assistancePoints, "assistanceY");
  const taskPath = linePath(taskPoints, "taskY");
  const areaPath = (points: any[], valueKey: "assistanceY" | "taskY") => points.length
    ? `${points.map((point, index) => `${index ? "L" : "M"}${point.x},${point[valueKey]}`).join(" ")} L${points[points.length - 1].x},${chartBottom} L${points[0].x},${chartBottom} Z`
    : "";
  const assistanceAreaPath = areaPath(assistancePoints, "assistanceY");
  const taskAreaPath = areaPath(taskPoints, "taskY");
  const hasActiveFilters = period !== "today" || (isAdmin && selectedUserId !== "");
  const formatBackupDate = (value: string | null | undefined) => value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "Never";
  const formatStorageStatus = (status?: DashboardStorageStatus) => {
    if (!status?.available) return "Unavailable";
    if (status.totalBytes === null || status.freeBytes === null || status.usedPercent === null) return "Available";

    const total = formatBytes(status.totalBytes);
    const free = formatBytes(status.freeBytes);
    return total && free ? `${total} total · ${free} free` : "Available";
  };
  const storageTotalBytes = systemHealth?.storage.totalBytes;
  const storageFreeBytes = systemHealth?.storage.freeBytes;
  const storageTotal = storageTotalBytes === null || storageTotalBytes === undefined ? null : Number(storageTotalBytes);
  const storageFree = storageFreeBytes === null || storageFreeBytes === undefined ? null : Number(storageFreeBytes);
  const storageUsed = storageTotal !== null && storageFree !== null && Number.isFinite(storageTotal) && Number.isFinite(storageFree)
    ? formatBytes(String(Math.max(0, storageTotal - storageFree)))
    : null;

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
          <div className="dashboard-kpis dashboard-kpis-activity">
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
          <div><h3>Status Distribution</h3>
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
          <div className="panelhead"><div><h3>Activity Trend</h3>
            <span className="muted">{d.trendSubtitle}</span></div></div>
          <div ref={trendChartContainerRef} style={{ overflowX: "auto" }}>
            <svg
              role="img"
              aria-label={`Activity trend: ${d.trendSubtitle}`}
              viewBox={`0 0 ${chartWidth} 230`}
              style={{ display: "block", width: "100%", minWidth: isCompactDashboard ? 0 : `${chartWidth}px`, height: "230px" }}
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
                  <title>{point.assistanceCount === null && point.taskCount === null
                    ? "No data yet"
                    : `${point.tooltip}: Technical Assistance ${point.assistanceCount ?? "No data yet"}, Other Tasks ${point.taskCount ?? "No data yet"}`}</title>
                  {point.assistanceCount !== null && <>
                    {point.highlighted && <circle className="trend-point-pulse" cx={point.x} cy={point.assistanceY} r="5" fill="none" stroke="var(--trend-highlight)" strokeWidth="2" />}
                    <circle cx={point.x} cy={point.assistanceY} r={point.highlighted ? 5.5 : point.assistanceCount === 0 ? 5 : 3.5} fill={point.highlighted ? "var(--trend-highlight)" : "var(--panel)"} stroke="#06aed4" strokeWidth="2" />
                    {point.showAssistanceValueLabel && <text className="trend-value trend-value-assistance" x={point.valueLabelX} y={point.assistanceValueY} textAnchor={point.valueLabelAnchor}>{point.assistanceCount}</text>}
                  </>}
                  {point.taskCount !== null && <>
                    {point.highlighted && <circle className="trend-point-pulse" cx={point.x} cy={point.taskY} r="5" fill="none" stroke="var(--trend-highlight)" strokeWidth="2" />}
                    <circle cx={point.x} cy={point.taskY} r={point.highlighted ? 5.5 : point.taskCount === 0 ? 4 : 3.5} fill={point.highlighted ? "var(--trend-highlight)" : "var(--panel)"} stroke="#f79009" strokeWidth="2" />
                    {point.showTaskValueLabel && <text className="trend-value trend-value-task" x={point.valueLabelX} y={point.taskValueY} textAnchor={point.valueLabelAnchor}>{point.taskCount}</text>}
                  </>}
                  {point.showAxisLabel && (showDailyLabels ? <>
                    <text className={point.highlighted ? "trend-label-pulse" : undefined} x={point.x} y="196" textAnchor="middle" fill={point.highlighted ? "var(--trend-highlight)" : "var(--muted)"} fontSize="11" fontWeight={point.highlighted ? 600 : 500}>{point.weekdayLabel}</text>
                    <text className={point.highlighted ? "trend-label-pulse" : undefined} x={point.x} y="212" textAnchor="middle" fill={point.highlighted ? "var(--trend-highlight)" : "var(--muted)"} fontSize="11" fontWeight={point.highlighted ? 600 : 500}>{point.dayLabel}</text>
                  </> : <text x={point.x} y="204" textAnchor="middle" fill={point.highlighted ? "var(--trend-highlight)" : "var(--muted)"} fontSize="11" fontWeight={point.highlighted ? 600 : 500}>{point.label}</text>)}
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
          <div className="panelhead"><div><h3>Needs Attention</h3>
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
          <div className="panelhead"><div><h3>Assistance by Category</h3>
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
          <div className="panelhead"><div><h3>Activities by Type</h3>
            <span className="muted">{d.tasks.total} record{d.tasks.total === 1 ? "" : "s"}</span></div></div>
          {d.activityTypesUnavailable ? (
            <div className="empty">Activity types are unavailable. Try again.</div>
          ) : d.activityTypes.length ? d.activityTypes.map((activityType: any, index: number) => (
            <div className="barrow" key={activityType.name} style={{ gridTemplateColumns: "minmax(0, 120px) minmax(0, 1fr) max-content" }}>
              <span style={{ overflowWrap: "anywhere" }}>{activityType.name}</span>
              <div className="bar"><i style={{ width: `${(activityType.count / activityTypeMax) * 100}%`, background: PALETTE[index % PALETTE.length] }} /></div>
              <b>{activityType.count}</b>
            </div>
          )) : <div className="empty">No activity types for the selected period.</div>}
        </section>
      </div>

      <section className={`panel dashboard-glass dashboard-quick-actions${animateDashboardEntrance ? " dashboard-enter dashboard-enter-5" : ""}`}>
        <div className="panelhead"><h3>Quick Actions</h3></div>
        <div className="quick-grid">
          <Link className="quick-card" href="/assistance" aria-label="Record technical assistance">
            <span className="quick-card-inner"><Wrench aria-hidden="true" size={16} /><span>Record Technical Assistance</span></span>
          </Link>
          <Link className="quick-card" href="/tasks" aria-label="Record other task">
            <span className="quick-card-inner"><ClipboardList aria-hidden="true" size={16} /><span>Record Other Task</span></span>
          </Link>
          <Link className="quick-card" href="/reports" aria-label="View reports">
            <span className="quick-card-inner"><BarChart3 aria-hidden="true" size={16} /><span>View Reports</span></span>
          </Link>
          {isAdmin && <Link className="quick-card" href="/admin" aria-label="Manage master data">
            <span className="quick-card-inner"><Database aria-hidden="true" size={16} /><span>Manage Master Data</span></span>
          </Link>}
        </div>
      </section>

      {isAdmin && <section className="panel spaced dashboard-glass" aria-labelledby="dashboard-system-health-title" style={{ marginBottom: "12px" }}>
        <div className="panelhead">
          <div>
            <h3 id="dashboard-system-health-title">System Health</h3>
            <span className="muted">Service, resource and backup overview</span>
          </div>
        </div>
        {!systemHealthLoaded ? <div className="muted">Loading system health…</div> : (
          <div style={{ display: "grid", gap: "16px" }}>
            <section aria-labelledby="dashboard-health-resources-title" style={{ minWidth: 0, padding: "20px", border: "1px solid var(--dashboard-glass-border)", borderRadius: "12px", background: "var(--dashboard-glass)" }}>
              <h4 id="dashboard-health-resources-title" style={{ margin: "0 0 18px", fontSize: "15px" }}>Resource Utilization</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 255px), 1fr))", gap: "14px" }}>
                <ResourceGauge
                  label="CPU"
                  icon={Cpu}
                  value={systemHealth?.cpuUsagePercent}
                  level={usageHealth(systemHealth?.cpuUsagePercent, 70)}
                  currentValue={systemHealth?.cpuUsagePercent === null || systemHealth?.cpuUsagePercent === undefined ? "Unavailable" : `${systemHealth.cpuUsagePercent.toFixed(1)}% used`}
                  totalValue="100% capacity"
                />
                <ResourceGauge
                  label="RAM"
                  icon={MemoryStick}
                  value={systemHealth?.memory.usedPercent}
                  level={usageHealth(systemHealth?.memory.usedPercent, 80)}
                  currentValue={systemHealth ? `${formatBytes(systemHealth.memory.usedBytes) ?? "Unavailable"} used` : "Unavailable"}
                  totalValue={systemHealth ? `${formatBytes(systemHealth.memory.totalBytes) ?? "Unavailable"} total` : "Unavailable"}
                />
                <ResourceGauge
                  label="Storage"
                  icon={HardDrive}
                  value={systemHealth?.storage.usedPercent}
                  level={!systemHealth ? "unknown" : !systemHealth.storage.available ? "critical" : usageHealth(systemHealth.storage.usedPercent, 80)}
                  currentValue={storageUsed ? `${storageUsed} used` : systemHealth?.storage.available ? "Usage unavailable" : "Unavailable"}
                  totalValue={systemHealth?.storage.available && systemHealth.storage.totalBytes !== null
                    ? `${formatBytes(systemHealth.storage.totalBytes) ?? "Unavailable"} total`
                    : systemHealth?.storage.available ? "Total capacity unavailable" : "Unavailable"}
                  detail={systemHealth?.storage.available && systemHealth.storage.freeBytes !== null
                    ? `${formatBytes(systemHealth.storage.freeBytes) ?? "Unavailable"} free`
                    : undefined}
                />
              </div>
              {systemHealth?.backupStorage && <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "14px",
                padding: "10px 12px",
                border: "1px solid var(--line2)",
                borderRadius: "9px",
                background: "var(--panel)",
              }}>
                <span className="muted" style={{ fontSize: "11px" }}>Backup Storage · {formatStorageStatus(systemHealth.backupStorage)}</span>
                <HealthIndicator
                  level={!systemHealth.backupStorage.available ? "critical" : usageHealth(systemHealth.backupStorage.usedPercent, 80)}
                  label={systemHealth.backupStorage.usedPercent === null
                    ? systemHealth.backupStorage.available ? "Available" : "Unavailable"
                    : `${systemHealth.backupStorage.usedPercent}% used`}
                />
              </div>}
            </section>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "16px" }}>
              <section aria-labelledby="dashboard-health-services-title" style={{ minWidth: 0, padding: "18px", border: "1px solid var(--dashboard-glass-border)", borderRadius: "12px", background: "var(--dashboard-glass)" }}>
                <h4 id="dashboard-health-services-title" style={{ margin: "0 0 14px", fontSize: "15px" }}>Service Status</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 195px), 1fr))", gap: "12px" }}>
                  {([
                    {
                      icon: Server,
                      label: "Application",
                      level: dashboardApiHealthy === null ? "unknown" : dashboardApiHealthy ? "healthy" : "critical",
                      status: dashboardApiHealthy === null ? "Checking" : dashboardApiHealthy ? "Healthy" : "Unavailable",
                    },
                    {
                      icon: Database,
                      label: "Database",
                      level: systemHealth ? systemHealth.database ? "healthy" : "critical" : "unknown",
                      status: systemHealth ? systemHealth.database ? "Healthy" : "Unavailable" : "Unavailable",
                    },
                    {
                      icon: Clock3,
                      label: "Scheduler",
                      level: backupSchedule === null ? "unknown" : backupSchedule.enabled ? "healthy" : "warning",
                      status: backupSchedule === null ? "Unavailable" : backupSchedule.enabled ? "Enabled" : "Disabled",
                      detail: backupSchedule === null
                        ? undefined
                        : `Last run: ${backupSchedule.lastRunAt
                          ? `${backupSchedule.lastStatus === "SUCCESS" ? "Success" : backupSchedule.lastStatus === "FAILED" ? "Failed" : backupSchedule.lastStatus === "RUNNING" ? "Started" : "Unknown"} · ${formatBackupDate(backupSchedule.lastRunAt)}`
                          : "Never"}`,
                      detailLevel: backupSchedule?.lastStatus === "SUCCESS" ? "healthy"
                        : backupSchedule?.lastStatus === "FAILED" ? "critical"
                          : backupSchedule ? "warning" : "unknown",
                    },
                    {
                      icon: Archive,
                      label: "Backup",
                      level: !systemHealth ? "unknown" : systemHealth.backupHealth.status === "SUCCESS" ? "healthy"
                        : systemHealth.backupHealth.status === "FAILED" ? "critical" : "warning",
                      status: !systemHealth ? "Unavailable" : systemHealth.backupHealth.status === "SUCCESS" ? "Success"
                        : systemHealth.backupHealth.status === "FAILED" ? "Failed"
                          : systemHealth.backupHealth.status === "RUNNING" ? "Running" : "No backups yet",
                    },
                  ] as const).map((service) => (
                    <ServiceStatusCard key={service.label} {...service} />
                  ))}
                </div>
              </section>

              <section aria-labelledby="dashboard-health-backups-title" style={{ minWidth: 0, padding: "18px", border: "1px solid var(--dashboard-glass-border)", borderRadius: "12px", background: "var(--dashboard-glass)" }}>
                <h4 id="dashboard-health-backups-title" style={{ margin: "0 0 14px", fontSize: "15px" }}>Backup Health</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px" }}>
                {([
                  {
                    label: "Last Successful Backup",
                    value: systemHealth ? formatBackupDate(systemHealth.backupHealth.lastSuccessfulAt) : "Unavailable",
                  },
                  {
                    label: "Available Backup Count",
                    value: systemHealth?.backupHealth.availableCount === null || systemHealth?.backupHealth.availableCount === undefined
                      ? "Unavailable" : String(systemHealth.backupHealth.availableCount),
                    level: systemHealth?.backupHealth.availableCount === null || systemHealth?.backupHealth.availableCount === undefined
                      ? "unknown" : systemHealth.backupHealth.availableCount > 0 ? "healthy" : "warning",
                  },
                  {
                    label: "Next Scheduled Backup",
                    value: backupSchedule === null ? "Unavailable"
                      : backupSchedule.enabled && backupSchedule.nextRunAt ? formatBackupDate(backupSchedule.nextRunAt) : "Not scheduled",
                  },
                  {
                    label: "Retention Limit",
                    value: backupSchedule ? `${backupSchedule.retentionCount} backups` : "Unavailable",
                  },
                ] as const).map((metric) => (
                  <div key={metric.label} style={{
                    display: "grid",
                    alignContent: "start",
                    gap: "12px",
                    minWidth: 0,
                    minHeight: "100px",
                    padding: "15px",
                    border: "1px solid var(--line2)",
                    borderRadius: "11px",
                    background: "var(--panel)",
                  }}>
                    <span className="muted" style={{ fontSize: "11px" }}>{metric.label}</span>
                    {"level" in metric
                      ? <HealthIndicator level={metric.level} label={metric.value} />
                      : <strong style={{ fontSize: "14px", lineHeight: 1.4, overflowWrap: "anywhere", fontVariantNumeric: "tabular-nums" }}>{metric.value}</strong>}
                  </div>
                ))}
              </div>
              </section>
            </div>
          </div>
        )}
      </section>}

      {isAdmin && <section className="panel spaced dashboard-glass" aria-labelledby="dashboard-workload-title">
        <div className="panelhead">
          <div>
            <h3 id="dashboard-workload-title">Team Workload Distribution</h3>
          </div>
        </div>
        {workloadState === "loading" ? (
          <div className="muted dashboard-load-state">Loading…</div>
        ) : workloadState === "error" ? (
          <div className="empty">Team workload data is unavailable. Try again.</div>
        ) : workloadUsers.length === 0 ? (
          <div className="empty">No owned records for the selected period.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: "20px" }}>
              {([
                { key: "technicalAssistanceCount", title: "Technical Assistance", total: workloadSummary.technicalAssistanceRecords, color: "#06aed4" },
                { key: "otherTasksCount", title: "Other Tasks", total: workloadSummary.otherTasksRecords, color: "#f79009" },
              ] as const).map((chart) => {
                const sortedUsers = [...workloadUsers].sort((left, right) => {
                  const countDifference = Number(right[chart.key]) - Number(left[chart.key]);
                  if (countDifference !== 0) return countDifference;
                  return left.name.localeCompare(right.name);
                });
                const maxCount = Math.max(1, ...sortedUsers.map((workloadUser) => workloadUser[chart.key]));
                return <div key={chart.key} aria-label={`${chart.title} owned records`}>
                  <div className="panelhead">
                    <div>
                      <h4 style={{ margin: 0 }}>{chart.title} ({chart.total})</h4>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: "8px" }}>
                    {sortedUsers.map((workloadUser, index) => {
                      const count = workloadUser[chart.key];
                      return <div className="barrow" key={workloadUser.id} style={{ gridTemplateColumns: "36px minmax(80px, 0.9fr) minmax(96px, 2fr) 44px", columnGap: "8px", margin: 0 }}>
                        <span className="muted" style={{ textAlign: "left" }}>#{index + 1}</span>
                        <span style={{ overflowWrap: "anywhere" }}>{workloadUser.name}</span>
                        <div className="bar" aria-hidden="true"><i style={{ width: `${(count / maxCount) * 100}%`, background: chart.color }} /></div>
                        <b style={{ textAlign: "right" }}>{count}</b>
                      </div>;
                    })}
                  </div>
                </div>;
              })}
            </div>
          </>
        )}
      </section>}

  {isAdmin && <section className={`panel spaced dashboard-glass${animateDashboardEntrance ? " dashboard-enter dashboard-enter-5" : ""}`}>
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
  </section>}

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
