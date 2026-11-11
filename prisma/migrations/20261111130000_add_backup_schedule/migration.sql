CREATE TYPE "BackupFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

CREATE TABLE "backup_schedule" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "BackupFrequency" NOT NULL DEFAULT 'DAILY',
    "backup_time" VARCHAR(5) NOT NULL DEFAULT '02:00',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weekly_day" INTEGER,
    "monthly_day" INTEGER,
    "retention_count" INTEGER NOT NULL DEFAULT 7,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "last_status" "BackupRunStatus",
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_schedule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "backup_schedule_weekly_day_check" CHECK ("weekly_day" IS NULL OR ("weekly_day" >= 0 AND "weekly_day" <= 6)),
    CONSTRAINT "backup_schedule_monthly_day_check" CHECK ("monthly_day" IS NULL OR ("monthly_day" >= 1 AND "monthly_day" <= 31)),
    CONSTRAINT "backup_schedule_retention_count_check" CHECK ("retention_count" >= 1)
);