import { SessionUser } from "./permissions";
import { applyRecordVisibility } from "./records";
import { fullName } from "./format";
import { prisma } from "./prisma";

export type ReportScope = "mine" | "all";

export interface ReportContributionSummary {
  userName: string;
  owned: number;
  assigned: number;
  participated: number;
}

export const WORK_LOG_TYPE_ORDER = ["INVESTIGATION", "RESOLUTION", "REMARK"] as const;

const reportParticipationWhere = (user: Pick<SessionUser, "id" | "name">) => ({
  OR: [
    { ownerId: user.id },
    { assigned: user.name },
    { workLogs: { some: { createdById: user.id } } },
  ],
});

export const reportOwnerSelect = {
  firstName: true,
  middleInitial: true,
  surname: true,
} as const;

export function formatReportOwner(owner?: {
  firstName: string;
  middleInitial?: string | null;
  surname: string;
} | null) {
  return owner ? fullName(owner) : "—";
}

export function resolveReportScope(scope: string | null | undefined, user: SessionUser): ReportScope {
  if (user.role !== "ADMIN") return "mine";
  if (scope === "mine" || scope === "all") return scope;
  return "all";
}

export async function applyReportScope<T extends Record<string, any>>(
  where: T,
  user: SessionUser,
  scope: ReportScope,
  userId?: string | null
) {
  const filters: Record<string, any>[] = scope === "all"
    ? [applyRecordVisibility(where, user)]
    : [where, reportParticipationWhere(user)];

  if (user.role === "ADMIN" && userId && userId !== "all" && /^\d+$/.test(userId)) {
    const selectedUser = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, firstName: true, middleInitial: true, surname: true },
    });
    filters.push(selectedUser
      ? reportParticipationWhere({ id: selectedUser.id, name: fullName(selectedUser) })
      : { id: -1 });
  }

  return filters.length === 1 ? filters[0] : { AND: filters };
}

export async function getReportContributionSummary(
  where: Record<string, any>,
  user: SessionUser,
  activity: string,
  userId?: string | null
): Promise<ReportContributionSummary> {
  let contributor = { id: user.id, name: user.name };

  if (user.role === "ADMIN" && userId && userId !== "all" && /^\d+$/.test(userId)) {
    const selectedUser = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { id: true, firstName: true, middleInitial: true, surname: true },
    });
    if (selectedUser) {
      contributor = { id: selectedUser.id, name: fullName(selectedUser) };
    }
  }

  const delegates = [
    ...(activity === "tasks" ? [] : [prisma.assistance]),
    ...(activity === "assistance" ? [] : [prisma.task]),
  ];
  const countFor = (delegate: any) => Promise.all([
    delegate.count({ where: { AND: [where, { ownerId: contributor.id }] } }),
    delegate.count({ where: { AND: [where, { assigned: contributor.name }] } }),
    delegate.count({
      where: {
        AND: [where, {
          OR: [
            { ownerId: contributor.id },
            { assigned: contributor.name },
            { workLogs: { some: { createdById: contributor.id } } },
          ],
        }],
      },
    }),
  ]);

  const perType = await Promise.all(delegates.map(countFor));
  return {
    userName: contributor.name,
    owned: perType.reduce((total, counts) => total + counts[0], 0),
    assigned: perType.reduce((total, counts) => total + counts[1], 0),
    participated: perType.reduce((total, counts) => total + counts[2], 0),
  };
}

export async function addReportWorkLogSummaries<T extends {
  id: number;
  workLogs?: Array<{
    id: number;
    type: string;
    message: string;
    createdAt: Date;
    createdByName: string;
  }>;
}>(records: T[], recordType: "assistance" | "tasks") {
  if (!records.length) return [];

  const foreignKey = recordType === "assistance" ? "assistanceId" : "taskId";
  const where = { [foreignKey]: { in: records.map((record) => record.id) } };
  const select = {
    assistanceId: true,
    taskId: true,
    id: true,
    type: true,
    message: true,
    createdAt: true,
    createdByName: true,
  } as const;
  const latestForType = (type: (typeof WORK_LOG_TYPE_ORDER)[number]) =>
    prisma.workLog.findMany({
      where: { ...where, type } as any,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      distinct: [foreignKey as any],
      select,
    });

  const [investigations, resolutions, remarks, latestWorkLogs] = await Promise.all([
    latestForType("INVESTIGATION"),
    latestForType("RESOLUTION"),
    latestForType("REMARK"),
    prisma.workLog.findMany({
      where: where as any,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      distinct: [foreignKey as any],
      select,
    }),
  ]);
  const latestByRecord = (logs: typeof resolutions) =>
    new Map(logs.map((log) => [log[foreignKey]!, log]));
  const latestInvestigations = latestByRecord(investigations);
  const latestResolutions = latestByRecord(resolutions);
  const latestRemarks = latestByRecord(remarks);
  const latestAnyWorkLogs = latestByRecord(latestWorkLogs);

  return records.map((record) => ({
    ...record,
    latestInvestigationWorkLog: latestInvestigations.get(record.id) ?? null,
    latestResolutionWorkLog: latestResolutions.get(record.id) ?? null,
    latestRemarkWorkLog: latestRemarks.get(record.id) ?? null,
    latestWorkLog: latestAnyWorkLogs.get(record.id) ?? null,
    recentWorkLogs: [...(record.workLogs ?? [])].sort((a, b) =>
      WORK_LOG_TYPE_ORDER.indexOf(a.type as (typeof WORK_LOG_TYPE_ORDER)[number]) -
        WORK_LOG_TYPE_ORDER.indexOf(b.type as (typeof WORK_LOG_TYPE_ORDER)[number]) ||
      a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id
    ),
  }));
}

export async function addReportTimelineSummaries<T extends {
  id: number;
  refNo: string;
  createdAt: Date;
  updatedAt: Date;
  assigned: string;
  status: string;
  resolution?: string | null;
  owner?: { firstName: string; middleInitial?: string | null; surname: string } | null;
}>(records: T[], recordType: "assistance" | "tasks") {
  if (!records.length) return [];

  const foreignKey = recordType === "assistance" ? "assistanceId" : "taskId";
  const refs = records.map((record) => record.refNo);
  const [workLogs, auditLogs] = await Promise.all([
    prisma.workLog.findMany({
      where: { [foreignKey]: { in: records.map((record) => record.id) } } as any,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        [foreignKey]: true,
        id: true,
        type: true,
        message: true,
        createdAt: true,
        createdByName: true,
      } as any,
    }),
    prisma.auditLog.findMany({
      where: { entityType: recordType, entityId: { in: refs } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { entityId: true, action: true, details: true, createdAt: true },
    }),
  ]);

  const logsByRecord = new Map<number, typeof workLogs>();
  for (const log of workLogs) {
    const id = (log as any)[foreignKey] as number | null;
    if (id == null) continue;
    const logs = logsByRecord.get(id) ?? [];
    logs.push(log);
    logsByRecord.set(id, logs);
  }

  const historyByRecord = new Map<string, typeof auditLogs>();
  for (const log of auditLogs) {
    if (!log.entityId) continue;
    const history = historyByRecord.get(log.entityId) ?? [];
    history.push(log);
    historyByRecord.set(log.entityId, history);
  }

  return records.map((record) => {
    const recordLogs = (logsByRecord.get(record.id) ?? []) as unknown as Array<{
      type: string;
      message: string;
      createdAt: Date;
      createdByName: string;
    }>;
    const history = historyByRecord.get(record.refNo) ?? [];
    const timeline: Array<{ title: string; description: string; createdAt: Date }> = [];
    const addEvent = (title: string, description: string, createdAt: Date) =>
      timeline.push({ title, description, createdAt });

    for (const entry of history) {
      const details = entry.details && typeof entry.details === "object"
        ? entry.details as Record<string, unknown>
        : {};
      const actor = typeof details.name === "string" ? ` by ${details.name}` : "";
      if (entry.action === "CREATE") {
        addEvent("Reported", `Record created${actor}`, entry.createdAt);
        addEvent("Assigned", `Assigned to ${String(details.assigned || record.assigned)}`, entry.createdAt);
      } else if (entry.action === "ENDORSED" || entry.action === "ASSIGNMENT_CHANGE") {
        addEvent(
          "Endorsed",
          `Reassigned from ${String(details.previousAssigned || "unassigned")} to ${String(details.assigned || record.assigned)}${actor}`,
          entry.createdAt,
        );
      } else if (entry.action === "STATUS_CHANGE") {
        const nextStatus = details.nextStatus;
        if (nextStatus === "CLOSE_PENDING") {
          addEvent("Close Pending", `Work completed and awaiting approval${actor}`, entry.createdAt);
        } else if (nextStatus === "CLOSED") {
          addEvent("Closed", `Approved and closed${actor}`, entry.createdAt);
        }
      }
    }

    const hasTitle = (title: string) => timeline.some((event) => event.title === title);
    if (!hasTitle("Reported")) addEvent("Reported", "Record created", record.createdAt);
    if (!hasTitle("Assigned")) addEvent("Assigned", `Assigned to ${record.assigned}`, record.createdAt);
    if (record.status === "CLOSE_PENDING" && !hasTitle("Close Pending")) {
      addEvent("Close Pending", "Current status is Close Pending", record.updatedAt);
    }
    if (record.status === "CLOSED" && !hasTitle("Closed")) {
      addEvent("Closed", "Current status is Closed", record.updatedAt);
    }

    const contributors = recordLogs
      .map((log) => log.createdByName.trim())
      .filter(Boolean);
    for (const log of recordLogs) {
      const title = log.type === "INVESTIGATION"
        ? "Investigation"
        : log.type === "RESOLUTION"
          ? "Resolution"
          : "Remark";
      addEvent(title, `${log.createdByName}: ${log.message}`, log.createdAt);
    }

    timeline.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
    const latestResolutionLog = [...recordLogs].reverse().find((log) => log.type === "RESOLUTION");
    const participants = [
      formatReportOwner(record.owner),
      record.assigned.trim() || "—",
      ...contributors,
    ].filter((name, index, names) => name !== "—" && names.indexOf(name) === index);

    return {
      ...record,
      participants,
      latestResolution: latestResolutionLog?.message || record.resolution || "",
      timelineSummary: timeline,
    };
  });
}