import { computeKpiVisual } from "../src/utils/kpiVisuals";

const DECREASING_KPI = {
  id: 1,
  name: "تعداد کلیک تا درگاه پرداخت",
  unit: "کلیک",
  input_type: "direct" as const,
  target_value: 3,
  target_direction: "maximum" as const,
};

function runVisual(baseline: number | null, current: number | null, meta = DECREASING_KPI): ReturnType<typeof computeKpiVisual> {
  return computeKpiVisual(
    meta,
    { baseline_value: baseline, current_value: current, calculated_value: current }
  );
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
}

// سناریو ۱: مبنا ۵۰ → عملکرد ۳ (رسیدن به هدف) = ۱۰۰٪ پیشرفت
check(
  "decreasing 50->3 reaches 100% progress",
  runVisual(50, 3).totalProgressPercent,
  100
);

// سناریو ۲: مبنا ۵۰ → عملکرد ۲۰ = (50-20)/(50-3)*100 = 63.83٪
check(
  "decreasing 50->20 ~63.83% progress",
  Number(runVisual(50, 20).totalProgressPercent.toFixed(2)),
  63.83
);

// سناریو ۳: رشد جهت‌آگاه — کاهش مقدار یعنی رشد مثبت
check(
  "decreasing 50->3 growth is positive +47",
  runVisual(50, 3).growthPositive,
  true
);
check(
  "decreasing 50->3 rawGrowth is +47 (baseline - current)",
  runVisual(50, 3).rawGrowthValue,
  47
);

// سناریو ۴: در شاخص کاهشی بالا رفتن مقدار = regression (رشد منفی)
check(
  "decreasing 50->60 marks negative growth (regression signal)",
  runVisual(50, 60).growthPositive,
  false
);

// سناریو ۵: شاخص صعودی عادی رفتار قبلی حفظ شود (هرچه بیشتر بهتر)
const INCREASING_KPI = {
  id: 2,
  name: "پیشرفت فیزیکی پارکینگ",
  unit: "درصد پیشرفت",
  input_type: "direct" as const,
  target_value: 100,
  target_direction: "minimum" as const,
};
check(
  "increasing 5->7 keeps old climb-to-ceiling ratio (7%)",
  runVisual(5, 7, INCREASING_KPI).totalProgressPercent,
  7
);

// سناریو ۵-ب: کاهش در شاخص صعودی عادی (افت عملکرد نسبت به دوره قبل)
const LIQUIDITY_KPI = {
  id: 3,
  name: "درصد نقد شوندگی",
  unit: "درصد",
  input_type: "direct" as const,
  target_value: 100,
  target_direction: "minimum" as const,
};
const dropCheck = computeKpiVisual(LIQUIDITY_KPI, { baseline_value: 6.19, current_value: 3.19, calculated_value: 3.19 });
check("drop 6.19->3.19 flags growthType as negative", dropCheck.growthType, "negative");
check("drop 6.19->3.19 sets growthLabel as کاهش", dropCheck.growthLabel, "کاهش");
check("drop 6.19->3.19 rawGrowthValue is -3", dropCheck.rawGrowthValue, -3);
check("drop 6.19->3.19 status is regressed", dropCheck.status, "regressed");
check("drop 6.19->3.19 statusLabel is کاهش در دوره", dropCheck.statusLabel, "کاهش در دوره");

// سناریو ۶: بافت بدون هدف (باشد بدون پیشرفت) 
const noTarget = runVisual(50, null, DECREASING_KPI);
check(
  "no current value => not_started and 0%",
  [noTarget.totalProgressPercent, noTarget.status],
  [0, "not_started"]
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll direction-aware KPI visual smoke checks passed.");
