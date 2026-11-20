ALTER TABLE "audit_logs"
    ADD COLUMN "ip_address" TEXT,
    ADD COLUMN "user_agent" TEXT,
    ADD COLUMN "old_values" JSONB,
    ADD COLUMN "new_values" JSONB;