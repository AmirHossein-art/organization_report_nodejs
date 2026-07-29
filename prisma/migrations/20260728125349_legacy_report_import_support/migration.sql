/*
  Warnings:

  - A unique constraint covering the columns `[import_key]` on the table `Report` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[project_id,period_id]` on the table `Report` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "NextAction" ADD COLUMN     "completed_at" TIMESTAMP(3),
ADD COLUMN     "is_completed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "target_date_raw" TEXT,
ALTER COLUMN "target_date" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "wbs_file_name" TEXT,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "import_key" TEXT,
ADD COLUMN     "imported_at" TIMESTAMP(3),
ADD COLUMN     "is_legacy_import" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_file_name" TEXT,
ADD COLUMN     "source_page" INTEGER,
ALTER COLUMN "results_achieved" SET DEFAULT '',
ALTER COLUMN "kpi_text" SET DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "job_title" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Report_import_key_key" ON "Report"("import_key");

-- CreateIndex
CREATE UNIQUE INDEX "Report_project_id_period_id_key" ON "Report"("project_id", "period_id");
