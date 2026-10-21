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

  const [investigations, resolutions, remarks] = await Promise.all([
    latestForType("INVESTIGATION"),
    latestForType("RESOLUTION"),
    latestForType("REMARK"),
  ]);
  const latestByRecord = (logs: typeof resolutions) =>
    new Map(logs.map((log) => [log[foreignKey]!, log]));
  const latestInvestigations = latestByRecord(investigations);
  const latestResolutions = latestByRecord(resolutions);
  const latestRemarks = latestByRecord(remarks);

  return records.map((record) => ({
    ...record,
    latestInvestigationWorkLog: latestInvestigations.get(record.id) ?? null,
    latestResolutionWorkLog: latestResolutions.get(record.id) ?? null,
    latestRemarkWorkLog: latestRemarks.get(record.id) ?? null,
    recentWorkLogs: [...(record.workLogs ?? [])].sort((a, b) =>
      WORK_LOG_TYPE_ORDER.indexOf(a.type as (typeof WORK_LOG_TYPE_ORDER)[number]) -
        WORK_LOG_TYPE_ORDER.indexOf(b.type as (typeof WORK_LOG_TYPE_ORDER)[number]) ||
      a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id
    ),
  }));
}