ALTER TABLE "assistance" ADD COLUMN "end_date" DATE;
ALTER TABLE "tasks" ADD COLUMN "end_date" DATE;

UPDATE "assistance" SET "end_date" = "date" WHERE "time_ended" IS NOT NULL;
UPDATE "tasks" SET "end_date" = "date" WHERE "time_ended" IS NOT NULL;