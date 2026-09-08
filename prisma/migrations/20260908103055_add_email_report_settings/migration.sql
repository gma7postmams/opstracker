-- AlterTable
ALTER TABLE "users" ADD COLUMN     "smtp_email" TEXT,
ADD COLUMN     "smtp_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtp_password" TEXT,
ADD COLUMN     "smtp_recipients" TEXT;
