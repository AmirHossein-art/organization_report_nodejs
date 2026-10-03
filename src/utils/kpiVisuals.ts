import { toPersianDigits } from "../dateUtils";

export type KpiStatus = "completed" | "in_progress" | "stagnant" | "not_started" | "not_measured";

export interface KpiVisualData {
  totalProgressPercent: number; // 0 to 100
  baselinePercent: number; // 0 to 100 (part 1 of the segmented bar)
  growthPercent: number; // 0 to 100 (part 2 of the segmented bar)
  rawCurrentValue: number | null;
  rawBaselineValue: number | null;
  rawGrowthValue: number | null;
  status: KpiStatus;
  statusLabel: string;
  badgeClass: string;
  baselineBarColor: string;
  growthBarColor: string;
  formattedCurrent: string;
  formattedBaseline: string;
  formattedTarget: string;
  formattedGrowth: string | null;
  growthPositive: boolean | null;
}

interface ComputeKpiParams {
  name?: string;
  unit?: string;
  input_type?: "direct" | "percentage_change" | string;
  target_value?: number | null;
  target_direction?: "minimum" | "maximum" | string;
  baseline_value?: number | null;
  current_value?: number | null;
  calculated_value?: number | null;
  not_measured?: boolean;
  missing_reason?: string | null;
}

/**
 * Calculates cumulative physical progress, segmented bar widths
 * (prior baseline + period growth), and Persian display strings.
 */
export function computeKpiVisual(
  kpiMeta: ComputeKpiParams | null | undefined,
  kpiValue: ComputeKpiParams | null | undefined
): KpiVisualData {
  const isNotMeasured = Boolean(kpiValue?.not_measured);

  if (isNotMeasured) {
    return {
      totalProgressPercent: 0,
      baselinePercent: 0,
      growthPercent: 0,
      rawCurrentValue: null,
      rawBaselineValue: null,
      rawGrowthValue: null,
      status: "not_measured",
      statusLabel: "عدم پایش",
      badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
      baselineBarColor: "#94a3b8",
      growthBarColor: "#fda4af",
      formattedCurrent: "—",
      formattedBaseline: "—",
      formattedTarget: "—",
      formattedGrowth: null,
      growthPositive: null,
    };
  }

  const unit = (kpiMeta?.unit || kpiValue?.unit || "").trim();
  const inputType = kpiMeta?.input_type || kpiValue?.input_type || "direct";
  const targetVal = kpiMeta?.target_value ?? kpiValue?.target_value ?? 100;
  const baselineVal = kpiValue?.baseline_value ?? kpiMeta?.baseline_value ?? null;
  const currentVal = kpiValue?.current_value ?? null;

  let effectiveVal = currentVal;
  if (inputType === "percentage_change") {
    if (kpiValue?.calculated_value !== null && kpiValue?.calculated_value !== undefined) {
      effectiveVal = Number(kpiValue.calculated_value);
    } else if (currentVal !== null && baselineVal !== null && Number(baselineVal) !== 0) {
      effectiveVal = ((Number(currentVal) - Number(baselineVal)) / Number(baselineVal)) * 100;
    }
  }

  const isPercentageUnit =
    unit.includes("درصد") || unit.includes("%") || Number(targetVal) === 100;

  // Format strings
  const formattedBaseline =
    baselineVal !== null && baselineVal !== undefined
      ? `${toPersianDigits(Number(baselineVal).toFixed(2))} ${unit}`
      : "—";

  const formattedTarget =
    targetVal !== null && targetVal !== undefined
      ? `${toPersianDigits(Number(targetVal).toFixed(2))} ${unit}`
      : "—";

  const formattedCurrent =
    effectiveVal !== null && effectiveVal !== undefined
      ? `${toPersianDigits(Number(effectiveVal).toFixed(2))} ${unit}`
      : "—";

  if (effectiveVal === null || effectiveVal === undefined) {
    return {
      totalProgressPercent: 0,
      baselinePercent: 0,
      growthPercent: 0,
      rawCurrentValue: null,
      rawBaselineValue: baselineVal !== null ? Number(baselineVal) : null,
      rawGrowthValue: null,
      status: "not_started",
      statusLabel: "ثبت نشده",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      baselineBarColor: "#64748b",
      growthBarColor: "#10b981",
      formattedCurrent,
      formattedBaseline,
      formattedTarget,
      formattedGrowth: null,
      growthPositive: null,
    };
  }

  const numCurrent = Number(effectiveVal);
  const numBaseline = baselineVal !== null && baselineVal !== undefined ? Number(baselineVal) : 0;
  const numTarget = targetVal !== null && targetVal !== undefined && Number(targetVal) > 0 ? Number(targetVal) : 100;

  // Calculate percentage of journey (0 to 100%)
  let totalProgressPercent = 0;
  let baselinePercent = 0;

  if (isPercentageUnit) {
    totalProgressPercent = Math.max(0, Math.min(100, numCurrent));
    baselinePercent = Math.max(0, Math.min(100, numBaseline));
  } else {
    totalProgressPercent = Math.max(0, Math.min(100, (numCurrent / numTarget) * 100));
    baselinePercent = Math.max(0, Math.min(100, (numBaseline / numTarget) * 100));
  }

  // Ensure baseline does not exceed total
  baselinePercent = Math.min(baselinePercent, totalProgressPercent);
  const growthPercent = Math.max(0, totalProgressPercent - baselinePercent);

  // Growth calculation in raw units
  const rawGrowth = numCurrent - numBaseline;
  const growthPositive = rawGrowth > 0;
  let formattedGrowth: string | null = null;
  if (rawGrowth > 0) {
    formattedGrowth = `+${toPersianDigits(rawGrowth.toFixed(2))} ${unit}`;
  } else if (rawGrowth < 0) {
    formattedGrowth = `${toPersianDigits(rawGrowth.toFixed(2))} ${unit}`;
  } else {
    formattedGrowth = `۰.۰۰ ${unit}`;
  }

  // Status categorization
  let status: KpiStatus = "in_progress";
  let statusLabel = "در حال اجرا";
  let badgeClass = "bg-blue-50 text-blue-800 border-blue-200";

  if (totalProgressPercent >= 100) {
    status = "completed";
    statusLabel = "تکمیل شده";
    badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-300 font-black";
  } else if (totalProgressPercent === 0) {
    status = "not_started";
    statusLabel = "شروع نشده";
    badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
  } else if (rawGrowth === 0) {
    status = "stagnant";
    statusLabel = "بدون رشد دوره";
    badgeClass = "bg-slate-100 text-slate-700 border-slate-300";
  } else {
    status = "in_progress";
    statusLabel = "پیشرفت در دوره";
    badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  return {
    totalProgressPercent: Number(totalProgressPercent.toFixed(2)),
    baselinePercent: Number(baselinePercent.toFixed(2)),
    growthPercent: Number(growthPercent.toFixed(2)),
    rawCurrentValue: numCurrent,
    rawBaselineValue: numBaseline,
    rawGrowthValue: rawGrowth,
    status,
    statusLabel,
    badgeClass,
    baselineBarColor: "#475569", // slate-600: پیشرفت قبلی
    growthBarColor: "#10b981",   // emerald-500: پیشرفت تازه این دوره
    formattedCurrent,
    formattedBaseline,
    formattedTarget,
    formattedGrowth,
    growthPositive,
  };
}
