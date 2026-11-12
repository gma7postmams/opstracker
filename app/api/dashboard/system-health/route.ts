import { constants } from "node:fs";
import { access, stat, statfs } from "node:fs/promises";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getBackupDirectory, getUploadsDirectory } from "@/lib/backup-storage";
import { isAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type StorageStatus = {
  available: boolean;
  totalBytes: string | null;
  freeBytes: string | null;
  usedPercent: number | null;
};

async function getStorageStatus(directory: string): Promise<StorageStatus> {
  try {
    const details = await stat(directory);
    if (!details.isDirectory()) return { available: false, totalBytes: null, freeBytes: null, usedPercent: null };
    await access(directory, constants.R_OK | constants.W_OK);
  } catch {
    return { available: false, totalBytes: null, freeBytes: null, usedPercent: null };
  }

  try {
    const filesystem = await statfs(directory, { bigint: true });
    const total = filesystem.blocks * filesystem.bsize;
    const available = filesystem.bavail * filesystem.bsize;
    if (total <= 0n || available < 0n) {
      return { available: true, totalBytes: null, freeBytes: null, usedPercent: null };
    }
    const free = available > total ? total : available;

    const usedPercent = Number(((total - free) * 10_000n) / total) / 100;
    return {
      available: true,
      totalBytes: total.toString(),
      freeBytes: free.toString(),
      usedPercent,
    };
  } catch {
    return { available: true, totalBytes: null, freeBytes: null, usedPercent: null };
  }
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user)) return NextResponse.json({ error: "Administrators only" }, { status: 403 });

  const [database, storage, backupStorage] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    getStorageStatus(getUploadsDirectory()),
    getStorageStatus(getBackupDirectory()),
  ]);

  return NextResponse.json({ database, storage, backupStorage });
}