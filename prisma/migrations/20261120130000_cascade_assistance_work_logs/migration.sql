ALTER TABLE "work_logs" DROP CONSTRAINT "work_logs_assistance_id_fkey";

ALTER TABLE "work_logs"
ADD CONSTRAINT "work_logs_assistance_id_fkey"
FOREIGN KEY ("assistance_id") REFERENCES "assistance"("id") ON DELETE CASCADE ON UPDATE CASCADE;