-- CreateEnum
CREATE TYPE "Status" AS ENUM ('OPEN', 'CLOSE_PENDING', 'CLOSED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MasterKind" AS ENUM ('LOCATION', 'SHIFT', 'SHOW_GROUP', 'CATEGORY', 'ACTIVITY_TYPE');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_initial" VARCHAR(1),
    "surname" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "avatar_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistance" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "show_group" TEXT,
    "client_name" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "resolution" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "time_started" VARCHAR(5) NOT NULL,
    "time_ended" VARCHAR(5),
    "status" "Status" NOT NULL DEFAULT 'OPEN',
    "assigned" TEXT NOT NULL,
    "accountable" TEXT NOT NULL,
    "remarks" TEXT,
    "owner_id" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "show_group" TEXT,
    "activity_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "time_started" VARCHAR(5) NOT NULL,
    "time_ended" VARCHAR(5),
    "status" "Status" NOT NULL DEFAULT 'OPEN',
    "assigned" TEXT NOT NULL,
    "accountable" TEXT NOT NULL,
    "remarks" TEXT,
    "owner_id" INTEGER,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branding" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL DEFAULT 'OpsLog',
    "tagline" TEXT NOT NULL DEFAULT 'Operations Platform',
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data" (
    "id" SERIAL NOT NULL,
    "kind" "MasterKind" NOT NULL,
    "value" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "master_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "assistance_ref_no_key" ON "assistance"("ref_no");

-- CreateIndex
CREATE INDEX "assistance_date_idx" ON "assistance"("date");

-- CreateIndex
CREATE INDEX "assistance_status_idx" ON "assistance"("status");

-- CreateIndex
CREATE INDEX "assistance_assigned_idx" ON "assistance"("assigned");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_ref_no_key" ON "tasks"("ref_no");

-- CreateIndex
CREATE INDEX "tasks_date_idx" ON "tasks"("date");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_assigned_idx" ON "tasks"("assigned");

-- CreateIndex
CREATE UNIQUE INDEX "master_data_kind_value_key" ON "master_data"("kind", "value");

-- AddForeignKey
ALTER TABLE "assistance" ADD CONSTRAINT "assistance_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistance" ADD CONSTRAINT "assistance_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_locked_by_id_fkey" FOREIGN KEY ("locked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
