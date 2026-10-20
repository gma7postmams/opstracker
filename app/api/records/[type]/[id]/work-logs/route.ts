import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { canEdit, canView } from "@/lib/permissions";
import { delegateFor, getRecord } from "@/lib/records";
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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, id } = await params;
  const found = await loadRecord(type, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canView(user, { ...found.record, ownerRole: found.record.owner?.role })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const where = found.type === "assistance"
    ? { assistanceId: found.record.id }
    : { taskId: found.record.id };
  const workLogs = await prisma.workLog.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const typeOrder = new Map(WORK_LOG_TYPES.map((type, index) => [type, index]));
  workLogs.sort((a, b) =>
    typeOrder.get(a.type)! - typeOrder.get(b.type)! ||
    a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id
  );
  return NextResponse.json(workLogs);
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