-- CreateEnum
CREATE TYPE "KpiInputType" AS ENUM ('direct', 'percentage_change');

-- CreateEnum
CREATE TYPE "KpiTargetDirection" AS ENUM ('minimum', 'maximum');

-- CreateTable
CREATE TABLE "ProjectKpi" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "input_type" "KpiInputType" NOT NULL DEFAULT 'direct',
    "target_value" DOUBLE PRECISION NOT NULL,
    "target_direction" "KpiTargetDirection" NOT NULL,
    "report_type" "ReportType",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectKpi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportKpiValue" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "project_kpi_id" INTEGER NOT NULL,
    "current_value" DOUBLE PRECISION,
    "baseline_value" DOUBLE PRECISION,
    "calculated_value" DOUBLE PRECISION,
    "not_measured" BOOLEAN NOT NULL DEFAULT false,
    "missing_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportKpiValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectKpi_project_id_is_active_idx" ON "ProjectKpi"("project_id", "is_active");

-- CreateIndex
CREATE INDEX "ReportKpiValue_project_kpi_id_idx" ON "ReportKpiValue"("project_kpi_id");

-- CreateIndex
CREATE UNIQUE INDEX "ReportKpiValue_report_id_project_kpi_id_key" ON "ReportKpiValue"("report_id", "project_kpi_id");

-- AddForeignKey
ALTER TABLE "ProjectKpi" ADD CONSTRAINT "ProjectKpi_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportKpiValue" ADD CONSTRAINT "ReportKpiValue_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportKpiValue" ADD CONSTRAINT "ReportKpiValue_project_kpi_id_fkey" FOREIGN KEY ("project_kpi_id") REFERENCES "ProjectKpi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
