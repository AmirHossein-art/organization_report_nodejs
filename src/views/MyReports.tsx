// src/views/MyReports.tsx
import { useState, useEffect } from "react";
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  FolderKanban, 
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
  CheckSquare
} from "lucide-react";
import { User, Report, Project, ReportPeriod } from "../types";

import ProjectBubbleNode from "../components/ProjectBubbleNode";
import ProjectNextActionsModal, { NextActionItem } from "../components/ProjectNextActionsDrawer";


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
  isOpen,
  onClose,
  onRunAudit,
}: {
  report: any | null;
  isOpen: boolean;
  onClose: () => void;
  onRunAudit: (rep: any) => void;
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

          {/* نتایج حاصله */}
          {report.results_achieved && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                نتایج و خروجی‌های ملموس حاصله
              </h4>
              <p className="text-xs md:text-sm text-slate-700 leading-relaxed whitespace-pre-line pt-1">
                {report.results_achieved}
              </p>
            </div>
          )}

          {/* شاخص‌ها (KPIs) */}
          {report.kpi_text && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
              <h4 className="font-extrabold text-slate-900 text-xs md:text-sm flex items-center gap-2 border-b border-slate-100 pb-2">
                <Target className="w-4 h-4 text-amber-600" />
                شاخص‌های کلیدی عملکرد (KPIs)
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

        {/* فوتر با دکمه ویژه ممیزی هوشمند */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            بستن
          </button>

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
// جایگزین بخش ManagerVisualBubbleExplorer در MyReports.tsx

function ManagerVisualBubbleExplorer() {
  const [projectClusters, setProjectClusters] = useState<any[]>([]);
  const [nextActions, setNextActions] = useState<NextActionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // استیت‌های لایه‌بندی
  const [activeProjectLayer, setActiveProjectLayer] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // استیت مودال‌ها
  const [rawModalOpen, setRawModalOpen] = useState<boolean>(false);
  const [selectedRawReport, setSelectedRawReport] = useState<any | null>(null);

  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [selectedAuditReport, setSelectedAuditReport] = useState<{ id: number; title: string } | null>(null);

  const [actionsModalOpen, setActionsModalOpen] = useState<boolean>(false);
  const [selectedProjectForActions, setSelectedProjectForActions] = useState<Project | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, repRes, actionsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/reports"),
        fetch("/api/next-actions"),
      ]);

      const fetchedProjects = projRes.ok ? await projRes.json() : [];
      const fetchedReports = repRes.ok ? await repRes.json() : [];
      const fetchedNextActions = actionsRes.ok ? await actionsRes.json() : [];

      setNextActions(fetchedNextActions);

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
    } catch (err) {
      console.error("Error fetching visual data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActionStatus = async (actionId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/next-actions/${actionId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: !currentStatus }),
      });
      if (res.ok) fetchData();
    } catch (err) {
      alert("خطا در به‌روزرسانی وضعیت اقدام.");
    }
  };

  const filteredProjects = projectClusters.filter((p: any) =>
    (p.project_title || "").includes(searchQuery) ||
    (p.code || "").includes(searchQuery)
  );

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

        {activeProjectLayer ? (
          <button
            onClick={() => setActiveProjectLayer(null)}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-2xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md shrink-0"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به نمای تمام پروژه‌ها</span>
          </button>
        ) : (
          <div className="relative w-full md:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="جستجوی پروژه‌ها..."
              className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-2xl px-3.5 py-2 pr-9 focus:outline-none focus:border-emerald-600 transition-colors"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          </div>
        )}
      </div>

      {/* 🌟 بوم اصلی کاوشگر با کنترل سرریز (Overflow Protection) */}
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

      <RawReportDetailsModal
        report={selectedRawReport}
        isOpen={rawModalOpen}
        onClose={() => setRawModalOpen(false)}
        onRunAudit={handleOpenAiAudit}
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
      />

    </div>
  );
}
// =================================================================
// 📄 کامپوننت اصلی MyReports
// =================================================================
export default function MyReports({ currentUser, user, reports = [], allReports = [] }: MyReportsProps) {
  
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeReports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    هیچ گزارشی توسط شما ثبت نشده است.
                  </td>
                </tr>
              ) : (
                activeReports.map((rep: any) => (
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}