import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  saveProjectMemory,
  getProjectMemory,
  formatProjectMemoryForPrompt,
  evolveProjectMemory,
} from "../src/services/projectMemory";

test("formatProjectMemoryForPrompt formats memory sections into prompt context", () => {
  const dummyMemory: any = {
    id: 1,
    project_id: 10,
    dna_summary: "پروژه احداث خطوط بی‌آرتی بزرگراه امام علی",
    chronic_bottlenecks: "• تاخیر در تملک املاک مسیر\n• تداخل با شبکه آب",
    reliability_notes: "نرخ وفای به عهد: ۸۰٪",
    lessons_learned: "• لزوم هماهنگی قبلی با پلیس راهور",
    version: 3,
  };

  const formatted = formatProjectMemoryForPrompt(dummyMemory);
  assert.ok(formatted.includes("Living Project Dossier"));
  assert.ok(formatted.includes("نسخه ۳"));
  assert.ok(formatted.includes("امام علی"));
  assert.ok(formatted.includes("تملک املاک"));
  assert.ok(formatted.includes("پلیس راهور"));
});

test("PostgreSQL integration: ProjectMemory lifecycle, evolution and cascade deletion", async () => {
  const snapshot = process.env.WBS_TEST_SNAPSHOT;
  if (!snapshot) return;

  const root = path.resolve(snapshot);
  const env = dotenv.parse(fs.readFileSync(path.join(root, "test.env")));
  const url = new URL(env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const pool = new pg.Pool({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // اطمینان از ساخت جدول ProjectMemory در دیتابیس آزمایشی ایزوله
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ProjectMemory" (
        "id" SERIAL PRIMARY KEY,
        "project_id" INTEGER NOT NULL UNIQUE REFERENCES "Project"("id") ON DELETE CASCADE,
        "dna_summary" TEXT NOT NULL,
        "chronic_bottlenecks" TEXT NOT NULL DEFAULT '',
        "reliability_notes" TEXT NOT NULL DEFAULT '',
        "lessons_learned" TEXT NOT NULL DEFAULT '',
        "version" INTEGER NOT NULL DEFAULT 1,
        "attributes" JSONB,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "ProjectMemory_project_id_idx" ON "ProjectMemory"("project_id");
    `);

    // ۱. ایجاد یک پروژه آزمایشی
    const project = await prisma.project.create({
      data: {
        code: `test-mem-proj-${Date.now()}`,
        title: "پروژه آزمون حافظه تکاملی هوش مصنوعی",
        description: "توسعه سامانه پایش دوربین‌های نظارت تصویری",
        project_type: "weekly",
      },
    });

    // ۲. بررسی حالت اولیه (بدون حافظه)
    const initialMem = await getProjectMemory(prisma, project.id);
    assert.equal(initialMem, null);

    // ۳. تکامل اولیه حافظه از طریق evolveProjectMemory
    const auditData = {
      wbs_structural_audit: {
        missing_wbs_activities: ["اخذ انشعاب فیبر نوری اختصاصی"],
      },
      kpi_strategic_audit: {
        blind_spots: ["کیفیت تصویر در شب فاقد شاخص سنجش است"],
      },
      strategic_alignment: {
        alignment_analysis: "پیشرفت فاز ۱ با اهداف نظارتی هم‌راستا است.",
      },
      recommendations: ["هماهنگی با سازمان فاوا جهت پهنای باند"],
    };

    const evolved1 = await evolveProjectMemory(prisma, project.id, auditData);
    assert.ok(evolved1);
    assert.equal(evolved1?.project_id, project.id);
    assert.equal(evolved1?.version, 1);
    assert.ok(evolved1?.dna_summary.includes("نظارت تصویری"));
    assert.ok(evolved1?.chronic_bottlenecks.includes("فیبر نوری"));
    assert.ok(evolved1?.lessons_learned.includes("سازمان فاوا"));

    // ۴. افزودن اقدام با تاخیر جهت بررسی خودکار الگوی وفای به عهد در تکامل بعدی
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10); // ۱۰ روز قبل

    await prisma.nextAction.create({
      data: {
        project_id: project.id,
        action_text: "تست کابل‌کشی معوق",
        target_date: pastDate,
        is_completed: false,
      },
    });

    // تکامل ثانویه (نسخه ۲)
    const evolved2 = await evolveProjectMemory(prisma, project.id, {
      recommendations: ["پیگیری با سرپرست کارگاه"],
    });

    assert.ok(evolved2);
    assert.equal(evolved2?.version, 2);
    assert.ok(evolved2?.reliability_notes.includes("تاخیر"));
    assert.ok(evolved2?.chronic_bottlenecks.includes("فیبر نوری"), "باید موانع قبلی را به عنوان سابقه انباشته حفظ کند");

    // ۵. تست حذف آبشاری (Cascade delete) با حذف پروژه
    await prisma.project.delete({ where: { id: project.id } });
    const afterDelete = await getProjectMemory(prisma, project.id);
    assert.equal(afterDelete, null, "ProjectMemory must be removed when project is deleted");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
});
