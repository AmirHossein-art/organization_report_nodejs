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
      <table
        className="kpi-matrix-table w-full text-right border-collapse border border-slate-300 rounded-lg text-[10.5px] leading-tight font-sans"
        style={{ borderCollapse: "collapse", width: "100%", border: "1px solid #cbd5e1" }}
      >
        <thead>
          <tr
            className="bg-slate-100/90 text-slate-800 font-bold border-b border-slate-300 text-[10px] sm:text-[10.5px]"
            style={{ backgroundColor: "#f1f5f9", color: "#1e293b", borderBottom: "1px solid #cbd5e1" }}
          >
            <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }} className="w-8 text-center">ردیف</th>
            <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }} className="min-w-[110px]">عنوان شاخص</th>
            <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }} className="w-14 text-center">واحد</th>
            <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }} className="w-20 text-center">مبنا</th>
            <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }} className="w-24 text-center">عملکرد دوره</th>
            <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }} className="w-24 text-center">هدف</th>
            <th style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }} className="text-center w-40">
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
                style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}
              >
                {/* ردیف */}
                <td
                  style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}
                  className="text-center text-slate-500 font-medium"
                >
                  {toPersianDigits(idx + 1)}
                </td>

                {/* عنوان شاخص */}
                <td
                  style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}
                  className="font-bold text-slate-900"
                >
                  <span>{kpiName}</span>
                  {kpiMeta?.description && !compactForPrint && (
                    <span className="block text-[9.5px] text-slate-400 font-normal mt-0.5 truncate max-w-[200px]">
                      {kpiMeta.description}
                    </span>
                  )}
                </td>

                {/* واحد */}
                <td
                  style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}
                  className="text-center text-slate-600"
                >
                  {unit}
                </td>

                {/* مبنا */}
                <td
                  style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}
                  className="text-center text-slate-600"
                >
                  {visual.formattedBaseline}
                </td>

                {/* عملکرد این دوره */}
                <td
                  style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}
                  className="text-center font-bold text-slate-900"
                >
                  {kv.not_measured ? (
                    <span className="text-rose-600 font-normal text-[10px]">اندازه‌گیری نشده</span>
                  ) : (
                    <span>{visual.formattedCurrent}</span>
                  )}
                  {visual.formattedGrowth && !kv.not_measured && (
                    <span
                      style={{
                        color: visual.growthPositive ? "#047857" : "#be123c",
                        fontSize: "9px",
                        fontWeight: "bold",
                        display: "block",
                        marginTop: "2px",
                      }}
                    >
                      (رشد: {visual.formattedGrowth})
                    </span>
                  )}
                </td>

                {/* هدف */}
                <td
                  style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}
                  className="text-center text-slate-700"
                >
                  {visual.formattedTarget}
                </td>

                {/* پیشرفت کل و رشد دوره با نوار تفکیک‌شده دو رنگ */}
                <td
                  style={{ border: "1px solid #cbd5e1", padding: "4px 6px" }}
                  className="text-center"
                >
                  {kv.not_measured ? (
                    <div className="flex flex-col items-center justify-center">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded text-[9.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                        style={{
                          backgroundColor: "#fff1f2",
                          color: "#be123c",
                          border: "1px solid #fecdd3",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          display: "inline-block",
                          printColorAdjust: "exact",
                          WebkitPrintColorAdjust: "exact",
                        }}
                      >
                        عدم پایش
                      </span>
                      {kv.missing_reason && (
                        <span className="text-[9px] text-rose-500 mt-0.5 truncate max-w-[130px]">
                          {kv.missing_reason}
                        </span>
                      )}
                    </div>
                  ) : !visual.hasTarget && !visual.isPercentageUnit ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-[10px] text-slate-400 font-medium">فاقد هدف عددی</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap justify-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black border ${visual.badgeClass}`}
                          style={{
                            backgroundColor: visual.totalProgressPercent >= 100 ? "#ecfdf5" : "#f1f5f9",
                            color: visual.totalProgressPercent >= 100 ? "#065f46" : "#0f172a",
                            border: `1px solid ${visual.totalProgressPercent >= 100 ? "#6ee7b7" : "#cbd5e1"}`,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontSize: "9.5px",
                            fontWeight: "bold",
                            display: "inline-block",
                            direction: "ltr",
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
                              backgroundColor: "#ecfdf5",
                              color: "#047857",
                              border: "1px solid #a7f3d0",
                              padding: "1px 4px",
                              borderRadius: "4px",
                              fontSize: "8.5px",
                              fontWeight: "bold",
                              display: "inline-block",
                              direction: "ltr",
                              printColorAdjust: "exact",
                              WebkitPrintColorAdjust: "exact",
                            }}
                          >
                            +{toPersianDigits(visual.rawGrowthValue.toFixed(2))}٪
                          </span>
                        ) : visual.rawGrowthValue === 0 && visual.totalProgressPercent > 0 && visual.totalProgressPercent < 100 ? (
                          <span
                            className="text-[8.5px] text-slate-400 font-medium"
                            style={{
                              color: "#94a3b8",
                              fontSize: "8.5px",
                              display: "inline-block",
                              printColorAdjust: "exact",
                              WebkitPrintColorAdjust: "exact",
                            }}
                          >
                            (بدون رشد)
                          </span>
                        ) : null}
                      </div>

                      {/* نوار پیشرفت تفکیک‌شده: مبنای قبلی + پیشرفت این دوره */}
                      <div
                        className="w-24 sm:w-28 h-2 bg-slate-200 rounded-full overflow-hidden flex"
                        style={{
                          width: "105px",
                          height: "7.5px",
                          backgroundColor: "#e2e8f0",
                          borderRadius: "9999px",
                          overflow: "hidden",
                          display: "flex",
                          margin: "2px auto 0 auto",
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
                              height: "100%",
                              backgroundColor: visual.baselineBarColor || "#475569",
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
                              height: "100%",
                              backgroundColor: visual.growthBarColor || "#10b981",
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
