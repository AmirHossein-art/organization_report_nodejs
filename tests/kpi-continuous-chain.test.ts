import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { computeKpiVisual } from "../src/utils/kpiVisuals";

test("KPI continuous progress chain: baseline 5 -> 7 (+2), 7 -> 10 (+3), 10 -> 12 (+2) in visuals", () => {
  const kpiMeta = {
    name: "پیشرفت فیزیکی احداث پارکینگ",
    unit: "درصد",
    input_type: "direct",
    baseline_value: 5,
    target_value: 100,
    target_direction: "minimum",
  };

  // هفته ۱: مبنا ۵، عملکرد ۷
  const week1Val = { baseline_value: 5, current_value: 7 };
  const vis1 = computeKpiVisual(kpiMeta, week1Val);
  assert.equal(vis1.rawBaselineValue, 5);
  assert.equal(vis1.rawCurrentValue, 7);
  assert.equal(vis1.rawGrowthValue, 2);
  assert.equal(vis1.formattedBaseline.includes("۵"), true);
  assert.equal(vis1.formattedCurrent.includes("۷"), true);
  assert.equal(vis1.formattedGrowth?.includes("۲"), true);

  // هفته ۲: مبنا ۷، عملکرد ۱۰
  const week2Val = { baseline_value: 7, current_value: 10 };
  const vis2 = computeKpiVisual(kpiMeta, week2Val);
  assert.equal(vis2.rawBaselineValue, 7);
  assert.equal(vis2.rawCurrentValue, 10);
  assert.equal(vis2.rawGrowthValue, 3);
  assert.equal(vis2.formattedBaseline.includes("۷"), true);
  assert.equal(vis2.formattedCurrent.includes("۱۰"), true);
  assert.equal(vis2.formattedGrowth?.includes("۳"), true);

  // هفته ۳: مبنا ۱۰، عملکرد ۱۲
  const week3Val = { baseline_value: 10, current_value: 12 };
  const vis3 = computeKpiVisual(kpiMeta, week3Val);
  assert.equal(vis3.rawBaselineValue, 10);
  assert.equal(vis3.rawCurrentValue, 12);
  assert.equal(vis3.rawGrowthValue, 2);
  assert.equal(vis3.formattedBaseline.includes("۱۰"), true);
  assert.equal(vis3.formattedCurrent.includes("۱۲"), true);
  assert.equal(vis3.formattedGrowth?.includes("۲"), true);
});

test("PostgreSQL integration: successive reports chain cumulative KPI values properly", async () => {
  const snapshot = process.env.WBS_TEST_SNAPSHOT;
  if (!snapshot) return;

  const root = path.resolve(snapshot);
  const env = dotenv.parse(fs.readFileSync(path.join(root, "test.env")));
  const url = new URL(env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  const pool = new pg.Pool({ connectionString: url.toString() });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    // ایجاد پروژه تستی و شاخص تستی با مبنای ۵
    const project = await prisma.project.create({
      data: {
        code: `kpi-chain-test-${Date.now()}`,
        title: "پروژه آزمون زنجیره پیشرفت KPI",
        project_type: "weekly",
      },
    });

    const kpi = await prisma.projectKpi.create({
      data: {
        project_id: project.id,
        name: "پیشرفت فیزیکی پارکینگ",
        unit: "درصد",
        input_type: "direct",
        baseline_value: 5,
        target_value: 100,
        target_direction: "minimum",
      },
    });

    const user = await prisma.user.findFirstOrThrow({ where: { role: "manager" } });

    // دوره‌های زمانی فرضی ۳ هفته پیاپی
    const p1 = await prisma.reportPeriod.create({
      data: {
        title: `دوره ۱ زنجیره ${Date.now()}`,
        report_type: "weekly",
        period_start: new Date("2026-10-01"),
        period_end: new Date("2026-10-07"),
        is_open: true,
      },
    });
    const p2 = await prisma.reportPeriod.create({
      data: {
        title: `دوره ۲ زنجیره ${Date.now()}`,
        report_type: "weekly",
        period_start: new Date("2026-10-08"),
        period_end: new Date("2026-10-14"),
        is_open: true,
      },
    });
    const p3 = await prisma.reportPeriod.create({
      data: {
        title: `دوره ۳ زنجیره ${Date.now()}`,
        report_type: "weekly",
        period_start: new Date("2026-10-15"),
        period_end: new Date("2026-10-21"),
        is_open: true,
      },
    });

    // ثبت گزارش هفته ۱: مبنا ۵ ➔ عملکرد ۷
    const r1 = await prisma.report.create({
      data: {
        user_id: user.id,
        user_full_name: user.full_name,
        user_username: user.username,
        project_id: project.id,
        project_title: project.title,
        report_type: "weekly",
        period_id: p1.id,
        period_title: p1.title,
        period_start: p1.period_start,
        period_end: p1.period_end,
        activities_done: "هفته ۱",
        status: "submitted",
        kpiValues: {
          create: [{ project_kpi_id: kpi.id, baseline_value: 5, current_value: 7, calculated_value: 7 }],
        },
      },
      include: { kpiValues: true },
    });
    assert.equal(r1.kpiValues[0].baseline_value, 5);
    assert.equal(r1.kpiValues[0].current_value, 7);

    // ثبت گزارش هفته ۲: مبنا ۷ ➔ عملکرد ۱۰
    const r2 = await prisma.report.create({
      data: {
        user_id: user.id,
        user_full_name: user.full_name,
        user_username: user.username,
        project_id: project.id,
        project_title: project.title,
        report_type: "weekly",
        period_id: p2.id,
        period_title: p2.title,
        period_start: p2.period_start,
        period_end: p2.period_end,
        activities_done: "هفته ۲",
        status: "submitted",
        kpiValues: {
          create: [{ project_kpi_id: kpi.id, baseline_value: 7, current_value: 10, calculated_value: 10 }],
        },
      },
      include: { kpiValues: true },
    });
    assert.equal(r2.kpiValues[0].baseline_value, 7);
    assert.equal(r2.kpiValues[0].current_value, 10);

    // ثبت گزارش هفته ۳: مبنا ۱۰ ➔ عملکرد ۱۲
    const r3 = await prisma.report.create({
      data: {
        user_id: user.id,
        user_full_name: user.full_name,
        user_username: user.username,
        project_id: project.id,
        project_title: project.title,
        report_type: "weekly",
        period_id: p3.id,
        period_title: p3.title,
        period_start: p3.period_start,
        period_end: p3.period_end,
        activities_done: "هفته ۳",
        status: "submitted",
        kpiValues: {
          create: [{ project_kpi_id: kpi.id, baseline_value: 10, current_value: 12, calculated_value: 12 }],
        },
      },
      include: { kpiValues: true },
    });
    assert.equal(r3.kpiValues[0].baseline_value, 10);
    assert.equal(r3.kpiValues[0].current_value, 12);

    // اطمینان از اینکه مقدار مبنای اولیه پروژه در جدول ProjectKpi هنوز همان ۵ اولیه است
    const originalKpi = await prisma.projectKpi.findUniqueOrThrow({ where: { id: kpi.id } });
    assert.equal(originalKpi.baseline_value, 5, "Initial project contract baseline must remain untouched at 5");

    // پاکسازی داده‌های آزمون
    await prisma.report.deleteMany({ where: { project_id: project.id } });
    await prisma.projectKpi.delete({ where: { id: kpi.id } });
    await prisma.project.delete({ where: { id: project.id } });
    await prisma.reportPeriod.deleteMany({ where: { id: { in: [p1.id, p2.id, p3.id] } } });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
});
