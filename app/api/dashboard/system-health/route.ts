import { constants } from "node:fs";
import { access, readdir, stat, statfs } from "node:fs/promises";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getBackupDirectory, getUploadsDirectory, isManagedBackupFilename } from "@/lib/backup-storage";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type StorageStatus = {
  available: boolean;
  totalBytes: string | null;
  freeBytes: string | null;
  usedPercent: number | null;
};

type StorageResult = {
  status: StorageStatus;
  deviceId: string | null;
};

async function getStorageStatus(directory: string): Promise<StorageResult> {
  let deviceId: string | null = null;
  try {
    const details = await stat(directory, { bigint: true });
    if (!details.isDirectory()) {
      return { status: { available: false, totalBytes: null, freeBytes: null, usedPercent: null }, deviceId: null };
    }
    deviceId = details.dev.toString();
    await access(directory, constants.R_OK | constants.W_OK);
  } catch {
    return { status: { available: false, totalBytes: null, freeBytes: null, usedPercent: null }, deviceId: null };
  }

  try {
    const filesystem = await statfs(directory, { bigint: true });
    const total = filesystem.blocks * filesystem.bsize;
    const available = filesystem.bavail * filesystem.bsize;
    if (total <= 0n || available < 0n) {
      return { status: { available: true, totalBytes: null, freeBytes: null, usedPercent: null }, deviceId };
    }
    const free = available > total ? total : available;

    const usedPercent = Number(((total - free) * 10_000n) / total) / 100;
    return {
      status: {
        available: true,
        totalBytes: total.toString(),
        freeBytes: free.toString(),
        usedPercent,
      },
      deviceId,
    };
  } catch {
    return { status: { available: true, totalBytes: null, freeBytes: null, usedPercent: null }, deviceId };
  }
}

async function getCpuUsagePercent(): Promise<number | null> {
  const before = os.cpus();
  await delay(100);
  const after = os.cpus();
  if (before.length === 0 || before.length !== after.length) return null;

  let idle = 0;
  let total = 0;
  for (let index = 0; index < before.length; index += 1) {
    const initial = before[index].times;
    const current = after[index].times;
    const initialTimes = Object.values(initial);
    const currentTimes = Object.values(current);
    idle += current.idle - initial.idle;
    total += currentTimes.reduce((sum, value, timeIndex) => sum + value - initialTimes[timeIndex], 0);
  }
  if (total <= 0 || idle < 0 || idle > total) return null;
  return Math.round(((total - idle) / total) * 1000) / 10;
}

async function getAvailableBackupCount(directory: string, filenames: string[]) {
  try {
    const entries = await readdir(directory);
    const files = new Set(entries.filter(isManagedBackupFilename));
    return filenames.filter((filename) => files.has(filename)).length;
  } catch (error) {
    if (error instanceof Error && "code" in error
      && (error.code === "ENOENT" || error.code === "EACCES" || error.code === "EPERM")) {
      return null;
    }
    throw error;
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const [database, storageResult, backupStorageResult, cpuUsagePercent] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    getStorageStatus(getUploadsDirectory()),
    getStorageStatus(getBackupDirectory()),
    getCpuUsagePercent(),
  ]);

  let backupHealth: {
    lastSuccessfulAt: string | null;
    status: "SUCCESS" | "FAILED" | "RUNNING" | null;
    availableCount: number | null;
  } = { lastSuccessfulAt: null, status: null, availableCount: null };

  if (database) {
    const runs = await prisma.backupRun.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { filename: true, status: true, createdAt: true, completedAt: true },
    });
    const lastSuccessfulRun = runs.find((run) => run.status === "SUCCESS");
    const availableCount = await getAvailableBackupCount(
      getBackupDirectory(),
      runs.filter((run) => run.status === "SUCCESS").map((run) => run.filename)
    );
    backupHealth = {
      lastSuccessfulAt: lastSuccessfulRun
        ? (lastSuccessfulRun.completedAt ?? lastSuccessfulRun.createdAt).toISOString()
        : null,
      status: runs[0]?.status ?? null,
      availableCount,
    };
  }

  const sameFilesystem = storageResult.deviceId !== null
    && storageResult.deviceId === backupStorageResult.deviceId;
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = Math.max(0, totalMemory - freeMemory);

  return NextResponse.json({
    database,
    cpuUsagePercent,
    memory: {
      usedBytes: usedMemory.toString(),
      totalBytes: totalMemory.toString(),
      usedPercent: totalMemory > 0 ? Math.round((usedMemory / totalMemory) * 1000) / 10 : null,
    },
    storage: storageResult.status,
    backupStorage: sameFilesystem ? null : backupStorageResult.status,
    backupHealth,
  });
}