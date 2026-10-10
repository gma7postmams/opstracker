import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isRecordType } from "@/lib/recordTypes";
import { listRecords, nextRefNo, normalizeTimes, delegateFor } from "@/lib/records";
import { schemaFor, flatten, listQuerySchema, queryObject } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const p = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRecordType(p.type)) return NextResponse.json({ error: "Unknown record type" }, { status: 404 });

  const parsed = listQuerySchema.safeParse(queryObject(req.nextUrl.searchParams));
  if (!parsed.success) {
    const fields = flatten(parsed.error);
    return NextResponse.json({ error: Object.values(fields)[0] ?? "Invalid query", fields }, { status: 400 });
  }
  const data = await listRecords(p.type, parsed.data);
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

  return NextResponse.json(record, { status: 201 });
}
