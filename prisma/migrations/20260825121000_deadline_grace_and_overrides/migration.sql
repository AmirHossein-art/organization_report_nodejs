-- AlterTable
ALTER TABLE "DeadlineSetting" ADD COLUMN "grace_days" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ReportPeriod" ADD COLUMN "deadline_override_at" TIMESTAMPTZ(3),
ADD COLUMN "grace_days_override" INTEGER;

-- Check constraints
ALTER TABLE "DeadlineSetting" ADD CONSTRAINT "DeadlineSetting_grace_days_check" CHECK ("grace_days" >= 0);

ALTER TABLE "ReportPeriod" ADD CONSTRAINT "ReportPeriod_grace_days_override_check" CHECK ("grace_days_override" IS NULL OR "grace_days_override" >= 0);
