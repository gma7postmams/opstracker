UPDATE "assistance"
SET "end_date" = NULL,
    "time_ended" = NULL
WHERE "status" = 'OPEN'
  AND ("end_date" IS NOT NULL OR "time_ended" IS NOT NULL);

UPDATE "tasks"
SET "end_date" = NULL,
    "time_ended" = NULL
WHERE "status" = 'OPEN'
  AND ("end_date" IS NOT NULL OR "time_ended" IS NOT NULL);