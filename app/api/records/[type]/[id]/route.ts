import { logAudit, makeAuditChanges } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isRecordType } from "@/lib/recordTypes";
import { getRecord, normalizeTimes, delegateFor, hasUserParticipated } from "@/lib/records";
import { canEdit, canView, editBlockedReason, isAdmin } from "@/lib/permissions";
import { schemaFor, flatten } from "@/lib/validation";
import { prisma } from "@/lib/prisma";

/** Resolves the route params into a narrowed type plus the record itself. */
async function load(type: string, id: string) {
  if (!isRecordType(type)) return null;
  const n = Number(id);
  if (!Number.isInteger(n)) return null;
  const record = await getRecord(type, n);
  return record ? { type, record } : null;
}

function visibleRecord(type: string, record: Record<string, any>) {
  return type === "tasks"
    ? Object.fromEntries(Object.entries(record).filter(([key]) => key !== "location" && key !== "showGroup"))
    : record;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await load(p.type, p.id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { type, record } = found;
  const hasParticipated = user.role !== "ADMIN" && await hasUserParticipated(type, record.id, user.id);
  if (!canView(user, { ...record, hasParticipated }, req.nextUrl.searchParams.get("userId") === "all")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const activityHistory = await prisma.auditLog.findMany({
    where: { entityType: type, entityId: record.refNo },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, details: true, createdAt: true },
  });
  return NextResponse.json({
    ...visibleRecord(type, record),
    activityHistory,
    canEdit: canEdit(user, record),
    canEditOriginal: canEdit(user, record) && (isAdmin(user) || record.ownerId === user.id),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await load(p.type, p.id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { type, record } = found;

  const requestBody = await req.json();
  const body = type === "tasks"
    ? Object.fromEntries(Object.entries(requestBody).filter(([key]) => key !== "location" && key !== "showGroup"))
    : requestBody;
  if (!isAdmin(user)) body.accountable = user.name;

  if (typeof body.status === "string" && body.status !== record.status) {
    const allowedTransitions: Record<string, string[]> = {
      OPEN: ["CLOSE_PENDING"],
      CLOSE_PENDING: ["CLOSED", "OPEN"],
      CLOSED: ["OPEN"],
    };
    if (!allowedTransitions[record.status]?.includes(body.status)) {
      return NextResponse.json({ error: "That status transition is not allowed" }, { status: 400 });
    }
  }

  // Lock toggling is a separate, admin-only concern from editing content.
  if (typeof body.locked === "boolean" && Object.keys(body).length === 1) {
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Only administrators can lock records" }, { status: 403 });
    }

const updated = await delegateFor(type).update({
  where: { id: record.id },
  data: {
    locked: body.locked,
    lockedById: body.locked ? user.id : null,
  },
});

const changes = makeAuditChanges(record, updated, ["locked"]);
if (changes.length > 0) {
  await logAudit({
    action: body.locked ? "LOCK" : "UNLOCK",
    entityType: type,
    entityId: updated.refNo,
    userId: user.id,
    details: { name: user.name, changes },
  });
}

return NextResponse.json(visibleRecord(type, updated));


  }

  if (!canEdit(user, record)) {
    return NextResponse.json({ error: editBlockedReason(user, record) }, { status: 403 });
  }
  if (!Object.keys(body).length) return NextResponse.json(visibleRecord(type, record));

  const canEditOriginal = isAdmin(user) || record.ownerId === user.id;
  const editableFields = canEditOriginal
    ? new Set([
        "startDate", "endDate", "shift",
        ...(type === "assistance" ? ["location", "showGroup"] : []),
        "priority",
        "timeStarted", "timeEnded", "status", "assigned", "accountable", "remarks",
        ...(type === "assistance"
          ? ["clientName", "problem", "cause", "category", "resolution"]
          : ["activityType", "description"]),
      ])
    : new Set(["assigned", "status", "endDate", "timeEnded", "priority"]);
  const rejectedFields = Object.keys(body).filter((key) =>
    !editableFields.has(key) && !(key === "accountable" && !isAdmin(user))
  );
  if (rejectedFields.length) {
    return NextResponse.json(
      {
        error: canEditOriginal
          ? "The record owner cannot be changed"
          : "Only assignee, status, priority, end date, and end time can be changed after creation",
        fields: Object.fromEntries(rejectedFields.map((key) => [key, "This field cannot be changed by your role"])),
      },
      { status: 400 }
    );
  }

  // Partial updates still need the cross-field time rules, so merge with the
  // stored row before validating rather than checking the patch in isolation.
  const merged = normalizeTimes({
    ...record,
    ...body,
    startDate: (body.startDate ?? record.startDate.toISOString().slice(0, 10)).slice(0, 10),
    endDate: body.endDate === undefined
      ? record.endDate?.toISOString().slice(0, 10) ?? null
      : body.endDate,
  });
  const parsed = schemaFor(type).safeParse(merged);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }

const normalized = normalizeTimes(parsed.data) as any;
  if (normalized.status === "OPEN") {
    normalized.endDate = null;
    normalized.timeEnded = null;
  }
const data: Record<string, any> = {};
for (const field of editableFields) {
  if (!Object.hasOwn(body, field)) continue;
  if (field === "startDate") {
    data.startDate = new Date(normalized.startDate);
  } else if (field === "endDate") {
    data.endDate = normalized.endDate ? new Date(normalized.endDate) : null;
  } else {
    data[field] = normalized[field];
  }
}
if (!isAdmin(user)) data.accountable = user.name;
if (normalized.status === "OPEN") {
  data.endDate = null;
  data.timeEnded = null;
} else if (body.status === "CLOSE_PENDING" && record.status !== "CLOSE_PENDING") {
  data.endDate = normalized.endDate ? new Date(normalized.endDate) : null;
  data.timeEnded = normalized.timeEnded;
}

const updated = await delegateFor(type).update({
  where: { id: record.id },
  data,
});

const statusChanged = updated.status !== record.status;
const assignmentChanged = updated.assigned !== record.assigned;
const changes = makeAuditChanges(record, updated, [...editableFields]);
const statusChanges = changes.filter(({ field }) =>
  field === "status" || (statusChanged && (field === "endDate" || field === "timeEnded"))
);
const assignmentChanges = changes.filter(({ field }) => field === "assigned");
if (statusChanged) {
  await logAudit({
    action: "STATUS_CHANGE",
    entityType: type,
    entityId: updated.refNo,
    userId: user.id,
    details: { name: user.name, changes: statusChanges },
  });
}
if (assignmentChanged) {
  await logAudit({
    action: "ENDORSED",
    entityType: type,
    entityId: updated.refNo,
    userId: user.id,
    details: { name: user.name, changes: assignmentChanges },
  });
}
const updateChanges = changes.filter(({ field }) =>
  field !== "status" && field !== "assigned" &&
  !(statusChanged && (field === "endDate" || field === "timeEnded"))
);
if (updateChanges.length > 0) {
  await logAudit({
    action: "UPDATE",
    entityType: type,
    entityId: updated.refNo,
    userId: user.id,
    details: { name: user.name, changes: updateChanges },
  });
}

return NextResponse.json(visibleRecord(type, updated));

}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await load(p.type, p.id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { type, record } = found;
  if (!canEdit(user, record)) {
    return NextResponse.json({ error: editBlockedReason(user, record) }, { status: 403 });
  }

  const workLogCount = await prisma.workLog.count({
    where: type === "assistance" ? { assistanceId: record.id } : { taskId: record.id },
  });
  if (workLogCount > 0) {
    return NextResponse.json({ error: "Records with work log history cannot be deleted" }, { status: 409 });
  }

await delegateFor(type).delete({
  where: { id: record.id },
});

await logAudit({
  action: "DELETE",
  entityType: type,
  entityId: record.refNo,
  userId: user.id,
  details: {
    name: user.name,
    referenceNo: record.refNo,
    subject: type === "assistance" ? record.clientName : record.activityType,
    description: type === "assistance" ? record.problem : record.description,
    assignedTo: record.assigned,
    recordType: type === "assistance" ? "Technical Assistance" : "Other Tasks",
  },
});

return NextResponse.json({ ok: true });


}
