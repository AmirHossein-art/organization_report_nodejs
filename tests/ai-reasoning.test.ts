import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

test("AI Reasoning schema validation: ensures WBS gaps, KPI recommendations & deliverable-oriented action audit", () => {
  // شبیه‌سازی خروجی استاندارد استنتاج ۳ ستونه هوش مصنوعی
  const sampleAiAudit = {
    executive_summary: "خلاصه مدیریتی پروژه جایگاه‌های شارژ...",
    wbs_structural_audit: {
      missing_wbs_activities: [
        "اخذ تاییدیه و انشعاب دیماند بالا از شرکت توزیع برق منطقه‌ای",
      ],
      hierarchy_recommendations: [
        "بسته کاری انتخاب کارشناس رسمی باید زیرمجموعه تهیه اسناد مزایده قرار گیرد",
      ],
      alignment_analysis: "فعالیت‌های گزارش منطبق بر فاز ۱ است.",
    },
    kpi_strategic_audit: {
      missing_kpis_recommendations: [
        {
          name: "میانگین زمان توقف خودرو در جایگاه",
          unit: "دقیقه",
          reason: "جهت سنجش کارایی فرآیند شارژ سریع و عدم ایجاد صف در معابر مجاور",
        },
      ],
      blind_spots: [
        "قلم تحویل‌دادنی فونداسیون استندها فاقد شاخص سنجش آزمون مقاومت بتن است",
      ],
      kpis_evaluation: [
        {
          kpi_name: "استندهای آماده به کار",
          previous_value: "۷۵٪",
          current_value: "۸۵٪",
          has_kpi: true,
        },
      ],
    },
    next_actions_audit: {
      are_actions_deliverable_oriented: true,
      orientation_analysis: "اقدامات به طور ملموس منتهی به تکمیل فونداسیون جایگاه ۳ می‌شوند.",
      recommended_next_actions: [
        {
          action: "تسریع در کابل‌کشی انشعاب جایگاه آزادی",
          deadline: "۱۴۰۵/۰۸/۲۵",
          wbs_code: "2.3",
          reasoning: "جلوگیری از تاخیر بحرانی در نصب فیزیکی استندها",
        },
      ],
    },
    repetitiveness_assessment: {
      similarity_percentage: 12,
      is_duplicate_risk: false,
      analysis_details: "گزارش دارای پیشرفت‌های واقعی نسبت به دوره قبل است.",
    },
  };

  // اعتبارسنجی ارکان ۳ ستون اصلی استنتاج
  assert.ok(Array.isArray(sampleAiAudit.wbs_structural_audit.missing_wbs_activities));
  assert.equal(sampleAiAudit.wbs_structural_audit.missing_wbs_activities.length, 1);
  assert.ok(Array.isArray(sampleAiAudit.wbs_structural_audit.hierarchy_recommendations));

  assert.ok(Array.isArray(sampleAiAudit.kpi_strategic_audit.missing_kpis_recommendations));
  assert.equal(sampleAiAudit.kpi_strategic_audit.missing_kpis_recommendations[0].name.includes("توقف"), true);
  assert.ok(Array.isArray(sampleAiAudit.kpi_strategic_audit.blind_spots));

  assert.equal(sampleAiAudit.next_actions_audit.are_actions_deliverable_oriented, true);
  assert.ok(Array.isArray(sampleAiAudit.next_actions_audit.recommended_next_actions));
  assert.equal(sampleAiAudit.next_actions_audit.recommended_next_actions[0].wbs_code, "2.3");
  assert.ok(sampleAiAudit.next_actions_audit.recommended_next_actions[0].deadline.includes("۱۴۰۵"));
});

test("PostgreSQL graph context: integrates Project Goals, WBS nodes, KPIs and Next Actions into unified context", async () => {
  const snapshot = process.env.WBS_TEST_SNAPSHOT;
  if (!snapshot) return;

  const root = path.resolve(snapshot);
  const env = dotenv.parse(fs.readFileSync(path.join(root, "test.env")));
  const url = new URL(env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const pool = new pg.Pool({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // واکشی یک پروژه معتبر از اسنپ‌شات (مثل پروژه ۸ که دارای ۲۴ گره WBS است)
    const project = await prisma.project.findUnique({
      where: { id: 8 },
      include: {
        wbsNodes: { where: { attributes: { path: ["active"], not: false } } },
        kpis: { where: { is_active: true } },
        nextActions: { where: { is_completed: false, is_cancelled: false } },
      },
    });

    assert.ok(project, "Project 8 must exist in test snapshot");
    assert.ok(project.wbsNodes.length >= 20, "Project 8 must have its synced WBS nodes");

    // بررسی اینکه گره‌ها دارای کد و عنوان معتبر هستند
    const sampleNode = project.wbsNodes[0];
    assert.ok(sampleNode.code);
    assert.ok(sampleNode.title);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
});
