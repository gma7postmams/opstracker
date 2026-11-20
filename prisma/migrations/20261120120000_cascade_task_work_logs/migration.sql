ALTER TABLE "work_logs" DROP CONSTRAINT "work_logs_task_id_fkey";

ALTER TABLE "work_logs"
ADD CONSTRAINT "work_logs_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;