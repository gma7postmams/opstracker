CREATE TYPE "BackupSource" AS ENUM ('MANUAL', 'SCHEDULED');
CREATE TYPE "BackupRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

CREATE TABLE "backup_runs" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "source" "BackupSource" NOT NULL,
    "format_version" INTEGER NOT NULL DEFAULT 2,
    "file_size" BIGINT,
    "status" "BackupRunStatus" NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "includes_uploads" BOOLEAN NOT NULL DEFAULT false,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "backup_runs_filename_key" ON "backup_runs"("filename");
CREATE INDEX "backup_runs_created_at_idx" ON "backup_runs"("created_at");