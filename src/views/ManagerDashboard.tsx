// src/views/ManagerDashboard.tsx
import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  FileText, 
  RefreshCw, 
  Search,
  ShieldAlert,
  Lightbulb,
  ShieldCheck,
  Clock,
  Target,
  Cpu,
  X
} from "lucide-react";
import { ReportPeriod, Project, User } from "../types";
import { CustomSelect } from "../components";

interface ManagerDashboardProps {
  periods: ReportPeriod[];
  projects: Project[];
  users: User[];
}

interface AiAnalysisResult {
  health_score: number;
  overall_status: string;
  executive_summary: string;
  key_achievements: string[];
  risks_and_delays: {
    project_title: string;
    risk_level: "high" | "medium" | "low";
    description: string;
  }[];
  actionable_recommendations: string[];
}

// ساختار داده ممیزی اختصاصی یک گزارش
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
// 🛍️ کامپوننت کشوی جانبی ممیزی هوشمند تک‌گزارش (Audit Drawer)
// =================================================================
function SingleReportAuditDrawer({
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

  const runSingleReportAudit = async () => {
    if (!reportId) return;
    setLoading(true);
    setError("");
    setAuditData(null);

    try {
      const res = await fetch("/api/reports/analyze-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          report_id: reportId,
          excel_file_name: "بهبود UI طرح ترافیک.xlsx" 
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAuditData(data.analysis);
        setModelUsed(data.model_used || "Gemini AI");
      } else {
        setError(data.error || "خطا در ارزیابی گزارش.");
      }
    } catch (err) {
      setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && reportId) {
      runSingleReportAudit();
    }
  }, [isOpen, reportId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs transition-opacity animate-fade-in">
      <div className="absolute inset-y-0 left-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col dir-rtl">
          
          {/* هدر کشو */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">ممیزی و ارزیابی استراتژیک گزارش</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{reportTitle}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* بدنه اصلی محتوا */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/50">
            {loading && (
              <div className="py-20 text-center space-y-3">
                <RefreshCw className="w-10 h-10 text-amber-500 animate-spin mx-auto" />
                <p className="text-xs font-medium text-slate-600">در حال ممیزی گزارش با WBS و سابقه کاربر...</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {auditData && (
              <>
                {/* نشانگر مدل استفاده شده */}
                {modelUsed && (
                  <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-600 shadow-2xs">
                    <span className="flex items-center gap-2 text-[11px]">
                      <Cpu className="w-4 h-4 text-emerald-600" />
                      موتور پردازشگر: <strong>{modelUsed}</strong>
                    </span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px] font-bold">فعال</span>
                  </div>
                )}

                {/* ۱. کارت سنجش اصالت و شباهت (بند ۵) */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  auditData.repetitiveness_assessment.is_duplicate_risk 
                    ? "bg-rose-50/80 border-rose-200 text-rose-900" 
                    : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      سنجش اصالت و شباهت‌سنجی متنی
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      auditData.repetitiveness_assessment.is_duplicate_risk 
                        ? "bg-rose-200 text-rose-800" 
                        : "bg-emerald-200 text-emerald-800"
                    }`}>
                      {auditData.repetitiveness_assessment.similarity_percentage}٪ شباهت به سابقه
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {auditData.repetitiveness_assessment.analysis_details}
                  </p>
                </div>

                {/* ۲. کارت تطابق استراتژیک و خلق فایده (بند ۶) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600" />
                      تطابق استراتژیک با WBS مرجع
                    </span>
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[10px] border border-indigo-100 font-bold">
                      خلق فایده: {auditData.strategic_alignment.value_creation}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {auditData.strategic_alignment.alignment_analysis}
                  </p>
                  <div className="text-[11px] bg-slate-50 p-2 rounded-lg text-slate-500 border border-slate-100">
                    📍 بسته کاری مرتبط: <strong>{auditData.strategic_alignment.wbs_matching_task}</strong>
                  </div>
                </div>

                {/* ۳. کارت خلاصه مدیریتی (بند ۱) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    خلاصه مدیریتی اقدامات
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {auditData.executive_summary}
                  </p>
                </div>

                {/* ۴. جدول مقایسه شاخص‌ها (بند ۲) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    پایش و مقایسه شاخص‌ها (KPIs)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 border-b border-slate-100">
                          <th className="p-2">عنوان شاخص</th>
                          <th className="p-2">سابقه قبلی</th>
                          <th className="p-2">مقدار فعلی</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditData.kpis_evaluation.map((kpi, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="p-2 font-medium text-slate-800">{kpi.kpi_name}</td>
                            <td className="p-2 text-slate-400">{kpi.previous_value}</td>
                            <td className="p-2 font-bold text-emerald-600">
                              {kpi.has_kpi ? kpi.current_value : <span className="text-rose-500">فاقد شاخص</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ۵. اقدامات آتی و ددلاین‌ها (بند ۴) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    برنامه آتی و مهلت‌های زمانی (Deadlines)
                  </h4>
                  <div className="space-y-2">
                    {auditData.future_actions_with_deadlines.map((act, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                        <span className="text-slate-700">{act.action}</span>
                        <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-mono font-bold text-[10px]">
                          📅 {act.deadline}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ۶. پیشنهادات اصلاحی هوش مصنوعی (بند ۳) */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    پیشنهادات و اقدامات اصلاحی
                  </h4>
                  <ul className="space-y-2">
                    {auditData.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2 bg-emerald-50/30 p-2 rounded-xl">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1.5 shrink-0"></span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =================================================================
// 🚀 کامپوننت اصلی داشبورد مدیریتی
// =================================================================
export default function ManagerDashboard({ periods, projects, users }: ManagerDashboardProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // استیت تحلیل کلی دوره
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");

  // 🌟 استیت‌های ممیزی اختصاصی تک‌گزارش (Drawer)
  const [auditDrawerOpen, setAuditDrawerOpen] = useState<boolean>(false);
  const [selectedAuditReport, setSelectedAuditReport] = useState<{ id: number; title: string } | null>(null);

  // انتخاب اولین بازه فعال به صورت خودکار
  useEffect(() => {
    if (periods.length > 0) {
      const openPeriod = periods.find((p) => p.is_open);
      setSelectedPeriodId(openPeriod ? openPeriod.id : periods[0].id);
    }
  }, [periods]);

  // دریافت اطلاعات ماتریس پایش
  const fetchSummary = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    setAiAnalysis(null);
    setAiError("");
    try {
      let url = `/api/dashboard/summary?period_id=${selectedPeriodId}`;
      if (selectedProjectId) url += `&project_id=${selectedProjectId}`;
      if (selectedUserId) url += `&user_id=${selectedUserId}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error("Error fetching summary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedPeriodId, selectedProjectId, selectedUserId]);

  // متد ارسال دیتا به AI جهت تحلیل کلی
  const handleRunAiAnalysis = async () => {
    if (!summaryData || !summaryData.rows) return;

    const submittedReports = summaryData.rows
      .filter((r: any) => r.report !== null)
      .map((r: any) => r.report);

    if (submittedReports.length === 0) {
      setAiError("هیچ گزارشی در این دوره توسط پرسنل ثبت نشده است. امکان تحلیل وجود ندارد.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const currentPeriod = periods.find((p) => p.id === selectedPeriodId);
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_title: currentPeriod ? currentPeriod.title : "دوره جاری",
          reports: submittedReports,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAiAnalysis(data.analysis);
      } else {
        setAiError(data.error || "خطا در تحلیل هوش مصنوعی.");
      }
    } catch (err) {
      setAiError("ارتباط با سرور هوش مصنوعی برقرار نشد.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* هدر بالایی پنل مدیریتی */}
      <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-700" />
            <span>داشبورد پایش و نظارت بر عملکرد پروژه‌ها</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            ماتریس نظارتی آنلاین جهت بررسی میزان مشارکت پرسنل و تحلیل هوشمند داده‌های سازمانی
          </p>
        </div>

        {/* فیلترهای بالا */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <CustomSelect
            value={selectedPeriodId}
            onChange={(v) => setSelectedPeriodId(Number(v))}
            options={periods.map((p) => ({ value: p.id, label: p.title }))}
          />
          <CustomSelect
            value={selectedProjectId}
            onChange={(v) => setSelectedProjectId(Number(v))}
            options={[
              { value: 0, label: "همه پروژه‌ها" },
              ...projects.map((p) => ({ value: p.id, label: p.title })),
            ]}
          />
          <CustomSelect
            value={selectedUserId}
            onChange={(v) => setSelectedUserId(Number(v))}
            options={[
              { value: 0, label: "همه پرسنل" },
              ...users.filter((u) => u.role === "user").map((u) => ({ value: u.id, label: u.full_name })),
            ]}
          />
        </div>
      </div>

      {/* خلاصه آماری دوره انتخابی */}
      {summaryData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-medium block">کل گزارش‌های مورد انتظار</span>
              <span className="text-xl font-extrabold text-slate-900 mt-1 block">
                {summaryData.summary.total_expected} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-emerald-600 text-xs font-medium block">ثبت‌شده و منظم</span>
              <span className="text-xl font-extrabold text-emerald-700 mt-1 block">
                {summaryData.summary.submitted_count} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-amber-600 text-xs font-medium block">ارسال با تأخیر</span>
              <span className="text-xl font-extrabold text-amber-600 mt-1 block">
                {summaryData.summary.late_count} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-rose-600 text-xs font-medium block">ثبت‌نشده (فاقد گزارش)</span>
              <span className="text-xl font-extrabold text-rose-600 mt-1 block">
                {summaryData.summary.missing_count} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* 🌟 بخش بنر و کنترل پردازش هوشمند کلان */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h3 className="text-lg font-bold flex items-center gap-2 text-amber-400">
              <Sparkles className="w-5 h-5" />
              <span>تحلیل و پردازش هوشمند کلان با AI</span>
            </h3>
            <p className="text-slate-300 text-xs">
              تجمیع خودکار تمام متون، سنجش درصد سلامت پروژه‌ها، استخراج ریسک‌ها و ارائه راهکارهای کلی مدیریتی
            </p>
          </div>

          <button
            onClick={handleRunAiAnalysis}
            disabled={aiLoading || loading}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 text-xs shadow-md disabled:opacity-50 flex-shrink-0"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>در حال تحلیل کلان داده‌ها...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>تحلیل هوشمند کارهای این دوره</span>
              </>
            )}
          </button>
        </div>

        {aiError && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* 📊 خروجی تحلیل کلان دوره */}
      {aiAnalysis && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between text-center relative overflow-hidden">
              <span className="text-slate-400 text-xs font-bold block">شاخص سلامت کلی پروژه‌ها</span>
              
              <div className="my-4 space-y-1">
                <span className="text-5xl font-black text-slate-900">{aiAnalysis.health_score}</span>
                <span className="text-slate-400 text-xs"> از ۱۰۰</span>
                <div className="pt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    aiAnalysis.overall_status === "پایدار"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    وضعیت: {aiAnalysis.overall_status}
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-amber-500 h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${aiAnalysis.health_score}%` }}
                ></div>
              </div>
            </div>

            <div className="md:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                <TrendingUp className="w-4 h-4 text-emerald-700" />
                <span>خلاصه مدیریتی عملکرد سازمان</span>
              </h4>
              <p className="text-slate-600 text-xs leading-relaxed whitespace-pre-line">
                {aiAnalysis.executive_summary}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>مهم‌ترین دستاوردهای این دوره</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                {aiAnalysis.key_achievements.map((ach, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/50">
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5 flex-shrink-0"></span>
                    <span>{ach}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>ماتریس ریسک‌ها و موانع</span>
              </h4>
              <div className="space-y-2 text-xs">
                {aiAnalysis.risks_and_delays.map((risk, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 text-[11px]">{risk.project_title}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        risk.risk_level === "high" 
                          ? "bg-rose-100 text-rose-700" 
                          : "bg-amber-100 text-amber-700"
                      }`}>
                        {risk.risk_level === "high" ? "ریسک بالا" : "متوسط"}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[10px] leading-relaxed">{risk.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>پیشنهادات و اقدام‌های پیشنهادی</span>
              </h4>
              <ul className="space-y-2 text-xs text-slate-600">
                {aiAnalysis.actionable_recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-amber-50/40 p-2.5 rounded-xl border border-amber-100/50">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* جدول نظارتی کامل پایش عملکرد پرسنل به همراه عملیات ممیزی */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <span>جدول تفکیکی وضعیت گزارش‌دهی پروژه‌ها</span>
          </h3>
          <span className="text-[11px] text-slate-400">بر اساس بازه زمانی فعال</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-700" />
            <span>در حال دریافت ماتریس اطلاعات...</span>
          </div>
        ) : !summaryData || summaryData.rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            هیچ تخصیص پروژه‌ای برای فیلتر انتخابی یافت نشد.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/30 text-slate-400 font-semibold">
                  <th className="p-4">نام پرسنل</th>
                  <th className="p-4">پروژه</th>
                  <th className="p-4">وضعیت نهایی</th>
                  <th className="p-4">توضیحات / جزئیات</th>
                  <th className="p-4">عملیات ممیزی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaryData.rows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{row.user_full_name}</td>
                    <td className="p-4 text-slate-600">{row.project_title}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        row.status_key === "submitted"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : row.status_key === "late"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-rose-50 text-rose-700 border border-rose-100"
                      }`}>
                        {row.status_label}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 max-w-xs truncate">
                      {row.report ? row.report.activities_done : "-"}
                    </td>

                    {/* 🌟 ستون جدید دکمه ممیزی هوشمند تک گزارش */}
                    <td className="p-4">
                      {row.report ? (
                        <button
                          onClick={() => {
                            setSelectedAuditReport({
                              id: row.report.id,
                              title: `گزارش ${row.user_full_name} - ${row.project_title}`,
                            });
                            setAuditDrawerOpen(true);
                          }}
                          className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl border border-amber-200/80 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>ممیزی هوشمند</span>
                        </button>
                      ) : (
                        <span className="text-slate-300 text-[11px]">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🌟 رندر کشوی جانبی ممیزی اختصاصی تک گزارش */}
      <SingleReportAuditDrawer
        reportId={selectedAuditReport?.id || null}
        reportTitle={selectedAuditReport?.title || ""}
        isOpen={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
      />

    </div>
  );
}