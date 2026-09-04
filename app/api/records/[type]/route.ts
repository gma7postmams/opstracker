import { logAudit } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRecordType, SortKey } from "@/lib/recordTypes";
import { listRecords, nextRefNo, normalizeTimes, delegateFor } from "@/lib/records";
import { schemaFor, flatten } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRecordType(p.type)) return NextResponse.json({ error: "Unknown record type" }, { status: 404 });

  const s = req.nextUrl.searchParams;
  const data = await listRecords(p.type, {
    q: s.get("q") ?? undefined,
    status: s.get("status") ?? undefined,
    location: s.get("location") ?? undefined,
    shift: s.get("shift") ?? undefined,
    from: s.get("from") ?? undefined,
    to: s.get("to") ?? undefined,
    sort: (s.get("sort") as SortKey) ?? "date",
    dir: s.get("dir") === "asc" ? "asc" : "desc",
    page: Number(s.get("page") ?? 1),
    perPage: Number(s.get("perPage") ?? 50),
  });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRecordType(p.type)) return NextResponse.json({ error: "Unknown record type" }, { status: 404 });

  const parsed = schemaFor(p.type).safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }

  const type = p.type;

const record = await prisma.$transaction(async (tx) => {
  const refNo = await nextRefNo(type, tx);
  const data = normalizeTimes({ ...parsed.data, date: new Date(parsed.data.date) });
  const d = (type === "assistance" ? tx.assistance : tx.task) as any;
  return d.create({ data: { ...data, refNo, ownerId: user.id } });
});

await logAudit({
  action: "CREATE",
  entityType: type,
  entityId: record.refNo,
  userId: user.id,
});

return NextResponse.json(record, { status: 201 });

}
