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
  Lightbulb
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

export default function ManagerDashboard({ periods, projects, users }: ManagerDashboardProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // استیت تحلیل هوش مصنوعی Gemini
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");

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
    setAiAnalysis(null); // ریست کردن تحلیل قبلی زمان تغییر بازه
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

  // متد ارسال دیتا به Gemini AI
  const handleRunAiAnalysis = async () => {
    if (!summaryData || !summaryData.rows) return;

    // استخراج تمام گزارش‌های واقعیِ ثبت‌شده در این دوره
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

      {/* 🌟 بخش بنر و کنترل پردازش هوشمند Gemini AI */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h3 className="text-lg font-bold flex items-center gap-2 text-amber-400">
              <Sparkles className="w-5 h-5" />
              <span>تحلیل و پردازش هوشمند گزارشات با Gemini AI</span>
            </h3>
            <p className="text-slate-300 text-xs">
              تجمیع خودکار متون گزارش‌ها، سنجش درصد سلامت پروژه‌ها، استخراج ریسک‌ها و ارائه راهکارهای مدیریتی
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
                <span>در حال تحلیل هوشمند داده‌ها...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>تحلیل هوشمند کارهای این دوره</span>
              </>
            )}
          </button>
        </div>

        {/* نمایش پیام خطا اگر گزارشی ثبت نشده باشد */}
        {aiError && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* 📊 رندر اتاق کنترل هوشمند (خروجی ساختاریافته JSON از Gemini) */}
      {aiAnalysis && (
        <div className="space-y-6 animate-fade-in">
          
          {/* کارت‌های شاخص سلامت و خلاصه کلان */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* گیج امتیاز سلامت کل */}
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

            {/* خلاصه مدیریتی ارائه‌شده توسط AI */}
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

          {/* ماتریس ریسک‌ها + دستاوردها + پیشنهادات */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* کارت دستاوردها */}
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

            {/* کارت ریسک‌ها و تأخیرها */}
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

            {/* کارت پیشنهادات اجرایی */}
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

      {/* جدول نظارتی کامل پایش عملکرد پرسنل */}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}