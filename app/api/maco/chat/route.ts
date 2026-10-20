import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { promises as fs } from "fs";
import path from "path";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SETTINGS_FILE = path.join(
  process.cwd(),
  "data",
  "ai-settings.json"
);

const formatDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));

type SourceReference = {
  source: string;
  references: string[];
};

export async function POST(req: NextRequest) {

  console.time("MACO Total");
  
  try {
    const body = await req.json();

    const question = body.message?.trim();

    const history = Array.isArray(body.history)
      ? body.history.slice(-6)
      : [];

    if (!question) {
      return NextResponse.json(
        {
          error: "Question is required",
        },
        {
          status: 400,
        }
      );
    }

    const q: string = question.toLowerCase();
    const explicitRecordReference =
      question.match(/\b(?:TA|OT)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/i)?.[0].toUpperCase() ?? null;
    const isIncidentFollowup = /\b(similar|related|happened before|seen before|recurring|same client|same category|same show|same group|records involving)\b/i.test(q);
    const historyRecordReference = [...history].reverse()
      .map((entry: any) => String(entry.content ?? "").match(/\b(?:TA|OT)-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/i)?.[0].toUpperCase())
      .find(Boolean) ?? null;
    const recordReference = explicitRecordReference ?? (isIncidentFollowup ? historyRecordReference : null);

    const simpleQuestion =
      q === "hi" ||
      q === "hello" ||
      q === "hey" ||
      q === "thanks" ||
      q === "thank you" ||
      q.includes("who are you");    

    const settings = JSON.parse(
      await fs.readFile(SETTINGS_FILE, "utf8")
    );
    const searchRecordsEnabled = settings.maco?.searchRecords !== false;

    let liveContext = "";
    const contextSections: string[] = [];
    const sourceReferences = new Map<string, Set<string>>();
    const addSourceReference = (source: string, references: string[] = []) => {
      const existing = sourceReferences.get(source) ?? new Set<string>();
      references.forEach((reference) => existing.add(reference));
      sourceReferences.set(source, existing);
    };
    const stopWords = new Set([
        "the", "and", "for", "with", "from", "that", "this", "are", "was",
        "were", "what", "when", "where", "which", "who", "how", "many",
        "show", "give", "list", "tell", "about", "please", "have", "has",
        "does", "did", "can", "could", "would", "should", "into", "their",
        "there", "them", "your", "our", "all", "any", "get", "find", "latest",
        "recent", "total", "count", "number", "statistics", "stats", "report",
        "reports", "data", "record", "records", "system", "ops", "tracker",
        "assistance", "incident", "ticket", "support", "problem", "issue",
        "task", "activity", "activities", "operation", "user", "users",
        "admin", "administrator", "administrators", "account", "staff",
        "audit", "log", "logs", "logged", "location", "locations", "shift",
        "shifts", "show", "shows", "group", "groups", "category", "categories",
        "master", "configuration", "config", "settings", "branding", "open",
        "pending", "unresolved", "active", "closed", "close", "status",
        "similar", "related", "previous", "before", "history", "encountered",
        "why", "occur", "occurs", "happen", "happens", "happening", "keep",
        "cause", "causes", "causing", "pattern", "patterns",
      ]);
    const terms: string[] = (q.match(/[a-z0-9-]{3,}/g) ?? [])
      .filter((term: string) => !stopWords.has(term))
      .slice(0, 5);
    const textWhere = (fields: string[]) => ({
      OR: fields.flatMap((field) => terms.map((term) => ({
        [field]: { contains: term, mode: "insensitive" },
      }))),
    });
    const shorten = (value: string | null | undefined, max = 320) =>
      value ? `${value.slice(0, max)}${value.length > max ? "..." : ""}` : "N/A";
    const asks = (pattern: RegExp) => pattern.test(q);
    const asksRecordHistory = asks(/\b(history|historical|timeline|what happened|changes?|updated|changed)\b/);
    const asksSimilarRecords = asks(/\b(similar|related|like this|comparable)\b/);
    const asksOperationalRootCause = asks(/\broot cause(?: analysis)?\b|\bwhy\b.{0,80}\b(?:incident|issue|problem)\b|\b(?:what|which)\b.{0,40}\bcaus(?:e|es|ing)\b|\bpatterns?\b.{0,30}\b(?:do you see|recurring|repeat|across)\b/);
    const asksIncidentInvestigation = asksSimilarRecords || asksOperationalRootCause || asks(/\b(happened before|seen before|recurring|repeat(?:ing)? problems?|related issues?|same client|same category|same show|same group|records involving|incidents? involving|issues? affect(?:s|ing)?|previous incidents?)\b/);
    const asksAssistance = asks(/\b(assistance|incident|ticket|support|problem|issue)\b/);
    const asksTask = asks(/\b(task|activity|activities|operation)\b/);
    const asksUsers = asks(/\b(user|users|admin|administrator|account|staff)\b/);
    const asksRecentAdminActions = asks(/\b(recent|latest|last)\b.{0,25}\b(administrative|admin)\b.{0,20}\b(actions?|activity)\b|\b(administrative|admin)\b.{0,25}\b(actions?|activity)\b/);
    const asksYesterdayAudit = asks(/\byesterday\b/) && asks(/\b(modified|changed|updated|deleted|created|actions?|activity)\b/);
    const asksAudit = asks(/\b(audit|logs?|logged|change history|system history|user actions?|actions? by|changes made|who (?:changed|updated|deleted|created)|login history|administrative actions?)\b/) || asksYesterdayAudit;
    const asksMasterData = asks(/\b(location|locations|shift|shifts|shows|groups|category|categories|activity type|activity types|master data)\b/);
    const asksAdmin = asks(/\b(admin|administration|configuration|config|settings|branding)\b/);
    const asksReport = asks(/\b(report|reports|dashboard|statistics|stats|summary|how many|total|count)\b/);
    const asksTodaySummary = asks(/\b(today|daily)\b/);
    const asksWeeklySummary = asks(/\b(weekly|this week|last week|past week|week over week)\b/);
    const asksMonthlySummary = asks(/\b(monthly|this month|last month|past month|month over month)\b/);
    const asksExecutiveSummary = asks(/\b(summar(?:y|ize|ise)|executive|overview|operational insights)\b/);
    const asksDetailedRecords = asks(/\b(full|complete|all)\s+(record|details|fields)|\b(detailed|full)\s+record|\brecord\s+details\b|\bdetails?\s+(of|for|on)\b|\ball available fields\b|\b(?:show|give|provide|include|tell me)\b.{0,30}\b(details|fields)\b/);
    const asksTopUsers = asks(/\b(top|most active|highest|busiest)\b.{0,30}\b(users|staff|assignees|operators)\b|\b(users|staff|assignees|operators)\b.{0,30}\b(top|most active|highest|busiest)\b/);
    const asksTopCategories = asks(/\b(top|most common|common|frequent|frequently reported)\b.{0,30}\b(categories|issues|problems)\b|\b(categories|issues|problems)\b.{0,30}\b(top|most common|frequent)\b/);
    const asksTopIssues = asks(/\b(top|most common|common|frequent) issues?\b/);
    const asksWorkload = asks(/\b(workload|work load|assignment|assignments|assignee|assignees|staff capacity)\b/);
    const asksActivityTimeline = asks(/\b(timeline|recent activity|what did i do|what happened (?:yesterday|today|this week|last week|in the past week))\b/);
    const asksWorkActivity = asks(/\b(this week|last week|past week|my activity|working on|consumed most|most of .*time|time spent|completed work by user|who handled)\b/) ||
      asksActivityTimeline ||
      (asks(/\byesterday\b/) && asks(/\b(work|working|activity|activities|task|tasks|assistance|handled|assigned|completed|doing)\b/));
    const asksTrend = asks(/\b(trend|trends|over time|week over week|month over month|increas(?:e|ed|ing)|decreas(?:e|ed|ing))\b/);
    const asksOperationsAnalytics = asksTodaySummary || asksWeeklySummary || asksMonthlySummary || asksExecutiveSummary || asksTopUsers || asksTopCategories || asksWorkload || asksWorkActivity || asksTrend || asksTopIssues;
    const asksOpen = asks(/\b(open|pending|unresolved|active)\b/);
    const wantsUserList = asks(/\b(list|names|who are|show (all )?(users|admins|administrators))\b/);
    const asksAllAdmins = asks(/\b(show|list|who are)\b.{0,25}\b(all )?(admins|administrators)\b/);
    const asksAdminCount = asks(/\b(count|how many|number of|total)\b.{0,25}\b(admins|administrators)\b|\b(admins|administrators)\b.{0,25}\b(count|how many|number|total)\b/);
    const asksActiveUsers = asks(/\b(active|enabled) users\b/);
    const asksDisabledUsers = asks(/\b(disabled|inactive) users\b/);
    const asksEmailReportUsers = asks(/\b(email|e-mail)\b.{0,30}\breports?\b|\breports?\b.{0,30}\b(email|e-mail)\b/);
    const asksEmailReportsDisabled = asksEmailReportUsers && asks(/\b(disabled|off|without|no|not|inactive)\b/);
    const asksTargetedUsers = asksAllAdmins || asksAdminCount || asksActiveUsers || asksDisabledUsers || asksEmailReportUsers;
    const asksMostCompletedTasks = asks(/\b(most|latest|recent) completed tasks\b|\bcompleted tasks\b/);
    const asksTopPerformers = asks(/\b(top|best|highest|most) performers?\b/);
    const asksPerformanceRanking = asks(/\b(who|most|top|highest|best|performers?)\b/);
    const asksTaskPerformance = asksPerformanceRanking &&
      asks(/\b(completed|closed)\b.{0,40}\b(tasks?|activities)\b|\b(tasks?|activities)\b.{0,40}\b(completed|closed)\b/);
    const asksAssistancePerformance = asksPerformanceRanking &&
      asks(/\b(completed|closed)\b.{0,50}\b(technical assistance|assistance requests?|incidents?|tickets?)\b|\b(technical assistance|assistance requests?|incidents?|tickets?)\b.{0,50}\b(completed|closed)\b/);
    const asksOpenTasks = asks(/\b(open|pending|unresolved) tasks\b/);
    const asksOverdueTasks = asks(/\boverdue tasks?\b/);
    const asksTargetedTasks = asksMostCompletedTasks || asksTopPerformers || asksTaskPerformance || asksOpenTasks || asksOverdueTasks;
    const asksOpenIncidents = asks(/\b(open|pending|unresolved) incidents?\b/);
    const asksAdobeIncidents = asks(/\badobe\b.{0,30}\b(incidents?|tickets?|issues?)\b|\b(incidents?|tickets?|issues?)\b.{0,30}\badobe\b/);
    const asksTargetedAssistance = asksTopIssues || asksAssistancePerformance || asksOpenIncidents || asksAdobeIncidents;
    const incidentTerms = (q.match(/[a-z0-9]{3,}/g) ?? [])
      .filter((term: string) => !stopWords.has(term) && !["same", "seen", "before", "happened", "recurring", "related", "issue", "issues", "problem", "problems", "incident", "incidents", "assistance", "support", "task", "tasks", "involving", "records", "client", "category", "show", "group"].includes(term))
      .slice(0, 8);
    const findIncidentMatches = async (seed?: Record<string, unknown>) => {
      const seedCategory = String(seed?.category ?? seed?.activityType ?? "").trim();
      const seedShowGroup = String(seed?.showGroup ?? seed?.show ?? seed?.group ?? "").trim();
      const seedClient = String(seed?.clientName ?? seed?.client ?? "").trim();
      const seedText = [seed?.problem, seed?.resolution, seed?.description]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
      const keywords = seed
        ? [...new Set((seedText.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((term) => !stopWords.has(term)))].slice(0, 8)
        : incidentTerms;
      const assistanceConditions: Record<string, unknown>[] = [
        ...(seedCategory ? [{ category: { contains: seedCategory, mode: "insensitive" } }] : []),
        ...(seedShowGroup ? [{ showGroup: { contains: seedShowGroup, mode: "insensitive" } }] : []),
        ...(seedClient ? [{ clientName: { contains: seedClient, mode: "insensitive" } }] : []),
        ...keywords.flatMap((term) => [
          { category: { contains: term, mode: "insensitive" } },
          { showGroup: { contains: term, mode: "insensitive" } },
          { clientName: { contains: term, mode: "insensitive" } },
          { problem: { contains: term, mode: "insensitive" } },
          { resolution: { contains: term, mode: "insensitive" } },
        ]),
      ];
      const taskConditions: Record<string, unknown>[] = [
        ...(seedCategory ? [{ activityType: { equals: seedCategory, mode: "insensitive" } }] : []),
        ...(seedShowGroup ? [{ showGroup: { equals: seedShowGroup, mode: "insensitive" } }] : []),
        ...keywords.flatMap((term) => [
          { activityType: { contains: term, mode: "insensitive" } },
          { showGroup: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ]),
      ];
      const assistanceWhere = assistanceConditions.length ? { OR: assistanceConditions } : undefined;
      const taskWhere = taskConditions.length ? { OR: taskConditions } : undefined;
      const [assistanceRecords, taskRecords] = await Promise.all([
        prisma.assistance.findMany({
          where: assistanceWhere as any,
          select: { refNo: true, startDate: true, category: true, showGroup: true, clientName: true, problem: true, resolution: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.task.findMany({
          where: taskWhere as any,
          select: { refNo: true, startDate: true, activityType: true, showGroup: true, description: true, status: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      ]);
      const candidates = [
        ...assistanceRecords.map((record) => ({
          type: "Technical Assistance",
          refNo: record.refNo,
          date: record.startDate,
          category: record.category,
          showGroup: record.showGroup,
          client: record.clientName,
          description: record.problem,
          resolution: record.resolution,
          status: record.status,
        })),
        ...taskRecords.map((record) => ({
          type: "Other Tasks",
          refNo: record.refNo,
          date: record.startDate,
          category: record.activityType,
          showGroup: record.showGroup,
          client: null,
          description: record.description,
          resolution: null,
          status: record.status,
        })),
      ].filter((record) => record.refNo !== seed?.refNo);
      const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();
      const matchesValue = (expected: string, actual: unknown) => {
        const expectedValue = normalized(expected);
        const actualValue = normalized(actual);
        return !!expectedValue && !!actualValue && actualValue.includes(expectedValue);
      };
      const matchesQueryTerm = (value: unknown) =>
        incidentTerms.some((term) => normalized(value).includes(normalized(term)));
      const scored = candidates.map((record) => {
        const categoryMatch = seedCategory
          ? matchesValue(seedCategory, record.category)
          : matchesQueryTerm(record.category);
        const showMatch = seedShowGroup
          ? matchesValue(seedShowGroup, record.showGroup)
          : matchesQueryTerm(record.showGroup);
        const clientMatch = seedClient
          ? matchesValue(seedClient, record.client)
          : matchesQueryTerm(record.client);
        const searchable = [record.description, record.resolution]
          .map(normalized).join(" ");
        const keywordMatches = keywords.filter((term) => searchable.includes(term));
        return {
          ...record,
          score: (categoryMatch ? 5 : 0) + (showMatch ? 5 : 0) + (clientMatch ? 6 : 0) + keywordMatches.length * 2,
          matches: [
            ...(clientMatch ? ["Same Client"] : []),
            ...(showMatch ? ["Same Show/Group"] : []),
            ...(categoryMatch ? ["Same Category"] : []),
            ...(keywordMatches.length ? ["Similar Keywords"] : []),
          ],
        };
      });
      const categoryCounts = new Map<string, number>();
      const showCounts = new Map<string, number>();
      const clientCounts = new Map<string, number>();
      for (const record of scored) {
        if (record.category) categoryCounts.set(normalized(record.category), (categoryCounts.get(normalized(record.category)) ?? 0) + 1);
        if (record.showGroup) showCounts.set(normalized(record.showGroup), (showCounts.get(normalized(record.showGroup)) ?? 0) + 1);
        if (record.client) clientCounts.set(normalized(record.client), (clientCounts.get(normalized(record.client)) ?? 0) + 1);
      }
      const countPatterns = (values: (string | null)[]) => {
        const counts = new Map<string, { value: string; count: number }>();
        for (const value of values) {
          if (!value) continue;
          const key = normalized(value);
          const entry = counts.get(key);
          counts.set(key, { value: entry?.value ?? value, count: (entry?.count ?? 0) + 1 });
        }
        return [...counts.values()].filter((entry) => entry.count > 1).sort((a, b) => b.count - a.count).slice(0, 5);
      };
      const problemKeywordCounts = new Map<string, number>();
      for (const record of candidates) {
        const words = new Set((record.description?.toLowerCase().match(/[a-z0-9]{4,}/g) ?? []).filter((term) => !stopWords.has(term)));
        for (const word of words) problemKeywordCounts.set(word, (problemKeywordCounts.get(word) ?? 0) + 1);
      }
      const recurringPatterns = {
        categories: countPatterns(candidates.map((record) => record.category)),
        showsOrGroups: countPatterns(candidates.map((record) => record.showGroup)),
        clients: countPatterns(candidates.map((record) => record.client)),
        problemKeywords: [...problemKeywordCounts.entries()].filter(([, count]) => count > 1).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([keyword, count]) => ({ keyword, count })),
      };
      const ranked = scored
        .map((record) => ({
          ...record,
          score: record.score + (categoryCounts.get(normalized(record.category)) ?? 0) + (showCounts.get(normalized(record.showGroup)) ?? 0) + (clientCounts.get(normalized(record.client)) ?? 0),
        }))
        .filter((record) => seed ? record.score > 0 : incidentTerms.length || asksOperationalRootCause ? record.score > 0 : record.score > 3)
        .sort((a, b) => b.score - a.score || new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
      return { candidates, ranked, recurringPatterns };
    };
    const responseType = asksExecutiveSummary
      ? "Executive Summary"
      : asksActivityTimeline
        ? "Timeline"
        : asksOperationsAnalytics || asksReport
        ? "Analytics"
        : asks(/\b(list|show|who are|which|all)\b/) || asksTargetedUsers || asksTargetedTasks || asksTargetedAssistance
          ? "Lists"
          : "Lookup";
    const asksSettingsChanges = asks(/\b(settings?|configuration|branding) changes?\b|\b(changed|updated|modified)\b.{0,25}\b(settings?|configuration|branding)\b|\bchanges?\b.{0,25}\b(settings?|configuration|branding)\b/);
    const asksRecordDeletions = asks(/\b(record|records|task|tasks|incident|incidents|user|users) deletions?\b|\b(deletions?|deleted)\b/);
    const asksUserActivity = asks(/\b(user activity|user actions|activity by users|users? activity)\b/);
    const asksTargetedAudit = asksSettingsChanges || asksRecordDeletions || asksUserActivity || asksRecentAdminActions || asksYesterdayAudit;
    const requestedPeriodWhere = () => {
      if (!asksWeeklySummary && !asksMonthlySummary) return {};
      const periodUnit = asksMonthlySummary ? "month" : "week";
      const start = new Date();
      if (periodUnit === "month") {
        start.setDate(1);
      } else {
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      }
      start.setHours(0, 0, 0, 0);
      if (asks(/\b(last|previous|past)\b/)) {
        if (periodUnit === "month") start.setMonth(start.getMonth() - 1);
        else start.setDate(start.getDate() - 7);
      }
      const end = new Date(start);
      if (periodUnit === "month") end.setMonth(end.getMonth() + 1);
      else end.setDate(end.getDate() + 7);
      return { startDate: { gte: start, lt: end } };
    };

    if (!simpleQuestion) {
      console.time("Database");

      if (recordReference) {
        const isAssistance = recordReference.startsWith("TA-");
        const record = isAssistance
          ? await prisma.assistance.findFirst({ where: { refNo: recordReference } })
          : await prisma.task.findFirst({ where: { refNo: recordReference } });
        addSourceReference(isAssistance ? "Technical Assistance" : "Tasks", [recordReference]);
        if (!record) {
          contextSections.push(`EXACT RECORD LOOKUP\nNo record found with reference ${recordReference}.`);
        } else {
          const recordData = record as unknown as Record<string, unknown>;
          const relatedValues = isAssistance
            ? [recordData.category, recordData.problem, recordData.resolution]
            : [recordData.activityType, recordData.description];
          const [historyEntries, incidentMatches] = await Promise.all([
            asksRecordHistory
              ? prisma.auditLog.findMany({
                  where: { entityId: { in: [String(recordData.id), recordReference] } },
                  select: { action: true, entityType: true, entityId: true, userId: true, details: true, createdAt: true },
                  orderBy: { createdAt: "desc" },
                  take: 20,
                })
              : Promise.resolve([]),
            asksIncidentInvestigation
              ? findIncidentMatches({ ...recordData, refNo: recordReference })
              : Promise.resolve({
                  candidates: [],
                  ranked: [],
                  recurringPatterns: { categories: [], showsOrGroups: [], clients: [], problemKeywords: [] },
                }),
          ]);
          const similarRecords = incidentMatches.ranked;
          addSourceReference("Technical Assistance", similarRecords.filter((record) => record.type === "Technical Assistance").map((record) => record.refNo));
          addSourceReference("Tasks", similarRecords.filter((record) => record.type === "Other Tasks").map((record) => record.refNo));
          const creatorField = Object.entries(recordData).find(([field]) =>
            /creator|created.?by|reported.?by|requested.?by/i.test(field)
          );
          const creator = creatorField?.[1] ?? null;
          const notes = Object.fromEntries(
            ["notes", "remarks", "resolution", "problem", "description"]
              .filter((field) => recordData[field] != null)
              .map((field) => [field, recordData[field]])
          );
          contextSections.push(`RECORD INVESTIGATION\n${JSON.stringify({
            type: isAssistance ? "technical assistance" : "other task",
            reference: recordReference,
            details: {
              ...(asksDetailedRecords ? recordData : {}),
              refNo: recordData.refNo ?? recordReference,
              status: recordData.status ?? null,
              category: recordData.category ?? recordData.activityType ?? null,
              assignee: recordData.assigned ?? null,
              creator,
              date: recordData.startDate ?? recordData.createdAt ?? null,
              summary: shorten(
                String(recordData.problem ?? recordData.description ?? ""),
                asksDetailedRecords ? 1000 : 240
              ),
              ...(asksDetailedRecords ? { notes } : {}),
            },
            history: asksRecordHistory ? historyEntries : undefined,
            incidentInvestigation: asksIncidentInvestigation ? {
              candidatesReviewed: incidentMatches.candidates.length,
              candidateScope: "Up to 100 recent technical assistance records and 100 recent task records matching the record's category, show/group, client, or keywords.",
              summary: `${similarRecords.length} most relevant matching records shown, ranked by category, show/group, client, and problem-description keyword overlap.`,
              recurringPatterns: incidentMatches.recurringPatterns,
              similarRecords,
            } : undefined,
          }, null, 2)}`);
        }
      }

      if (!recordReference && asksIncidentInvestigation && searchRecordsEnabled) {
        const incidentMatches = await findIncidentMatches();
        const matches = incidentMatches.ranked;
        addSourceReference("Technical Assistance", matches.filter((record) => record.type === "Technical Assistance").map((record) => record.refNo));
        addSourceReference("Tasks", matches.filter((record) => record.type === "Other Tasks").map((record) => record.refNo));
        contextSections.push(`INCIDENT INVESTIGATION\n${JSON.stringify({
          recordsReviewed: incidentMatches.candidates.length,
          candidateScope: incidentTerms.length
            ? "Up to 100 recent technical assistance records and 100 recent task records matching the query terms."
            : "Up to 100 most recent technical assistance records and 100 most recent task records.",
          summary: matches.length
            ? `Found ${matches.length} relevant records; ranked using category/activity type, show/group, client where recorded, and problem/description keyword overlap.`
            : incidentTerms.length
              ? "No relevant prior records matched the available category, show/group, client, or description keywords."
              : "No repeated match patterns were identified in the retrieved records.",
          recurringPatterns: incidentMatches.recurringPatterns,
          mostRelevantRecords: matches.map((record) => ({
            type: record.type,
            refNo: record.refNo,
            date: record.date,
            category: record.category,
            showOrGroup: record.showGroup,
            client: record.client,
            status: record.status,
            matchedOn: record.matches,
            description: shorten(record.description, 180),
            resolution: record.resolution ? shorten(record.resolution, 160) : undefined,
          })),
        }, null, 2)}`);
      }

      if (!recordReference && asksTargetedUsers) {
        const userWhere = asksAllAdmins || asksAdminCount
          ? { role: "ADMIN" as const }
          : asksActiveUsers
            ? { active: true }
            : asksDisabledUsers
              ? { active: false }
              : { smtpEnabled: asksEmailReportsDisabled ? false : true };
        const [totalUsers, totalAdmins, totalActive, totalEmailReportsEnabled, totalEmailReportsDisabled, count, users] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { role: "ADMIN" } }),
          prisma.user.count({ where: { active: true } }),
          prisma.user.count({ where: { smtpEnabled: true } }),
          prisma.user.count({ where: { smtpEnabled: false } }),
          prisma.user.count({ where: userWhere }),
          asksAdminCount && !asksAllAdmins
            ? Promise.resolve([])
            : prisma.user.findMany({
                where: userWhere,
                select: { firstName: true, surname: true, email: true, role: true, active: true, smtpEnabled: true },
                orderBy: [{ surname: "asc" }, { firstName: "asc" }],
                take: 5,
              }),
        ]);
        addSourceReference("Users", users.map((user) => `${user.firstName} ${user.surname}`));
        const type = asksAllAdmins || asksAdminCount
          ? "administrators"
          : asksActiveUsers
            ? "active users"
            : asksDisabledUsers
              ? "inactive users"
              : asksEmailReportsDisabled
                ? "users without email reports"
                : "users with email reports enabled";
        contextSections.push(`TARGETED USER RETRIEVAL\n${JSON.stringify({
          type,
          count,
          totals: {
            users: totalUsers,
            administrators: totalAdmins,
            activeUsers: totalActive,
            inactiveUsers: totalUsers - totalActive,
            usersWithEmailReports: totalEmailReportsEnabled,
            usersWithoutEmailReports: totalEmailReportsDisabled,
          },
          users: users.map((user) => ({ name: `${user.firstName} ${user.surname}`, email: user.email, role: user.role, active: user.active, emailReportsEnabled: user.smtpEnabled })),
        }, null, 2)}`);
      }

      if (!recordReference && !asksTargetedUsers && !asksTargetedTasks && !asksTopUsers && (asksUsers || asksAdmin)) {
        const [total, active, admins, users] = await Promise.all([
          prisma.user.count(),
          prisma.user.count({ where: { active: true } }),
          prisma.user.count({ where: { role: "ADMIN" } }),
          wantsUserList
            ? prisma.user.findMany({
                where: asks(/\b(admin|administrator|admins)\b/) ? { role: "ADMIN" } : undefined,
                select: { firstName: true, surname: true, role: true, active: true },
                orderBy: [{ surname: "asc" }, { firstName: "asc" }],
                take: 5,
              })
            : terms.length
              ? prisma.user.findMany({
                  where: { OR: terms.flatMap((term) => [
                    { firstName: { contains: term, mode: "insensitive" } },
                    { surname: { contains: term, mode: "insensitive" } },
                  ]) },
                  select: { firstName: true, surname: true, role: true, active: true },
                  take: 5,
                })
            : Promise.resolve([]),
        ]);
            addSourceReference("Users", users.map((user) => `${user.firstName} ${user.surname}`));
        contextSections.push(`USERS\nTotal: ${total}; active: ${active}; inactive: ${total - active}; administrators: ${admins}.`);
        if (users.length) {
          contextSections.push(`USER LIST (maximum 5)\n${users.map((user) => `- ${user.firstName} ${user.surname}; ${user.role}; ${user.active ? "active" : "inactive"}`).join("\n")}`);
        }
      }

      if (!recordReference && !asksIncidentInvestigation && !asksTargetedAssistance && !asksOperationsAnalytics && (asksAssistance || (asksReport && asks(/\b(technical|support|incident|ticket)\b/)))) {
        const assistanceWhere = {
          ...(asksOpen ? { status: "OPEN" as const } : {}),
          ...(terms.length ? textWhere(["refNo", "problem", "resolution", "remarks", "category", "assigned", "accountable", "location", "shift", "showGroup"]) : {}),
        } as any;
        const [total, byStatus, records] = await Promise.all([
          prisma.assistance.count({ where: assistanceWhere }),
          asksReport || asksOpen ? prisma.assistance.groupBy({ by: ["status"], where: assistanceWhere, _count: { _all: true } }) : Promise.resolve([]),
          searchRecordsEnabled && !asksReport && (terms.length > 0 || asksOpen || asks(/\b(latest|recent|last)\b/))
            ? prisma.assistance.findMany({
                where: assistanceWhere,
                select: { refNo: true, startDate: true, shift: true, location: true, showGroup: true, clientName: true, category: true, problem: true, resolution: true, priority: true, status: true, assigned: true, accountable: true, remarks: true },
                orderBy: { createdAt: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
        ]);
          addSourceReference("Technical Assistance", records.map((record) => record.refNo));
        contextSections.push(`TECHNICAL ASSISTANCE\nTotal records: ${total}${byStatus.length ? `; status counts: ${byStatus.map((entry) => `${entry.status} ${entry._count._all}`).join(", ")}` : ""}.`);
        if (records.length) {
          contextSections.push(`MATCHING TECHNICAL ASSISTANCE (maximum 5)\n${records.map((record) => `Ref ${record.refNo}; ${formatDate(record.startDate)}; ${record.shift}; ${record.location}; ${record.showGroup ?? "No group"}; category ${record.category}; ${record.priority}; ${record.status}; assigned ${record.assigned}; accountable ${record.accountable}; problem: ${shorten(record.problem, asksDetailedRecords ? 320 : 140)}${asksDetailedRecords ? `; resolution: ${shorten(record.resolution, 200)}; remarks: ${shorten(record.remarks, 120)}` : ""}`).join("\n")}`);
        }
      }

      if (!recordReference && !asksIncidentInvestigation && !asksTargetedTasks && !asksOperationsAnalytics && (asksTask || (asksReport && !asks(/\b(technical|support|incident|ticket)\b/)))) {
        const taskWhere = {
          ...(asksOpen ? { status: "OPEN" as const } : {}),
          ...(terms.length ? textWhere(["refNo", "activityType", "description", "remarks", "assigned", "accountable", "location", "shift", "showGroup"]) : {}),
        } as any;
        const [total, byStatus, records] = await Promise.all([
          prisma.task.count({ where: taskWhere }),
          asksReport || asksOpen ? prisma.task.groupBy({ by: ["status"], where: taskWhere, _count: { _all: true } }) : Promise.resolve([]),
          searchRecordsEnabled && !asksReport && (terms.length > 0 || asksOpen || asks(/\b(latest|recent|last)\b/))
            ? prisma.task.findMany({
                where: taskWhere,
                select: { refNo: true, startDate: true, shift: true, location: true, showGroup: true, activityType: true, description: true, priority: true, status: true, assigned: true, accountable: true, remarks: true },
                orderBy: { createdAt: "desc" },
                take: 5,
              })
            : Promise.resolve([]),
        ]);
          addSourceReference("Tasks", records.map((record) => record.refNo));
        contextSections.push(`OTHER TASKS\nTotal records: ${total}${byStatus.length ? `; status counts: ${byStatus.map((entry) => `${entry.status} ${entry._count._all}`).join(", ")}` : ""}.`);
        if (records.length) {
          contextSections.push(`MATCHING OTHER TASKS (maximum 5)\n${records.map((record) => `Ref ${record.refNo}; ${formatDate(record.startDate)}; ${record.shift}; ${record.location}; ${record.showGroup ?? "No group"}; activity ${record.activityType}; ${record.priority}; ${record.status}; assigned ${record.assigned}; accountable ${record.accountable}; description: ${shorten(record.description, asksDetailedRecords ? 320 : 140)}${asksDetailedRecords ? `; remarks: ${shorten(record.remarks, 120)}` : ""}`).join("\n")}`);
        }
      }

      if (!recordReference && !asksOperationsAnalytics && asksReport && !asksUsers && !asksAdmin) {
        const [assistanceTotal, taskTotal, assistanceByStatus, tasksByStatus] = await Promise.all([
          prisma.assistance.count(),
          prisma.task.count(),
          prisma.assistance.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
        ]);
        addSourceReference("Technical Assistance");
        addSourceReference("Tasks");
        contextSections.push(`REPORT SUMMARY\nTechnical assistance: ${assistanceTotal} total (${assistanceByStatus.map((entry) => `${entry.status} ${entry._count._all}`).join(", ")}). Other tasks: ${taskTotal} total (${tasksByStatus.map((entry) => `${entry.status} ${entry._count._all}`).join(", ")}).`);
      }

      if (!recordReference && asksWorkActivity) {
        const now = new Date();
        let periodStart: Date | undefined;
        let periodEnd: Date | undefined;
        let periodLabel = "All available history";
        if (asks(/\byesterday\b/)) {
          periodStart = new Date(now);
          periodStart.setDate(periodStart.getDate() - 1);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 1);
          periodLabel = `Yesterday (${formatDate(periodStart)})`;
        } else if (asksWeeklySummary || asks(/\bthis week\b/)) {
          periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodEnd.getDate() + 7);
          periodLabel = `This week (${formatDate(periodStart)} to ${formatDate(new Date(periodEnd.getTime() - 1))})`;
        }

        const session = await getServerSession(authOptions);
        const currentUserId = session?.user?.id;
        const currentUser = currentUserId
          ? await prisma.user.findUnique({ where: { id: currentUserId }, select: { id: true, firstName: true, surname: true } })
          : null;
        const asksMyActivity = asks(/\bmy\b/);
        const nameCandidate = q.match(/\b(?:was|of|by|for|handled)\s+([a-z][a-z'-]+)\b/)?.[1];
        const namedPerson = nameCandidate && !["my", "our", "the", "user", "users", "staff"].includes(nameCandidate)
          ? nameCandidate
          : (question.match(/\b[A-Z][a-z]+\b/g) ?? [])
          .filter((name: string) => !["What", "Who", "Show", "Yesterday", "This", "My"].includes(name))
          .at(-1) ?? null;
        const currentUserName = currentUser
          ? `${currentUser.firstName} ${currentUser.surname}`
          : session?.user?.name ?? session?.user?.username ?? null;
        const focusName = asksMyActivity
          ? currentUserName
          : namedPerson;
        const periodWhere = periodStart && periodEnd
          ? { startDate: { gte: periodStart, lt: periodEnd } }
          : undefined;
        const logWhere = periodStart && periodEnd
          ? { createdAt: { gte: periodStart, lt: periodEnd } }
          : undefined;
        const [assistanceRecords, taskRecords, auditLogs] = await Promise.all([
          prisma.assistance.findMany({ where: periodWhere, orderBy: { createdAt: "desc" }, take: 1000 }),
          prisma.task.findMany({ where: periodWhere, orderBy: { createdAt: "desc" }, take: 1000 }),
          prisma.auditLog.findMany({ where: logWhere, orderBy: { createdAt: "desc" }, take: 1000 }),
        ]);
        const records = [
          ...assistanceRecords.map((record) => ({ ...record, recordType: "Technical Assistance", categoryName: record.category, activityName: record.category })),
          ...taskRecords.map((record) => ({ ...record, recordType: "Other Tasks", categoryName: record.activityType, activityName: record.activityType })),
        ] as Array<Record<string, unknown>>;
        const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();
        const matchesName = (value: unknown) => {
          const name = normalized(focusName);
          const actual = normalized(value);
          return !!name && !!actual && (actual.includes(name) || name.split(/\s+/).every((part) => actual.includes(part)));
        };
        const isRequestForPerson = (record: Record<string, unknown>) =>
          [record.clientName, record.requester, record.requestedBy, record.reportedBy, record.createdBy]
            .some(matchesName);
        const isAssignedToPerson = (record: Record<string, unknown>) =>
          matchesName(record.assigned) || matchesName(record.accountable);
        const isHandledRequestQuery = asks(/\bwho handled\b/);
        const focusedRecords = focusName
          ? records.filter((record) => isHandledRequestQuery ? isRequestForPerson(record) : isAssignedToPerson(record))
          : asksMyActivity ? [] : records;
        const relevantRecordIds = new Set(focusedRecords.flatMap((record) => [record.id, record.refNo].filter(Boolean).map(String)));
        const userIds = [...new Set(auditLogs.flatMap((log) => log.userId ? [log.userId] : []))];
        const auditUsers = userIds.length
          ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, surname: true } })
          : [];
        const auditUserNames = new Map(auditUsers.map((user) => [user.id, `${user.firstName} ${user.surname}`]));
        const relevantAuditLogs = auditLogs.filter((log) => {
          const actorMatches = focusName && !isHandledRequestQuery
            ? (currentUser?.id ? log.userId === currentUser.id : matchesName(log.userId == null ? "" : auditUserNames.get(log.userId)))
            : false;
          const recordMatches = relevantRecordIds.has(String(log.entityId ?? ""));
          return actorMatches || recordMatches || (!focusName && !asksMyActivity && !isHandledRequestQuery);
        });
        const countBy = (items: Array<[string, number]>) => {
          const counts = new Map<string, number>();
          for (const [label, amount] of items) {
            if (label && label !== "N/A") counts.set(label, (counts.get(label) ?? 0) + amount);
          }
          return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
        };
        const categoryCounts = countBy(focusedRecords.map((record) => [String(record.categoryName ?? "N/A"), 1]));
        const activityCounts = countBy(focusedRecords.map((record) => [String(record.activityName ?? "N/A"), 1]));
        const assignedCounts = countBy(focusedRecords.map((record) => [String(record.assigned ?? record.accountable ?? "N/A"), 1]));
        const completedRecords = focusedRecords.filter((record) => normalized(record.status) === "closed");
        const durationByUser = new Map<string, number>();
        const durationByActivity = new Map<string, number>();
        let totalDurationMinutes = 0;
        const readDurationMinutes = (record: Record<string, unknown>) => {
          let total = 0;
          for (const [field, value] of Object.entries(record)) {
            if (!/(duration|time.?spent|spent.?time)/i.test(field) || !/(minute|min|hour|hr|second|sec)/i.test(field)) continue;
            const amount = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
            if (!Number.isFinite(amount)) continue;
            const key = field.toLowerCase();
            total += /hour|hr/.test(key) ? amount * 60 : /second|sec/.test(key) ? amount / 60 : amount;
          }
          return total;
        };
        for (const record of focusedRecords) {
          const minutes = readDurationMinutes(record);
          totalDurationMinutes += minutes;
          const assignee = String(record.assigned ?? record.accountable ?? "").trim();
          const activity = String(record.activityName ?? "").trim();
          if (assignee) durationByUser.set(assignee, (durationByUser.get(assignee) ?? 0) + minutes);
          if (activity) durationByActivity.set(activity, (durationByActivity.get(activity) ?? 0) + minutes);
        }
        const topDurations = (values: Map<string, number>) => [...values.entries()]
          .filter(([, minutes]) => minutes > 0)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }));
        addSourceReference("Technical Assistance", focusedRecords.filter((record) => record.recordType === "Technical Assistance").map((record) => String(record.refNo ?? "")));
        addSourceReference("Other Tasks", focusedRecords.filter((record) => record.recordType === "Other Tasks").map((record) => String(record.refNo ?? "")));
        addSourceReference("Audit Logs", relevantAuditLogs.slice(0, 5).map((log) => `${log.action} ${log.entityType}${log.entityId ? ` ${log.entityId}` : ""}`));
        if (asksActivityTimeline) {
          const timelineEvents = [
            ...focusedRecords.map((record) => ({
              timestamp: record.date ?? record.createdAt,
              source: record.recordType,
              summary: `${record.recordType === "Technical Assistance" ? "Technical assistance" : "Task"} ${record.refNo ?? ""}: ${String(record.activityName ?? "Work item")}${record.status ? ` (${record.status})` : ""}${record.problem || record.description ? ` - ${shorten(String(record.problem ?? record.description), 120)}` : ""}`,
            })),
            ...relevantAuditLogs.map((log) => ({
              timestamp: log.createdAt,
              source: "Audit Logs",
              summary: `${log.action} ${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}`,
            })),
          ]
            .filter((event) => event.timestamp && Number.isFinite(new Date(event.timestamp as string | Date).getTime()))
            .sort((a, b) => new Date(a.timestamp as string | Date).getTime() - new Date(b.timestamp as string | Date).getTime())
            .slice(-30);
          const groupedTimeline = new Map<string, typeof timelineEvents>();
          for (const event of timelineEvents) {
            const dateLabel = new Intl.DateTimeFormat("en-PH", { dateStyle: "full" }).format(new Date(event.timestamp as string | Date));
            const eventsForDate = groupedTimeline.get(dateLabel) ?? [];
            eventsForDate.push(event);
            groupedTimeline.set(dateLabel, eventsForDate);
          }
          contextSections.push(`ACTIVITY TIMELINE\n${JSON.stringify({
            period: periodLabel,
            focus: focusName ?? "All users",
            eventsShown: timelineEvents.length,
            groups: [...groupedTimeline.entries()].map(([date, events]) => ({
              date,
              events: events.map((event) => ({ time: formatDate(event.timestamp as string | Date), source: event.source, summary: event.summary })),
            })),
            note: timelineEvents.length === 30 ? "Showing the 30 most recent matching events, in chronological order." : undefined,
          }, null, 2)}`);
        } else {
          contextSections.push(`WORKLOAD AND ACTIVITY ANALYSIS\n${JSON.stringify({
          period: periodLabel,
          focus: focusName ?? "All users",
          dataScope: { technicalAssistance: assistanceRecords.length, otherTasks: taskRecords.length, auditLogs: auditLogs.length, recordLimit: 1000 },
          finding: asksMyActivity && !focusName
            ? "The current user could not be identified from the session, so personal activity cannot be filtered."
            : `${focusedRecords.length} assigned/requested records and ${relevantAuditLogs.length} related audit activities; ${completedRecords.length} records completed.`,
          observation: totalDurationMinutes
            ? `Recorded duration totals ${Math.round(totalDurationMinutes)} minutes.`
            : "The available records contain no explicit duration values; elapsed time spent cannot be verified.",
          workloadSummary: {
            categories: categoryCounts,
            activities: activityCounts,
            assignedRecords: assignedCounts,
            completedRecords: countBy(completedRecords.map((record) => [String(record.assigned ?? record.accountable ?? "Unassigned"), 1])),
            completedCount: completedRecords.length,
            auditActivityByUser: countBy(relevantAuditLogs.map((log) => [log.userId == null ? "System/unknown" : auditUserNames.get(log.userId) ?? "System/unknown", 1])),
            durationByActivity: topDurations(durationByActivity),
            durationByUser: topDurations(durationByUser),
          },
          recommendation: totalDurationMinutes
            ? "Review the highest-duration activity or assignee for capacity planning."
            : "Track duration on work records to compare time consumed rather than using record counts as a proxy.",
          mostRelevantRecords: focusedRecords.slice(0, 8).map((record) => ({ type: record.recordType, refNo: record.refNo, date: record.date, category: record.categoryName, activity: record.activityName, status: record.status, assigned: record.assigned, accountable: record.accountable })),
        }, null, 2)}`);
        }
      }

      if (!recordReference && !asksIncidentInvestigation && asksOperationsAnalytics && !asksWorkActivity) {
        const periodUnit = asksTodaySummary ? "day" : asksMonthlySummary ? "month" : "week";
        const now = new Date();
        const currentStart = periodUnit === "month"
          ? new Date(now.getFullYear(), now.getMonth(), 1)
          : periodUnit === "week"
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
            : new Date(now.getFullYear(), now.getMonth(), now.getDate());
        currentStart.setHours(0, 0, 0, 0);
        const periodWasRequested = asksTodaySummary || asksWeeklySummary || asksMonthlySummary;
        const usePreviousPeriod = periodWasRequested && asks(/\b(last|previous|past)\b/);
        const periodStart = new Date(currentStart);
        if (usePreviousPeriod) {
          if (periodUnit === "month") periodStart.setMonth(periodStart.getMonth() - 1);
          else periodStart.setDate(periodStart.getDate() - (periodUnit === "week" ? 7 : 1));
        }
        const periodEnd = new Date(periodStart);
        if (periodUnit === "month") periodEnd.setMonth(periodEnd.getMonth() + 1);
        else periodEnd.setDate(periodEnd.getDate() + (periodUnit === "week" ? 7 : 1));
        const comparisonStart = new Date(periodStart);
        if (periodUnit === "month") comparisonStart.setMonth(comparisonStart.getMonth() - 1);
        else comparisonStart.setDate(comparisonStart.getDate() - (periodUnit === "week" ? 7 : 1));
        const periodWhere = { startDate: { gte: periodStart, lt: periodEnd } };
        const comparisonWhere = { startDate: { gte: comparisonStart, lt: periodStart } };
        const usePeriodFilter = periodWasRequested || asksExecutiveSummary || asksTrend || asksTopUsers || asksWorkload || (asksTopCategories && !asksTopIssues);
        const aggregateWhere = usePeriodFilter ? periodWhere : undefined;
        const assignmentWhere = asksWorkload && !periodWasRequested && !asksExecutiveSummary && !asksTrend
          ? { status: { not: "CLOSED" as const } }
          : aggregateWhere;
        const [
          assistanceTotal,
          taskTotal,
          assistanceByStatus,
          tasksByStatus,
          categories,
          taskTypes,
          recurringIssues,
          assistanceAssignments,
          taskAssignments,
          previousAssistanceTotal,
          previousTaskTotal,
        ] = await Promise.all([
          prisma.assistance.count({ where: aggregateWhere }),
          prisma.task.count({ where: aggregateWhere }),
          prisma.assistance.groupBy({ by: ["status"], where: aggregateWhere, _count: { _all: true } }),
          prisma.task.groupBy({ by: ["status"], where: aggregateWhere, _count: { _all: true } }),
          prisma.assistance.groupBy({ by: ["category"], where: aggregateWhere, _count: { _all: true } }),
          prisma.task.groupBy({ by: ["activityType"], where: aggregateWhere, _count: { _all: true } }),
          prisma.assistance.groupBy({ by: ["problem"], where: { ...aggregateWhere, problem: { not: "" } }, _count: { _all: true }, orderBy: { _count: { problem: "desc" } }, take: 5 }),
          prisma.assistance.groupBy({ by: ["assigned"], where: assignmentWhere, _count: { _all: true } }),
          prisma.task.groupBy({ by: ["assigned"], where: assignmentWhere, _count: { _all: true } }),
          prisma.assistance.count({ where: comparisonWhere }),
          prisma.task.count({ where: comparisonWhere }),
        ]);
        addSourceReference("Technical Assistance");
        addSourceReference("Tasks");
        const workloadByUser = new Map<string, number>();
        for (const assignment of [...assistanceAssignments, ...taskAssignments]) {
          const user = assignment.assigned?.trim();
          if (user) workloadByUser.set(user, (workloadByUser.get(user) ?? 0) + assignment._count._all);
        }
        const topUsers = [...workloadByUser.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
        const topCategories = categories.sort((a, b) => b._count._all - a._count._all).slice(0, 5);
        const topTaskTypes = taskTypes.sort((a, b) => b._count._all - a._count._all).slice(0, 5);
        const currentTotal = assistanceTotal + taskTotal;
        const previousTotal = previousAssistanceTotal + previousTaskTotal;
        const delta = currentTotal - previousTotal;
        const deltaPercent = previousTotal ? `${Math.round((delta / previousTotal) * 100)}%` : currentTotal ? "new activity" : "0%";
        const periodName = periodUnit === "day" ? "day" : periodUnit;
        const periodLabel = usePeriodFilter
          ? `${usePreviousPeriod ? "Previous" : "Current"} ${periodName} (${formatDate(periodStart)} to ${formatDate(new Date(periodEnd.getTime() - 1))})`
          : "All time";
        const lines = [
          `Period: ${periodLabel}. Technical assistance: ${assistanceTotal}; other tasks: ${taskTotal}; total: ${currentTotal}.`,
        ];
        if (asksExecutiveSummary || asksReport) {
          lines.push(`Status: assistance ${assistanceByStatus.map((entry) => `${entry.status} ${entry._count._all}`).join(", ") || "none"}; tasks ${tasksByStatus.map((entry) => `${entry.status} ${entry._count._all}`).join(", ") || "none"}.`);
        }
        if (asksTopCategories || asksExecutiveSummary || asksReport) {
          lines.push(`Top assistance categories: ${topCategories.map((entry) => `${entry.category} (${entry._count._all})`).join(", ") || "none"}; task types: ${topTaskTypes.map((entry) => `${entry.activityType} (${entry._count._all})`).join(", ") || "none"}.`);
        }
        if (asksTopUsers || asksWorkload || asksExecutiveSummary || asksReport) {
          const workloadLabel = asksWorkload && !periodWasRequested && !asksExecutiveSummary ? "Open workload by assignee" : "Top assigned users";
          lines.push(`${workloadLabel}: ${topUsers.map(([user, count]) => `${user} (${count})`).join(", ") || "none"}.`);
        }
        if (asksTopIssues || asksExecutiveSummary || asksReport) {
          lines.push(`Recurring assistance issues: ${recurringIssues.map((entry) => `“${shorten(entry.problem, 100)}” (${entry._count._all})`).join(", ") || "none"}.`);
        }
        if (asksTrend || asksExecutiveSummary || asksReport) {
          lines.push(`Trend versus previous ${periodName}: ${currentTotal} versus ${previousTotal} total records; change ${delta >= 0 ? "+" : ""}${delta} (${deltaPercent}).`);
        }
        contextSections.push(`${asksExecutiveSummary ? "EXECUTIVE OPERATIONAL SUMMARY" : "OPERATIONAL ANALYTICS"}\n${lines.join("\n")}`);
      }

      if (!recordReference && !asksIncidentInvestigation && asksTargetedTasks) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (asksMostCompletedTasks) {
          const [count, activityTypes] = await Promise.all([
            prisma.task.count({ where: { status: "CLOSED" } }),
            prisma.task.groupBy({ by: ["activityType"], where: { status: "CLOSED" }, _count: { _all: true }, orderBy: { _count: { activityType: "desc" } }, take: 10 }),
          ]);
          addSourceReference("Tasks");
          contextSections.push(`TARGETED TASK RETRIEVAL\n${JSON.stringify({ type: "most completed task types", totalCompleted: count, activityTypes: activityTypes.map((entry) => ({ activityType: entry.activityType, completedCount: entry._count._all })) }, null, 2)}`);
        } else if (asksTopPerformers || asksTaskPerformance) {
          const performers = await prisma.task.groupBy({ by: ["assigned"], where: { status: "CLOSED", assigned: { not: "" }, ...requestedPeriodWhere() }, _count: { assigned: true }, orderBy: { _count: { assigned: "desc" } }, take: 10 });
          addSourceReference("Tasks");
          contextSections.push(`TARGETED TASK RETRIEVAL\n${JSON.stringify({ type: "top performers by completed task count", performers: performers.filter((entry) => entry.assigned?.trim()).map((entry, index) => ({ rank: index + 1, name: entry.assigned, completedTasks: entry._count.assigned })) }, null, 2)}`);
        } else {
          const overdue = asksOverdueTasks;
          const where = overdue
            ? { status: { not: "CLOSED" as const }, startDate: { lt: today } }
            : { status: "OPEN" as const };
          const [count, tasks] = await Promise.all([
            prisma.task.count({ where }),
            prisma.task.findMany({ where, select: { refNo: true, startDate: true, activityType: true, description: true, status: true, assigned: true, accountable: true }, orderBy: { startDate: overdue ? "asc" : "desc" }, take: 5 }),
          ]);
          addSourceReference("Tasks", tasks.map((task) => task.refNo));
          contextSections.push(`TARGETED TASK RETRIEVAL\n${JSON.stringify({ type: overdue ? "overdue tasks (scheduled date before today and not closed)" : "open tasks", count, tasks: tasks.map((task) => ({ refNo: task.refNo, date: task.startDate, activityType: task.activityType, status: task.status, assigned: task.assigned, accountable: task.accountable, description: shorten(task.description, asksDetailedRecords ? 500 : 140) })) }, null, 2)}`);
        }
      }

      if (!recordReference && !asksIncidentInvestigation && asksTargetedAssistance && !asksOperationsAnalytics) {
        if (asksAssistancePerformance) {
          const performers = await prisma.assistance.groupBy({ by: ["assigned"], where: { status: "CLOSED", assigned: { not: "" }, ...requestedPeriodWhere() }, _count: { assigned: true }, orderBy: { _count: { assigned: "desc" } }, take: 10 });
          addSourceReference("Technical Assistance");
          contextSections.push(`TARGETED ASSISTANCE RETRIEVAL\n${JSON.stringify({ type: "top performers by completed technical assistance count", performers: performers.filter((entry) => entry.assigned?.trim()).map((entry, index) => ({ rank: index + 1, name: entry.assigned, completedRequests: entry._count.assigned })) }, null, 2)}`);
        } else if (asksTopIssues) {
          const categories = await prisma.assistance.groupBy({ by: ["category"], _count: { _all: true }, orderBy: { _count: { category: "desc" } }, take: 10 });
          addSourceReference("Technical Assistance");
          contextSections.push(`TARGETED ASSISTANCE RETRIEVAL\n${JSON.stringify({ type: "most reported issue categories", issues: categories.map((entry) => ({ category: entry.category, count: entry._count._all })) }, null, 2)}`);
        } else {
          const where = asksAdobeIncidents
            ? { OR: [
                { category: { contains: "Adobe", mode: "insensitive" as const } },
                { problem: { contains: "Adobe", mode: "insensitive" as const } },
                { clientName: { contains: "Adobe", mode: "insensitive" as const } },
              ] }
            : { status: "OPEN" as const };
          const [count, incidents] = await Promise.all([
            prisma.assistance.count({ where }),
            prisma.assistance.findMany({ where, select: { refNo: true, startDate: true, category: true, problem: true, resolution: true, status: true, assigned: true, location: true }, orderBy: { createdAt: "desc" }, take: 5 }),
          ]);
          addSourceReference("Technical Assistance", incidents.map((incident) => incident.refNo));
          contextSections.push(`TARGETED ASSISTANCE RETRIEVAL\n${JSON.stringify({ type: asksAdobeIncidents ? "Adobe incidents" : "open incidents", count, incidents: incidents.map((incident) => ({ refNo: incident.refNo, date: incident.startDate, category: incident.category, status: incident.status, assigned: incident.assigned, location: incident.location, problem: shorten(incident.problem, asksDetailedRecords ? 500 : 140), ...(asksDetailedRecords ? { resolution: shorten(incident.resolution, 300) } : {}) })) }, null, 2)}`);
        }
      }

      if (!recordReference && asksTargetedAudit) {
        const auditFilters: Record<string, unknown>[] = [];
        if (asksSettingsChanges) {
          auditFilters.push({ OR: [
              { entityType: { contains: "setting", mode: "insensitive" as const } },
              { entityType: { contains: "config", mode: "insensitive" as const } },
              { entityType: { contains: "branding", mode: "insensitive" as const } },
              { entityType: { contains: "system", mode: "insensitive" as const } },
              { entityType: { contains: "ai", mode: "insensitive" as const } },
              { action: { contains: "setting", mode: "insensitive" as const } },
              { action: { contains: "config", mode: "insensitive" as const } },
            ] });
        }
        if (asksRecordDeletions) {
          auditFilters.push({ action: { contains: "delet", mode: "insensitive" as const } });
        }
        if (asksYesterdayAudit) {
          const start = new Date();
          start.setDate(start.getDate() - 1);
          start.setHours(0, 0, 0, 0);
          const end = new Date(start);
          end.setDate(end.getDate() + 1);
          auditFilters.push({ createdAt: { gte: start, lt: end } });
        }
        const where = auditFilters.length ? { AND: auditFilters } : undefined;
        const [auditCount, auditLogs] = await Promise.all([
          prisma.auditLog.count({ where }),
          prisma.auditLog.findMany({
            where,
            select: { action: true, entityType: true, entityId: true, userId: true, details: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ]);
        addSourceReference("Audit Logs", auditLogs.slice(0, 5).map((log) => `${log.action} ${log.entityType}${log.entityId ? ` ${log.entityId}` : ""}`));
        const userIds = [...new Set(auditLogs.flatMap((log) => log.userId ? [log.userId] : []))];
        const users = userIds.length
          ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, surname: true } })
          : [];
        const usersById = new Map(users.map((user) => [user.id, `${user.firstName} ${user.surname}`]));
        contextSections.push(`TARGETED AUDIT RETRIEVAL\n${JSON.stringify({ type: asksSettingsChanges ? "settings changes" : asksRecordDeletions ? "record deletions" : asksYesterdayAudit ? "changes from yesterday" : asksRecentAdminActions ? "recent administrative actions" : "recent user activity", count: auditCount, logs: auditLogs.map((log) => ({ user: log.userId ? usersById.get(log.userId) ?? `ID ${log.userId}` : "System/unknown", action: log.action, target: `${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}`, timestamp: log.createdAt, ...(asksDetailedRecords ? { details: log.details } : {}) })) }, null, 2)}`);
      }

      if (!recordReference && asksAudit && !asksTargetedAudit) {
        const where = terms.length ? textWhere(["action", "entityType", "entityId"]) as any : undefined;
        const [auditCount, auditLogs] = await Promise.all([
          prisma.auditLog.count({ where }),
          prisma.auditLog.findMany({
            where,
            select: { action: true, entityType: true, entityId: true, userId: true, details: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
        ]);
        addSourceReference(
          "Audit Logs",
          auditLogs.slice(0, 5).map((log) => `${log.action} ${log.entityType}${log.entityId ? ` ${log.entityId}` : ""}`)
        );
        const userIds = [...new Set(auditLogs.flatMap((log) => log.userId ? [log.userId] : []))];
        const users = userIds.length
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, firstName: true, surname: true },
            })
          : [];
        const usersById = new Map(users.map((user) => [user.id, `${user.firstName} ${user.surname}`]));
        contextSections.push(`AUDIT LOGS\nTotal matching records: ${auditCount}; showing at most 5.\n${auditLogs.map((log) => `- User: ${log.userId ? usersById.get(log.userId) ?? `ID ${log.userId}` : "System/unknown"}; Action: ${log.action}; Target: ${log.entityType}${log.entityId ? ` (${log.entityId})` : ""}; Timestamp: ${formatDate(log.createdAt)}${asksDetailedRecords ? `; Changes: ${log.details == null ? "No change details recorded" : JSON.stringify(log.details)}` : ""}`).join("\n") || "No matching audit logs found."}`);
      }

      if (!recordReference && !asksIncidentInvestigation && (asksMasterData || asksAdmin)) {
        const kinds: ("LOCATION" | "SHIFT" | "SHOW_GROUP" | "CATEGORY" | "ACTIVITY_TYPE")[] = asksAdmin
          ? ["LOCATION", "SHIFT", "SHOW_GROUP", "CATEGORY", "ACTIVITY_TYPE"]
          : [
              ...(asks(/\b(location|locations)\b/) ? ["LOCATION" as const] : []),
              ...(asks(/\b(shift|shifts)\b/) ? ["SHIFT" as const] : []),
              ...(asks(/\b(shows|groups)\b/) ? ["SHOW_GROUP" as const] : []),
              ...(asks(/\b(category|categories)\b/) ? ["CATEGORY" as const] : []),
              ...(asks(/\b(activity type|activity types)\b/) ? ["ACTIVITY_TYPE" as const] : []),
            ];
        const [masterData, branding, counters] = await Promise.all([
          prisma.masterData.findMany({ where: { kind: { in: kinds }, active: true }, select: { kind: true, value: true }, orderBy: [{ kind: "asc" }, { sort: "asc" }], take: 50 }),
          asksAdmin ? prisma.branding.findUnique({ where: { id: 1 }, select: { title: true, tagline: true } }) : Promise.resolve(null),
          asksAdmin ? prisma.counter.findMany({ select: { key: true, value: true }, take: 20, orderBy: { key: "asc" } }) : Promise.resolve([]),
        ]);
        contextSections.push(`CONFIGURATION AND MASTER DATA (active values, maximum 50)\n${masterData.map((item) => `${item.kind}: ${item.value}`).join("\n") || "No active values found."}${branding ? `\nBranding: ${branding.title}; ${branding.tagline}` : ""}${counters.length ? `\nRecord counters: ${counters.map((counter) => `${counter.key} ${counter.value}`).join(", ")}` : ""}`);
      }

      if (!contextSections.length && searchRecordsEnabled && terms.length) {
        const [assistanceRecords, taskRecords] = await Promise.all([
          prisma.assistance.findMany({
            where: textWhere(["refNo", "problem", "resolution", "remarks", "category", "assigned", "accountable", "location", "shift", "showGroup"]) as any,
            select: { refNo: true, problem: true, resolution: true, status: true, category: true, location: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          }),
          prisma.task.findMany({
            where: textWhere(["refNo", "activityType", "description", "remarks", "assigned", "accountable", "location", "shift", "showGroup"]) as any,
            select: { refNo: true, activityType: true, description: true, status: true, location: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          }),
        ]);
        addSourceReference("Technical Assistance", assistanceRecords.map((record) => record.refNo));
        addSourceReference("Tasks", taskRecords.map((record) => record.refNo));
        if (assistanceRecords.length) {
          contextSections.push(`MATCHING TECHNICAL ASSISTANCE (maximum 3)\n${assistanceRecords.map((record) => `Ref ${record.refNo}; ${record.location}; ${record.category}; ${record.status}; ${shorten(record.problem, asksDetailedRecords ? 320 : 140)}${asksDetailedRecords ? `; resolution: ${shorten(record.resolution, 180)}` : ""}`).join("\n")}`);
        }
        if (taskRecords.length) {
          contextSections.push(`MATCHING OTHER TASKS (maximum 3)\n${taskRecords.map((record) => `Ref ${record.refNo}; ${record.location}; ${record.activityType}; ${record.status}; ${shorten(record.description, asksDetailedRecords ? 320 : 140)}`).join("\n")}`);
        }
      }

      if (!contextSections.length && asksOpen) {
        const [openTasks, openAssistance] = await Promise.all([
          prisma.task.count({ where: { status: "OPEN" } }),
          prisma.assistance.count({ where: { status: "OPEN" } }),
        ]);
        addSourceReference("Tasks");
        addSourceReference("Technical Assistance");
        contextSections.push(`OPEN RECORD COUNTS\nOther tasks: ${openTasks}; technical assistance: ${openAssistance}.`);
      }

      console.timeEnd("Database");
      liveContext = contextSections.join("\n\n");
    }

    // ADD THESE
    console.log("Ollama URL:", settings.url);
    console.log("Model:", settings.maco.model);

    const ollamaUrl =
      `${settings.url}/api/generate`;

    console.log(
      "Calling URL:",
      ollamaUrl
    );

    let prompt = "";

    if (simpleQuestion) {
      prompt = `
    You are MACO, the MAMS Operations Copilot.

    Respond conversationally, directly, and briefly. Keep the tone operational and actionable.
    Do not use headings or report-style formatting for greetings, thanks, or simple questions.

    If asked who you are, identify yourself as MACO, the MAMS Operations Copilot for OpsTracker.

    User Question:
    ${question}
    `;
    } else {
      prompt = `
    You are MACO, the MAMS Operations Copilot. You assist MAMS employees with:
    - Technical support
    - Broadcast operations
    - Engineering concerns
    - Workflow troubleshooting
    - General knowledge questions

    Rules:
    - Be conversational, direct, operational, and actionable. Start with a concise answer.
    - Response type: ${responseType}. Match the answer to this type and put the summary before supporting detail.
    - For Analytics, Lists, and Executive Summary responses, use these sections in this order: Finding, Observation, Recommendation, except workload and activity analysis which uses its required four-section format. Keep each section concise and grounded in supplied live data.
    - For workload and activity analysis, use exactly these sections in this order: Finding, Observation, Workload Summary, Recommendation. Keep the answer concise and base duration claims only on explicitly recorded duration data; if duration is absent, say so and do not present record counts as time spent.
    - For Timeline responses, present concise activity events grouped under date headings in chronological order. Combine Technical Assistance, Tasks, and Audit Logs when supplied; do not convert the timeline into aggregate counts.
    - In Finding, state the key result and compare with the previous period when comparable previous-period data is supplied. Include the size and direction of the change when available; do not imply a comparison when it is unavailable.
    - In Observation, explain the operational significance of the data and identify unusual patterns, risks, or anomalies when the supplied data supports them. Do not label normal variation as an anomaly.
    - In Recommendation, give practical next steps that follow from the evidence. If the data does not support a specific action, say that no specific action is indicated.
    - For Lookup responses, answer the requested question directly and include only the relevant evidence. Do not provide a full record unless explicitly requested.
    - For Lists responses, include only the requested concise names or record identifiers/details, with no more than 5 entries unless the user explicitly requests more. Mention when additional matching records are not shown. Do not dump raw records or reproduce full descriptions, notes, or change payloads unless explicitly requested.
    - For operational root-cause questions, use exactly these sections in this order: Finding, Observation, Possible Cause, Recommendation. Base every statement only on supplied OpsTracker data. Treat repeated categories, shows/groups, clients, and keywords as observed correlations, not proven causes. In Possible Cause, state a cause only when the records directly support it; otherwise say the available records do not establish a cause. Include recurrence counts and record references when supplied, and state the reviewed-record scope when relevant.
    - For Analytics and Executive Summary responses, synthesize aggregate findings rather than listing underlying records. Include only metrics relevant to the question.
    - Do not generate a formal report unless the user explicitly requests one.
    - Keep simple questions and answers simple; do not force headings, summaries, or report formatting.
    - Use concise bullets only when they make findings or actions easier to scan.
    - Provide accurate answers. Do not make up information. If you are unsure, say so.
    - If asked who you are, respond that you are MACO, the MAMS Operations Copilot for OpsTracker.
    - Never identify yourself as ChatGPT, OpenAI, Qwen, Ollama, or any other assistant.
    - Use the supplied live data when it is relevant to the question.
    - Never claim access to data that is not supplied or make up statistics.

    Response Style:
    - Use natural language and only as much structure as the question needs.
    - Avoid excessive headings and repeated labels such as "Summary", "Detailed Breakdown", and "Next Steps".
    - Use tables only when explicitly requested or when they clearly improve comparison.

    Live System Data Rules:
    - Use only the live data relevant to the question; do not infer missing values.

    When a user asks for a specific task or assistance record:
    - State the result directly, then give the relevant findings and evidence from the supplied record.
    - Include all available fields only when the user asks for the full record or a report.
    - If no matching record is found, say so clearly and recommend verifying the reference or checking Audit Logs; do not speculate about the cause.

    Do not claim that you do not have access
    to system data if statistics are provided.

    Live System Data:

    ${liveContext}

    Conversation History:

    ${history
      .map((m: any) => `${String(m.role ?? "user")}: ${String(m.content ?? "").slice(0, 1200)}`)
      .join("\n")}

    User Question:
    ${question}
    `;
    }

    console.log(
      "Prompt Length:",
      prompt.length
    );

    console.log(
      "Prompt Preview:",
      prompt.substring(0, 500)
    );    

    console.time("Ollama");

    console.log(
      "Live Context Length:",
      liveContext.length
    );

    console.log(
      "Total Prompt Length:",
      (liveContext + question).length
    );    

    console.log("Question:", question);

    console.log(
      "History Length:",
      history.length
    );

    console.log(
      "History Content:",
      history.map(
        (m: any) => m.content
      )
    );

    console.log(
      "Live Context Length:",
      liveContext.length
    );

    const response = await fetch(
      ollamaUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          model: settings.maco.model,
          prompt,
          stream: false,
          options: {
            temperature:
              settings.maco.temperature ?? 0.2,
          },
        }),
      }
    );

    console.timeEnd("Ollama");
    console.timeEnd("MACO Total");

  // ADD THIS
  console.log("Status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();

      console.log(
        "Ollama Error Body:",
        errorBody
      );

      throw new Error(
        `Ollama error: ${response.status}`
      );
    }

    const data = await response.json();

    return NextResponse.json({
      answer: data.response,
      model: settings.maco.model,
      sources: [...sourceReferences].map(([source, references]): SourceReference => ({
        source,
        references: [...references].slice(0, 5),
      })),
    });
  } 
  catch (error: any) {
    console.error("MACO ERROR:", error);

    return NextResponse.json(
      {
        error: error?.message || "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}