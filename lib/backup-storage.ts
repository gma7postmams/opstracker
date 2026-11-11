import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { createBackupPackage, parseBackupPackage } from "./backup-package";
import { encryptBackupFile, isBackupEncryptionConfigured } from "./backup-crypto";

const FORMAT_VERSION = 2;
const BACKUP_FILENAME = /^opstracker-backup-v2-\d{8}-\d{6}\.opsbackup$/;

export type BackupActor = { id?: number; name: string };
export type BackupSourceValue = "MANUAL" | "SCHEDULED";

export function getBackupDirectory() {
  return path.resolve(process.env.BACKUP_STORAGE_DIR ?? path.join(process.cwd(), "backups"));
}

export function getUploadsDirectory() {
  return path.resolve(process.env.UPLOADS_STORAGE_DIR ?? path.join(process.cwd(), "public", "uploads"));
}

export function isManagedBackupFilename(filename: string) {
  return BACKUP_FILENAME.test(filename);
}

function makeFilename(date: Date) {
  const stamp = date.toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  return `opstracker-backup-v2-${stamp}.opsbackup`;
}

async function availableFilename() {
  let date = new Date();
  for (;;) {
    const filename = makeFilename(date);
    try {
      await access(path.join(getBackupDirectory(), filename));
      date = new Date(date.getTime() + 1000);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return filename;
      throw error;
    }
  }
}

async function exportPayload(exportedBy: string) {
  const [users, assistance, tasks, workLogs, branding, masterData, counters, auditLogs] = await prisma.$transaction(
    (tx) => Promise.all([
      tx.user.findMany({ orderBy: { id: "asc" } }),
      tx.assistance.findMany({ orderBy: { id: "asc" } }),
      tx.task.findMany({ orderBy: { id: "asc" } }),
      tx.workLog.findMany({ orderBy: { id: "asc" } }),
      tx.branding.findUnique({ where: { id: 1 } }),
      tx.masterData.findMany({ orderBy: { id: "asc" } }),
      tx.counter.findMany(),
      tx.auditLog.findMany({ orderBy: { id: "asc" } }),
    ]),
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000 },
  );

  return {
    format: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    counts: {
      users: users.length,
      assistance: assistance.length,
      tasks: tasks.length,
      workLogs: workLogs.length,
      auditLogs: auditLogs.length,
    },
    data: { users, assistance, tasks, workLogs, branding, masterData, counters, auditLogs },
  };
}

export async function createStoredBackup(source: BackupSourceValue, actor: BackupActor) {
  await mkdir(getBackupDirectory(), { recursive: true });
  const filename = await availableFilename();
  const run = await prisma.backupRun.create({ data: { filename, source } });
  const temporaryPath = path.join(getBackupDirectory(), `.${filename}.${randomUUID()}.tmp`);

  try {
    const payload = await exportPayload(actor.name);
    const databaseContents = Buffer.from(JSON.stringify(payload, null, 2));
    const packageMetadata = await createBackupPackage(databaseContents, payload.exportedAt, getUploadsDirectory(), temporaryPath);
    const generatedContents = await readFile(temporaryPath);
    const parsedPackage = await parseBackupPackage(generatedContents);
    const checked = JSON.parse(parsedPackage.databaseContents.toString("utf8"));
    if (checked.format !== FORMAT_VERSION || !checked.data || !Array.isArray(checked.data.workLogs)) {
      throw new Error("Generated backup validation failed");
    }
    const { encrypted, contents } = encryptBackupFile(generatedContents);
    await writeFile(path.join(getBackupDirectory(), filename), contents, { mode: 0o600, flag: "wx" });
    await rm(temporaryPath, { force: true });
    const fileInfo = await stat(path.join(getBackupDirectory(), filename));
    const completed = await prisma.backupRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        fileSize: fileInfo.size,
        includesUploads: packageMetadata.includesUploads,
        encrypted,
        completedAt: new Date(),
      },
    });
    await logAudit({
      userId: actor.id,
      action: "BACKUP",
      entityType: "System",
      entityId: "Backup Created",
      details: { source, filename, formatVersion: FORMAT_VERSION, fileSize: fileInfo.size, status: "Success" },
    });
    return { run: completed, contents };
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    const message = "Backup failed. Check backup storage and database availability.";
    const failed = await prisma.backupRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: message.slice(0, 2000), completedAt: new Date() },
    });
    await logAudit({
      userId: actor.id,
      action: "BACKUP_FAILED",
      entityType: "System",
      entityId: "Backup Failed",
      details: { source, filename, status: "Failed", error: message.slice(0, 500) },
    });
    throw Object.assign(new Error(message), { backupRun: failed });
  }
}

export async function readStoredBackup(filename: string) {
  if (!isManagedBackupFilename(filename)) throw new Error("Backup not found");
  const run = await prisma.backupRun.findUnique({ where: { filename } });
  if (!run || run.status !== "SUCCESS") throw new Error("Backup not found");

  const directory = getBackupDirectory();
  const filePath = path.resolve(directory, filename);
  if (path.dirname(filePath) !== directory) throw new Error("Backup not found");
  return { run, contents: await readFile(filePath) };
}

export async function deleteStoredBackup(filename: string) {
  if (!isManagedBackupFilename(filename)) throw new Error("Backup not found");
  const run = await prisma.backupRun.findUnique({ where: { filename } });
  if (!run) throw new Error("Backup not found");
  const directory = getBackupDirectory();
  const filePath = path.resolve(directory, filename);
  if (path.dirname(filePath) !== directory) throw new Error("Backup not found");
  await rm(filePath, { force: true });
  await prisma.backupRun.delete({ where: { id: run.id } });
  return run;
}

export async function pruneScheduledBackups(retentionCount: number) {
  const runs = await prisma.backupRun.findMany({
    where: { source: "SCHEDULED", status: "SUCCESS" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const removed: string[] = [];

  for (const run of runs.slice(retentionCount)) {
    if (!isManagedBackupFilename(run.filename)) continue;
    const directory = getBackupDirectory();
    const filePath = path.resolve(directory, run.filename);
    if (path.dirname(filePath) !== directory) continue;
    await rm(filePath, { force: true });
    await prisma.backupRun.delete({ where: { id: run.id } });
    removed.push(run.filename);
  }

  if (removed.length) {
    await logAudit({
      action: "BACKUP_RETENTION_CLEANUP",
      entityType: "System",
      entityId: "Scheduled Backups Pruned",
      details: { removed, retainedCount: retentionCount },
    });
  }
  return removed;
}