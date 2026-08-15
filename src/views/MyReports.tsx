// src/views/MyReports.tsx
import { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  FileText, 
  TrendingUp, 
  Clock, 
  X, 
  ShieldCheck, 
  Target, 
  Cpu, 
  Search,
  User as UserIcon,
  Calendar,
  CheckSquare,
  Square,
  Crown,
  FileCheck2,
  Printer
} from "lucide-react";
import { User, Report, Project, ReportPeriod } from "../types";
import { CustomSelect, ShamsiDatePicker } from "../components";

import ProjectBubbleNode from "../components/ProjectBubbleNode";
import ProjectNextActionsModal, { NextActionItem } from "../components/ProjectNextActionsDrawer";
import Projects3DExplorer from "../components/projects-3d/Projects3DExplorer";
import ReportsPdfDocument from "../components/ReportsPdfDocument";

// 🌐 تابع کمکی تبدیل اعداد انگلیسی به فارسی
export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

const formatPersianDate = (
  value: string | null | undefined,
): string => {
  if (!value) return "بدون تاریخ مشخص";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date);
};

// محاسبه تاریخ ددلاین ویرایش گزارش (مطابق منطق سمت سرور در server.ts)
function getEditDeadlineDate(periodEnd: string, deadlineDay: number, deadlineTime: string, reportType: "weekly" | "monthly"): Date {
  const deadlineDate = new Date(periodEnd + "T00:00:00");
  if (reportType === "weekly") {
    deadlineDate.setDate(deadlineDate.getDate() + 1);
    while (deadlineDate.getDay() !== deadlineDay) {
      deadlineDate.setDate(deadlineDate.getDate() + 1);
    }
  } else {
    if (deadlineDay <= deadlineDate.getDate()) {
      deadlineDate.setMonth(deadlineDate.getMonth() + 1);
    }
    deadlineDate.setDate(deadlineDay);
  }
  const [hours, minutes] = deadlineTime.split(":").map(Number);
  deadlineDate.setHours(hours || 0, minutes || 0, 0, 0);
  return deadlineDate;
}

interface MyReportsProps {
  currentUser?: User;
  user?: User;
  reports?: Report[];
  allReports?: Report[];
  projects?: Project[];
  periods?: ReportPeriod[];
  onRefresh?: () => void;
}

interface SingleReportAuditResult {
  executive_summary: string;
  kpis_evaluation: Array<{
    kpi_name: string;
    previous_value: string;
    current_value: string;
    has_kpi: boolean;
  }>;
  recommendations: string[];
  future_actions_with_deadlines: Array<{
    action: string;
    deadline: string;
  }>;
  repetitiveness_assessment: {
    similarity_percentage: number;
    is_duplicate_risk: boolean;
    analysis_details: string;
  };
  strategic_alignment: {
    is_aligned: boolean;
    value_creation: string;
    wbs_matching_task: string;
    alignment_analysis: string;
  };
}

// =================================================================
// 📄 ۱. مودال مشاهده متن کامل و اصلی گزارش خام پرسنل
// =================================================================
function RawReportDetailsModal({
  report,
  kpiMap,
  isOpen,
  onClose,
  onRunAudit,
  showAiAudit = false,
  onToggleActionStatus,
}: {
  report: any | null;
  kpiMap: Record<number, any>;
  isOpen: boolean;
  onClose: () => void;
  onRunAudit: (rep: any) => void;
  showAiAudit?: boolean;
  onToggleActionStatus?: (actionId: number, currentStatus: boolean) => void;
}) {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in dir-rtl font-sans">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* هدر مودال */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-emerald-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-white">
                شرح گزارش عملکرد ثبت‌شده
              </h3>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                {report.user_full_name || report.user_username} — {report.project_title}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه اطلاعات خام گزارش */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/60 text-right">
          
          {/* مشخصات ثبت */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs text-xs">
            <div className="space-y-1">
              <span className="text-slate-400 block flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5" /> نویسنده:
              </span>
              <strong className="text-slate-800 block">{report.user_full_name || report.user_username}</strong>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 block flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> بازه زمان‌بندی:
              </span>
              <strong className="text-emerald-700 block">{toPersianDigits(report.period_title)}</strong>
            </div>

            <div className="space-y-1">
              <span className="text-slate-400 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> تاریخ ثبت:
              </span>
              <strong className="text-slate-700 block">
                {formatPersianDate(report.submitted_at)}
              </strong>
            </div>
          </div>

          {/* فعالیت‌های انجام‌شده */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <CheckSquare className="w-4 h-4 text-emerald-600" />
              فعالیت‌ها و اقدامات انجام‌شده
            </h4>
            <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line pt-1">
              {report.activities_done || "متنی برای فعالیت‌ها ثبت نشده است."}
            </p>
          </div>

          {/* نتایج و اقدامات تحقق‌یافته */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              نتایج و اقدامات تحقق‌یافته این دوره
            </h4>

            {report.achievedActions && report.achievedActions.length > 0 ? (
              <div className="space-y-2">
                {report.achievedActions.map((act: any) => {
                  const isManager = act.created_by_role === "manager";
                  const isVerified = act.is_completed;

                  return (
                    <div
                      key={act.id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-all ${
                        isVerified
                          ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                          : "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                      }`}
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${isVerified ? "text-emerald-600" : "text-indigo-600"}`} />
                          <span className="font-bold">{act.action_text}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] pr-6">
                          {isManager ? (
                            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-bold">
                              <Crown className="w-2.5 h-2.5" />
                              ابلاغیه مدیر
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">اقدام قبلی پرسنل</span>
                          )}

                          {act.target_date && (
                            <span className="text-slate-500 font-sans">
                              📅 سررسید: {formatPersianDate(act.target_date)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isVerified ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                        }`}>
                          {isVerified ? "تایید شده توسط مدیر" : "اعلام پرسنل (در انتظار تایید)"}
                        </span>

                        {onToggleActionStatus && (
                          <button
                            type="button"
                            onClick={() => onToggleActionStatus(act.id, act.is_completed)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[10px] font-bold text-slate-800 transition-all cursor-pointer shadow-2xs"
                          >
                            {isVerified ? "لغو تایید" : "تایید صحت"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : report.results_achieved ? (
              <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line pt-1">
                {report.results_achieved}
              </p>
            ) : (
              <p className="text-xs text-slate-400">نتیجه یا اقدامی برای این دوره ثبت نشده است.</p>
            )}

            {/* در صورتی که هم اقدامات ساختاریافته وجود داشت و هم متن تکمیلی */}
            {report.achievedActions && report.achievedActions.length > 0 && report.results_achieved && !report.results_achieved.startsWith("•") && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-600">
                <span className="font-bold text-slate-700">توضیحات تکمیلی: </span>
                <span>{report.results_achieved}</span>
              </div>
            )}
          </div>

          {/* شاخص‌های ساختاریافته (Structured KPIs) */}
          {report.kpiValues && report.kpiValues.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <Target className="w-4 h-4 text-emerald-600" />
                شاخص‌های عملکرد ساختاریافته
              </h4>
              <div className="space-y-2">
                {report.kpiValues.map((kv: any) => {
                  const kpiMeta = kpiMap?.[kv.project_kpi_id];
                  if (kv.not_measured) {
                    return (
                      <div key={kv.id} className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs">
                        <p className="font-bold text-slate-800">{kpiMeta?.name || "شاخص"}</p>
                        <p className="text-rose-600 mt-0.5">اندازه‌گیری نشده — {kv.missing_reason || "دلیل ثبت نشده"}</p>
                      </div>
                    );
                  }
                  return (
                    <div key={kv.id} className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs flex flex-col gap-0.5">
                      <p className="font-bold text-slate-800">{kpiMeta?.name || "شاخص"}</p>
                      {kpiMeta?.input_type === "percentage_change" ? (
                        <p className="text-slate-600">
                          مبنا: {toPersianDigits(Number(kv.baseline_value).toFixed(2))}، دوره جاری: {toPersianDigits(Number(kv.current_value).toFixed(2))}
                          {" → "}درصد تغییر: <strong className="text-emerald-700">{toPersianDigits(Number(kv.calculated_value).toFixed(1))}٪</strong>
                        </p>
                      ) : (
                        <p className="text-slate-600">
                          مقدار این دوره: <strong className="text-emerald-700">{toPersianDigits(Number(kv.current_value).toFixed(2))} {kpiMeta?.unit || ""}</strong>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* شاخص‌های متنی قدیمی (Legacy kpi_text) */}
          {report.kpi_text && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <Target className="w-4 h-4 text-amber-600" />
                شاخص‌های کلیدی عملکرد (متن آزاد - گزارش‌های قدیمی)
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed pt-1">
                {toPersianDigits(report.kpi_text)}
              </p>
            </div>
          )}

          {/* اقدامات آتی */}
          {report.nextActions && report.nextActions.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
              <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <Clock className="w-4 h-4 text-indigo-600" />
                اقدامات آتی و برنامه‌های دور بعد
              </h4>
              <div className="space-y-2">
                {report.nextActions.map((act: any, i: number) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                    <span className="text-slate-800 font-medium">{act.title || act.action_text}</span>
                    {act.target_date && (
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-[10px]">
                         📅{" "}{act.target_date ? formatPersianDate(act.target_date): act.target_date_raw || "بدون تاریخ مشخص"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* فوتر */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            بستن
          </button>

          {showAiAudit && (
            <button
              onClick={() => {
                onClose();
                onRunAudit(report);
              }}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>اجرای ممیزی هوشمند WBS با AI</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// =================================================================
// 🏛️ ۲. مودال متمرکز ممیزی WBS با هوش مصنوعی
// =================================================================
function SingleReportAuditModal({
  reportId,
  reportTitle,
  isOpen,
  onClose,
}: {
  reportId: number | null;
  reportTitle: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [auditData, setAuditData] = useState<SingleReportAuditResult | null>(null);
  const [modelUsed, setModelUsed] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isOpen && reportId) {
      const runSingleReportAudit = async () => {
        setLoading(true);
        setError("");
        setAuditData(null);
        try {
          const res = await fetch("/api/reports/analyze-single", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ report_id: reportId }),
          });
          const data = await res.json();
          if (res.ok) {
            setAuditData(data.analysis);
            setModelUsed(data.model_used || "موتور هوش مصنوعی");
          } else {
            setError(data.error || "خطا در ارزیابی گزارش.");
          }
        } catch (err) {
          setError("ارتباط با سرور برقرار نشد.");
        } finally {
          setLoading(false);
        }
      };
      runSingleReportAudit();
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in dir-rtl font-sans">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* هدر مودال */}
        <div className="p-5 md:p-6 bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 text-white flex items-center justify-between border-b border-emerald-800/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-emerald-50">ممیزی استراتژیک و تطابق WBS</h3>
              <p className="text-xs text-amber-300/90 mt-0.5 font-medium">{reportTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه محتوای ممیزی */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/60 text-right">
          {loading && (
            <div className="py-20 text-center space-y-4">
              <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-800">در حال ممیزی هوشمند و انطباق با سند WBS...</p>
              <p className="text-xs text-slate-400">استخراج شاخص‌ها، تحلیل اصالت و میزان خلق فایده</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {auditData && (
            <div className="space-y-6">
              {modelUsed && (
                <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 text-xs text-slate-700 shadow-2xs">
                  <span className="flex items-center gap-2 font-medium">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    موتور پردازشگر ممیزی: <strong className="text-emerald-900">{modelUsed}</strong>
                  </span>
                  <span className="text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200 text-[11px] font-bold">
                    ارزیابی فعال
                  </span>
                </div>
              )}

              {/* ۱. شباهت‌سنجی */}
              <div className={`p-5 rounded-2xl border transition-all ${
                auditData.repetitiveness_assessment?.is_duplicate_risk 
                  ? "bg-rose-50/90 border-rose-200 text-rose-950" 
                  : "bg-emerald-50/90 border-emerald-200 text-emerald-950"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-sm flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-700" />
                    سنجش اصالت و شباهت‌سنجی متنی گزارش
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    auditData.repetitiveness_assessment?.is_duplicate_risk 
                      ? "bg-rose-200 text-rose-900" 
                      : "bg-emerald-200 text-emerald-900"
                  }`}>
                    {toPersianDigits(auditData.repetitiveness_assessment?.similarity_percentage || 0)}٪ شباهت به سابقه
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90 mt-2">
                  {auditData.repetitiveness_assessment?.analysis_details}
                </p>
              </div>

              {/* ۲. تطابق WBS */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Target className="w-5 h-5 text-emerald-600" />
                    تطابق استراتژیک با WBS مرجع پروژه
                  </span>
                  <span className="bg-amber-50 text-amber-900 px-3 py-1 rounded-xl text-xs border border-amber-200 font-bold">
                    میزان خلق فایده: {auditData.strategic_alignment?.value_creation || "نامشخص"}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {auditData.strategic_alignment?.alignment_analysis}
                </p>
                <div className="text-xs bg-emerald-50/50 p-3 rounded-xl text-emerald-900 border border-emerald-100 font-medium">
                  📍 بسته کاری مرتبط: <strong>{auditData.strategic_alignment?.wbs_matching_task || "ثبت نشده"}</strong>
                </div>
              </div>

              {/* ۳. خلاصه مدیریتی */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FileText className="w-5 h-5 text-amber-500" />
                  خلاصه مدیریتی اقدامات
                </h4>
                <p className="text-xs text-slate-700 leading-relaxed pt-1">
                  {auditData.executive_summary}
                </p>
              </div>

              {/* ۴. جدول شاخص‌ها */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                  پایش و مقایسه شاخص‌های کلیدی عملکرد (KPIs)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-100">
                        <th className="p-3">عنوان شاخص</th>
                        <th className="p-3">سابقه قبلی</th>
                        <th className="p-3">مقدار فعلی</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(auditData.kpis_evaluation || []).map((kpi, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{kpi.kpi_name}</td>
                          <td className="p-3 text-slate-500">{toPersianDigits(kpi.previous_value)}</td>
                          <td className="p-3 font-bold text-emerald-700">
                            {kpi.has_kpi ? toPersianDigits(kpi.current_value) : <span className="text-rose-500">فاقد شاخص</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ۵. ددلاین‌ها */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  برنامه اقدامات آتی و مهلت‌های زمانی (Deadlines)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(auditData.future_actions_with_deadlines || []).map((act, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl text-xs border border-slate-200/80">
                      <span className="text-slate-800 font-medium">{act.action}</span>
                      <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0">
                        📅 {toPersianDigits(act.deadline)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ۶. پیشنهادات AI */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  پیشنهادات و اقدامات اصلاحی هوش مصنوعی
                </h4>
                <ul className="space-y-2">
                  {(auditData.recommendations || []).map((rec, i) => (
                    <li key={i} className="text-xs text-slate-700 flex items-start gap-2 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 leading-relaxed">
                      <span className="w-2 h-2 bg-emerald-600 rounded-full mt-1.5 shrink-0"></span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 🚀 ۳. کاوشگر دیداری مدیر (Visual Explorer)
// =================================================================

function ManagerVisualBubbleExplorer() {
  const [projectClusters, setProjectClusters] = useState<any[]>([]);
  const [nextActions, setNextActions] = useState<NextActionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // استیت‌های لایه‌بندی
  const [activeProjectLayer, setActiveProjectLayer] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDeputy, setSelectedDeputy] = useState<string>("");
  const [explorerMode, setExplorerMode] = useState<"2d" | "3d">("2d");

  // استیت مودال‌ها
  const [rawModalOpen, setRawModalOpen] = useState<boolean>(false);
  const [selectedRawReport, setSelectedRawReport] = useState<any | null>(null);

  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [selectedAuditReport, setSelectedAuditReport] = useState<{ id: number; title: string } | null>(null);

  const [actionsModalOpen, setActionsModalOpen] = useState<boolean>(false);
  const [selectedProjectForActions, setSelectedProjectForActions] = useState<Project | null>(null);

  const [kpiMap, setKpiMap] = useState<Record<number, any>>({});

  // استیت‌های خروجی PDF
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);
  const [rawReports, setRawReports] = useState<Report[]>([]);
  const [periodsList, setPeriodsList] = useState<ReportPeriod[]>([]);
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);

  // استخراج لیست یکتای نام معاونت‌ها
  const deputyOptions = useMemo(() => {
    const set = new Set<string>();
    (usersList || []).filter((u) => u.role === "user" && u.job_title).forEach((u) => {
      if (u.job_title && u.job_title.trim()) set.add(u.job_title.trim());
    });
    return Array.from(set);
  }, [usersList]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, repRes, actionsRes, periodsRes, usersRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/reports"),
        fetch("/api/next-actions"),
        fetch("/api/report-periods"),
        fetch("/api/users"),
      ]);

      const fetchedProjects = projRes.ok ? await projRes.json() : [];
      const fetchedReports = repRes.ok ? await repRes.json() : [];
      const fetchedNextActions = actionsRes.ok ? await actionsRes.json() : [];
      const fetchedPeriods = periodsRes.ok ? await periodsRes.json() : [];
      const fetchedUsers = usersRes.ok ? await usersRes.json() : [];

      setProjectsList(fetchedProjects);
      setRawReports(fetchedReports);
      setNextActions(fetchedNextActions);
      setPeriodsList(fetchedPeriods);
      setUsersList(fetchedUsers);

      const combined = (fetchedProjects || []).map((p: any) => {
        const matchingReports = (fetchedReports || []).filter(
          (r: any) => r.project_id === p.id || r.project_title === p.title
        );
        return {
          ...p,
          project_title: p.title,
          reports: matchingReports,
        };
      });

      setProjectClusters(combined);

      const kpiRes = await fetch("/api/project-kpis");
      if (kpiRes.ok) {
        const kpiData: any[] = await kpiRes.json();
        const map: Record<number, any> = {};
        (Array.isArray(kpiData) ? kpiData : []).forEach((k) => { map[k.id] = k; });
        setKpiMap(map);
      }
    } catch (err) {
      console.error("Error fetching visual data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActionStatus = async (actionId: number, currentStatus: boolean, resetClaim?: boolean) => {
    try {
      const res = await fetch(`/api/next-actions/${actionId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_completed: resetClaim ? false : !currentStatus,
          reset_claim: resetClaim || false,
        }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      alert("خطا در به‌روزرسانی وضعیت اقدام.");
    }
  };

  const filteredProjects = useMemo(() => {
    return projectClusters.filter((p: any) => {
      const matchesSearch =
        (p.project_title || "").includes(searchQuery) ||
        (p.code || "").includes(searchQuery);
      if (!matchesSearch) return false;

      if (selectedDeputy) {
        // فیلتر بر اساس نام معاونت
        const hasDeputyReport = (p.reports || []).some((r: any) => {
          const user = (usersList || []).find((u) => u.id === r.user_id);
          const dep = r.deputy_name || r.user_job_title || user?.job_title;
          return dep === selectedDeputy;
        });
        return hasDeputyReport;
      }
      return true;
    });
  }, [projectClusters, searchQuery, selectedDeputy, usersList]);

  const handleOpenAiAudit = (rep: any) => {
    setSelectedAuditReport({
      id: rep.id,
      title: `گزارش ${rep.user_full_name || rep.user_username} - ${rep.project_title}`,
    });
    setAuditModalOpen(true);
  };

  const handleOpenProjectActionsModal = (proj: any) => {
    setSelectedProjectForActions(proj as Project);
    setActionsModalOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in text-right dir-rtl font-sans">
      
      <style>{`
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        .bubble-floating {
          animation: gentleFloat 4s ease-in-out infinite;
        }
      `}</style>

      {/* هدر کاوشگر */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-500" />
            <span>کاوشگر دیداری تمامی پروژه‌ها</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            مشاهده گزارش‌های خام با کلیک روی دکمه داخلی، و ممیزی مستقیم WBS با دکمه طلایی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setPdfModalOpen(true)}
            className="bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-600/40 whitespace-nowrap shrink-0"
            title="صدور نسخه رسمی PDF از تمامی گزارش‌ها"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            <span>خروجی PDF تمام گزارش‌ها</span>
          </button>

          {activeProjectLayer ? (
            <button
              onClick={() => setActiveProjectLayer(null)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              <span>بازگشت به نمای تمام پروژه‌ها</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-1 md:flex-initial">
              {/* فیلتر معاونت */}
              <div className="w-44 sm:w-52">
                <CustomSelect
                  value={selectedDeputy}
                  onChange={(v) => setSelectedDeputy(String(v))}
                  options={[
                    { value: "", label: "همه معاونت‌ها" },
                    ...deputyOptions.map((dep) => ({ value: dep, label: dep })),
                  ]}
                />
              </div>

              <div className="relative w-full md:w-60">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="جستجوی پروژه‌ها..."
                  className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-2xl px-3.5 py-2.5 pr-9 focus:outline-none focus:border-emerald-600 transition-colors"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>
          )}
        </div>
      </div>

      {!activeProjectLayer && (
        <div className="flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-xs">
            <button
              type="button"
              onClick={() =>
                setExplorerMode("2d")
              }
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                explorerMode === "2d"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              نمای دوبعدی
            </button>

            <button
              type="button"
              onClick={() =>
                setExplorerMode("3d")
              }
              className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                explorerMode === "3d"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              }`}
            >
              نمای سه‌بعدی
            </button>
          </div>
        </div>
      )}
      

      {/* 🌟 بوم اصلی کاوشگر با کنترل سرریز (Overflow Protection) */}
      {explorerMode === "3d" &&
      !activeProjectLayer ? (
        <Projects3DExplorer
          projects={filteredProjects}
          nextActions={nextActions}
          onOpenActions={
            handleOpenProjectActionsModal
          }
          onOpenReports={(project) =>
            setActiveProjectLayer(project)
          }
        />
      ) : (
      <div className="bg-slate-50/80 rounded-3xl p-6 md:p-10 border border-slate-200/90 relative min-h-[480px] overflow-visible flex items-center justify-center shadow-inner">
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-40 rounded-3xl pointer-events-none"></div>

        {loading ? (
          <div className="text-center text-slate-500 text-xs flex items-center justify-center gap-2 z-10">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span>در حال دریافت و ساخت منظومه دیداری پروژه‌ها و سیارک‌ها...</span>
          </div>
        ) : !activeProjectLayer ? (
          
          /* 🌟 لایه ۱: چیدمان متوازن با گپ مناسب و امکان اسکرول عمودی بدون برش حباب‌ها */
          <div className="relative z-10 w-full flex flex-wrap items-center justify-center gap-x-12 gap-y-16 py-8 max-h-[72vh] overflow-y-auto px-4">
            {filteredProjects.length === 0 ? (
              <div className="text-slate-400 text-xs text-center">هیچ پروژه‌ای تعریف نشده است.</div>
            ) : (
              filteredProjects.map((proj: any) => {
                const projActions = nextActions.filter((a) => a.project?.id === proj.id);
                const hasLate = proj.reports.some((r: any) => r.status === "late");

                return (
                  <ProjectBubbleNode
                    key={proj.id}
                    project={proj as Project}
                    actions={projActions}
                    reportsCount={proj.reports.length}
                    hasLateReports={hasLate}
                    onOpenModal={() => handleOpenProjectActionsModal(proj)}
                    onOpenReportsLayer={() => setActiveProjectLayer(proj)}
                  />
                );
              })
            )}
          </div>

        ) : (

          /* 🌟 لایه ۲: گزارش‌های یک پروژه */
          <div className="relative z-10 w-full flex flex-wrap items-center justify-center gap-8 md:gap-12 pt-28 pb-10 px-4 overflow-visible">
            {activeProjectLayer.reports.length === 0 ? (
              <div className="text-slate-600 text-xs text-center bg-white p-8 rounded-3xl border border-slate-200 shadow-xs space-y-2">
                <p className="font-bold text-slate-800">هیچ گزارشی برای پروژه «{activeProjectLayer.project_title}» ثبت نشده است.</p>
                <p className="text-slate-400 text-[11px]">پرسنل تخصیص‌یافته هنوز گزارشی ارسال نکرده‌اند.</p>
              </div>
            ) : (
              activeProjectLayer.reports.map((rep: any, idx: number) => {
                const isLate = rep.status === "late";
                const bubbleColor = isLate
                  ? "from-amber-500 to-amber-700 shadow-amber-500/30 border-amber-300"
                  : "from-emerald-500 to-teal-700 shadow-emerald-500/30 border-emerald-300";

                return (
                  <div key={idx} className="group relative flex flex-col items-center">
                    
                    <div className="absolute bottom-full mb-3 right-1/2 translate-x-1/2 w-72 bg-white text-slate-800 p-4 rounded-2xl shadow-2xl border border-slate-200/90 text-xs opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-50 space-y-2 backdrop-blur-md dir-rtl">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="font-extrabold text-emerald-800">{rep.user_full_name || rep.user_username}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                          {rep.period_title}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-4 leading-relaxed">
                        <strong>خلاصه فعالیت:</strong> {rep.activities_done}
                      </p>
                    </div>

                    <div
                      onClick={() => {
                        setSelectedRawReport(rep);
                        setRawModalOpen(true);
                      }}
                      style={{
                        animationDelay: `${(idx % 4) * 0.5}s`,
                        animationDuration: `${3.5 + (idx % 3) * 0.5}s`
                      }}
                      className={`bubble-floating w-40 h-40 md:w-44 md:h-44 rounded-full bg-gradient-to-br ${bubbleColor} border-3 shadow-xl flex flex-col items-center justify-center text-center p-3 text-white transition-all duration-300 transform group-hover:scale-105 cursor-pointer relative select-none`}
                    >
                      <span className="font-black text-xs md:text-sm line-clamp-1">{rep.user_full_name || rep.user_username}</span>
                      <span className="text-[10px] opacity-90 mt-1 font-medium">
                        {toPersianDigits(rep.period_title)}
                      </span>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAiAudit(rep);
                        }}
                        className="mt-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1 rounded-full text-[10px] transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer border border-amber-300/40"
                        title="ارزیابی و انطباق WBS با هوش مصنوعی"
                      >
                        <Sparkles className="w-3 h-3 text-slate-950" />
                        <span>ممیزی WBS</span>
                      </button>

                    </div>

                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      )}
      <RawReportDetailsModal
        report={selectedRawReport}
        kpiMap={kpiMap}
        isOpen={rawModalOpen}
        onClose={() => setRawModalOpen(false)}
        onRunAudit={handleOpenAiAudit}
        showAiAudit={true}
        onToggleActionStatus={handleToggleActionStatus}
      />

      <SingleReportAuditModal
        reportId={selectedAuditReport?.id || null}
        reportTitle={selectedAuditReport?.title || ""}
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
      />

      <ProjectNextActionsModal
        isOpen={actionsModalOpen}
        onClose={() => setActionsModalOpen(false)}
        project={selectedProjectForActions}
        actions={nextActions.filter((a) => a.project?.id === selectedProjectForActions?.id)}
        onToggleStatus={handleToggleActionStatus}
        onRefresh={fetchData}
      />

      {/* 📄 رندر مودال خروجی PDF جامع */}
      <ReportsPdfDocument
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        reports={rawReports}
        periods={periodsList}
        projects={projectsList}
        users={usersList}
      />

    </div>
  );
}
// =================================================================
// ✏️ مودال ویرایش گزارش شخصی (قبل از ددلاین)
// =================================================================

interface EditNextAction {
  action_text: string;
  target_date: string;
}

function ReportEditModal({
  report,
  isOpen,
  onClose,
  onSaved,
}: {
  report: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [activitiesDone, setActivitiesDone] = useState("");
  const [extraResultsNotes, setExtraResultsNotes] = useState("");
  const [nextActions, setNextActions] = useState<EditNextAction[]>([]);
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [pendingActionsLoading, setPendingActionsLoading] = useState(false);
  const [selectedActionIds, setSelectedActionIds] = useState<number[]>([]);
  const [showExtraNotes, setShowExtraNotes] = useState(false);

  const [kpis, setKpis] = useState<any[]>([]);
  const [kpiValues, setKpiValues] = useState<Record<number, any>>({});
  const [kpisLoading, setKpisLoading] = useState(false);
  const [selectedKpiFilter, setSelectedKpiFilter] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const flashSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(""), 4000); };
  const flashError = (msg: string) => { setErrorMsg(msg); setTimeout(() => setErrorMsg(""), 5000); };

  // بارگذاری اطلاعات فعلی گزارش و شاخص‌ها هنگام باز شدن مودال
  useEffect(() => {
    if (!isOpen || !report) return;

    setActivitiesDone(report.activities_done || "");
    setExtraResultsNotes(
      report.results_achieved && !report.results_achieved.startsWith("•") ? report.results_achieved : ""
    );
    setNextActions(
      Array.isArray(report.nextActions) && report.nextActions.length > 0
        ? report.nextActions.map((a: any) => ({
            action_text: a.action_text || "",
            target_date: a.target_date ? String(a.target_date).split("T")[0] : "",
          }))
        : [{ action_text: "", target_date: "" }]
    );
    setSuccessMsg("");
    setErrorMsg("");

    // واکشی اقدامات منتظر و در جریان برای این پروژه و کاربر
    setPendingActionsLoading(true);
    fetch(`/api/next-actions?project_id=${report.project_id}&user_id=${report.user_id}&pending_for_report=true&report_id=${report.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        const list = Array.isArray(data) ? data : [];
        setPendingActions(list);
        // اقدامات قبلاً تیک خورده در این گزارش
        const initialSelected = list
          .filter((a) => a.claimed_report_id === report.id || (report.achievedActions || []).some((aa: any) => aa.id === a.id))
          .map((a) => a.id);
        setSelectedActionIds(initialSelected);
      })
      .catch(() => setPendingActions([]))
      .finally(() => setPendingActionsLoading(false));

    // واکشی شاخص‌های فعال پروژه
    setKpisLoading(true);
    fetch(`/api/projects/${report.project_id}/kpis?report_type=${report.report_type}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        const kpiList = Array.isArray(data) ? data : [];
        setKpis(kpiList);

        // مقداردهی اولیه از مقادیر ثبت‌شده قبلی
        const existingValues = Array.isArray(report.kpiValues) ? report.kpiValues : [];
        const initial: Record<number, any> = {};
        kpiList.forEach((k: any) => {
          const existing = existingValues.find((v: any) => v.project_kpi_id === k.id);
          if (existing) {
            initial[k.id] = {
              current_value: existing.not_measured ? "" : (existing.current_value ?? ""),
              baseline_value: existing.not_measured ? "" : (existing.baseline_value ?? ""),
              not_measured: existing.not_measured || false,
              missing_reason: existing.missing_reason || "",
            };
          } else {
            initial[k.id] = { current_value: "", baseline_value: "", not_measured: false, missing_reason: "" };
          }
        });
        setKpiValues(initial);
      })
      .catch(() => setKpis([]))
      .finally(() => setKpisLoading(false));
  }, [isOpen, report]);

  const updateKpiValue = (kpiId: number, patch: Partial<any>) => {
    setKpiValues((prev) => ({
      ...prev,
      [kpiId]: { ...(prev[kpiId] || { current_value: "", baseline_value: "", not_measured: false, missing_reason: "" }), ...patch },
    }));
  };

  const toggleActionSelected = (actionId: number) => {
    setSelectedActionIds((prev) =>
      prev.includes(actionId) ? prev.filter((id) => id !== actionId) : [...prev, actionId]
    );
  };

  const kpiIncomplete = kpis.some((k) => {
    const v = kpiValues[k.id];
    if (!v) return true;
    if (v.not_measured) return !v.missing_reason || !v.missing_reason.trim();
    if (k.input_type === "direct") return v.current_value === "" || v.current_value === null || isNaN(Number(v.current_value));
    return (
      v.baseline_value === "" || v.baseline_value === null || isNaN(Number(v.baseline_value)) ||
      v.current_value === "" || v.current_value === null || isNaN(Number(v.current_value))
    );
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report) return;

    if (!activitiesDone.trim()) {
      flashError("پر کردن فیلد فعالیت‌های انجام‌شده الزامی است.");
      return;
    }
    const hasInvalidAction = nextActions.some((a) => !a.action_text.trim() || !a.target_date);
    if (hasInvalidAction) {
      flashError("لطفاً شرح و تاریخ سررسید دقیق را برای تمامی اقدامات آتی مشخص کنید.");
      return;
    }
    if (kpiIncomplete) {
      flashError("لطفاً مقادیر تمامی شاخص‌ها را تکمیل کنید یا عدم اندازه‌گیری را مشخص نمایید.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("activities_done", activitiesDone);
    formData.append("results_achieved", extraResultsNotes);
    formData.append("achieved_action_ids", JSON.stringify(selectedActionIds));
    formData.append("next_actions", JSON.stringify(nextActions));

    // ساخت آرایه مقادیر شاخص
    const kpiPayload = kpis.map((k) => {
      const v = kpiValues[k.id] || {};
      if (v.not_measured) {
        return { project_kpi_id: k.id, current_value: null, baseline_value: null, not_measured: true, missing_reason: (v.missing_reason || "").trim() || null };
      }
      return {
        project_kpi_id: k.id,
        current_value: Number(v.current_value),
        baseline_value: k.input_type === "percentage_change" ? Number(v.baseline_value) : null,
        not_measured: false,
        missing_reason: null,
      };
    });
    if (kpis.length > 0) {
      formData.append("kpi_values", JSON.stringify(kpiPayload));
    }

    try {
      const res = await fetch(`/api/reports/${report.id}`, { method: "PUT", body: formData });
      if (res.ok) {
        flashSuccess("گزارش با موفقیت ویرایش شد.");
        onSaved();
        setTimeout(() => onClose(), 1200);
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در ویرایش گزارش.");
      }
    } catch (err) {
      flashError("ارتباط با سرور دچار مشکل شد.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in dir-rtl font-sans">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">

        {/* هدر */}
        <div className="p-5 bg-gradient-to-r from-slate-900 to-emerald-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg text-white">ویرایش گزارش عملکرد</h3>
              <p className="text-xs text-slate-300 mt-0.5 font-medium">
                {report.project_title} — {toPersianDigits(report.period_title)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* پیام‌های وضعیت */}
        {successMsg && (
          <div className="mx-6 mt-4 bg-green-600 text-white font-medium px-4 py-3 rounded-xl flex items-center gap-2 border border-green-700">
            <CheckCircle2 className="w-5 h-5" /> <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-4 bg-red-600 text-white font-medium px-4 py-3 rounded-xl flex items-center gap-2 border border-red-700">
            <AlertTriangle className="w-5 h-5" /> <span>{errorMsg}</span>
          </div>
        )}

        {/* بدنه فرم */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/60 text-right">

          {/* فعالیت‌ها */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">فعالیت‌های انجام‌شده *</label>
            <textarea
              required
              value={activitiesDone}
              onChange={(e) => setActivitiesDone(e.target.value)}
              className="w-full bg-white border border-slate-200 focus:border-emerald-600 rounded-2xl p-3 text-xs min-h-[100px] focus:outline-none transition-all"
              placeholder="لیست فعالیت‌ها..."
            />
          </div>

          {/* نتایج و چک‌لیست اقدامات */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="w-5 h-5 text-emerald-700" />
                  <label className="text-sm font-extrabold text-slate-850">
                    نتایج حاصل‌شده (اقدامات تحقق‌یافته در این دوره)
                  </label>
                  {pendingActions.length > 0 && (
                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {toPersianDigits(selectedActionIds.length)} از {toPersianDigits(pendingActions.length)} اقدام انتخاب شده
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  اقداماتی که در این بازه تکمیل کرده‌اید را علامت بزنید.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowExtraNotes(!showExtraNotes)}
                className="text-xs text-slate-600 hover:text-emerald-800 font-bold flex items-center gap-1 self-start sm:self-center transition-colors cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs"
              >
                <span>{showExtraNotes ? "بستن یادداشت متفرقه" : "+ افزودن دستاورد متفرقه / یادداشت"}</span>
              </button>
            </div>

            {pendingActionsLoading ? (
              <div className="text-xs text-slate-400 flex items-center justify-center gap-2 py-6">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>در حال بارگذاری اقدامات این پروژه...</span>
              </div>
            ) : pendingActions.length === 0 ? (
              <div className="bg-slate-50 p-4 rounded-xl text-center text-xs text-slate-500">
                اقدام آتی باز یا ابلاغیه‌ای برای این پروژه ثبت نشده است.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingActions.map((action) => {
                  const isSelected = selectedActionIds.includes(action.id);
                  const isManagerCreated = action.created_by_role === "manager";
                  const isOverdue = action.target_date && new Date(action.target_date).getTime() < Date.now();

                  return (
                    <div
                      key={action.id}
                      onClick={() => toggleActionSelected(action.id)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? "bg-emerald-50/90 border-emerald-400 shadow-xs ring-1 ring-emerald-400"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200/80 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="pt-0.5 shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className={`text-xs font-bold leading-relaxed line-clamp-2 ${isSelected ? "text-emerald-950" : "text-slate-800"}`}>
                            {action.action_text}
                          </p>

                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {isManagerCreated ? (
                              <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold">
                                <Crown className="w-3 h-3 text-purple-600" />
                                <span>ابلاغیه مدیر</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                                <span>اقدام قبلی</span>
                              </span>
                            )}

                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                              isOverdue ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-white text-slate-600 border border-slate-200/60"
                            }`}>
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>مهلت: {formatPersianDate(action.target_date)}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* فیلد اختیاری توضیحات متفرقه نتایج */}
            {showExtraNotes && (
              <div className="space-y-2 pt-2 border-t border-slate-200/60 animate-fade-in">
                <label className="text-xs font-bold text-slate-700 block">
                  سایر دستاوردها یا توضیحات تکمیلی (اختیاری)
                </label>
                <textarea
                  value={extraResultsNotes}
                  onChange={(e) => setExtraResultsNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-emerald-600 rounded-2xl p-3 text-xs min-h-[70px] focus:outline-none transition-all"
                  placeholder="اگر دستاورد یا خروجی خارج از برنامه قبلی داشته‌اید در اینجا شرح دهید..."
                />
              </div>
            )}
          </div>

          {/* اقدامات آتی */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/60 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <label className="text-sm font-bold text-slate-850">اقدامات آتی و برنامه دور بعد</label>
              <button
                type="button"
                onClick={() => setNextActions([...nextActions, { action_text: "", target_date: "" }])}
                className="text-xs bg-emerald-800 text-white px-3 py-1.5 rounded-xl font-medium hover:bg-emerald-900 cursor-pointer"
              >
                + افزودن اقدام
              </button>
            </div>
            {nextActions.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-slate-50 p-3 rounded-xl border border-slate-200/70">
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">شرح اقدام</label>
                  <input
                    type="text"
                    required
                    value={item.action_text}
                    onChange={(e) => { const u = [...nextActions]; u[index].action_text = e.target.value; setNextActions(u); }}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div className="w-full md:w-44">
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">تاریخ سررسید</label>
                  <ShamsiDatePicker
                    value={item.target_date}
                    onChange={(gregorianDate) => { const u = [...nextActions]; u[index].target_date = gregorianDate; setNextActions(u); }}
                    placeholder="انتخاب تاریخ"
                  />
                </div>
                {nextActions.length > 1 && (
                  <button type="button" onClick={() => setNextActions(nextActions.filter((_, i) => i !== index))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* شاخص‌های عملکرد */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-700" />
                <label className="text-sm font-bold text-slate-850">شاخص‌های عملکرد پروژه</label>
                <span className="text-[11px] text-slate-400">({toPersianDigits(kpis.length)} شاخص)</span>
              </div>

              {kpis.length > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">نمایش شاخص:</span>
                  <div className="w-56">
                    <CustomSelect
                      value={selectedKpiFilter}
                      onChange={(val) => setSelectedKpiFilter(Number(val))}
                      options={[
                        { value: 0, label: "همه شاخص‌ها" },
                        ...kpis.map((k) => ({ value: k.id, label: k.name })),
                      ]}
                    />
                  </div>
                </div>
              )}
            </div>

            {kpisLoading ? (
              <div className="text-xs text-slate-400 flex items-center gap-2 bg-white p-4 rounded-2xl border border-slate-200/60">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>در حال بارگذاری شاخص‌ها...</span>
              </div>
            ) : kpis.length === 0 ? (
              <div className="text-xs text-slate-500 bg-white p-4 rounded-2xl border border-slate-200/60">
                برای این پروژه شاخص فعالی تعریف نشده است.
              </div>
            ) : (
              <div className="space-y-3">
                {kpis
                  .filter((k) => selectedKpiFilter === 0 || k.id === selectedKpiFilter)
                  .map((k) => {
                  const v = kpiValues[k.id] || { current_value: "", baseline_value: "", not_measured: false, missing_reason: "" };
                  const disabled = v.not_measured;
                  let preview: string | null = null;
                  if (k.input_type === "percentage_change" && !disabled && v.baseline_value && v.current_value &&
                      Number(v.baseline_value) !== 0 && !isNaN(Number(v.current_value)) && !isNaN(Number(v.baseline_value))) {
                    const pct = ((Number(v.current_value) - Number(v.baseline_value)) / Number(v.baseline_value)) * 100;
                    preview = `${toPersianDigits(pct.toFixed(1))}٪`;
                  }
                  return (
                    <div key={k.id} className="bg-white p-4 rounded-2xl border border-slate-200/70 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h5 className="text-sm font-bold text-slate-800">{k.name}</h5>
                          {k.description && <p className="text-[11px] text-slate-500 mt-0.5">{k.description}</p>}
                          <p className="text-[11px] text-slate-600 mt-1">
                            هدف: {k.target_direction === "minimum" ? "حداقل" : "حداکثر"} {toPersianDigits(k.target_value)} {k.unit}
                          </p>
                        </div>
                        <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-[11px] text-slate-600">
                          <input type="checkbox" checked={disabled} onChange={(e) => updateKpiValue(k.id, { not_measured: e.target.checked })} className="w-4 h-4 accent-rose-600" />
                          اندازه‌گیری نشده
                        </label>
                      </div>
                      {disabled ? (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-medium text-slate-500 block">دلیل عدم اندازه‌گیری *</label>
                          <textarea value={v.missing_reason} onChange={(e) => updateKpiValue(k.id, { missing_reason: e.target.value })}
                            rows={2} placeholder="دلیل..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500" />
                        </div>
                      ) : (
                        <div className={k.input_type === "percentage_change" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                          {k.input_type === "percentage_change" && (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-slate-500 block">مقدار مبنا *</label>
                              <input type="number" step="any" value={v.baseline_value}
                                onChange={(e) => updateKpiValue(k.id, { baseline_value: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600" />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <label className="text-[11px] font-medium text-slate-500 block">
                              {k.input_type === "direct" ? "مقدار این دوره *" : "مقدار دوره جاری *"}
                            </label>
                            <input type="number" step="any" value={v.current_value}
                              onChange={(e) => updateKpiValue(k.id, { current_value: e.target.value })}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600" />
                          </div>
                          {k.input_type === "percentage_change" && preview !== null && (
                            <div className="sm:col-span-2 text-[11px] text-slate-500">
                              درصد تغییر (پیش‌نمایش): <span className="font-bold text-emerald-700">{preview}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </form>

        {/* فوتر */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer">
            انصراف
          </button>
          <button type="submit" disabled={loading} onClick={handleSave}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium px-6 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>ذخیره تغییرات</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 📄 کامپوننت اصلی MyReports
// =================================================================
export default function MyReports({ currentUser, user, reports = [], allReports = [], onRefresh }: MyReportsProps) {
  const [editingReport, setEditingReport] = useState<any | null>(null);
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [deadlineSettings, setDeadlineSettings] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/deadline-settings")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setDeadlineSettings(Array.isArray(data) ? data : []))
      .catch(() => setDeadlineSettings([]));
  }, []);

  const isEditableBeforeDeadline = (rep: any): boolean => {
    if (!rep || !rep.period_end || !rep.report_type) return false;
    const setting = deadlineSettings.find((s: any) => s.report_type === rep.report_type);
    if (!setting) return true; // اگر تنظیماتی نباشد کماکان قابل ویرایش است
    try {
      const deadlineDate = getEditDeadlineDate(
        rep.period_end,
        setting.deadline_day,
        setting.deadline_time,
        rep.report_type
      );
      return new Date() <= deadlineDate;
    } catch {
      return false;
    }
  };

  const activeUser = currentUser || user;
  const activeReports = reports.length > 0 ? reports : allReports;

  // استخراج نقش کاربر
  const rawRole = String(
    activeUser?.role || 
    (activeUser as any)?.user?.role || 
    ""
  ).toLowerCase();

  const isManagerOrAdmin = 
    rawRole.includes("manager") || 
    rawRole.includes("admin") || 
    rawRole.includes("مدیر");

  // 🟢 برای مدیران -> کاوشگر دیداری حباب‌ها همراه با سیارک‌های چرخان
  if (isManagerOrAdmin) {
    return <ManagerVisualBubbleExplorer />;
  }

  // 🟡 برای پرسنل عادی -> جدول گزارش‌های شخص خودش
  return (
    <div className="space-y-6 animate-fade-in text-right dir-rtl font-sans">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">📄 گزارش‌های ثبت‌شده من</h1>
        <p className="text-slate-500 text-xs mt-1">
          آرشیو تمامی گزارش‌های عملکرد ثبت‌شده توسط شما در سیستم.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 font-semibold">
                <th className="p-4">عنوان پروژه</th>
                <th className="p-4">بازه گزارش‌دهی</th>
                <th className="p-4">تاریخ ثبت</th>
                <th className="p-4">وضعیت</th>
                <th className="p-4">خلاصه فعالیت‌ها</th>
                <th className="p-4 text-center">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    هیچ گزارشی توسط شما ثبت نشده است.
                  </td>
                </tr>
              ) : (
                activeReports.map((rep: any) => {
                  const canEdit = isEditableBeforeDeadline(rep);
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{rep.project_title}</td>
                      <td className="p-4 text-slate-600">{toPersianDigits(rep.period_title)}</td>
                      <td className="p-4 text-slate-500">{formatPersianDate(rep.submitted_at)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          rep.status === "late"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}>
                          {rep.status === "late" ? "ارسال با تأخیر" : "ثبت منظم"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600 max-w-xs truncate">{rep.activities_done}</td>
                      <td className="p-4 flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setViewingReport(rep)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-[11px] transition-colors cursor-pointer"
                        >
                          مشاهده جزئیات
                        </button>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setEditingReport(rep)}
                            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold rounded-xl text-[11px] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <span>ویرایش گزارش</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                            پایان مهلت ویرایش
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال مشاهده جزئیات */}
      <RawReportDetailsModal
        report={viewingReport}
        kpiMap={{}}
        isOpen={Boolean(viewingReport)}
        onClose={() => setViewingReport(null)}
        onRunAudit={() => {}}
      />

      {/* مودال ویرایش گزارش */}
      <ReportEditModal
        report={editingReport}
        isOpen={Boolean(editingReport)}
        onClose={() => setEditingReport(null)}
        onSaved={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
}