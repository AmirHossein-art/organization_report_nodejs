// src/views/SubmitReport.tsx
import { useState, useEffect } from "react";
import { Plus, X, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Project, ReportPeriod, User } from "../types";
import { CustomSelect, ShamsiDatePicker } from ".././components";

interface SubmitReportProps {
  projects: Project[];
  periods: ReportPeriod[];
  user: User;
  onRefresh: () => void;
}

interface NextActionInput {
  action_text: string;
  target_date: string; // ذخیره تاریخ میلادی خروجی دیت‌پیکر
}

export default function SubmitReport({ projects, periods, user, onRefresh }: SubmitReportProps) {
  const [subReportType, setSubReportType] = useState<"weekly" | "monthly">("weekly");
  const [subPeriodId, setSubPeriodId] = useState<number>(0);
  const [subProjectId, setSubProjectId] = useState<number>(0);
  const [activitiesDone, setActivitiesDone] = useState("");
  const [resultsAchieved, setResultsAchieved] = useState("");
  const [kpiText, setKpiText] = useState("");
  const [subFiles, setSubFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);

  // استیت جدید برای اقدامات آتی ساختاریافته (متن + تاریخ سررسید واقعی)
  const [nextActions, setNextActions] = useState<NextActionInput[]>([
    { action_text: "", target_date: "" }
  ]);

  useEffect(() => {
    const openP = periods.filter((p) => p.report_type === subReportType && p.is_open);
    if (openP.length > 0) setSubPeriodId(openP[0].id);
  }, [subReportType, periods]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ولیدیشن فیلد اقدامات آتی: جلوگیری از ثبت تاریخ خالی
    const hasInvalidAction = nextActions.some(a => !a.action_text.trim() || !a.target_date);
    if (hasInvalidAction) {
      alert("لطفاً شرح و تاریخ سررسید دقیق را برای تمامی اقدامات آتی مشخص کنید.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("user_id", user.id.toString());
    formData.append("project_id", subProjectId.toString());
    formData.append("report_type", subReportType);
    formData.append("period_id", subPeriodId.toString());
    formData.append("activities_done", activitiesDone);
    formData.append("results_achieved", resultsAchieved);
    formData.append("kpi_text", kpiText);
    
    // ارسال آرایه اقدامات آتی به صورت JSON به سرور
    formData.append("next_actions", JSON.stringify(nextActions));

    if (subFiles) {
      for (let i = 0; i < subFiles.length; i++) formData.append("files", subFiles[i]);
    }

    try {
      const res = await fetch("/api/reports", { method: "POST", body: formData });
      if (res.ok) {
        alert("گزارش با موفقیت ثبت شد.");
        setActivitiesDone("");
        setResultsAchieved("");
        setKpiText("");
        setNextActions([{ action_text: "", target_date: "" }]);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">📝 ثبت گزارش عملکرد جدید</h2>
        <p className="text-slate-500 text-xs mt-1">اطلاعات فعالیت‌ها و برنامه‌های زمان‌بندی شده خود را با دقت وارد کنید.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
        {/* فیلدهای انتخاب پروژه و بازه */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* ... بخش انتخاب نوع گزارش، بازه و پروژه مشابه قبل است ... */}
        </div>

        {/* فیلد فعالیت‌های انجام شده */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">فعالیت‌های انجام‌شده *</label>
          <textarea
            required
            value={activitiesDone}
            onChange={(e) => setActivitiesDone(e.target.value)}
            className="w-full bg-slate-50/50 border border-slate-200 focus:border-slate-900 rounded-2xl p-3 text-xs min-h-[100px] focus:outline-none transition-all"
            placeholder="کارهای صورت گرفته در این دوره را بنویسید..."
          />
        </div>

        {/* 🛠️ بخش جدید و اصلاح‌شده اقدامات آتی با کنترل تاریخ دقیق روز */}
        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <label className="text-sm font-bold text-slate-800">🔮 اقدامات آتی و برنامه پیش‌رو</label>
            <button
              type="button"
              onClick={() => setNextActions([...nextActions, { action_text: "", target_date: "" }])}
              className="text-xs bg-slate-900 text-white px-3 py-1.5 rounded-xl font-medium hover:bg-slate-800 flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>افزودن اقدام جدید</span>
            </button>
          </div>

          <div className="space-y-3">
            {nextActions.map((item, index) => (
              <div key={index} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs">
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">شرح مختصر اقدام آتی</label>
                  <input
                    type="text"
                    required
                    value={item.action_text}
                    onChange={(e) => {
                      const updated = [...nextActions];
                      updated[index].action_text = e.target.value;
                      setNextActions(updated);
                    }}
                    placeholder="مثال: رفع باگ‌های ماژول احراز هویت..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div className="w-full md:w-48">
                  <label className="text-[11px] font-medium text-slate-400 block mb-1">تاریخ دقیق سررسید روز (ددلاین داخلی)</label>
                  {/* استفاده از دیت‌پیکر شمسی شما برای ولیدیشن دقیق تاریخ */}
                  <ShamsiDatePicker
                    value={item.target_date}
                    onChange={(gregorianDate) => {
                      const updated = [...nextActions];
                      updated[index].target_date = gregorianDate; // ذخیره تاریخ استاندارد میلادی YYYY-MM-DD
                      setNextActions(updated);
                    }}
                    placeholder="انتخاب تاریخ هدف"
                  />
                </div>

                {nextActions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setNextActions(nextActions.filter((_, i) => i !== index))}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* دکمه ثبت نهایی گزارش */}
        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>ثبت نهایی گزارش عملکرد</span>
          </button>
        </div>
      </form>
    </div>
  );
}