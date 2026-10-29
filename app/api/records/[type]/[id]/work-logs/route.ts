import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { canEdit, canView } from "@/lib/permissions";
import { delegateFor, getRecord, hasUserParticipated } from "@/lib/records";
import { isRecordType } from "@/lib/recordTypes";
import { prisma } from "@/lib/prisma";

const WORK_LOG_TYPES = ["INVESTIGATION", "RESOLUTION", "REMARK"] as const;

async function loadRecord(type: string, id: string) {
  if (!isRecordType(type)) return null;
  const recordId = Number(id);
  if (!Number.isInteger(recordId)) return null;
  const record = await getRecord(type, recordId);
  return record ? { type, record } : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const found = await loadRecord(type, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const hasParticipated = user.role !== "ADMIN" && await hasUserParticipated(found.type, found.record.id, user.id);
  if (!canView(user, { ...found.record, hasParticipated }, req.nextUrl.searchParams.get("userId") === "all")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const where = found.type === "assistance"
    ? { assistanceId: found.record.id }
    : { taskId: found.record.id };
  const workLogs = await prisma.workLog.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return NextResponse.json(workLogs.map((workLog) => ({
    ...workLog,
    canEdit: user.role === "ADMIN" || found.record.ownerId === user.id || workLog.createdById === user.id,
    canDelete: user.role === "ADMIN" || found.record.ownerId === user.id || workLog.createdById === user.id,
  })));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const found = await loadRecord(type, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEdit(user, found.record)) {
    return NextResponse.json({ error: "You do not have permission to add work logs" }, { status: 403 });
  }

  let body: { type?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!WORK_LOG_TYPES.includes(body.type as (typeof WORK_LOG_TYPES)[number])) {
    return NextResponse.json({ error: "Choose a valid work log type" }, { status: 400 });
  }
  if (!message || message.length > 10000) {
    return NextResponse.json({ error: "Message must be between 1 and 10000 characters" }, { status: 400 });
  }

  const data = {
    type: body.type as (typeof WORK_LOG_TYPES)[number],
    message,
    createdById: user.id,
    createdByName: user.name,
    ...(found.type === "assistance"
      ? { assistanceId: found.record.id }
      : { taskId: found.record.id }),
  };
  const workLog = await prisma.workLog.create({ data });
  return NextResponse.json(workLog, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const found = await loadRecord(type, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { id?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const workLogId = Number(body.id);
  if (!Number.isInteger(workLogId) || workLogId < 1) {
    return NextResponse.json({ error: "A valid work log ID is required" }, { status: 400 });
  }
  const relationWhere = found.type === "assistance"
    ? { assistanceId: found.record.id }
    : { taskId: found.record.id };
  const workLog = await prisma.workLog.findFirst({ where: { id: workLogId, ...relationWhere } });
  if (!workLog) return NextResponse.json({ error: "Work log not found" }, { status: 404 });

  const canEdit = user.role === "ADMIN" || found.record.ownerId === user.id || workLog.createdById === user.id;
  if (!canEdit) return NextResponse.json({ error: "You do not have permission to edit this work log" }, { status: 403 });

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > 10000) {
    return NextResponse.json({ error: "Message must be between 1 and 10000 characters" }, { status: 400 });
  }

  const baseTime =
    workLog.updatedAt?.getTime() ??
    workLog.createdAt?.getTime() ??
    Date.now();
  const updatedAt = new Date(Math.max(Date.now(), baseTime + 1));
  const updatedWorkLog = await prisma.workLog.update({
    where: { id: workLog.id },
    data: { message, updatedAt },
  });
  return NextResponse.json(updatedWorkLog);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const found = await loadRecord(type, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const workLogId = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(workLogId) || workLogId < 1) {
    return NextResponse.json({ error: "A valid work log ID is required" }, { status: 400 });
  }
  const relationWhere = found.type === "assistance"
    ? { assistanceId: found.record.id }
    : { taskId: found.record.id };
  const workLog = await prisma.workLog.findFirst({ where: { id: workLogId, ...relationWhere } });
  if (!workLog) return NextResponse.json({ error: "Work log not found" }, { status: 404 });

  const canDelete = user.role === "ADMIN" || found.record.ownerId === user.id || workLog.createdById === user.id;
  if (!canDelete) return NextResponse.json({ error: "You do not have permission to delete this work log" }, { status: 403 });

  await prisma.workLog.delete({ where: { id: workLog.id } });
  return new NextResponse(null, { status: 204 });
}