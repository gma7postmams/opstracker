import { prisma } from "../lib/prisma";
import { createStoredBackup, pruneScheduledBackups } from "../lib/backup-storage";
import { getNextBackupRun } from "../lib/backup-schedule";

const POLL_INTERVAL_MS = 15_000;
let checking = false;

async function checkSchedule() {
  if (checking) return;
  checking = true;
  try {
    const schedule = await prisma.backupSchedule.findUnique({ where: { id: 1 } });
    if (!schedule?.enabled) return;

    const now = new Date();
    if (!schedule.nextRunAt) {
      await prisma.backupSchedule.updateMany({
        where: { id: 1, enabled: true, nextRunAt: null },
        data: {
          nextRunAt: getNextBackupRun(schedule, now),
        },
      });
      return;
    }
    if (schedule.nextRunAt > now) return;

    const nextRunAt = getNextBackupRun(schedule, now);
    const claim = await prisma.backupSchedule.updateMany({
      where: { id: 1, enabled: true, nextRunAt: schedule.nextRunAt },
      data: {
        lastRunAt: now,
        lastStatus: "RUNNING",
        lastError: null,
        nextRunAt,
      },
    });
    if (claim.count !== 1) return;

    try {
      const { run } = await createStoredBackup("SCHEDULED", { name: "OpsTracker Scheduler" });
      let retentionError: string | null = null;
      try {
        await pruneScheduledBackups(schedule.retentionCount);
      } catch {
        retentionError = "Backup succeeded, but scheduled retention cleanup failed.";
        console.error("Scheduled backup retention cleanup failed");
      }
      await prisma.backupSchedule.update({
        where: { id: 1 },
        data: { lastStatus: "SUCCESS", lastError: retentionError },
      });
      console.info("Scheduled backup completed", { filename: run.filename });
    } catch {
      await prisma.backupSchedule.update({
        where: { id: 1 },
        data: { lastStatus: "FAILED", lastError: "Scheduled backup failed. Check backup storage and database availability." },
      });
      console.error("Scheduled backup failed");
    }
  } catch {
    console.error("Backup scheduler check failed");
  } finally {
    checking = false;
  }
}

console.info("Backup scheduler started");
void checkSchedule();
const timer = setInterval(() => void checkSchedule(), POLL_INTERVAL_MS);

process.on("SIGTERM", async () => {
  clearInterval(timer);
  await prisma.$disconnect();
  process.exit(0);
});