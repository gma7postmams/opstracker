import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isRecordType } from "@/lib/recordTypes";
import { getRecord, normalizeTimes, delegateFor } from "@/lib/records";
import { canEdit, editBlockedReason, isAdmin } from "@/lib/permissions";
import { schemaFor, flatten } from "@/lib/validation";

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
  return NextResponse.json({ ...record, canEdit: canEdit(user, record) });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ type: string; id: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await load(p.type, p.id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { type, record } = found;

  const body = await req.json();

  // Lock toggling is a separate, admin-only concern from editing content.
  if (typeof body.locked === "boolean" && Object.keys(body).length === 1) {
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Only administrators can lock records" }, { status: 403 });
    }
    const updated = await delegateFor(type).update({
      where: { id: record.id },
      data: { locked: body.locked, lockedById: body.locked ? user.id : null },
    });
    return NextResponse.json(updated);
  }

  if (!canEdit(user, record)) {
    return NextResponse.json({ error: editBlockedReason(user, record) }, { status: 403 });
  }

  // Partial updates still need the cross-field time rules, so merge with the
  // stored row before validating rather than checking the patch in isolation.
  const merged = {
    ...record,
    ...body,
    date: (body.date ?? record.date.toISOString().slice(0, 10)).slice(0, 10),
  };
  const parsed = schemaFor(type).safeParse(merged);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }

  const data = normalizeTimes({ ...parsed.data, date: new Date(parsed.data.date) });
  const updated = await delegateFor(type).update({ where: { id: record.id }, data });
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
  await delegateFor(type).delete({ where: { id: record.id } });
  return NextResponse.json({ ok: true });
}
