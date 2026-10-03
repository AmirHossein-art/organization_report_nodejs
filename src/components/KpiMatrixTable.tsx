import React from "react";
import { toPersianDigits } from "../dateUtils";
import { computeKpiVisual } from "../utils/kpiVisuals";

export interface KpiMatrixTableProps {
  kpiValues?: Array<any> | null;
  kpiMap?: Record<number, any>;
  kpiText?: string | null;
  compactForPrint?: boolean;
}

export const KpiMatrixTable: React.FC<KpiMatrixTableProps> = ({
  kpiValues,
  kpiMap = {},
  kpiText,
  compactForPrint = false,
}) => {
  const hasStructuredKpis = Array.isArray(kpiValues) && kpiValues.length > 0;

  if (!hasStructuredKpis && (!kpiText || !kpiText.trim())) {
    return (
      <div className="text-[11px] text-slate-500 py-1 italic">
        شاخص عملکردی برای این پروژه در این دوره ثبت نشده است.
      </div>
    );
  }

  if (!hasStructuredKpis && kpiText && kpiText.trim()) {
    return (
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
        <span className="font-bold">شاخص‌های متنی (دوره پیشین): </span>
        <span>{kpiText.trim()}</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto w-full my-1.5">
      <table className="w-full text-right border-collapse border border-slate-300 rounded-lg text-[10.5px] leading-tight font-sans">
        <thead>
          <tr className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300 text-[10px] sm:text-[10.5px]">
            <th className="py-1.5 px-2 border-l border-slate-300 w-8 text-center">ردیف</th>
            <th className="py-1.5 px-2 border-l border-slate-300 min-w-[110px]">عنوان شاخص</th>
            <th className="py-1.5 px-2 border-l border-slate-300 w-14 text-center">واحد</th>
            <th className="py-1.5 px-2 border-l border-slate-300 w-20 text-center">مبنا</th>
            <th className="py-1.5 px-2 border-l border-slate-300 w-24 text-center">عملکرد دوره</th>
            <th className="py-1.5 px-2 border-l border-slate-300 w-24 text-center">هدف</th>
            <th className="py-1.5 px-2 text-center w-40">
              <span className="block">پیشرفت کل پروژه</span>
              <span className="block text-[8px] font-medium text-slate-500 mt-0.5">
                <span className="text-slate-600 font-bold">■</span> قبلی | <span className="text-emerald-600 font-bold">■</span> رشد دوره
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {kpiValues!.map((kv, idx) => {
            const kpiMeta = kv.name ? kv : (kpiMap[kv.project_kpi_id] || kv);
            const visual = computeKpiVisual(kpiMeta, kv);
            const kpiName = kpiMeta?.name || "شاخص";
            const unit = (kpiMeta?.unit || "—").trim();

            return (
              <tr
                key={kv.id || idx}
                className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}
              >
                {/* ردیف */}
                <td className="py-1.5 px-2 border-l border-slate-200 text-center text-slate-500 font-medium">
                  {toPersianDigits(idx + 1)}
                </td>

                {/* عنوان شاخص */}
                <td className="py-1.5 px-2 border-l border-slate-200 font-bold text-slate-900">
                  <span>{kpiName}</span>
                  {kpiMeta?.description && !compactForPrint && (
                    <span className="block text-[9.5px] text-slate-400 font-normal mt-0.5 truncate max-w-[200px]">
                      {kpiMeta.description}
                    </span>
                  )}
                </td>

                {/* واحد */}
                <td className="py-1.5 px-2 border-l border-slate-200 text-center text-slate-600">
                  {unit}
                </td>

                {/* مبنا */}
                <td className="py-1.5 px-2 border-l border-slate-200 text-center text-slate-600">
                  {visual.formattedBaseline}
                </td>

                {/* عملکرد این دوره */}
                <td className="py-1.5 px-2 border-l border-slate-200 text-center font-bold text-slate-900">
                  {kv.not_measured ? (
                    <span className="text-rose-600 font-normal text-[10px]">اندازه‌گیری نشده</span>
                  ) : (
                    <span>{visual.formattedCurrent}</span>
                  )}
                  {visual.formattedGrowth && !kv.not_measured && (
                    <span
                      className={`block text-[9px] font-medium mt-0.5 ${
                        visual.growthPositive ? "text-emerald-700" : "text-rose-600"
                      }`}
                    >
                      (رشد: {visual.formattedGrowth})
                    </span>
                  )}
                </td>

                {/* هدف */}
                <td className="py-1.5 px-2 border-l border-slate-200 text-center text-slate-700">
                  {visual.formattedTarget}
                </td>

                {/* پیشرفت کل و رشد دوره با نوار تفکیک‌شده دو رنگ */}
                <td className="py-1.5 px-2 text-center">
                  {kv.not_measured ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        عدم پایش
                      </span>
                      {kv.missing_reason && (
                        <span className="text-[9px] text-rose-500 mt-0.5 truncate max-w-[130px]">
                          {kv.missing_reason}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black border ${visual.badgeClass}`}
                          style={{
                            printColorAdjust: "exact",
                            WebkitPrintColorAdjust: "exact",
                          }}
                        >
                          {toPersianDigits(visual.totalProgressPercent.toFixed(2))}٪
                        </span>
                        {visual.rawGrowthValue !== null && visual.rawGrowthValue > 0 ? (
                          <span
                            className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200"
                            style={{
                              printColorAdjust: "exact",
                              WebkitPrintColorAdjust: "exact",
                            }}
                          >
                            +{toPersianDigits(visual.rawGrowthValue.toFixed(2))}٪
                          </span>
                        ) : visual.rawGrowthValue === 0 && visual.totalProgressPercent > 0 && visual.totalProgressPercent < 100 ? (
                          <span className="text-[8.5px] text-slate-400 font-medium">
                            (بدون رشد)
                          </span>
                        ) : null}
                      </div>

                      {/* نوار پیشرفت تفکیک‌شده: مبنای قبلی + پیشرفت این دوره */}
                      <div
                        className="w-24 sm:w-28 h-2 bg-slate-200 rounded-full overflow-hidden flex"
                        style={{
                          printColorAdjust: "exact",
                          WebkitPrintColorAdjust: "exact",
                        }}
                      >
                        {/* بخش ۱: پیشرفت گزارش‌های قبلی (مبنا) */}
                        {visual.baselinePercent > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${visual.baselinePercent}%`,
                              backgroundColor: visual.baselineBarColor,
                              printColorAdjust: "exact",
                              WebkitPrintColorAdjust: "exact",
                            }}
                            title={`پیشرفت قبلی: ${toPersianDigits(visual.baselinePercent)}٪`}
                          />
                        )}
                        {/* بخش ۲: پیشرفت اضافه شده در این گزارش (رشد) */}
                        {visual.growthPercent > 0 && (
                          <div
                            className="h-full"
                            style={{
                              width: `${visual.growthPercent}%`,
                              backgroundColor: visual.growthBarColor,
                              printColorAdjust: "exact",
                              WebkitPrintColorAdjust: "exact",
                            }}
                            title={`پیشرفت این دوره: +${toPersianDigits(visual.growthPercent)}٪`}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
