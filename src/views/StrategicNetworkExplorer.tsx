import { useState, useEffect, useMemo, useRef } from "react";
import {

  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Network,
  RefreshCw,
  Search,
  Filter,
  Sparkles,





  Check,


  Globe,
  Table as TableIcon,
} from "lucide-react";
import { Project } from "../types";
import { toPersianDigits } from "../dateUtils";
import SemanticNetworkCanvas from "../components/SemanticNetworkCanvas";
import type { SemanticGraph } from "../semantic/strategicGraph";

interface WbsNodeItem {
  id: number;
  code: string;
  title: string;
  level: number;
  node_type: string;
  deliverable_text: string | null;
  responsible: string | null;
  prerequisite: string | null;
  sort_order: number;
  active: boolean;
  kpis: Array<{ id: number; name: string; unit: string; target_value: number | null }>;
}

interface ActivityItem {
  id: number;
  report_id: number;
  period_title: string;
  period_id: number;
  line_number: number;
  activity_text: string;
  wbs_node_id: number | null;
  confidence: number | null;
  status: string; // auto_confirmed | needs_review | confirmed | overridden | unmapped
  ai_reasoning: string | null;
  audit_feedback: string | null;
  created_at: string;
}

interface NextActionItem {
  id: number;
  action_text: string;
  wbs_node_id: number | null;
  target_date: string | null;
  is_completed: boolean;
  is_cancelled: boolean;
  user_name: string | null;
}

interface KpiItem {
  id: number;
  name: string;
  unit: string;
  baseline_value: number | null;
  target_value: number | null;
  target_direction: string;
}

interface StrategicGraphResponse {
  semantic?: SemanticGraph;
  project: {
    id: number;
    title: string;
    code: string;
  };
  nodes: {
    wbsNodes: WbsNodeItem[];
    activities: ActivityItem[];
    nextActions: NextActionItem[];
    kpis: KpiItem[];
  };
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    status?: string;
  }>;
  stats: {
    totalWbs: number;
    totalActivities: number;
    autoConfirmedActivities: number;
    needsReviewActivities: number;
    unmappedActivities: number;
    totalNextActions: number;
    totalKpis: number;
  };
}

interface StrategicNetworkExplorerProps {
  projects: Project[];
}

export default function StrategicNetworkExplorer({ projects }: StrategicNetworkExplorerProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number>(() => {
    return projects.length > 0 ? projects[0].id : 0;
  });

  const [graphData, setGraphData] = useState<StrategicGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [isGlobalSyncing, setIsGlobalSyncing] = useState<boolean>(false);
  const [globalSyncProgress, setGlobalSyncProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedProjectIdRef = useRef<number>(selectedProjectId);
  selectedProjectIdRef.current = selectedProjectId;

  const projectPollingRef = useRef<any>(null);
  const requestEpochRef = useRef(0);
  const mountedRef = useRef(true);
  const globalPollingRef = useRef<any>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (globalPollingRef.current) clearInterval(globalPollingRef.current);
    };
  }, []);

  // وضعیت فیلترها و نمایش
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [statusFilter, setStatusFilter] = useState<"all" | "needs_review" | "auto_confirmed" | "unmapped">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [editingWbsId, setEditingWbsId] = useState<number | "none">("none");
  const [isUpdatingLink, setIsUpdatingLink] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // بزرگ‌نمایی و کنترل‌های کانواس


  // خواندن داده‌های گراف پروژه
  const fetchGraphData = async (projectId: number) => {
    if (!projectId || !mountedRef.current || selectedProjectIdRef.current !== projectId) return;
    const epoch = requestEpochRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategic-graph`);
      if (!res.ok) {
        throw new Error("خطا در دریافت شبکه استراتژیک پروژه.");
      }
      const data: StrategicGraphResponse = await res.json();
      if (mountedRef.current && requestEpochRef.current === epoch && selectedProjectIdRef.current === projectId) {
        setGraphData(data);
      }
    } catch (err: any) {
      if (mountedRef.current && requestEpochRef.current === epoch && selectedProjectIdRef.current === projectId) {
        setError(err?.message || "خطای ناشناخته در دریافت داده‌های گراف.");
        setGraphData(null);
      }
    } finally {
      if (mountedRef.current && requestEpochRef.current === epoch && selectedProjectIdRef.current === projectId) {
        setIsLoading(false);
      }
    }
  };

  const startProjectPolling = (pId: number) => {
    if (projectPollingRef.current) clearInterval(projectPollingRef.current);
    projectPollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/projects/${pId}/sync-status`);
        const job = await res.json();
        if (selectedProjectIdRef.current === pId) {
          if (job.status === "running") {
            setIsSyncing(true);
            setSyncProgress(`در حال پردازش گزارش ${toPersianDigits(job.processedReports)} از ${toPersianDigits(job.totalReports)}...`);
            // بهینه‌سازی: عدم لود کل گراف در هر تیک ۳ ثانیه‌ای جهت حفظ پهنای باند و منابع دیتابیس
          } else if (job.status === "completed") {
            clearInterval(projectPollingRef.current);
            projectPollingRef.current = null;
            setIsSyncing(false);
            setSyncProgress(null);
            setToastMessage({
              text: `ممیزی هوشمند با موفقیت تکمیل شد: ${toPersianDigits(job.activitiesCreated)} فعالیت متصل گردید.`,
              type: "success",
            });
            fetchGraphData(pId);
          } else if (job.status === "failed") {
            clearInterval(projectPollingRef.current);
            projectPollingRef.current = null;
            setIsSyncing(false);
            setSyncProgress(null);
            setToastMessage({
              text: job.error || "پردازش ممیزی با خطا مواجه شد.",
              type: "error",
            });
          } else {
            setIsSyncing(false);
            setSyncProgress(null);
          }
        }
      } catch { }
    }, 3000);
  };

  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    setGraphData(null);
    setSelectedActivity(null);
    setIsSyncing(false);
    setIsUpdatingLink(false);
    setSyncProgress(null);
    fetchGraphData(selectedProjectId);

    // بررسی وضعیت همین پروژه در پس‌زمینه
    fetch(`/api/projects/${selectedProjectId}/sync-status`)
      .then((r) => r.json())
      .then((job) => {
        if (cancelled || selectedProjectIdRef.current !== selectedProjectId) return;
        if (job.status === "running") {
          setIsSyncing(true);
          setSyncProgress(`در حال پردازش گزارش ${toPersianDigits(job.processedReports)} از ${toPersianDigits(job.totalReports)}...`);
          startProjectPolling(selectedProjectId);
        } else {
          setIsSyncing(false);
          setSyncProgress(null);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      requestEpochRef.current++;
      if (projectPollingRef.current) {
        clearInterval(projectPollingRef.current);
        projectPollingRef.current = null;
      }
    };
  }, [selectedProjectId]);

  // اجرای همگام‌سازی خودکار و بازخوانی فعالیت‌های همین پروژه
  const handleBatchSync = async () => {
    if (!selectedProjectId || isSyncing) return;
    if (!window.confirm("آیا مایلید فعالیت‌های ثبت‌شده در گزارش‌های این پروژه در پس‌زمینه توسط هوش مصنوعی ممیزی و به WBS متصل شوند؟")) {
      return;
    }

    setIsSyncing(true);
    setSyncProgress("در حال راه‌اندازی فرآیند ممیزی هوشمند...");
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/sync-activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_refresh: true }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "خطا در همگام‌سازی فعالیت‌های پروژه.");
      }

      setToastMessage({
        text: "ممیزی هوشمند در پس‌زمینه آغاز شد. گراف به‌صورت زنده به‌روزرسانی می‌شود...",
        type: "success",
      });

      startProjectPolling(selectedProjectId);
    } catch (err: any) {
      setIsSyncing(false);
      setSyncProgress(null);
      setToastMessage({
        text: err?.message || "خطا در اجرای همگام‌سازی هوش مصنوعی.",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // اجرای همگام‌سازی سراسری برای همه پروژه‌ها
  const handleGlobalBatchSync = async () => {
    if (isGlobalSyncing) return;
    if (!window.confirm("آیا مایلید تمام پروژه‌های دارای WBS به ترتیب در پس‌زمینه توسط هوش مصنوعی ممیزی و متصل شوند؟")) {
      return;
    }

    setIsGlobalSyncing(true);
    setGlobalSyncProgress("در حال راه‌اندازی ممیزی سراسری تمام پروژه‌ها...");
    try {
      const res = await fetch("/api/projects-all/sync-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_refresh: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در شروع ممیزی سراسری.");

      setToastMessage({
        text: "ممیزی سراسری تمام پروژه‌ها در پس‌زمینه آغاز شد.",
        type: "success",
      });

      if (globalPollingRef.current) clearInterval(globalPollingRef.current);
      globalPollingRef.current = setInterval(async () => {
        try {
          const sRes = await fetch("/api/projects-all/sync-status");
          const gJob = await sRes.json();
          if (gJob.status === "running") {
            setGlobalSyncProgress(
              `ممیزی سراسری: پروژه ${toPersianDigits(gJob.processedProjects)} از ${toPersianDigits(gJob.totalProjects)} (${gJob.currentProjectTitle || ""} - گزارش ${toPersianDigits(gJob.processedReports)} از ${toPersianDigits(gJob.totalReports)})`
            );
          } else if (gJob.status === "completed") {
            clearInterval(globalPollingRef.current);
            globalPollingRef.current = null;
            setIsGlobalSyncing(false);
            setGlobalSyncProgress(null);
            setToastMessage({
              text: `ممیزی سراسری تمام پروژه‌ها با موفقیت تکمیل شد (${toPersianDigits(gJob.activitiesCreated)} فعالیت متصل شد).`,
              type: "success",
            });
            if (selectedProjectIdRef.current) {
              fetchGraphData(selectedProjectIdRef.current);
            }
          } else if (gJob.status === "failed") {
            clearInterval(globalPollingRef.current);
            globalPollingRef.current = null;
            setIsGlobalSyncing(false);
            setGlobalSyncProgress(null);
            setToastMessage({
              text: gJob.error || "خطا در پردازش ممیزی سراسری",
              type: "error",
            });
          }
        } catch { }
      }, 4000);
    } catch (err: any) {
      setIsGlobalSyncing(false);
      setGlobalSyncProgress(null);
      setToastMessage({
        text: err?.message || "خطا در شروع ممیزی سراسری",
        type: "error",
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // اصلاح یا تایید دستی اتصال فعالیت
  const handleUpdateActivityLink = async (newWbsId: number | null, newStatus: string) => {
    if (!selectedActivity || isUpdatingLink) return;
    const projectId = selectedProjectId;
    const activityId = selectedActivity.id;
    const epoch = requestEpochRef.current;
    const isCurrent = () => mountedRef.current && requestEpochRef.current === epoch && selectedProjectIdRef.current === projectId;
    setIsUpdatingLink(true);
    try {
      const res = await fetch(`/api/report-activities/${selectedActivity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wbs_node_id: newWbsId,
          status: newStatus,
        }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || "خطا در به‌روزرسانی اتصال فعالیت.");

      if (!isCurrent()) return;
      setToastMessage({ text: "پیوند فعالیت با موفقیت اصلاح شد.", type: "success" });
      setSelectedActivity((prev) => (prev?.id === activityId ? { ...prev, wbs_node_id: newWbsId, status: newStatus } : prev));
      await fetchGraphData(projectId);
    } catch (err: any) {
      if (isCurrent()) setToastMessage({ text: err?.message || "خطا در اصلاح پیوند.", type: "error" });
    } finally {
      if (isCurrent()) {
        setIsUpdatingLink(false);
        setTimeout(() => { if (isCurrent()) setToastMessage(null); }, 4000);
      }
    }
  };

  // فیلتر کردن فعالیت‌ها بر اساس جستجو و وضعیت
  const filteredActivities = useMemo(() => {
    if (!graphData?.nodes.activities) return [];
    return graphData.nodes.activities.filter((act) => {
      const matchSearch = searchQuery.trim() === "" || act.activity_text.includes(searchQuery) || act.period_title.includes(searchQuery);
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "needs_review" && act.status === "needs_review") ||
        (statusFilter === "auto_confirmed" && (act.status === "auto_confirmed" || act.status === "confirmed")) ||
        (statusFilter === "unmapped" && act.status === "unmapped");

      return matchSearch && matchStatus;
    });
  }, [graphData, searchQuery, statusFilter]);

  // نگاشت کدهای WBS برای دسترسی سریع
  const wbsMap = useMemo(() => {
    const map = new Map<number, WbsNodeItem>();
    graphData?.nodes.wbsNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graphData]);

  return (
    <div className="space-y-6 dir-rtl text-right font-sans">
      {/* پیام بازخورد موقت */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold border transition-all flex items-center justify-between shadow-md ${
            toastMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* نوار ابزار بالای صفحه: انتخاب پروژه + آمار خلاصه + دکمه همگام‌سازی */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-2xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">پروژه:</span>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                className="bg-transparent text-xs font-black text-emerald-900 border-none focus:outline-none cursor-pointer pr-1"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            {/* سوییچ نما: گراف vs جدول */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode("graph")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === "graph"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Network className="w-3.5 h-3.5 text-emerald-600" />
                <span>شبکهٔ روابط و شواهد</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>جدول ممیزی فعالیت‌ها</span>
              </button>
            </div>
          </div>

          {/* دکمه‌های همگام‌سازی و ممیزی هوشمند */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleBatchSync}
              disabled={isSyncing || isGlobalSyncing || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              title="ممیزی و اتصال فعالیت‌های گزارش‌های همین پروژه به WBS"
            >
              <Sparkles className={`w-4 h-4 ${isSyncing ? "animate-spin text-amber-300" : ""}`} />
              <span>{isSyncing ? (syncProgress || "در حال ممیزی این پروژه...") : "ممیزی هوشمند همین پروژه"}</span>
            </button>

            <button
              type="button"
              onClick={handleGlobalBatchSync}
              disabled={isGlobalSyncing || isSyncing || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-slate-100 border border-slate-700 rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
              title="ممیزی دسته‌جمعی تمام پروژه‌های دارای WBS در پس‌زمینه"
            >
              <Globe className={`w-4 h-4 ${isGlobalSyncing ? "animate-spin text-cyan-300" : "text-cyan-400"}`} />
              <span>{isGlobalSyncing ? "در حال ممیزی سراسری..." : "ممیزی سراسری همه پروژه‌ها"}</span>
            </button>
          </div>
        </div>

        {/* بنر وضعیت ممیزی سراسری در صورت اجرا */}
        {globalSyncProgress && (
          <div className="p-3 bg-cyan-950/40 border border-cyan-800/60 rounded-2xl text-xs text-cyan-200 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
              <span>{globalSyncProgress}</span>
            </div>
          </div>
        )}

        {/* کارت‌های آماری خلاصه شبکه */}
        {graphData?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
              <span className="text-[10px] text-slate-500 block font-medium">بسته‌های WBS</span>
              <span className="text-sm font-black text-slate-800">{toPersianDigits(graphData.stats.totalWbs)}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
              <span className="text-[10px] text-slate-500 block font-medium">فعالیت‌های ثبت‌شده</span>
              <span className="text-sm font-black text-slate-800">{toPersianDigits(graphData.stats.totalActivities)}</span>
            </div>
            <div
              onClick={() => setStatusFilter("auto_confirmed")}
              className={`border rounded-2xl p-2.5 text-center cursor-pointer transition-all ${
                statusFilter === "auto_confirmed"
                  ? "bg-emerald-100 border-emerald-400"
                  : "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/50"
              }`}
            >
              <span className="text-[10px] text-emerald-700 block font-bold flex items-center justify-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" /> تایید خودکار هوش مصنوعی
              </span>
              <span className="text-sm font-black text-emerald-800">
                {toPersianDigits(graphData.stats.autoConfirmedActivities)}
              </span>
            </div>
            <div
              onClick={() => setStatusFilter("needs_review")}
              className={`border rounded-2xl p-2.5 text-center cursor-pointer transition-all ${
                statusFilter === "needs_review"
                  ? "bg-amber-100 border-amber-400"
                  : "bg-amber-50/60 border-amber-200 hover:bg-amber-100/50"
              }`}
            >
              <span className="text-[10px] text-amber-700 block font-bold flex items-center justify-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" /> نیازمند بازبینی مدیر
              </span>
              <span className="text-sm font-black text-amber-800">
                {toPersianDigits(graphData.stats.needsReviewActivities)}
              </span>
            </div>
            <div
              onClick={() => setStatusFilter("unmapped")}
              className={`border rounded-2xl p-2.5 text-center cursor-pointer transition-all ${
                statusFilter === "unmapped"
                  ? "bg-rose-100 border-rose-400"
                  : "bg-rose-50/60 border-rose-200 hover:bg-rose-100/50"
              }`}
            >
              <span className="text-[10px] text-rose-700 block font-bold flex items-center justify-center gap-1">
                <AlertCircle className="w-3 h-3 text-rose-600" /> فعالیت‌های فاقد تطبیق
              </span>
              <span className="text-sm font-black text-rose-800">
                {toPersianDigits(graphData.stats.unmappedActivities)}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-2.5 text-center">
              <span className="text-[10px] text-slate-500 block font-medium">شاخص‌های پایش</span>
              <span className="text-sm font-black text-slate-800">{toPersianDigits(graphData.stats.totalKpis)}</span>
            </div>
          </div>
        )}
      </div>

      {/* نوار جستجو و فیلترهای سریع */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="جستجو در بسته‌ها، فعالیت‌ها، شاخص‌ها و شواهد..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-800 font-medium placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto text-xs">
          <span className="text-slate-500 font-bold ml-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> فیلتر:
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
              statusFilter === "all"
                ? "bg-slate-800 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            همه
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("needs_review")}
            className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
              statusFilter === "needs_review"
                ? "bg-amber-600 text-white"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            نیاز به بازبینی
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("auto_confirmed")}
            className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
              statusFilter === "auto_confirmed"
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
            }`}
          >
            تایید خودکار
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("unmapped")}
            className={`px-3 py-1 rounded-xl font-bold cursor-pointer transition-all ${
              statusFilter === "unmapped"
                ? "bg-rose-600 text-white"
                : "bg-rose-50 text-rose-800 hover:bg-rose-100"
            }`}
          >
            فاقد تطبیق
          </button>
        </div>
      </div>

      {/* وضعیت لودینگ و خطا */}
      {isLoading && (
        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center shadow-sm">
          <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-700">در حال بارگذاری شبکه معنایی استراتژیک پروژه...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center text-rose-800 font-bold text-xs shadow-sm">
          {error}
        </div>
      )}

      {/* محتوای اصلی */}
      {!isLoading && !error && graphData && (
        <>
          {viewMode === "graph" ? (
            graphData.semantic ? <SemanticNetworkCanvas
              key={selectedProjectId}
              graph={graphData.semantic}
              query={searchQuery}
              status={statusFilter === "auto_confirmed" ? "confirmed" : statusFilter}
              selectedActivityId={selectedActivity?.id}
              onSelectActivity={(id) => {
                const activity = graphData.nodes.activities.find(a => a.id === id);
                if (activity) { setSelectedActivity(activity); setEditingWbsId(activity.wbs_node_id || "none"); }
              }}
              activityEditor={selectedActivity ? <div className="space-y-3 border-t border-slate-200 pt-4">
                <label className="block text-xs font-bold text-slate-700" htmlFor="semantic-wbs-link">اصلاح اتصال این فعالیت</label>
                <select id="semantic-wbs-link" value={editingWbsId} onChange={e => setEditingWbsId(e.target.value === "none" ? "none" : Number(e.target.value))} className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800">
                  <option value="none">بدون پیوند WBS</option>
                  {graphData.nodes.wbsNodes.filter(w => w.active).map(w => <option key={w.id} value={w.id}>{toPersianDigits(w.code)} — {w.title}</option>)}
                </select>
                <button type="button" onClick={() => handleUpdateActivityLink(editingWbsId === "none" ? null : editingWbsId, editingWbsId === "none" ? "unmapped" : "confirmed")} disabled={isUpdatingLink} className="w-full rounded-lg bg-emerald-700 p-2.5 text-xs font-bold text-white disabled:opacity-50">{isUpdatingLink ? "در حال ثبت..." : "ثبت اصلاح و تأیید اتصال"}</button>
                <p className="text-[11px] leading-6 text-slate-500">تأیید اتصال، تأیید تحقق یا تحویل خروجی نیست.</p>
              </div> : null}
            /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">قرارداد معنایی از سرور دریافت نشد. نسخهٔ سرور را به‌روز کنید؛ روابط حدسی نمایش داده نمی‌شود.</div>
          ) : (
            /* =================== نمای جدول ممیزی (Audit Table) =================== */
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <tr>
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">شرح فعالیت</th>
                      <th className="p-3.5">دوره گزارش</th>
                      <th className="p-3.5">بسته کاری متصل (WBS)</th>
                      <th className="p-3.5 text-center">ضریب اطمینان</th>
                      <th className="p-3.5">وضعیت ممیزی</th>
                      <th className="p-3.5">استدلال و بازخورد هوش مصنوعی</th>
                      <th className="p-3.5 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredActivities.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                          فعالیتی مطابق فیلتر یافت نشد.
                        </td>
                      </tr>
                    ) : (
                      filteredActivities.map((act, idx) => {
                        const targetWbs = act.wbs_node_id ? wbsMap.get(act.wbs_node_id) : null;

                        let statusBadge = "bg-amber-50 text-amber-800 border-amber-200";
                        let statusText = "نیازمند بازبینی";
                        if (act.status === "auto_confirmed") {
                          statusBadge = "bg-emerald-50 text-emerald-800 border-emerald-200";
                          statusText = "تایید خودکار";
                        } else if (act.status === "confirmed" || act.status === "overridden") {
                          statusBadge = "bg-blue-50 text-blue-800 border-blue-200";
                          statusText = "تایید مدیر";
                        } else if (act.status === "unmapped") {
                          statusBadge = "bg-rose-50 text-rose-800 border-rose-200";
                          statusText = "فاقد تطبیق";
                        }

                        return (
                          <tr key={act.id} className="hover:bg-slate-50/80 transition-all">
                            <td className="p-3.5 text-slate-400 font-medium">{toPersianDigits(idx + 1)}</td>
                            <td className="p-3.5 font-bold text-slate-900 max-w-xs">{act.activity_text}</td>
                            <td className="p-3.5 text-slate-600">{act.period_title}</td>
                            <td className="p-3.5">
                              {targetWbs ? (
                                <span className="inline-flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                  <span>{targetWbs.code}:</span>
                                  <span className="truncate max-w-[180px]">{targetWbs.title}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">بدون اتصال</span>
                              )}
                            </td>
                            <td className="p-3.5 text-center font-black text-slate-700">
                              {typeof act.confidence === "number"
                                ? `%${toPersianDigits(Math.round(act.confidence * 100))}`
                                : "—"}
                            </td>
                            <td className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${statusBadge}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="p-3.5 text-slate-500 max-w-sm text-[11px] leading-5">
                              {act.audit_feedback || act.ai_reasoning || "—"}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedActivity(act);
                                  setEditingWbsId(act.wbs_node_id || "none");
                                  setViewMode("graph");
                                }}
                                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
                              >
                                بررسی در گراف
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
