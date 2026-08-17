// src/views/SubmitReport.tsx
import { useState, useEffect } from "react";
import { 
  Plus, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  BarChart3, 
  FolderGit2, 
  ArrowLeft, 
  Target, 
  CheckSquare, 
  Square, 
  Crown, 
  Calendar, 
  FileCheck2
} from "lucide-react";
import { Project, ReportPeriod, User, Report } from "../types";
import { CustomSelect, ShamsiDatePicker } from "../components";

// 🌐 تبدیل اعداد به فارسی
const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

const formatPersianDate = (value: string | null | undefined): string => {
  if (!value) return "بدون تاریخ مشخص";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date);
};

interface SubmitReportProps {
  projects: Project[];
  periods: ReportPeriod[];
  user: User;
  allReports: Report[];
  onRefresh: () => void;
  onNavigate?: (tab: string) => void; // 🟢 اضافه شدن پروپ تغییر تب
}

interface NextActionInput {
  action_text: string;
  target_date: string; 
}

export default function SubmitReport({ projects, periods, user, allReports, onRefresh, onNavigate }: SubmitReportProps) {
  const [subReportType, setSubReportType] = useState<"weekly" | "monthly">("weekly");
  const [subPeriodId, setSubPeriodId] = useState<number>(0);
  const [subProjectId, setSubProjectId] = useState<number>(0);
  const [activitiesDone, setActivitiesDone] = useState("");
  const [extraResultsNotes, setExtraResultsNotes] = useState("");
  const [subFiles, setSubFiles] = useState<FileList | null>(null);

  // 🟢 چک‌لیست اقدامات تحقق‌یافته در این دوره
  const [pendingActions, setPendingActions] = useState<any[]>([]);
  const [pendingActionsLoading, setPendingActionsLoading] = useState(false);
  const [selectedActionIds, setSelectedActionIds] = useState<number[]>([]);
  const [showExtraNotes, setShowExtraNotes] = useState(false);

  // 🟢 وضعیت شاخص‌های ساختاریافته پروژه
  const [kpis, setKpis] = useState<any[]>([]);
  const [kpisLoading, setKpisLoading] = useState(false);
  // مقادیر واردشده به تفکیک شناسه شاخص
  const [kpiValues, setKpiValues] = useState<Record<number, any>>({});
  const [selectedKpiFilter, setSelectedKpiFilter] = useState<number>(0); // 0 = همه شاخص‌ها
  
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

  // 🟢 واکشی اقدامات جاری/ابلاغیه‌های در انتظار برای پرسنل در پروژه انتخابی
  useEffect(() => {
    if (!subProjectId || !user?.id) {
      setPendingActions([]);
      setSelectedActionIds([]);
      return;
    }
    setPendingActionsLoading(true);
    fetch(`/api/next-actions?project_id=${subProjectId}&user_id=${user.id}&pending_for_report=true`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        setPendingActions(Array.isArray(data) ? data : []);
        setSelectedActionIds([]);
      })
      .catch(() => setPendingActions([]))
      .finally(() => setPendingActionsLoading(false));
  }, [subProjectId, user?.id]);

  // 🟢 واکشی شاخص‌های فعالِ کاربردی برای پروژه و نوع گزارش انتخاب‌شده
  useEffect(() => {
    if (!subProjectId || !subPeriodId) {
      setKpis([]);
      setKpiValues({});
      return;
    }
    setKpisLoading(true);
    fetch(`/api/projects/${subProjectId}/kpis?report_type=${subReportType}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: any[]) => {
        setKpis(Array.isArray(data) ? data : []);
        // مقداردهی اولیه ورودی‌ها
        const initial: Record<number, any> = {};
        (Array.isArray(data) ? data : []).forEach((k) => {
          initial[k.id] = { current_value: "", baseline_value: "", not_measured: false, missing_reason: "" };
        });
        setKpiValues(initial);
      })
      .catch(() => {
        setKpis([]);
      })
      .finally(() => setKpisLoading(false));
  }, [subProjectId, subPeriodId, subReportType]);

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

  // بررسی تکمیل بودن تمام شاخص‌های اعمال‌شده
  const kpiIncomplete = kpis.some((k) => {
    const v = kpiValues[k.id];
    if (!v) return true;
    if (v.not_measured) {
      return !v.missing_reason || !v.missing_reason.trim();
    }
    if (k.input_type === "direct") {
      return v.current_value === "" || v.current_value === null || isNaN(Number(v.current_value));
    }
    return (
      v.baseline_value === "" || v.baseline_value === null || isNaN(Number(v.baseline_value)) ||
      v.current_value === "" || v.current_value === null || isNaN(Number(v.current_value))
    );
  });

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

    if (kpiIncomplete) {
      flashError("لطفاً مقادیر تمامی شاخص‌های نمایش‌داده‌شده را تکمیل کنید یا عدم اندازه‌گیری را مشخص نمایید.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("user_id", user.id.toString());
    formData.append("project_id", subProjectId.toString());
    formData.append("report_type", subReportType);
    formData.append("period_id", subPeriodId.toString());
    formData.append("activities_done", activitiesDone);
    formData.append("results_achieved", extraResultsNotes);
    formData.append("achieved_action_ids", JSON.stringify(selectedActionIds));
    formData.append("kpi_text", "");

    // 🟢 ساخت آرایه مقادیر شاخص‌ها (فقط برای شاخص‌های اعمال‌شده)
    const kpiValuesPayload = kpis.map((k) => {
      const v = kpiValues[k.id] || {};
      if (v.not_measured) {
        return {
          project_kpi_id: k.id,
          current_value: null,
          baseline_value: null,
          not_measured: true,
          missing_reason: (v.missing_reason || "").trim() || null,
        };
      }
      return {
        project_kpi_id: k.id,
        current_value: k.input_type === "direct" ? Number(v.current_value) : Number(v.current_value),
        baseline_value: k.input_type === "percentage_change" ? Number(v.baseline_value) : null,
        not_measured: false,
        missing_reason: null,
      };
    });
    formData.append("kpi_values", JSON.stringify(kpiValuesPayload));

    formData.append("next_actions", JSON.stringify(nextActions));

    if (subFiles) {
      for (let i = 0; i < subFiles.length; i++) formData.append("files", subFiles[i]);
    }

    try {
      const res = await fetch("/api/reports", { method: "POST", body: formData });
      if (res.ok) {
        flashSuccess("گزارش شما با موفقیت ثبت شد.");
        setActivitiesDone("");
        setExtraResultsNotes("");
        setSelectedActionIds([]);
        setNextActions([{ action_text: "", target_date: "" }]);
        setKpiValues({});
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

  // 🟢 نمایش کارت اختصاصی و شیک برای مدیر سیستم (به‌جای فرم ثبت گزارش)
  if (user?.role === "manager") {
    return (
      <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right my-4">
        {/* هرو کارت شیک و مدرن مدیر */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border border-slate-800/80 p-8 shadow-2xl text-white">
          
          {/* نور پس‌زمینه تزئینی */}
          <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute -right-10 -top-10 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            
            {/* نشانگر نقش مدیر */}
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-[11px] font-bold backdrop-blur-md">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>پنل ویژه مدیران ارشد و ناظرین استراتژیک</span>
              </span>

              <span className="text-slate-400 text-[11px] font-sans">
                پورتال پایش سازمان
              </span>
            </div>

            {/* متن اصلی */}
            <div className="space-y-2 max-w-2xl">
              <h2 className="text-xl font-extrabold text-white leading-tight">
                جناب آقای {user.full_name}؛ شما در وضعیت «نظارت و مدیریت ارشد» قرار دارید
              </h2>
              <p className="text-slate-300 text-xs leading-relaxed font-light">
                فرم درج عملکرد زیر برای ثبت گزارش‌های اجرایی مسئولین پروژه‌ها طراحی شده است. حساب کاربری شما دارای سطح دسترسی عالی جهت **ممیزی هوش مصنوعی، بررسی انحراف برنامه، و تخصیص سطح دسترسی‌ها** می‌باشد.
              </p>
            </div>

            {/* میانبرهای سریع مدیریتی */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => onNavigate && onNavigate("manager_dashboard")}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3.5 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-200 text-xs">پیشخوان پایش کل</span>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate && onNavigate("project_allocations")}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3.5 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <FolderGit2 className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-200 text-xs">تخصیص پروژه‌ها</span>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => onNavigate && onNavigate("my_reports")}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3.5 transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-200 text-xs">ممیزی هوشمند WBS</span>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:-translate-x-1 transition-transform" />
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

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
            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-6 rounded-2xl flex flex-col items-center justify-center text-center gap-3 animate-fade-in">
              <AlertTriangle className="w-8 h-8 text-amber-600 animate-bounce" />
              <h4 className="font-bold text-sm">گزارش عملکرد این پروژه در این بازه قبلاً ثبت شده است</h4>
              <p className="text-xs leading-relaxed max-w-md font-medium text-slate-700">
                شما این گزارش را وارد کرده‌اید. لطفاً برای مشاهده و ویرایش آن به صفحه <strong>گزارش‌های من</strong> بروید.
              </p>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate("my_reports")}
                  className="mt-2 bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-5 py-2 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <span>ورود به صفحه گزارش‌های من</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : subPeriodId === 0 ? (
            <div className="bg-amber-50/60 border border-amber-200 text-amber-900 p-8 rounded-2xl flex flex-col items-center justify-center text-center gap-3 animate-fade-in">
              <Clock className="w-8 h-8 text-amber-600 animate-pulse" />
              <h4 className="font-bold text-sm">بازه گزارش‌دهی انتخاب نشده است</h4>
              <p className="text-xs leading-relaxed max-w-sm font-medium text-slate-600">
                لطفاً جهت نمایان شدن فیلدهای گزارش‌نویسی، ابتدا یک <strong>بازه گزارش‌دهی معتبر</strong> را از منوی بالای صفحه انتخاب نمایید.
              </p>
            </div>
          ) : (
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

              {/* فیلد نتایج حاصل شده (چک‌لیست اقدامات آتی و ابلاغیه‌ها) */}
              <div className="bg-slate-50/70 p-5 rounded-3xl border border-slate-200/80 space-y-4 shadow-xs">
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
                      اقداماتی که در این بازه تکمیل و محقق کرده‌اید را علامت بزنید (جهت بررسی و تایید نهایی توسط مدیر).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowExtraNotes(!showExtraNotes)}
                    className="text-xs text-slate-600 hover:text-emerald-800 font-bold flex items-center gap-1 self-start sm:self-center transition-colors cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs"
                  >
                    <span>{showExtraNotes ? "بستن یادداشت متفرقه" : "+ افزودن دستاورد متفرقه / یادداشت"}</span>
                  </button>
                </div>

                {pendingActionsLoading ? (
                  <div className="text-xs text-slate-400 flex items-center justify-center gap-2 py-8 bg-white rounded-2xl border border-slate-200/60">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>در حال بارگذاری اقدامات و ابلاغیه‌های این پروژه...</span>
                  </div>
                ) : pendingActions.length === 0 ? (
                  <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center space-y-2">
                    <CheckSquare className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold text-slate-700">
                      هیچ اقدام آتی باز یا ابلاغیه مدیریتی در انتظاری برای این پروژه یافت نشد.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      در صورتی که خروجی یا دستاورد خاصی در این دوره داشته‌اید، از دکمه «افزودن دستاورد متفرقه» در بالا استفاده کنید.
                    </p>
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
                              : "bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs"
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
                                    <span>اقدام قبلی شما</span>
                                  </span>
                                )}

                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                                  isOverdue ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-slate-50 text-slate-600 border border-slate-200/60"
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
                      سایر دستاوردها، نتایج ملموس یا توضیحات تکمیلی (اختیاری)
                    </label>
                    <textarea
                      value={extraResultsNotes}
                      onChange={(e) => setExtraResultsNotes(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-emerald-600 rounded-2xl p-3 text-xs min-h-[70px] focus:outline-none transition-all"
                      placeholder="اگر دستاورد یا خروجی خارج از برنامه قبلی داشته‌اید در اینجا شرح دهید..."
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {/* فیلد شاخص‌ها حذف شد — جایگزین با شاخص‌های ساختاریافته در پایین فرم */}
              </div>

              {/* 🟢 بخش شاخص‌های عملکرد ساختاریافته */}
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
                  <div className="text-xs text-slate-400 flex items-center gap-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>در حال بارگذاری شاخص‌های پروژه...</span>
                  </div>
                ) : kpis.length === 0 ? (
                  <div className="text-xs text-slate-500 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/60">
                    برای این پروژه شاخص فعالی تعریف نشده است.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {kpis
                      .filter((k) => selectedKpiFilter === 0 || k.id === selectedKpiFilter)
                      .map((k) => {
                      const v = kpiValues[k.id] || { current_value: "", baseline_value: "", not_measured: false, missing_reason: "" };
                      const disabled = v.not_measured;
                      // پیش‌نمایش محاسبه درصد برای کلاینت (منبع حقیقت سرور است)
                      let preview: string | null = null;
                      if (k.input_type === "percentage_change" && !disabled && v.baseline_value && v.current_value &&
                          Number(v.baseline_value) !== 0 && !isNaN(Number(v.current_value)) && !isNaN(Number(v.baseline_value))) {
                        const pct = ((Number(v.current_value) - Number(v.baseline_value)) / Number(v.baseline_value)) * 100;
                        preview = `${toPersianDigits(pct.toFixed(1))}٪`;
                      }
                      return (
                        <div key={k.id} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/70 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-sm font-bold text-slate-800">{k.name}</h5>
                              {k.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{k.description}</p>
                              )}
                              <p className="text-[11px] text-slate-600 mt-1">
                                هدف: {k.target_direction === "minimum" ? "حداقل" : "حداکثر"} {toPersianDigits(k.target_value)} {k.unit}
                              </p>
                            </div>
                            <label className="flex items-center gap-1.5 shrink-0 cursor-pointer text-[11px] text-slate-600">
                              <input
                                type="checkbox"
                                checked={disabled}
                                onChange={(e) => updateKpiValue(k.id, { not_measured: e.target.checked })}
                                className="w-4 h-4 accent-rose-600"
                              />
                              اندازه‌گیری نشده
                            </label>
                          </div>

                          {disabled ? (
                            <div className="space-y-1.5">
                              <label className="text-[11px] font-medium text-slate-500 block">
                                دلیل عدم اندازه‌گیری شاخص *
                              </label>
                              <textarea
                                value={v.missing_reason}
                                onChange={(e) => updateKpiValue(k.id, { missing_reason: e.target.value })}
                                rows={2}
                                placeholder="دلیل عدم اندازه‌گیری شاخص را وارد کنید..."
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-500"
                              />
                            </div>
                          ) : (
                            <div className={k.input_type === "percentage_change" ? "grid grid-cols-1 sm:grid-cols-2 gap-3" : ""}>
                              {k.input_type === "percentage_change" && (
                                <div className="space-y-1.5">
                                  <label className="text-[11px] font-medium text-slate-500 block">مقدار مبنا *</label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={v.baseline_value}
                                    onChange={(e) => updateKpiValue(k.id, { baseline_value: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600"
                                    placeholder="مقدار مبنا"
                                  />
                                </div>
                              )}
                              <div className="space-y-1.5">
                                <label className="text-[11px] font-medium text-slate-500 block">
                                  {k.input_type === "direct" ? "مقدار این دوره *" : "مقدار دوره جاری *"}
                                </label>
                                <input
                                  type="number"
                                  step="any"
                                  value={v.current_value}
                                  onChange={(e) => updateKpiValue(k.id, { current_value: e.target.value })}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-600"
                                  placeholder="مقدار این دوره"
                                />
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