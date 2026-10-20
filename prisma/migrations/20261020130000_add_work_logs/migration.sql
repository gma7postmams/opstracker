CREATE TYPE "WorkLogType" AS ENUM ('RESOLUTION', 'REMARK', 'INVESTIGATION');

CREATE TABLE "work_logs" (
    "id" SERIAL NOT NULL,
    "assistance_id" INTEGER,
    "task_id" INTEGER,
    "type" "WorkLogType" NOT NULL,
    "message" TEXT NOT NULL,
    "created_by_id" INTEGER,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_logs_record_reference_check" CHECK (
        ("assistance_id" IS NOT NULL AND "task_id" IS NULL) OR
        ("assistance_id" IS NULL AND "task_id" IS NOT NULL)
    ),
    CONSTRAINT "work_logs_assistance_id_fkey" FOREIGN KEY ("assistance_id")
        REFERENCES "assistance"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_logs_task_id_fkey" FOREIGN KEY ("task_id")
        REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "work_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "work_logs_assistance_id_created_at_idx" ON "work_logs"("assistance_id", "created_at");
CREATE INDEX "work_logs_task_id_created_at_idx" ON "work_logs"("task_id", "created_at");