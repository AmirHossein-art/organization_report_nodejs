// src/views/SubmitReport.tsx
import { useState, useEffect } from "react";
import { Plus, X, CheckCircle2, AlertTriangle, RefreshCw, AlertCircle, Clock } from "lucide-react";
import { Project, ReportPeriod, User, Report } from "../types";
import { CustomSelect, ShamsiDatePicker } from ".././components";

interface SubmitReportProps {
  projects: Project[];
  periods: ReportPeriod[];
  user: User;
  allReports: Report[];
  onRefresh: () => void;
}

interface NextActionInput {
  action_text: string;
  target_date: string; 
}

export default function SubmitReport({ projects, periods, user, allReports, onRefresh }: SubmitReportProps) {
  const [subReportType, setSubReportType] = useState<"weekly" | "monthly">("weekly");
  const [subPeriodId, setSubPeriodId] = useState<number>(0);
  const [subProjectId, setSubProjectId] = useState<number>(0);
  const [activitiesDone, setActivitiesDone] = useState("");
  const [resultsAchieved, setResultsAchieved] = useState("");
  const [kpiText, setKpiText] = useState("");
  const [subFiles, setSubFiles] = useState<FileList | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [nextActions, setNextActions] = useState<NextActionInput[]>([
    { action_text: "", target_date: "" }
  ]);

  // تنظیم خودکار بازه زمانی باز متناسب با نوع گزارش
  useEffect(() => {
    const openP = periods.filter((p) => p.report_type === subReportType && p.is_open);
    if (openP.length > 0) {
      setSubPeriodId(openP[0].id);
    } else {
      setSubPeriodId(0);
    }
  }, [subReportType, periods]);

  // واکشی پروژه‌های تخصیص‌یافته به کاربر
  const [userAssignedProjects, setUserAssignedProjects] = useState<Project[]>([]);
  useEffect(() => {
    if (user) {
      fetch("/api/user-projects")
        .then((r) => r.json())
        .then((allocations: any[]) => {
          const myProjectIds = allocations
            .filter((a) => a.user_id === user.id)
            .map((a) => a.project_id);
          const assigned = projects.filter((p) => myProjectIds.includes(p.id) && p.is_active);
          setUserAssignedProjects(assigned);
          if (assigned.length > 0) {
            setSubProjectId(assigned[0].id);
          }
        });
    }
  }, [user, projects]);

  const hasAlreadySubmitted = allReports.some(
    (r) => r.user_id === user?.id && r.project_id === subProjectId && r.period_id === subPeriodId
  );

  const flashSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const flashError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subPeriodId) {
      flashError("لطفاً یک بازه معتبر انتخاب کنید.");
      return;
    }
    if (!subProjectId) {
      flashError("لطفاً یک پروژه انتخاب کنید.");
      return;
    }
    if (!activitiesDone.trim()) {
      flashError("پر کردن فیلد فعالیت‌های انجام‌شده الزامی است.");
      return;
    }

    if (hasAlreadySubmitted) {
      flashError("شما قبلاً برای این پروژه در این دوره گزارش ثبت کرده‌اید.");
      return;
    }

    const hasInvalidAction = nextActions.some(a => !a.action_text.trim() || !a.target_date);
    if (hasInvalidAction) {
      flashError("لطفاً شرح و تاریخ سررسید دقیق را برای تمامی اقدامات آتی مشخص کنید.");
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
    formData.append("next_actions", JSON.stringify(nextActions));

    if (subFiles) {
      for (let i = 0; i < subFiles.length; i++) formData.append("files", subFiles[i]);
    }

    try {
      const res = await fetch("/api/reports", { method: "POST", body: formData });
      if (res.ok) {
        flashSuccess("گزارش شما با موفقیت ثبت شد.");
        setActivitiesDone("");
        setResultsAchieved("");
        setKpiText("");
        setNextActions([{ action_text: "", target_date: "" }]);
        setSubFiles(null);
        const fileInput = document.getElementById("report_files_input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        onRefresh();
      } else {
        const err = await res.json();
        flashError(err.error || "خطا در ثبت گزارش.");
      }
    } catch (err) {
      flashError("ارتباط با سرور دچار مشکل شد.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* پیام‌های وضعیت */}
      {successMessage && (
        <div className="fixed top-4 left-4 z-50 bg-green-600 text-white font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-4 left-4 z-50 bg-red-600 text-white font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-white/60 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">📝 ثبت گزارش عملکرد جدید</h2>
        <p className="text-slate-500 text-xs mt-1">اطلاعات فعالیت‌ها و برنامه‌های زمان‌بندی شده خود را با دقت وارد کنید.</p>
      </div>

      {userAssignedProjects.length === 0 ? (
        <div className="bg-amber-50 text-amber-800 p-6 rounded-2xl border border-amber-200 flex gap-4">
          <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600" />
          <div className="space-y-1">
            <h4 className="font-bold">عدم تخصیص پروژه مجاز</h4>
            <p className="text-sm">هیچ پروژه‌ای برای شما تعریف نشده است. جهت ثبت گزارش، مدیریت سامانه ابتدا باید پروژه‌های مجاز شما را مشخص کند.</p>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-sm space-y-6">
          
          {/* منوهای بالایی انتخاب بازه و پروژه */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">نوع گزارش</label>
              <CustomSelect
                value={subReportType}
                onChange={(val) => setSubReportType(val as "weekly" | "monthly")}
                options={[
                  { value: "weekly", label: "گزارش هفتگی" },
                  { value: "monthly", label: "گزارش ماهانه" }
                ]}
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">بازه گزارش‌دهی</label>
              <CustomSelect
                value={subPeriodId}
                onChange={(val) => setSubPeriodId(Number(val))}
                options={[
                  { value: 0, label: "-- انتخاب بازه --" },
                  ...periods
                    .filter((p) => p.report_type === subReportType && p.is_open)
                    .map((p) => ({
                      value: p.id,
                      label: p.title
                    }))
                ]}
              />
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">انتخاب پروژه مربوطه</label>
              <CustomSelect
                value={subProjectId}
                onChange={(val) => setSubProjectId(Number(val))}
                options={userAssignedProjects.map((p) => ({
                  value: p.id,
                  label: p.title
                }))}
              />
            </div>
          </div>

          {/* 🛠️ شرط‌های رندر داینامیک فرم */}
          {hasAlreadySubmitted ? (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-3">
              <AlertTriangle className="w-8 h-8 text-orange-600 animate-pulse" />
              <h4 className="font-bold text-sm">گزارش قبلاً ثبت شده است</h4>
              <p className="text-xs leading-relaxed max-w-md font-medium">
                شما قبلاً برای پروژه انتخابی در این بازه گزارش عملکرد ثبت کرده‌اید. امکان ثبت گزارش مجدد وجود ندارد.
              </p>
            </div>
          ) : subPeriodId === 0 ? (
            /* 🟢 کارت جدید: اگر بازه انتخاب نشده باشد (روی حالت 0)، فرم مخفی شده و این پیام شیک با تم طلایی نشان داده می‌شود */
            <div className="bg-amber-50/60 border border-amber-200 text-amber-900 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-3 animate-fade-in">
              <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
              <h4 className="font-bold text-sm">بازه گزارش‌دهی انتخاب نشده است</h4>
              <p className="text-xs leading-relaxed max-w-sm font-medium text-slate-600">
                لطفاً جهت نمایان شدن فیلدهای گزارش‌نویسی، ابتدا یک <strong>بازه گزارش‌دهی معتبر</strong> را از منوی بالای صفحه انتخاب نمایید.
              </p>
            </div>
          ) : (
            /* اگر بازه انتخاب شده بود و گزارش هم تکراری نبود، کل فرم با پالت سبز رندر می‌شود */
            <>
              {/* فیلد فعالیت‌های انجام شده */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">فعالیت‌های انجام‌شده *</label>
                <textarea
                  required
                  value={activitiesDone}
                  onChange={(e) => setActivitiesDone(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-emerald-600 rounded-2xl p-3 text-xs min-h-[100px] focus:outline-none transition-all"
                  placeholder="لیست فعالیت‌ها، کارهای توسعه داده شده و جلسات در قالب بندهای مرتب..."
                />
              </div>

              {/* فیلد نتایج حاصل شده */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">نتایج حاصل‌شده</label>
                <textarea
                  value={resultsAchieved}
                  onChange={(e) => setResultsAchieved(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-200 focus:border-emerald-600 rounded-2xl p-3 text-xs min-h-[80px] focus:outline-none transition-all"
                  placeholder="نتایج ملموس، دستاوردها و خروجی‌هایی که بدست آمد..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 🛠️ فیکس دیت‌پیکر: کلاس اسکرول پدربزرگ حذف شد تا تقویم بیرون بزند */}
                <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <label className="text-sm font-bold text-slate-850">اقدامات آتی و برنامه پیش‌رو</label>
                    <button
                      type="button"
                      onClick={() => setNextActions([...nextActions, { action_text: "", target_date: "" }])}
                      className="text-xs bg-emerald-800 text-white px-3 py-1.5 rounded-xl font-medium hover:bg-emerald-900 flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن اقدام جدید</span>
                    </button>
                  </div>

                  {/* حذف اسکرول کادر پدربزرگ برای رهایی کامل دیت‌پیکر شمسی */}
                  <div className="space-y-3 pr-1">
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
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600"
                          />
                        </div>

                        <div className="w-full md:w-44">
                          <label className="text-[11px] font-medium text-slate-400 block mb-1">تاریخ سررسید ددلاین روز</label>
                          <ShamsiDatePicker
                            value={item.target_date}
                            onChange={(gregorianDate) => {
                              const updated = [...nextActions];
                              updated[index].target_date = gregorianDate;
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

                {/* فیلد شاخص‌ها */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">شاخص‌ها و معیارهای سنجش (KPIs)</label>
                  <textarea
                    value={kpiText}
                    onChange={(e) => setKpiText(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 focus:border-emerald-600 rounded-2xl p-3 text-xs min-h-[160px] focus:outline-none transition-all"
                    placeholder="درصد پیشرفت کار، متغیرهای کلیدی انجام فعالیت و آمارها..."
                  />
                </div>
              </div>

              {/* بخش آپلود فایل */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 text-sm font-medium">فایل‌های پیوست گزارش (حداکثر ۱۰ مگابایت)</label>
                <input
                  type="file"
                  id="report_files_input"
                  multiple
                  onChange={(e) => setSubFiles(e.target.files)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-600 file:ml-4 file:bg-emerald-800 file:text-white file:border-none file:px-3 file:py-1 file:rounded-lg file:cursor-pointer hover:file:bg-emerald-900"
                />
                <p className="text-[11px] text-slate-400 mt-1">فرمت‌های مجاز: PDF، Word، Excel، تصاویر داکیومنت و زیپ.</p>
              </div>

              {/* دکمه ثبت نهایی */}
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-medium px-6 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>ثبت نهایی گزارش عملکرد</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}