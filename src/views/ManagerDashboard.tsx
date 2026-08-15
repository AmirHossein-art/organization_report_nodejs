// src/views/ManagerDashboard.tsx
import { useState, useEffect, useMemo } from "react";
import { 
  Sparkles, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  FileText, 
  RefreshCw, 
  ShieldAlert, 
  Lightbulb, 
  ShieldCheck, 
  Clock, 
  Target, 
  Cpu, 
  X, 
  LayoutGrid, 
  Table as TableIcon, 
  Users, 
  FolderKanban, 
  Printer
} from "lucide-react";
import { ReportPeriod, Project, User } from "../types";
import { CustomSelect } from "../components";
import ReportsPdfDocument from "../components/ReportsPdfDocument";

// 🌐 تبدیل اعداد به فارسی
export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

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
// 🏛️ مودال متمرکز ممیزی استراتژیک (Centered WBS Audit Modal)
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

  const runSingleReportAudit = async () => {
    if (!reportId) return;
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
        setModelUsed(data.model_used || "AI Engine");
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in dir-rtl">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* هدر مودال */}
        <div className="p-5 md:p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base md:text-lg">ممیزی و ارزیابی استراتژیک گزارش (WBS)</h3>
              <p className="text-xs text-slate-400 mt-0.5">{reportTitle}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* بدنه محتوا */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50/50 text-right">
          {loading && (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
              <p className="text-sm font-bold text-slate-700">در حال تطابق گزارش با ساختار شکست کار (WBS)...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {auditData && (
            <div className="space-y-6">
              {modelUsed && (
                <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200/80 text-xs text-slate-600 shadow-2xs">
                  <span className="flex items-center gap-2 font-medium">
                    <Cpu className="w-4 h-4 text-emerald-600" />
                    موتور پردازشگر ممیزی: <strong>{modelUsed}</strong>
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-[11px] font-bold">
                    ارزیابی فعال
                  </span>
                </div>
              )}

              {/* ۱. اصالت و شباهت‌سنجی */}
              <div className={`p-5 rounded-2xl border transition-all ${
                auditData.repetitiveness_assessment?.is_duplicate_risk 
                  ? "bg-rose-50/80 border-rose-200 text-rose-950" 
                  : "bg-emerald-50/80 border-emerald-200 text-emerald-950"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-sm flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    سنجش اصالت و شباهت‌سنجی متنی گزارش
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    auditData.repetitiveness_assessment?.is_duplicate_risk 
                      ? "bg-rose-200 text-rose-800" 
                      : "bg-emerald-200 text-emerald-800"
                  }`}>
                    {toPersianDigits(auditData.repetitiveness_assessment?.similarity_percentage || 0)}٪ شباهت به سابقه
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90 mt-2">
                  {auditData.repetitiveness_assessment?.analysis_details}
                </p>
              </div>

              {/* ۲. تطابق با WBS */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-600" />
                    تطابق استراتژیک با WBS مرجع پروژه
                  </span>
                  <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-xl text-xs border border-indigo-100 font-bold">
                    میزان خلق فایده: {auditData.strategic_alignment?.value_creation || "نامشخص"}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {auditData.strategic_alignment?.alignment_analysis}
                </p>
                <div className="text-xs bg-slate-50 p-3 rounded-xl text-slate-600 border border-slate-100">
                  📍 بسته کاری مرتبط: <strong>{auditData.strategic_alignment?.wbs_matching_task || "ثبت نشده"}</strong>
                </div>
              </div>

              {/* ۳. خلاصه مدیریتی */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <FileText className="w-5 h-5 text-amber-500" />
                  خلاصه مدیریتی اقدامات
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  {auditData.executive_summary}
                </p>
              </div>

              {/* ۴. جدول شاخص‌ها */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  پایش و مقایسه شاخص‌های کلیدی عملکرد (KPIs)
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
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
                          <td className="p-3 font-bold text-emerald-600">
                            {kpi.has_kpi ? toPersianDigits(kpi.current_value) : <span className="text-rose-500">فاقد شاخص</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ۵. ددلاین‌ها */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Clock className="w-5 h-5 text-amber-600" />
                  برنامه اقدامات آتی و مهلت‌های زمانی (Deadlines)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(auditData.future_actions_with_deadlines || []).map((act, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 p-3 rounded-xl text-xs border border-slate-100">
                      <span className="text-slate-700 font-medium">{act.action}</span>
                      <span className="bg-amber-100 text-amber-900 px-2.5 py-1 rounded-lg font-bold text-[11px] shrink-0">
                        📅 {toPersianDigits(act.deadline)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ۶. پیشنهادات AI */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  پیشنهادات و اقدامات اصلاحی هوش مصنوعی
                </h4>
                <ul className="space-y-2">
                  {(auditData.recommendations || []).map((rec, i) => (
                    <li key={i} className="text-xs text-slate-700 flex items-start gap-2 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/50 leading-relaxed">
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
// 🚀 کامپوننت اصلی داشبورد مدیریتی
// =================================================================
interface ManagerDashboardProps {
  periods: ReportPeriod[];
  projects: Project[];
  users: User[];
}

export default function ManagerDashboard({ 
  periods = [], 
  projects = [], 
  users = [] 
}: ManagerDashboardProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedDeputy, setSelectedDeputy] = useState<string>("");

  // استخراج لیست یکتای نام معاونت‌ها
  const deputyOptions = useMemo(() => {
    const set = new Set<string>();
    (users || []).filter((u) => u.role === "user" && u.job_title).forEach((u) => {
      if (u.job_title && u.job_title.trim()) set.add(u.job_title.trim());
    });
    return Array.from(set);
  }, [users]);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"visual" | "table">("visual");

  // 🌟 استیت تفکیک حباب‌ها بر اساس معاونت‌ها یا پروژه‌ها
  const [bubbleGroupBy, setBubbleGroupBy] = useState<"user" | "project">("user");
  const [bubbleFilter, setBubbleFilter] = useState<"all" | "submitted" | "late" | "missing">("all");
  const [expandedUserKey, setExpandedUserKey] =  useState<string | null>(null);

  // استیت‌های تحلیل AI کلان
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");

  // استیت‌های ممیزی
  const [auditModalOpen, setAuditModalOpen] = useState<boolean>(false);
  const [selectedAuditReport, setSelectedAuditReport] = useState<{ id: number; title: string } | null>(null);

  // استیت‌های خروجی PDF
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (periods && periods.length > 0) {
      const openPeriod = periods.find((p) => p.is_open);
      setSelectedPeriodId(openPeriod ? openPeriod.id : periods[0].id);
    }
  }, [periods]);

  const fetchSummary = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    setAiAnalysis(null);
    setAiError("");
    try {
      let url = `/api/dashboard/summary?period_id=${selectedPeriodId}`;
      if (selectedProjectId) url += `&project_id=${selectedProjectId}`;
      if (selectedDeputy) url += `&deputy_name=${encodeURIComponent(selectedDeputy)}`;

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
  }, [selectedPeriodId, selectedProjectId, selectedDeputy]);

  useEffect(() => {
    setExpandedUserKey(null);
  }, [
    selectedPeriodId,
    selectedProjectId,
    selectedDeputy,
    bubbleFilter,
    bubbleGroupBy,
  ]);

  const handleRunAiAnalysis = async () => {
    if (!summaryData || !summaryData.rows) return;

    const submittedReports = (summaryData.rows || [])
      .filter((r: any) => r.report !== null)
      .map((r: any) => r.report);

    if (submittedReports.length === 0) {
      setAiError("هیچ گزارشی در این دوره توسط پرسنل ثبت نشده است.");
      return;
    }

    setAiLoading(true);
    setAiError("");

    try {
      const res = await fetch("/api/ai/strategic-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_title: summaryData.period ? summaryData.period.title : "دوره جاری",
          reports: submittedReports,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis);
      } else {
        const errData = await res.json();
        setAiError(errData.error || "خطا در پردازش تحلیل کلان هوش مصنوعی.");
      }
    } catch (err) {
      setAiError("عدم برقراری ارتباط با سرور برای تحلیل AI.");
    } finally {
      setAiLoading(false);
    }
  };

  const rows = summaryData && summaryData.rows ? summaryData.rows : [];

  // 🔮 گروه‌بندی داده‌ها به تفکیک پروژه‌ها
  const projectAggregatedRows = Object.values(
    rows.reduce((acc: any, row: any) => {
      const pTitle = row.project_title || "پروژه عمومی";
      if (!acc[pTitle]) {
        acc[pTitle] = {
          project_title: pTitle,
          total_staff: 0,
          submitted_count: 0,
          late_count: 0,
          missing_count: 0,
          staff_list: [],
        };
      }
      acc[pTitle].total_staff += 1;
      if (row.status_key === "submitted") acc[pTitle].submitted_count += 1;
      if (row.status_key === "late") acc[pTitle].late_count += 1;
      if (row.status_key === "missing") acc[pTitle].missing_count += 1;
      acc[pTitle].staff_list.push(row);
      return acc;
    }, {})
  );

  // گروه‌بندی تمام پروژه‌ها زیر هر پرسنل / معاونت
  const userAggregatedRows = Object.values(
    rows.reduce((acc: Record<string, any>, row: any) => {
      const userKey = String(
        row.user_id ?? row.user_username ?? row.user_full_name
      );

      if (!acc[userKey]) {
        acc[userKey] = {
          user_key: userKey,
          user_id: row.user_id,
          user_full_name: row.user_full_name,
          user_username: row.user_username,
          user_job_title: row.user_job_title,
          deputy_name: row.deputy_name || row.user_job_title || row.user_full_name,
          projects: [],
        };
      }

      const projectExists = acc[userKey].projects.some(
        (projectRow: any) =>
          projectRow.project_id === row.project_id
      );

      if (!projectExists) {
        acc[userKey].projects.push(row);
      }

      return acc;
    }, {})
  ).map((person: any) => {
    const submittedCount = person.projects.filter(
      (project: any) => project.status_key === "submitted"
    ).length;

    const lateCount = person.projects.filter(
      (project: any) => project.status_key === "late"
    ).length;

    const missingCount = person.projects.filter(
      (project: any) => project.status_key === "missing"
    ).length;

    let statusKey: "submitted" | "late" | "missing" = "submitted";
    let statusLabel = "همه گزارش‌ها منظم";

    if (missingCount > 0) {
      statusKey = "missing";
      statusLabel = "دارای پروژه فاقد گزارش";
    } else if (lateCount > 0) {
      statusKey = "late";
      statusLabel = "دارای گزارش تأخیری";
    }

    return {
      ...person,
      submitted_count: submittedCount,
      late_count: lateCount,
      missing_count: missingCount,
      total_projects: person.projects.length,
      status_key: statusKey,
      status_label: statusLabel,
    };
  });

  // اعمال فیلتر روی خود افراد، نه روی پروژه‌های جداگانه
  const filteredUserRows = userAggregatedRows.filter(
    (person: any) => {
      if (bubbleFilter === "all") return true;
      return person.status_key === bubbleFilter;
    }
  );

  // پرسنلی که پروژه‌هایش در لایه دوم باز شده‌اند
  const expandedPerson = expandedUserKey
    ? userAggregatedRows.find(
        (person: any) => person.user_key === expandedUserKey
      )
    : null;


  return (
    <div className="space-y-6 animate-fade-in text-right dir-rtl font-sans">
      
      {/* 🔮 تزریق CSS انیمیشن شناور بودن حباب‌ها */}
      <style>{`
        @keyframes gentleFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        .bubble-floating {
          animation: gentleFloat 4s ease-in-out infinite;
        }
      `}</style>

      {/* هدر پنل */}
      <div className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-700" />
            <span>اتاق کنترل و پایش تعاملی پروژه‌ها</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            مشاهده شناور وضعیت گزارش‌دهی پرسنل و پروژه‌ها به صورت زنده
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            type="button"
            onClick={() => setPdfModalOpen(true)}
            className="bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-600/40 whitespace-nowrap shrink-0"
            title="صدور نسخه رسمی PDF از تمامی گزارش‌ها"
          >
            <Printer className="w-4 h-4 text-emerald-300" />
            <span>خروجی PDF تمام گزارش‌ها</span>
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 min-w-[280px]">
            <CustomSelect
              value={selectedPeriodId}
              onChange={(v) => setSelectedPeriodId(Number(v))}
              options={(periods || []).map((p) => ({ value: p.id, label: toPersianDigits(p.title) }))}
            />
            <CustomSelect
              value={selectedProjectId}
              onChange={(v) => setSelectedProjectId(Number(v))}
              options={[
                { value: 0, label: "همه پروژه‌ها" },
                ...(projects || []).map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
            <CustomSelect
              value={selectedDeputy}
              onChange={(v) => setSelectedDeputy(String(v))}
              options={[
                { value: "", label: "همه معاونت‌ها" },
                ...deputyOptions.map((dep) => ({ value: dep, label: dep })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* خلاصه آماری */}
      {summaryData && summaryData.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-semibold block">کل گزارش‌های مورد انتظار</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {toPersianDigits(summaryData.summary.total_expected || 0)} مورد
              </span>
            </div>
            <div className="w-11 h-11 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-emerald-700 text-xs font-semibold block">ثبت‌شده و منظم</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {toPersianDigits(summaryData.summary.submitted_count || 0)} مورد
              </span>
            </div>
            <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-amber-700 text-xs font-semibold block">ارسال با تأخیر</span>
              <span className="text-2xl font-black text-amber-600 mt-1 block">
                {toPersianDigits(summaryData.summary.late_count || 0)} مورد
              </span>
            </div>
            <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-rose-700 text-xs font-semibold block">ثبت‌نشده (فاقد گزارش)</span>
              <span className="text-2xl font-black text-rose-600 mt-1 block">
                {toPersianDigits(summaryData.summary.missing_count || 0)} مورد
              </span>
            </div>
            <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center border border-rose-100">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* بنر پردازش هوشمند */}
      <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 rounded-3xl p-6 text-white shadow-xl border border-emerald-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-black flex items-center gap-2 text-amber-400">
              <Sparkles className="w-5 h-5" />
              <span>پردازش و ارزیابی استراتژیک کلان دوره</span>
            </h3>
            <p className="text-slate-300 text-xs">
              تجمیع خودکار داده‌ها، محاسبه شاخص سلامت ارگان، استخراج موانع و ارائه پیشنهادات
            </p>
          </div>

          <button
            onClick={handleRunAiAnalysis}
            disabled={aiLoading || loading}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 text-xs shadow-md disabled:opacity-50 shrink-0"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
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

        {aiError && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{aiError}</span>
          </div>
        )}
      </div>

      {/* خروجی تحلیل کلان دوره */}
      {aiAnalysis && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            <div className="md:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between text-center relative overflow-hidden">
              <span className="text-slate-400 text-xs font-bold block">شاخص سلامت کلی پروژه‌ها</span>
              
              <div className="my-4 space-y-1">
                <span className="text-5xl font-black text-slate-900">{toPersianDigits(aiAnalysis.health_score || 0)}</span>
                <span className="text-slate-400 text-xs"> از ۱۰۰</span>
                <div className="pt-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    aiAnalysis.overall_status === "پایدار"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    وضعیت: {aiAnalysis.overall_status || "نامشخص"}
                  </span>
                </div>
              </div>

              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-amber-500 h-2.5 rounded-full transition-all duration-1000"
                  style={{ width: `${aiAnalysis.health_score || 0}%` }}
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
                {(aiAnalysis.key_achievements || []).map((ach, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/50 leading-relaxed">
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full mt-1.5 shrink-0"></span>
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
                {(aiAnalysis.risks_and_delays || []).map((risk, idx) => (
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
                {(aiAnalysis.actionable_recommendations || []).map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 bg-amber-50/40 p-2.5 rounded-xl border border-amber-100/50 leading-relaxed">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-1.5 shrink-0"></span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 🔮 نوار کنترل تعاملی دو حالته (پرسنل / پروژه) */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-5 text-white shadow-lg border border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h3 className="text-sm font-black text-amber-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span>شبکه دیداری و شناور حباب‌های پایش</span>
          </h3>
          <p className="text-slate-400 text-[11px] mt-0.5">
            سوییچ بین تفکیک پرسنل یا تفکیک کلان پروژه‌ها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          
          {/* 🌟 انتخاب حالت تفکیک (معاونت‌ها یا پروژه‌ها) */}
          <div className="flex items-center bg-slate-800/90 p-1 rounded-2xl border border-slate-700 text-[11px]">
            <button
              onClick={() => setBubbleGroupBy("user")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                bubbleGroupBy === "user" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>تفکیک معاونت‌ها</span>
            </button>
            <button
              onClick={() => setBubbleGroupBy("project")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                bubbleGroupBy === "project" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-300 hover:text-white"
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>تفکیک پروژه‌ها</span>
            </button>
          </div>

          {/* فیلترهای وضعیت در حالت پرسنل */}
          {bubbleGroupBy === "user" && (
            <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700 text-[11px]">
              <button
                onClick={() => setBubbleFilter("all")}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  bubbleFilter === "all" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                همه ({toPersianDigits(userAggregatedRows.length)})
              </button>
              <button
                onClick={() => setBubbleFilter("submitted")}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  bubbleFilter === "submitted" ? "bg-emerald-500/30 text-emerald-300" : "text-slate-400 hover:text-white"
                }`}
              >
                منظم ({toPersianDigits(
                  userAggregatedRows.filter(
                    (person: any) => person.status_key === "submitted"
                  ).length
                )})
              </button>
              <button
                onClick={() => setBubbleFilter("late")}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  bubbleFilter === "late" ? "bg-amber-500/30 text-amber-300" : "text-slate-400 hover:text-white"
                }`}
              >
                تأخیری ({toPersianDigits(
                  userAggregatedRows.filter(
                    (person: any) => person.status_key === "late"
                  ).length
                )})
              </button>
              <button
                onClick={() => setBubbleFilter("missing")}
                className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                  bubbleFilter === "missing" ? "bg-rose-500/30 text-rose-300" : "text-slate-400 hover:text-white"
                }`}
              >
                فاقد گزارش ({toPersianDigits(
                  userAggregatedRows.filter(
                    (person: any) => person.status_key === "missing"
                  ).length
                )})
              </button>
            </div>
          )}

          {/* سوئیچ بین حالت حباب و جدول */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700 text-[11px]">
            <button
              onClick={() => setViewMode("visual")}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === "visual" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="نمایش حباب‌های دیداری"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === "table" ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
              }`}
              title="نمایش جدول ماتریسی"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* 🟢 بخش نمایش شناور حباب‌ها (Visual Mode) */}
      {viewMode === "visual" ? (
        <div className="bg-slate-950/90 rounded-3xl p-8 md:p-12 border border-slate-800 relative min-h-[440px] overflow-visible flex items-center justify-center">
          
          <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:20px_20px] opacity-25 rounded-3xl"></div>

          {loading ? (
            <div className="text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
              <span>در حال بارگذاری شبکه شناور حباب‌ها...</span>
            </div>
          ) : bubbleGroupBy === "user" ? (
            
            /* 🟢 حالت ۱: حباب‌های شناور به تفکیک پرسنل */
            filteredUserRows.length === 0 ? (
              <div className="text-slate-400 text-xs text-center">
                هیچ گزارشی یافت نشد.
              </div>
            ) : (
              <div className="relative z-10 w-full space-y-10">

                {/* لایه اول: حباب‌های پرسنل */}
                <div className="flex flex-wrap items-center justify-center gap-8 md:gap-12 pt-10">
                  {filteredUserRows.map((person: any, idx: number) => {
                    const isSubmitted =
                      person.status_key === "submitted";

                    const isLate =
                      person.status_key === "late";

                    const isExpanded =
                      expandedUserKey === person.user_key;

                    const bubbleColor = isSubmitted
                      ? "from-emerald-500 to-teal-600 shadow-emerald-500/40 border-emerald-400/50"
                      : isLate
                      ? "from-amber-500 to-yellow-600 shadow-amber-500/40 border-amber-400/50"
                      : "from-rose-600 to-red-700 shadow-rose-600/40 border-rose-400/50";

                    const icon = isSubmitted ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : isLate ? (
                      <AlertTriangle className="w-5 h-5 text-white" />
                    ) : (
                      <ShieldAlert className="w-5 h-5 text-white" />
                    );

                    return (
                      <div
                        key={`person-${person.user_key}`}
                        className="relative flex flex-col items-center"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedUserKey((current) =>
                              current === person.user_key
                                ? null
                                : person.user_key
                            );
                          }}
                          style={{
                            animationDelay: `${(idx % 4) * 0.7}s`,
                            animationDuration: `${
                              3.5 + (idx % 3) * 0.5
                            }s`,
                          }}
                          className={`
                            bubble-floating
                            w-36 h-36 md:w-40 md:h-40
                            rounded-full
                            bg-gradient-to-br
                            ${bubbleColor}
                            border-2 shadow-2xl
                            flex flex-col items-center justify-center
                            text-center p-3 text-white
                            transition-all duration-300
                            cursor-pointer relative
                            hover:scale-110
                            ${
                              isExpanded
                                ? "ring-4 ring-amber-400 ring-offset-4 ring-offset-slate-950 scale-110"
                                : ""
                            }
                          `}
                        >
                          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-1">
                            {icon}
                          </div>

                          <span className="font-black text-xs md:text-sm line-clamp-2 px-1.5 leading-tight">
                            {person.deputy_name || person.user_job_title || person.user_full_name}
                          </span>

                          {person.user_job_title && (
                            <span className="text-[10px] text-amber-200 font-bold opacity-90 mt-0.5 line-clamp-1">
                              {person.user_full_name}
                            </span>
                          )}

                          <span className="text-[10px] opacity-90 mt-1">
                            {toPersianDigits(person.total_projects)} پروژه
                          </span>

                          <span className="mt-2 bg-black/30 backdrop-blur-md text-[9px] px-2.5 py-0.5 rounded-full font-bold">
                            {isExpanded
                              ? "پروژه‌ها باز هستند"
                              : "مشاهده پروژه‌ها"}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* لایه دوم: تمام پروژه‌های پرسنل انتخاب‌شده */}
                {expandedPerson && (
                  <div className="border-t border-slate-700/70 pt-8 animate-fade-in">

                    <div className="flex items-center justify-between gap-4 mb-7">
                      <div>
                        <h4 className="text-amber-400 font-black text-sm flex items-center gap-2">
                          <FolderKanban className="w-4 h-4" />

                          پروژه‌های {expandedPerson.deputy_name || expandedPerson.user_full_name}
                        </h4>

                        <p className="text-slate-400 text-[11px] mt-1">
                          {toPersianDigits(expandedPerson.total_projects)}
                          {" "}پروژه در این دوره (مسئول: {expandedPerson.user_full_name})
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedUserKey(null)}
                        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        بستن پروژه‌ها
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-7 md:gap-10">
                      {expandedPerson.projects.map(
                        (projectRow: any, projectIndex: number) => {
                          const projectSubmitted =
                            projectRow.status_key === "submitted";

                          const projectLate =
                            projectRow.status_key === "late";

                          const projectColor = projectSubmitted
                            ? "from-emerald-500 to-teal-700 border-emerald-400/50 shadow-emerald-500/30"
                            : projectLate
                            ? "from-amber-500 to-orange-700 border-amber-400/50 shadow-amber-500/30"
                            : "from-rose-600 to-red-800 border-rose-400/50 shadow-rose-500/30";

                          return (
                            <button
                              type="button"
                              key={`${expandedPerson.user_key}-${projectRow.project_id}`}
                              disabled={!projectRow.report}
                              onClick={() => {
                                if (!projectRow.report) return;

                                setSelectedAuditReport({
                                  id: projectRow.report.id,
                                  title:
                                    `گزارش ${expandedPerson.user_full_name} - ${projectRow.project_title}`,
                                });

                                setAuditModalOpen(true);
                              }}
                              style={{
                                animationDelay: `${
                                  (projectIndex % 4) * 0.3
                                }s`,
                              }}
                              className={`
                                w-28 h-28 md:w-32 md:h-32
                                rounded-full
                                bg-gradient-to-br
                                ${projectColor}
                                border-2 shadow-xl
                                flex flex-col items-center justify-center
                                text-center p-3 text-white
                                transition-all duration-300
                                ${
                                  projectRow.report
                                    ? "cursor-pointer hover:scale-110 hover:-translate-y-2"
                                    : "cursor-not-allowed opacity-70"
                                }
                              `}
                            >
                              <FolderKanban className="w-5 h-5 mb-2 text-white" />

                              <span className="font-black text-[10px] md:text-[11px] line-clamp-3 leading-relaxed">
                                {projectRow.project_title}
                              </span>

                              <span className="mt-2 bg-black/30 text-[8px] px-2 py-0.5 rounded-full font-bold">
                                {projectRow.status_label}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : (

            /* 🟢 حالت ۲: حباب‌های شناور به تفکیک کلان پروژه‌ها */
            projectAggregatedRows.length === 0 ? (
              <div className="text-slate-400 text-xs text-center">هیچ پروژه‌ای یافت نشد.</div>
            ) : (
              <div className="relative z-10 w-full flex flex-wrap items-center justify-center gap-10 md:gap-14 pt-16 pb-8">
                {projectAggregatedRows.map((proj: any, idx: number) => {
                  const healthPercent = Math.round(((proj.submitted_count + proj.late_count) / proj.total_staff) * 100) || 0;
                  
                  const isHighHealth = healthPercent >= 80;
                  const isMediumHealth = healthPercent >= 40;

                  const bubbleColor = isHighHealth
                    ? "from-teal-500 to-emerald-700 shadow-teal-500/40 border-emerald-400/50"
                    : isMediumHealth
                    ? "from-amber-500 to-orange-600 shadow-amber-500/40 border-amber-400/50"
                    : "from-rose-600 to-red-800 shadow-rose-600/40 border-rose-400/50";

                  return (
                    <div key={idx} className="group relative flex flex-col items-center">
                      
                      {/* کارت شناور جزئیات کامل پرسنل پروژه (Tooltip) */}
                      <div className="absolute bottom-full mb-3 right-1/2 translate-x-1/2 w-80 bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-slate-700/80 text-xs opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 z-40 space-y-2 backdrop-blur-md">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                          <span className="font-black text-amber-400">{proj.project_title}</span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                            {toPersianDigits(healthPercent)}٪ پوشش عملکرد
                          </span>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <span className="text-[11px] text-slate-400 font-bold block">وضعیت پرسنل این پروژه:</span>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {proj.staff_list.map((st: any, sIdx: number) => (
                              <div key={sIdx} className="flex justify-between items-center bg-slate-800/60 p-1.5 rounded-lg text-[11px]">
                                <span className="font-semibold text-slate-200">{st.user_full_name}</span>
                                <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                                  st.status_key === "submitted" 
                                    ? "bg-emerald-500/20 text-emerald-300" 
                                    : st.status_key === "late" 
                                    ? "bg-amber-500/20 text-amber-300" 
                                    : "bg-rose-500/20 text-rose-300"
                                }`}>
                                  {st.status_label}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* حباب شناور پروژه با انیمیشن زنده */}
                      <div
                        style={{
                          animationDelay: `${(idx % 4) * 0.8}s`,
                          animationDuration: `${4 + (idx % 3) * 0.6}s`
                        }}
                        className={`bubble-floating w-44 h-44 md:w-48 md:h-48 rounded-full bg-gradient-to-br ${bubbleColor} border-2 shadow-2xl flex flex-col items-center justify-center text-center p-4 text-white transition-all duration-300 transform group-hover:scale-110 group-hover:-translate-y-2 relative`}
                      >
                        <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-1">
                          <FolderKanban className="w-5 h-5 text-white" />
                        </div>

                        <span className="font-black text-xs md:text-sm line-clamp-2 px-2">{proj.project_title}</span>
                        
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] bg-black/30 backdrop-blur-md px-3 py-1 rounded-full font-bold">
                          <span>{toPersianDigits(proj.submitted_count + proj.late_count)} از {toPersianDigits(proj.total_staff)} معاون </span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      ) : (

        /* 📊 حالت جدول کلاسیک ماتریسی */
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-400 font-semibold">
                  <th className="p-4">نام معاونت / پرسنل مسئول</th>
                  <th className="p-4">پروژه</th>
                  <th className="p-4">وضعیت نهایی</th>
                  <th className="p-4">توضیحات / جزئیات</th>
                  <th className="p-4">عملیات ممیزی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-slate-900">{row.deputy_name || row.user_job_title || row.user_full_name}</span>
                        {row.user_job_title && (
                          <span className="text-[10px] text-slate-400 font-normal">{row.user_full_name}</span>
                        )}
                      </div>
                    </td>
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

                    <td className="p-4">
                      {row.report ? (
                        <button
                          onClick={() => {
                            setSelectedAuditReport({
                              id: row.report.id,
                              title: `گزارش ${row.user_full_name} - ${row.project_title}`,
                            });
                            setAuditModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-1.5 rounded-xl border border-amber-200/80 text-[11px] font-bold transition-all cursor-pointer shadow-2xs"
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
        </div>
      )}

      {/* 🏛️ رندر مودال متمرکز ممیزی */}
      <SingleReportAuditModal
        reportId={selectedAuditReport?.id || null}
        reportTitle={selectedAuditReport?.title || ""}
        isOpen={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
      />

      {/* 📄 رندر مودال خروجی PDF جامع تمام گزارش‌ها */}
      <ReportsPdfDocument
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        periods={periods}
        projects={projects}
        users={users}
        defaultPeriodId={selectedPeriodId}
      />

    </div>
  );
}