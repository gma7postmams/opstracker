import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { isRecordType } from "@/lib/recordTypes";
import { batchUpdate, batchDelete, batchLock } from "@/lib/records";
import { isAdmin } from "@/lib/permissions";
import { batchPatchSchema, flatten } from "@/lib/validation";

const bodySchema = z.object({
  action: z.enum(["update", "delete", "lock", "unlock"]),
  ids: z.array(z.number().int()).min(1, "Select at least one record"),
  patch: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isRecordType(type)) return NextResponse.json({ error: "Unknown record type" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(parsed.error) }, { status: 400 });
  }
  const { action, ids, patch } = parsed.data;

  if (action === "lock" || action === "unlock") {
    if (!isAdmin(user)) {
      return NextResponse.json({ error: "Only administrators can lock records" }, { status: 403 });
    }
    const res = await batchLock(type, ids, action === "lock", user.id);
    return NextResponse.json(res);
  }

  if (action === "delete") {
    return NextResponse.json(await batchDelete(type, ids, user));
  }

  const patchParsed = batchPatchSchema.safeParse(patch ?? {});
  if (!patchParsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: flatten(patchParsed.error) }, { status: 400 });
  }
  // Only the fields the user actually set are applied — everything else is
  // left alone across the whole selection.
  const clean = Object.fromEntries(Object.entries(patchParsed.data).filter(([, v]) => v !== undefined && v !== ""));
  if (!Object.keys(clean).length) {
    return NextResponse.json({ error: "No fields to change" }, { status: 400 });
  }
  return NextResponse.json(await batchUpdate(type, ids, clean, user));
}
