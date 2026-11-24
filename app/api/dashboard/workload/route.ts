import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createReportParticipationResolver, reportParticipationWhere, type ReportParticipationUser } from "@/lib/reports";
import { fullName } from "@/lib/format";
import { getCustomPeriodRange, getPeriodRange, PERIOD_OPTIONS, type Period } from "@/lib/period";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type ParticipationRecord = {
  ownerId: number | null;
  assigned: string;
  workLogs: Array<{ createdById: number | null }>;
};

function countParticipationByUser(
  records: ParticipationRecord[],
  users: ReportParticipationUser[],
  resolveParticipants: ReturnType<typeof createReportParticipationResolver>,
) {
  const counts = new Map(users.map((eligibleUser) => [eligibleUser.id, 0]));
  for (const record of records) {
    for (const userId of resolveParticipants(record)) {
      counts.set(userId, (counts.get(userId) ?? 0) + 1);
    }
  }
  return counts;
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const searchParams = new URL(request.url).searchParams;
  const requestedUserId = searchParams.get("userId");
  const periodParam = searchParams.get("period") ?? "today";
  if (!PERIOD_OPTIONS.some((option) => option.value === periodParam)) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  const period = periodParam as Period;
  let range: { start: Date; end: Date } | null = null;
  if (period === "custom") {
    range = getCustomPeriodRange(searchParams.get("from") ?? "", searchParams.get("to") ?? "");
    if (!range) return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  } else if (period !== "all") {
    range = getPeriodRange(period, new Date());
  }

  if (requestedUserId && requestedUserId !== "all" && !/^[1-9]\d*$/.test(requestedUserId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const eligibleUsers = await prisma.user.findMany({
    where: { role: "USER", active: true },
    select: { id: true, firstName: true, middleInitial: true, surname: true },
  });
  const selectedUserId = requestedUserId && requestedUserId !== "all"
    ? Number(requestedUserId)
    : null;
  if (selectedUserId !== null && (
    !Number.isSafeInteger(selectedUserId) ||
    !eligibleUsers.some((eligibleUser) => eligibleUser.id === selectedUserId)
  )) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const recordWhere = range ? { startDate: { gte: range.start, lt: range.end } } : {};
  const reportUsers: ReportParticipationUser[] = eligibleUsers.map((eligibleUser) => ({
    id: eligibleUser.id,
    name: fullName(eligibleUser),
  }));
  const participationWhere = reportUsers.length
    ? { OR: reportUsers.map((participant) => reportParticipationWhere(participant)) }
    : { id: -1 };
  const participationSelect = {
    ownerId: true,
    assigned: true,
    workLogs: {
      where: { createdById: { in: reportUsers.map((participant) => participant.id) } },
      select: { createdById: true },
    },
  } as const;
  const [
    assistanceRecordCount,
    assistanceRecords,
    taskRecordCount,
    taskRecords,
  ] = await Promise.all([
    prisma.assistance.count({ where: recordWhere }),
    prisma.assistance.findMany({
      where: { AND: [recordWhere, participationWhere] },
      select: participationSelect,
    }),
    prisma.task.count({ where: recordWhere }),
    prisma.task.findMany({
      where: { AND: [recordWhere, participationWhere] },
      select: participationSelect,
    }),
  ]);
  const resolveParticipants = createReportParticipationResolver(reportUsers);
  const assistanceByUser = countParticipationByUser(assistanceRecords, reportUsers, resolveParticipants);
  const tasksByUser = countParticipationByUser(taskRecords, reportUsers, resolveParticipants);
  const visibleUsers = eligibleUsers.filter((eligibleUser) =>
    selectedUserId === null || eligibleUser.id === selectedUserId
  );
  const workload = visibleUsers
    .map((eligibleUser) => ({
      id: eligibleUser.id,
      name: fullName(eligibleUser),
      technicalAssistanceCount: assistanceByUser.get(eligibleUser.id) ?? 0,
      otherTasksCount: tasksByUser.get(eligibleUser.id) ?? 0,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return NextResponse.json({
    users: workload,
    summary: {
      technicalAssistanceParticipation: workload.reduce((total, eligibleUser) => total + eligibleUser.technicalAssistanceCount, 0),
      otherTasksParticipation: workload.reduce((total, eligibleUser) => total + eligibleUser.otherTasksCount, 0),
      technicalAssistanceUnassigned: assistanceRecordCount - assistanceRecords.length,
      otherTasksUnassigned: taskRecordCount - taskRecords.length,
    },
  });
}