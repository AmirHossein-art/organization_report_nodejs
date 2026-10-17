import React from "react";
import { toPersianDigits } from "../dateUtils";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";

export interface KpiInteractiveInputProps {
  kpi: {
    id: number;
    name: string;
    description?: string | null;
    unit: string;
    input_type: "direct" | "percentage_change" | string;
    baseline_value?: number | null;
    target_value?: number | null;
    target_direction: "minimum" | "maximum" | string;
  };
  value: {
    current_value: string | number;
    baseline_value?: string | number;
    not_measured?: boolean;
    missing_reason?: string;
  };
  onChange: (updated: Partial<KpiInteractiveInputProps["value"]>) => void;
}

export const KpiInteractiveInput: React.FC<KpiInteractiveInputProps> = ({
  kpi,
  value,
  onChange,
}) => {
  const disabled = Boolean(value.not_measured);
  const rawBaseline =
    value.baseline_value !== "" && value.baseline_value !== null && value.baseline_value !== undefined
      ? Number(value.baseline_value)
      : kpi.baseline_value !== null && kpi.baseline_value !== undefined
      ? Number(kpi.baseline_value)
      : null;

  const currentNum =
    value.current_value !== "" && value.current_value !== null && value.current_value !== undefined && !isNaN(Number(value.current_value))
      ? Number(value.current_value)
      : null;

  // اولین عددی که در KPI وارد می‌شود به عنوان مبنا در نظر گرفته می‌شود
  const baselineNum = rawBaseline !== null ? rawBaseline : currentNum;
  const isFirstBaselineEntry = rawBaseline === null && currentNum !== null;

  // بررسی کاهش غیرمجاز نسبت به پیشرفت قبلی (فقط وقتی مبنای قبلی وجود دارد)
  // جهت‌آگاه: در شاخص «هرچه کمتر بهتر» حرکت به سمت هدف یعنی کاهش مقدار؛
  // پس ریگرسیون به معنای افزایش مقدار بالاتر از مبناست (برعکس شاخص صعودی).
  const directionIsDecreasing = kpi.target_direction === "maximum";
  const isRegressed =
    !disabled &&
    rawBaseline !== null &&
    currentNum !== null &&
    (directionIsDecreasing ? currentNum > rawBaseline : currentNum < rawBaseline);

  // محاسبه پیش‌نمایش درصد تغییر (برای درصد تغییر)
  let percentageChangePreview: string | null = null;
  if (kpi.input_type === "percentage_change" && !disabled && currentNum !== null) {
    if (isFirstBaselineEntry) {
      percentageChangePreview = "۰٪ (مبنای اولیه)";
    } else if (rawBaseline !== null && rawBaseline !== 0) {
      const pct = ((currentNum - rawBaseline) / rawBaseline) * 100;
      percentageChangePreview = `${toPersianDigits(pct.toFixed(1))}٪`;
    }
  }

  // محاسبه عرض قطعات نوار پیشرفت (0 تا 100)
  const hasTarget = kpi.target_value !== null && kpi.target_value !== undefined;
  const targetNum = hasTarget && Number(kpi.target_value) > 0 ? Number(kpi.target_value) : 100;
  const isPercentageUnit =
    kpi.unit.includes("درصد") || kpi.unit.includes("%") || targetNum === 100;

  let totalPercent = 0;
  let basePercent = 0;

  // پیشرفت جهت‌آگاه: در شاخص «هرچه کمتر بهتر» درصد پیشرفت = مسافت طی‌شده از مبنا به سمت هدف
  if (currentNum !== null) {
    if (isPercentageUnit) {
      totalPercent = Math.max(0, Math.min(100, currentNum));
      basePercent = isFirstBaselineEntry
        ? totalPercent
        : rawBaseline !== null
        ? Math.max(0, Math.min(100, rawBaseline))
        : 0;
    } else if (hasTarget && directionIsDecreasing) {
      const span = Math.abs((rawBaseline ?? currentNum) - targetNum);
      totalPercent = span > 0
        ? Math.max(0, Math.min(100, (((rawBaseline ?? currentNum) - currentNum) / span) * 100))
        : (currentNum <= targetNum ? 100 : 0);
      basePercent = 0; // مبنا نقطه شروع سفر است
    } else {
      totalPercent = Math.max(0, Math.min(100, (currentNum / targetNum) * 100));
      basePercent = isFirstBaselineEntry
        ? totalPercent
        : rawBaseline !== null
        ? Math.max(0, Math.min(100, (rawBaseline / targetNum) * 100))
        : 0;
    }
  } else if (rawBaseline !== null) {
    basePercent = isPercentageUnit
      ? Math.max(0, Math.min(100, rawBaseline))
      : !directionIsDecreasing && hasTarget
      ? Math.max(0, Math.min(100, (rawBaseline / targetNum) * 100))
      : 0;
  }

  basePercent = Math.min(basePercent, totalPercent > 0 ? totalPercent : basePercent);
  const growthPercent = Math.max(0, totalPercent - basePercent);
  // جهت‌آگاه: در شاخص «هرچه کمتر بهتر» رشد = مبنا - مقدار (کاهش مقدار یعنی پیشرفت مثبت)
  const growthRaw =
    currentNum !== null && rawBaseline !== null
      ? (directionIsDecreasing ? rawBaseline - currentNum : currentNum - rawBaseline)
      : null;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200/70 space-y-3 shadow-2xs font-sans">
      {/* هدر شاخص */}
      <div className="flex items-start justify-between gap-2 flex-wrap sm:flex-nowrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="text-sm font-bold text-slate-850">{kpi.name}</h5>
            {/* تگ مفهوم جهت هدف: هرچه کمتر بهتر / هرچه بیشتر بهتر */}
            {directionIsDecreasing ? (
              <span className="flex items-center gap-1 font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 text-[10px]">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>هرچه کمتر بهتر</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-[10px]">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>هرچه بیشتر بهتر</span>
              </span>
            )}
            {rawBaseline !== null ? (
              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 text-[10px]">
                پیشرفت قبلی: {toPersianDigits(rawBaseline)} {kpi.unit}
              </span>
            ) : isFirstBaselineEntry ? (
              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 text-[10px]">
                مبنای پروژه (اولین ثبت): {toPersianDigits(currentNum!)} {kpi.unit}
              </span>
            ) : (
              <span className="font-normal text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 text-[10px]">
                مبنا تعیین نشده (اولین ورودی مبنا خواهد شد)
              </span>
            )}
            {hasTarget && (
              <span className="text-[10px] text-slate-500 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-lg">
                هدف: {toPersianDigits(kpi.target_value!)} {kpi.unit}
              </span>
            )}
          </div>
          {kpi.description && (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {kpi.description}
            </p>
          )}
        </div>

        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-[11px] text-slate-600 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-xl border border-slate-200 transition-colors">
          <input
            type="checkbox"
            checked={disabled}
            onChange={(e) => onChange({ not_measured: e.target.checked })}
            className="w-4 h-4 accent-rose-600 cursor-pointer"
          />
          <span>اندازه‌گیری نشده</span>
        </label>
      </div>

      {disabled ? (
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-medium text-slate-600 block">
            دلیل عدم اندازه‌گیری در این دوره *
          </label>
          <textarea
            value={value.missing_reason || ""}
            onChange={(e) => onChange({ missing_reason: e.target.value })}
            rows={2}
            placeholder="علت عدم اندازه‌گیری یا پایش شاخص در این دوره را شرح دهید..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition-all"
          />
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          <div className={kpi.input_type === "percentage_change" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
            {kpi.input_type === "percentage_change" && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600 block">مقدار مبنا *</label>
                <input
                  type="number"
                  step="any"
                  value={value.baseline_value ?? ""}
                  onChange={(e) => onChange({ baseline_value: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600 focus:bg-white"
                  placeholder="مقدار مبنا"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-600 block">
                {kpi.input_type === "direct" ? "پیشرفت کل تا این دوره *" : "مقدار دوره جاری *"}
              </label>
              <input
                type="number"
                step="any"
                min={baselineNum !== null && !directionIsDecreasing ? baselineNum : undefined}
                max={baselineNum !== null && directionIsDecreasing ? baselineNum : undefined}
                value={value.current_value ?? ""}
                onChange={(e) => onChange({ current_value: e.target.value })}
                className={`w-full border rounded-xl px-3 py-1.5 text-xs focus:outline-none transition-all ${
                  isRegressed
                    ? "bg-rose-50 border-rose-400 text-rose-900 focus:border-rose-600"
                    : "bg-slate-50 border-slate-200 focus:border-emerald-600 focus:bg-white"
                }`}
                placeholder={rawBaseline !== null ? `مثال: ${rawBaseline}` : "اولین ثبت (مبنای پروژه)"}
              />
            </div>
          </div>

          {/* هشدار جلوگیری از حرکت برخلاف جهت هدف (جهت‌آگاه: صعودی = کاهش ممنوع؛ کاهشی = افزایش ممنوع) */}
          {isRegressed && (
            <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                {directionIsDecreasing ? (
                  <>
                    <strong>توجه:</strong> در شاخص «هرچه کمتر بهتر» مقدار جدید نمی‌تواند بیشتر از پیشرفت قبلی ثبت‌شده (
                    {toPersianDigits(baselineNum!)} {kpi.unit}) باشد؛ کاهش مقدار در این شاخص پیشرفت است.
                  </>
                ) : (
                  <>
                    <strong>توجه:</strong> درصد پیشرفت تجمیعی نمی‌تواند کمتر از پیشرفت قبلی ثبت‌شده (
                    {toPersianDigits(baselineNum!)} {kpi.unit}) باشد.
                  </>
                )}
              </span>
            </div>
          )}

          {/* نوار و گیج گرافیکی تعاملی زنده */}
          <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[11px] flex-wrap gap-1">
              <span className="font-bold text-slate-800">
                پیشرفت نهایی:{" "}
                <span
                  className={
                    isRegressed
                      ? "text-rose-600 font-black"
                      : currentNum !== null && currentNum >= targetNum
                      ? "text-emerald-700 font-black"
                      : "text-slate-900 font-black"
                  }
                >
                  {currentNum !== null
                    ? `${toPersianDigits(currentNum.toFixed(2))} ${kpi.unit}`
                    : "—"}
                </span>
              </span>

              {baselineNum !== null && !isRegressed && growthRaw !== null && (
                <span className="text-[11px]">
                  {growthRaw > 0 ? (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {directionIsDecreasing ? "کاهش مثبت (نزدیک‌شدن به هدف): " : "رشد این دوره: "}
                      +{toPersianDigits(growthRaw.toFixed(2))} {kpi.unit}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium">
                      بدون پیشرفت جدید در این دوره
                    </span>
                  )}
                </span>
              )}

              {percentageChangePreview && (
                <span className="text-emerald-700 font-bold text-[11px]">
                  درصد تغییر: {percentageChangePreview}
                </span>
              )}
            </div>

            {/* نوار دو رنگ تفکیک‌شده: مبنا (پیشرفت قبلی) + رشد جدید */}
            <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
              {/* بخش ۱: پیشرفت قبلی */}
              {basePercent > 0 && (
                <div
                  className="h-full bg-slate-600 transition-all duration-300"
                  style={{ width: `${basePercent}%` }}
                  title={`پیشرفت قبلی: ${toPersianDigits(basePercent)}٪`}
                />
              )}
              {/* بخش ۲: رشد این دوره */}
              {growthPercent > 0 && (
                <div
                  className={`h-full transition-all duration-300 ${
                    isRegressed ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${growthPercent}%` }}
                  title={`رشد جدید: +${toPersianDigits(growthPercent)}٪`}
                />
              )}
            </div>

            {/* راهنمای سریع رنگ‌ها */}
            <div className="flex items-center justify-between text-[9.5px] text-slate-500 pt-0.5">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-600 inline-block" />
                <span>پیشرفت قبلی ({toPersianDigits(baselineNum ?? 0)} {kpi.unit})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span>{directionIsDecreasing ? "کاهش مثبت این دوره" : "رشد جدید دوره"}</span>
              </span>
              {hasTarget && (
                <span>
                  هدف ({directionIsDecreasing ? "هرچه کمتر بهتر" : "هرچه بیشتر بهتر"}): {toPersianDigits(kpi.target_value!)} {kpi.unit}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
