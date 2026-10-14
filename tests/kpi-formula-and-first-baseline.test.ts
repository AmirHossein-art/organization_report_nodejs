import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { evaluateFormula, validateFormula } from "../src/utils/formulaEvaluator";

test("KPI first entered value becomes baseline logic", () => {
  // شبیه‌سازی منطق تعیین خودکار مبنا در اولین ثبت
  function resolveKpiBaseline(
    kpiBaselineValue: number | null | undefined,
    submittedBaseline: number | null | undefined,
    currentValue: number
  ) {
    let baseline =
      submittedBaseline !== undefined && submittedBaseline !== null
        ? submittedBaseline
        : kpiBaselineValue !== undefined && kpiBaselineValue !== null
        ? kpiBaselineValue
        : null;

    let baselinePersistedToProject = false;
    if (baseline === null) {
      baseline = currentValue;
      if (kpiBaselineValue === null || kpiBaselineValue === undefined) {
        baselinePersistedToProject = true;
      }
    }

    return { baseline, baselinePersistedToProject };
  }

  // ۱. شاخص جدید بدون مبنا: اولین ثبت با عدد ۵
  const res1 = resolveKpiBaseline(null, null, 5);
  assert.equal(res1.baseline, 5, "اولین ورودی باید به عنوان مبنا تعیین شود");
  assert.equal(res1.baselinePersistedToProject, true, "باید در مشخصات پروژه تثبیت شود");

  // ۲. گزارش بعدی با ثبت عدد ۷ روی شاخصی که مبنای ۵ دارد
  const res2 = resolveKpiBaseline(5, null, 7);
  assert.equal(res2.baseline, 5);
  assert.equal(res2.baselinePersistedToProject, false);
});

test("PostgreSQL integration: Composite KPI formula and initial baseline persistence", async () => {
  const snapshot = process.env.WBS_TEST_SNAPSHOT;
  if (!snapshot) return;

  const root = path.resolve(snapshot);
  const env = dotenv.parse(fs.readFileSync(path.join(root, "test.env")));
  const url = new URL(env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const pool = new pg.Pool({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // اطمینان از ستون formula در جدول CompositeKpi در دیتابیس تستی
    await pool.query(`
      ALTER TABLE "CompositeKpi" ADD COLUMN IF NOT EXISTS "formula" TEXT;
    `);

    // ۱. ایجاد یک پروژه آزمایشی
    const project = await prisma.project.create({
      data: {
        code: `test-kpi-proj-${Date.now()}`,
        title: "پروژه آزمون فرمول و مبنای شاخص",
        project_type: "weekly",
      },
    });

    // ۲. ایجاد شاخص بدون مقدار مبنا (baseline_value: null)
    const kpi1 = await prisma.projectKpi.create({
      data: {
        project_id: project.id,
        name: "شاخص پیشرفت فاز ۱ (بدون مبنای اولیه)",
        unit: "درصد",
        input_type: "direct",
        target_direction: "minimum",
        baseline_value: null,
      },
    });

    const kpi2 = await prisma.projectKpi.create({
      data: {
        project_id: project.id,
        name: "شاخص پیشرفت فاز ۲ (بدون مبنای اولیه)",
        unit: "درصد",
        input_type: "direct",
        target_direction: "minimum",
        baseline_value: null,
      },
    });

    assert.equal(kpi1.baseline_value, null);
    assert.equal(kpi2.baseline_value, null);

    // ۳. شبیه‌سازی اولین ورود عدد توسط کاربر (عدد ۶ برای kpi1) و تثبیت در دیتابیس
    await prisma.projectKpi.update({
      where: { id: kpi1.id },
      data: { baseline_value: 6 },
    });
    const refreshedKpi1 = await prisma.projectKpi.findUnique({ where: { id: kpi1.id } });
    assert.equal(refreshedKpi1?.baseline_value, 6, "اولین عدد واردشده باید در baseline_value ذخیره شود");

    // ۴. ایجاد شاخص ترکیبی با فرمول ریاضی سفارشی
    const formulaText = "(A * 0.4) + (B * 0.6)";
    const valRes = validateFormula(formulaText, ["A", "B"]);
    assert.equal(valRes.valid, true);

    const composite = await prisma.compositeKpi.create({
      data: {
        project_id: project.id,
        name: "شاخص ترکیبی پیشرفت کل با فرمول وزنی",
        unit: "درصد",
        formula: formulaText,
        operator: "sum",
        items: {
          create: [
            { project_kpi_id: kpi1.id, order_index: 1 },
            { project_kpi_id: kpi2.id, order_index: 2 },
          ],
        },
      },
      include: { items: true },
    });

    assert.equal(composite.formula, formulaText);
    assert.equal(composite.items.length, 2);

    // ۵. تست ارزیابی فرمول با مقادیر دو شاخص (A=10, B=20)
    const evalRes = evaluateFormula(composite.formula, { A: 10, B: 20 });
    assert.equal(evalRes.success, true);
    assert.equal(evalRes.result, 16); // (10 * 0.4) + (20 * 0.6) = 4 + 12 = 16

    // ۶. تست اعتبارسنجی فرمول نامعتبر
    const invalidVal = validateFormula("(A * 0.4) + (C * 0.6)", ["A", "B"]);
    assert.equal(invalidVal.valid, false, "متغیر تعریف‌نشده C باید رد شود");

    // پاکسازی داده‌های تست
    await prisma.project.delete({ where: { id: project.id } });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
});
