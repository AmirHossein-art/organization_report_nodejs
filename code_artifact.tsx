import React, { useState, useEffect, useMemo } from "react";
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
  X,
  LayoutGrid,
  Zap,
  Filter,
  ChevronDown
} from "lucide-react";
import { ReportPeriod, Project, User } from "../types";

interface CustomSelectProps {
  value: number | string;
  onChange: (value: number | string) => void;
  options: { value: number | string; label: string }[];
  placeholder?: string;
}

function InlineCustomSelect({ value, onChange, options }: CustomSelectProps) {
  return (
    <div className="relative inline-block w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-white border border-slate-200 text-slate-800 text-xs rounded-2xl px-3.5 py-2.5 pr-8 pl-8 font-medium shadow-2xs hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-2.5 text-slate-400">
        <ChevronDown className="w-3.5 h-3.5" />
      </div>
    </div>
  );
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
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-md transition-all animate-fade-in">
      <div className="absolute inset-y-0 left-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col dir-rtl border-r border-slate-100">
          
          {/* Drawer Header */}
          <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-100">ممیزی و ارزیابی استراتژیک WBS</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">{reportTitle}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-slate-50/60">
            {loading && (
              <div className="py-24 text-center space-y-4">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-amber-400/20 animate-ping"></div>
                  <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                  </div>
                </div>
                <p className="text-xs font-bold text-slate-700">در حال تطابق گزارش با ساختار شکست کار (WBS)...</p>
                <p className="text-[11px] text-slate-400">استخراج شاخص‌ها و سنجش کپی‌برداری متنی</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs flex items-center gap-2 shadow-xs">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {auditData && (
              <>
                {modelUsed && (
                  <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 text-xs font-mono text-slate-600 shadow-2xs">
                    <span className="flex items-center gap-2 text-[11px]">
                      <Cpu className="w-4 h-4 text-emerald-600" />
                      موتور ممیزی فعال: <strong className="text-slate-900 font-bold">{modelUsed}</strong>
                    </span>
                    <span className="text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-[10px] font-bold">پردازش آنلاین</span>
                  </div>
                )}

                {/* Similarity Assessment */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  auditData.repetitiveness_assessment.is_duplicate_risk 
                    ? "bg-rose-50/90 border-rose-200 text-rose-950 shadow-rose-100 shadow-sm" 
                    : "bg-emerald-50/90 border-emerald-200 text-emerald-950 shadow-emerald-100 shadow-sm"
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-xs flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      سنجش اصالت و کپی‌برداری متنی
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      auditData.repetitiveness_assessment.is_duplicate_risk 
                        ? "bg-rose-200/80 text-rose-900" 
                        : "bg-emerald-200/80 text-emerald-900"
                    }`}>
                      {auditData.repetitiveness_assessment.similarity_percentage}٪ شباهت با سابقه
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed opacity-90">
                    {auditData.repetitiveness_assessment.analysis_details}
                  </p>
                </div>

                {/* WBS Strategic Alignment */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-2">
                      <Target className="w-4 h-4 text-indigo-600" />
                      تطابق استراتژیک با بسته‌های WBS
                    </span>
                    <span className="bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg text-[10px] border border-indigo-100 font-extrabold">
                      خلق ارزش: {auditData.strategic_alignment.value_creation}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {auditData.strategic_alignment.alignment_analysis}
                  </p>
                  <div className="text-[11px] bg-slate-50 p-2.5 rounded-xl text-slate-600 border border-slate-100 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                    <span>بسته کاری مرتبط: <strong className="text-slate-900">{auditData.strategic_alignment.wbs_matching_task}</strong></span>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    خلاصه کارشناسی گزارش
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {auditData.executive_summary}
                  </p>
                </div>

                {/* KPIs Table */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    پایش و مقایسه شاخص‌های KPI
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
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
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

                {/* Future Actions */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    برنامه آتی و ددلاین‌های زمانی
                  </h4>
                  <div className="space-y-2">
                    {auditData.future_actions_with_deadlines.map((act, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl text-xs border border-slate-100">
                        <span className="text-slate-700">{act.action}</span>
                        <span className="bg-amber-100/80 text-amber-900 px-2.5 py-0.5 rounded-lg font-mono font-bold text-[10px]">
                          📅 {act.deadline}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Recommendations */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs flex items-center gap-2 border-b border-slate-100 pb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    پیشنهادات اصلاحی هوش مصنوعی
                  </h4>
                  <ul className="space-y-2">
                    {auditData.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-2 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100/50">
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

function SmartBubbleVisualizer({ 
  rows, 
  onSelectReport 
}: { 
  rows: any[]; 
  onSelectReport: (reportId: number, title: string) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredRows = useMemo(() => {
    if (filterStatus === "all") return rows;
    return rows.filter((r) => r.status_key === filterStatus);
  }, [rows, filterStatus]);

  return (
    <div className="space-y-4">
      {/* Visual Canvas Filter and Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-900/90 text-white p-4 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100">شبکه دیداری و تعاملی حباب‌های عملکرد</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">برای مشاهده شناور اطلاعات موس را روی هر حباب قرار دهید</p>
          </div>
        </div>

        {/* Quick Filter Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-[11px]">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer font-medium ${
              filterStatus === "all" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            همه ({rows.length})
          </button>
          <button
            onClick={() => setFilterStatus("submitted")}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer font-medium ${
              filterStatus === "submitted" ? "bg-emerald-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            منظم ({rows.filter(r => r.status_key === "submitted").length})
          </button>
          <button
            onClick={() => setFilterStatus("late")}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer font-medium ${
              filterStatus === "late" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            تأخیری ({rows.filter(r => r.status_key === "late").length})
          </button>
          <button
            onClick={() => setFilterStatus("missing")}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer font-medium ${
              filterStatus === "missing" ? "bg-rose-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
            }`}
          >
            فاقد گزارش ({rows.filter(r => r.status_key === "missing").length})
          </button>
        </div>
      </div>

      {/* Floating Canvas Grid */}
      <div className="relative min-h-[460px] bg-slate-950 rounded-3xl p-8 border border-slate-800 shadow-2xl overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>

        {filteredRows.length === 0 ? (
          <div className="text-center text-slate-500 space-y-2 z-10">
            <Filter className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs">هیچ حباب و گزارشی مطابق فیلتر انتخابی یافت نشد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 z-10 w-full max-w-6xl py-6">
            {filteredRows.map((row, index) => {
              const isHovered = hoveredIndex === index;
              const hasReport = !!row.report;
              
              const floatDelay = (index % 5) * 0.4;
              const floatDuration = 3 + (index % 3);

              let gradient = "from-slate-700 to-slate-800 text-slate-200 border-slate-600 shadow-slate-900/50";
              let ringColor = "ring-slate-500/30";
              let statusBadge = "bg-slate-800 text-slate-400";
              let glowEffect = "hover:shadow-slate-500/20";

              if (row.status_key === "submitted") {
                gradient = "from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-400/50 shadow-emerald-600/30";
                ringColor = "ring-emerald-400/50";
                statusBadge = "bg-emerald-400/20 text-emerald-200 border-emerald-400/30";
                glowEffect = "hover:shadow-emerald-500/40";
              } else if (row.status_key === "late") {
                gradient = "from-amber-500 via-orange-500 to-amber-600 text-slate-950 border-amber-300/60 shadow-amber-500/30";
                ringColor = "ring-amber-400/50";
                statusBadge = "bg-amber-950/40 text-amber-200 border-amber-400/40";
                glowEffect = "hover:shadow-amber-500/40";
              } else if (row.status_key === "missing") {
                gradient = "from-rose-600 via-red-600 to-rose-700 text-white border-rose-400/50 shadow-rose-600/30";
                ringColor = "ring-rose-400/50";
                statusBadge = "bg-rose-950/40 text-rose-200 border-rose-400/30";
                glowEffect = "hover:shadow-rose-500/40";
              }

              return (
                <div
                  key={index}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="relative flex flex-col items-center justify-center group"
                >
                  {/* Main Animated Floating Bubble */}
                  <div
                    style={{
                      animation: `floating ${floatDuration}s ease-in-out infinite alternate`,
                      animationDelay: `${floatDelay}s`
                    }}
                    onClick={() => {
                      if (hasReport) {
                        onSelectReport(
                          row.report.id,
                          `گزارش ${row.user_full_name} - ${row.project_title}`
                        );
                      }
                    }}
                    className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr ${gradient} border-2 flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all duration-500 shadow-xl ${glowEffect} ${
                      isHovered ? "scale-115 z-30 ring-8 " + ringColor : "scale-100 z-10"
                    }`}
                  >
                    <div className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
                      isHovered ? "opacity-100 bg-white/20 blur-md" : "opacity-0"
                    }`}></div>

                    <div className="mb-1">
                      {row.status_key === "submitted" && <CheckCircle2 className="w-5 h-5 text-emerald-100 animate-bounce" />}
                      {row.status_key === "late" && <AlertTriangle className="w-5 h-5 text-slate-950" />}
                      {row.status_key === "missing" && <ShieldAlert className="w-5 h-5 text-rose-100" />}
                    </div>

                    <span className="font-extrabold text-[11px] leading-tight truncate max-w-[90%]">
                      {row.user_full_name}
                    </span>

                    <span className="text-[9px] opacity-80 truncate max-w-[85%] mt-0.5">
                      {row.project_title}
                    </span>

                    <span className={`mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold border backdrop-blur-xs ${statusBadge}`}>
                      {row.status_label}
                    </span>
                  </div>

                  {/* Interactive Tooltip Card */}
                  {isHovered && (
                    <div className="absolute bottom-full mb-3 w-64 bg-slate-900/95 text-white p-4 rounded-2xl border border-slate-700 shadow-2xl backdrop-blur-xl z-50 animate-fade-in pointer-events-none dir-rtl">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2">
                        <div>
                          <h5 className="font-bold text-xs text-amber-400">{row.user_full_name}</h5>
                          <p className="text-[10px] text-slate-400">{row.project_title}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          row.status_key === "submitted" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                        }`}>
                          {row.status_label}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-[10px] text-slate-300">
                        <div className="flex justify-between">
                          <span className="text-slate-400">شناسه کاربر:</span>
                          <span className="font-mono">{row.user_username}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">خلاصه فعالیت:</span>
                          <span className="text-slate-200 truncate max-w-[130px]">
                            {hasReport ? row.report.activities_done : "گزارشی ثبت نشده"}
                          </span>
                        </div>
                        {hasReport && (
                          <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800">
                            <span>تاریخ ثبت:</span>
                            <span className="font-mono">{new Date(row.report.submitted_at).toLocaleDateString("fa-IR")}</span>
                          </div>
                        )}
                      </div>

                      {hasReport && (
                        <div className="mt-3 pt-2 border-t border-slate-800/80 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                            <Sparkles className="w-3 h-3" /> برای ممیزی WBS کلیک کنید
                          </span>
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
    </div>
  );
}

export default function ManagerDashboard({ periods, projects, users }: ManagerDashboardProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedUserId, setSelectedUserId] = useState<number>(0);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [viewMode, setViewMode] = useState<"visual" | "table">("visual");

  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string>("");

  const [auditDrawerOpen, setAuditDrawerOpen] = useState<boolean>(false);
  const [selectedAuditReport, setSelectedAuditReport] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    if (periods.length > 0) {
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
    <div className="space-y-6 animate-fade-in text-xs">
      <style>{`
        @keyframes floating {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(1deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
      `}</style>

      {/* Header controls and View Mode toggle */}
      <div className="bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-600" />
            <span>اتاق کنترل و پایش تعاملی پروژه‌ها</span>
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            مشاهده تعاملی وضعیت گزارش‌دهی پرسنل به صورت شبکه‌ای و ممیزی هوشمند استراتژیک
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200/80 w-full sm:w-auto justify-center">
            <button
              onClick={() => setViewMode("visual")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                viewMode === "visual"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>نمایش حبابی دیداری</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span>جدول ماتریسی</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto min-w-[320px]">
            <InlineCustomSelect
              value={selectedPeriodId}
              onChange={(v) => setSelectedPeriodId(Number(v))}
              options={periods.map((p) => ({ value: p.id, label: p.title }))}
            />
            <InlineCustomSelect
              value={selectedProjectId}
              onChange={(v) => setSelectedProjectId(Number(v))}
              options={[
                { value: 0, label: "همه پروژه‌ها" },
                ...projects.map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
            <InlineCustomSelect
              value={selectedUserId}
              onChange={(v) => setSelectedUserId(Number(v))}
              options={[
                { value: 0, label: "همه پرسنل" },
                ...users.filter((u) => u.role === "user").map((u) => ({ value: u.id, label: u.full_name })),
              ]}
            />
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summaryData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-[11px] font-bold block">کل گزارش‌های مورد انتظار</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {summaryData.summary.total_expected} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-emerald-600 text-[11px] font-bold block">ثبت‌شده و منظم</span>
              <span className="text-xl font-black text-emerald-700 mt-1 block">
                {summaryData.summary.submitted_count} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-amber-600 text-[11px] font-bold block">ارسال با تأخیر</span>
              <span className="text-xl font-black text-amber-600 mt-1 block">
                {summaryData.summary.late_count} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-rose-100 rounded-2xl p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-rose-600 text-[11px] font-bold block">ثبت‌نشده (فاقد گزارش)</span>
              <span className="text-xl font-black text-rose-600 mt-1 block">
                {summaryData.summary.missing_count} مورد
              </span>
            </div>
            <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-100">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* Macro AI Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-emerald-950 to-slate-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h3 className="text-base font-bold flex items-center gap-2 text-amber-400">
              <Sparkles className="w-5 h-5" />
              <span>پردازش و ارزیابی استراتژیک کلان دوره</span>
            </h3>
            <p className="text-slate-300 text-xs">
              تجمیع خودکار داده‌ها، محاسبه شاخص سلامت ارگان، استخراج موانع و ارائه پیشنهادات توسعه
            </p>
          </div>

          <button
            onClick={handleRunAiAnalysis}
            disabled={aiLoading || loading}
            className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-5 py-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 text-xs shadow-md disabled:opacity-50 flex-shrink-0"
          >
            {aiLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>در حال ارزیابی کلان...</span>
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

      {/* AI Macro Analysis Results */}
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
                <TrendingUp className="w-4 h-4 text-emerald-600" />
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
                <span>دستاوردهای کلیدی دوره</span>
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
                <span>پیشنهادات اجرایی و کاربردی</span>
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

      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2 border border-slate-200/80">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span>در حال دریافت و بروزرسانی شبکه اطلاعات...</span>
        </div>
      ) : !summaryData || summaryData.rows.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-400 text-xs border border-slate-200/80">
          هیچ تخصیص پروژه‌ای برای فیلتر انتخابی یافت نشد.
        </div>
      ) : viewMode === "visual" ? (
        <SmartBubbleVisualizer
          rows={summaryData.rows}
          onSelectReport={(id, title) => {
            setSelectedAuditReport({ id, title });
            setAuditDrawerOpen(true);
          }}
        />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <span>جدول تفکیکی وضعیت گزارش‌دهی پروژه‌ها</span>
            </h3>
            <span className="text-[11px] text-slate-400">بر اساس بازه زمانی فعال</span>
          </div>

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
        </div>
      )}

      <SingleReportAuditDrawer
        reportId={selectedAuditReport?.id || null}
        reportTitle={selectedAuditReport?.title || ""}
        isOpen={auditDrawerOpen}
        onClose={() => setAuditDrawerOpen(false)}
      />
    </div>
  );
}