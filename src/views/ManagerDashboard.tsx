// src/views/ManagerDashboard.tsx
import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, Paperclip, Download, X } from "lucide-react";
import { ReportPeriod, Project, User, DashboardSummary, DashboardRow, Report } from "../types";
import { CustomSelect } from ".././components";
import { toPersianDigits } from "../dateUtils";

interface ManagerDashboardProps {
  periods: ReportPeriod[];
  projects: Project[];
  users: User[];
}

export default function ManagerDashboard({ periods, projects, users }: ManagerDashboardProps) {
  const [dashPeriodId, setDashPeriodId] = useState<number>(0);
  const [dashProjId, setDashProjId] = useState("all");
  const [dashUserId, setDashUserId] = useState("all");
  const [dashStatusFilter, setDashStatusFilter] = useState("all");

  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null);
  const [dashRows, setDashRows] = useState<DashboardRow[]>([]);
  const [viewingReportDetail, setViewingReportDetail] = useState<Report | null>(null);

  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  useEffect(() => {
    if (periods.length > 0 && dashPeriodId === 0) setDashPeriodId(periods[0].id);
  }, [periods, dashPeriodId]);

  const fetchDashboardData = async () => {
    if (dashPeriodId === 0) return;
    try {
      let url = `/api/dashboard/summary?period_id=${dashPeriodId}`;
      if (dashProjId !== "all") url += `&project_id=${dashProjId}`;
      if (dashUserId !== "all") url += `&user_id=${dashUserId}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDashSummary(data.summary);
        setDashRows(data.rows);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [dashPeriodId, dashProjId, dashUserId]);

  const handleAIAnalyze = async () => {
    if (!dashPeriodId) return;
    const activePeriod = periods.find((p) => p.id === dashPeriodId);
    if (!activePeriod) return;

    setAiAnalyzing(true);
    setAiAnalysis("");

    const submittedReports = dashRows
      .filter((row) => row.status_key !== "missing" && row.report)
      .map((row) => row.report);

    try {
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_title: activePeriod.title, reports: submittedReports }),
      });
      const data = await res.json();
      if (res.ok) setAiAnalysis(data.analysis);
    } catch (err) {
      setAiAnalysis("خطا در پایش هوش مصنوعی.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">📊 پیشخوان و داشبورد نظارتی مدیریت</h1>
        <p className="text-slate-500 text-xs mt-1">پایش آنی، نظارت بر تاخیرات پرسنل و بازخورد هوشمند سیستم.</p>
      </div>

      {/* فیلترهای داشبورد */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/70 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">دوره گزارش‌دهی هدف</label>
          <CustomSelect value={dashPeriodId} onChange={(v) => setDashPeriodId(Number(v))} options={periods.map(p => ({ value: p.id, label: p.title }))} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">پروژه سازمان</label>
          <CustomSelect value={dashProjId} onChange={setDashProjId} options={[{ value: "all", label: "همه پروژه‌ها" }, ...projects.map(p => ({ value: String(p.id), label: p.title }))]} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">کارشناس مربوطه</label>
          <CustomSelect value={dashUserId} onChange={setDashUserId} options={[{ value: "all", label: "همه کارشناسان" }, ...users.filter(u => u.role === "user").map(u => ({ value: String(u.id), label: u.full_name }))]} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">وضعیت ارسال</label>
          <CustomSelect value={dashStatusFilter} onChange={setDashStatusFilter} options={[{ value: "all", label: "همه وضعیت‌ها" }, { value: "submitted", label: "ثبت‌شده" }, { value: "late", label: "تأخیری" }, { value: "missing", label: "ثبت‌نشده" }]} />
        </div>
      </div>

      {/* کارت‌های خلاصه وضعیت */}
      {dashSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-2xs">
            <span className="text-slate-400 text-[11px] block font-medium">مورد انتظار کل</span>
            <span className="text-xl font-bold block mt-1 text-slate-900">{toPersianDigits(dashSummary.total_expected)} مورد</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 border-r-4 border-r-green-500 shadow-2xs">
            <span className="text-slate-400 text-[11px] block font-medium">منظم و به‌موقع</span>
            <span className="text-xl font-bold block mt-1 text-green-600">{toPersianDigits(dashSummary.submitted_count)} مورد</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 border-r-4 border-r-orange-500 shadow-2xs">
            <span className="text-slate-400 text-[11px] block font-medium">ثبت‌شده با تأخیر</span>
            <span className="text-xl font-bold block mt-1 text-orange-600">{toPersianDigits(dashSummary.late_count)} مورد</span>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 border-r-4 border-r-red-500 shadow-2xs">
            <span className="text-slate-400 text-[11px] block font-medium">ارسال نشده (مفقود)</span>
            <span className="text-xl font-bold block mt-1 text-red-600">{toPersianDigits(dashSummary.missing_count)} مورد</span>
          </div>
        </div>
      )}

      {/* ماژول خلاصه سازی هوش مصنوعی */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            <h3 className="font-bold text-sm">تحلیل و پردازش هوشمند گزارشات با Gemini AI</h3>
          </div>
          <button onClick={handleAIAnalyze} disabled={aiAnalyzing || dashPeriodId === 0} className="bg-white text-slate-900 text-[11px] font-bold px-4 py-1.5 rounded-xl shadow-xs hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5 transition-all">
            {aiAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>تحلیل هوشمند کارهای این دوره</span>
          </button>
        </div>
        {aiAnalysis && <div className="bg-white/10 p-3.5 rounded-xl border border-white/5 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>}
      </div>

      {/* جدول داده‌ها */}
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <th className="px-5 py-3">نام پرسنل</th>
                <th className="px-5 py-3">پروژه</th>
                <th className="px-5 py-3">وضعیت نهایی</th>
                <th className="px-5 py-3 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {dashRows
                .filter(row => dashStatusFilter === "all" || row.status_key === dashStatusFilter)
                .map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{row.user_full_name}</td>
                    <td className="px-5 py-3.5">{row.project_title}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${row.status_key === "submitted" ? "bg-green-50 text-green-600 border border-green-100" : row.status_key === "late" ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
                        {row.status_label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-left">
                      {row.report ? (
                        <button onClick={() => setViewingReportDetail(row.report)} className="text-slate-900 font-bold hover:underline">مشاهده جزئیات</button>
                      ) : "-"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* مودال مشاهده جزئیات کامل گزارش */}
      {viewingReportDetail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] overflow-y-auto shadow-xl border border-slate-200 p-6 space-y-4 text-xs text-slate-700">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">بررسی گزارش کارشناس</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">{viewingReportDetail.user_full_name} - {viewingReportDetail.project_title}</p>
              </div>
              <button onClick={() => setViewingReportDetail(null)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <h5 className="font-bold text-slate-400 mb-1">فعالیت‌های صورت گرفته:</h5>
              <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">{viewingReportDetail.activities_done}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <h5 className="font-bold text-slate-400 mb-1">نتایج و دستاوردها:</h5>
              <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">{viewingReportDetail.results_achieved || "ثبت نشده"}</p>
            </div>
            {viewingReportDetail.files && viewingReportDetail.files.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h5 className="font-bold text-slate-400">فایل‌های پیوست داکیومنت:</h5>
                <div className="flex flex-wrap gap-2">
                  {viewingReportDetail.files.map(f => (
                    <a key={f.id} href={`/uploads/${f.filename}`} download target="_blank" className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 flex items-center gap-1 hover:bg-slate-200">
                      <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                      <span>{f.original_filename}</span>
                      <Download className="w-3 h-3 text-slate-400 mr-1" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}