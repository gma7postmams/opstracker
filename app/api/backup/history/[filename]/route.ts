import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { deleteStoredBackup, readStoredBackup } from "@/lib/backup-storage";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

async function authorize() {
  const user = await currentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!isAdmin(user)) return { user: null, response: NextResponse.json({ error: "Administrators only" }, { status: 403 }) };
  return { user, response: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { user, response } = await authorize();
  if (response) return response;
  const { filename } = await params;
  try {
    const { contents, run } = await readStoredBackup(filename);
    return new NextResponse(new Uint8Array(contents), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${run.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { user, response } = await authorize();
  if (response) return response;
  const { filename } = await params;
  try {
    const run = await deleteStoredBackup(filename);
    await logAudit({
      userId: user!.id,
      action: "BACKUP_DELETED",
      entityType: "System",
      entityId: "Backup Deleted",
      details: { filename: run.filename, source: run.source },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Backup not found" }, { status: 404 });
  }
}