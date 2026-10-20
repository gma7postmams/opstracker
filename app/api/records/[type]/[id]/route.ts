import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isRecordType } from "@/lib/recordTypes";
import { getRecord, normalizeTimes, delegateFor } from "@/lib/records";
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await load(p.type, p.id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { type, record } = found;
  if (!canView(user, { ...record, ownerRole: record.owner?.role })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const activityHistory = await prisma.auditLog.findMany({
    where: { entityType: type, entityId: record.refNo },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, details: true, createdAt: true },
  });
  return NextResponse.json({ ...record, activityHistory, canEdit: canEdit(user, record) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await load(p.type, p.id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { type, record } = found;

  const body = await req.json();

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

await logAudit({
  action: body.locked ? "LOCK" : "UNLOCK",
  entityType: type,
  entityId: updated.refNo,
  userId: user.id,
  details: {
    name: user.name,
  },
});

return NextResponse.json(updated);


  }

  if (!canEdit(user, record)) {
    return NextResponse.json({ error: editBlockedReason(user, record) }, { status: 403 });
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

const normalized = normalizeTimes(parsed.data);
if (record.status !== "OPEN" && normalized.status === "OPEN") {
  normalized.endDate = null;
  normalized.timeEnded = null;
}
const data = {
  ...normalized,
  startDate: new Date(normalized.startDate),
  endDate: normalized.endDate ? new Date(normalized.endDate) : null,
};

const updated = await delegateFor(type).update({
  where: { id: record.id },
  data,
});

const statusChanged = updated.status !== record.status;
const assignmentChanged = updated.assigned !== record.assigned;
if (statusChanged) {
  await logAudit({
    action: "STATUS_CHANGE",
    entityType: type,
    entityId: updated.refNo,
    userId: user.id,
    details: {
      name: user.name,
      previousStatus: record.status,
      nextStatus: updated.status,
      previousEndDate: record.endDate?.toISOString().slice(0, 10) ?? null,
      previousTimeEnded: record.timeEnded,
      endDate: updated.endDate,
      timeEnded: updated.timeEnded,
    },
  });
}
if (assignmentChanged) {
  await logAudit({
    action: "ENDORSED",
    entityType: type,
    entityId: updated.refNo,
    userId: user.id,
    details: {
      name: user.name,
      previousAssigned: record.assigned,
      assigned: updated.assigned,
    },
  });
}
if (!statusChanged && !assignmentChanged) {
  await logAudit({
    action: "UPDATE",
    entityType: type,
    entityId: updated.refNo,
    userId: user.id,
    details: { recordId: record.id, name: user.name },
  });
}

return NextResponse.json(updated);

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
  },
});

return NextResponse.json({ ok: true });


}
