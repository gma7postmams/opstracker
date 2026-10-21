ALTER TABLE "work_logs"
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "work_logs"
SET "updated_at" = "created_at";