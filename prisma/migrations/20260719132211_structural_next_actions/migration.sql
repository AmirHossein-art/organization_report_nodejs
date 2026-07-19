/*
  Warnings:

  - You are about to drop the column `next_actions` on the `Report` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_period_id_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_project_id_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_user_id_fkey";

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "next_actions";

-- CreateTable
CREATE TABLE "NextAction" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "action_text" TEXT NOT NULL,
    "target_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NextAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "ReportPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NextAction" ADD CONSTRAINT "NextAction_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
