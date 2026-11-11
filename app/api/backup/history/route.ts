import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createStoredBackup } from "@/lib/backup-storage";

export const runtime = "nodejs";

function authorized(user: Awaited<ReturnType<typeof currentUser>>) {
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });
  return null;
}

export async function GET() {
  const user = await currentUser();
  const denied = authorized(user);
  if (denied) return denied;

  const runs = await prisma.backupRun.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
  return NextResponse.json(runs.map((run) => ({
    ...run,
    source: run.source === "MANUAL" ? "Manual" : "Scheduled",
    status: run.status === "SUCCESS" ? "Success" : run.status === "FAILED" ? "Failed" : "Running",
    fileSize: run.fileSize === null ? null : Number(run.fileSize),
    createdAt: run.createdAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    error: run.error,
  })));
}

export async function POST() {
  const user = await currentUser();
  const denied = authorized(user);
  if (denied) return denied;

  try {
    const { run } = await createStoredBackup("MANUAL", user!);
    return NextResponse.json({
      filename: run.filename,
      source: "Manual",
      formatVersion: run.formatVersion,
      fileSize: Number(run.fileSize ?? 0),
      status: "Success",
      includesUploads: run.includesUploads,
      encrypted: run.encrypted,
      createdAt: run.createdAt.toISOString(),
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Backup creation failed. See Administration backup history for details." }, { status: 500 });
  }
}