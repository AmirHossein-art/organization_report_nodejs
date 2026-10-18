import { useState, useEffect, useMemo } from "react";
import {
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Network,
  RefreshCw,
  Search,
  Filter,
  Sparkles,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ShieldCheck,
  Check,
  Info,
  Calendar,
  Table as TableIcon,
} from "lucide-react";
import { Project } from "../types";
import { toPersianDigits } from "../dateUtils";

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
  const [error, setError] = useState<string | null>(null);

  // وضعیت فیلترها و نمایش
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [statusFilter, setStatusFilter] = useState<"all" | "needs_review" | "auto_confirmed" | "unmapped">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);
  const [editingWbsId, setEditingWbsId] = useState<number | "none">("none");
  const [isUpdatingLink, setIsUpdatingLink] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // بزرگ‌نمایی و کنترل‌های کانواس
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // خواندن داده‌های گراف پروژه
  const fetchGraphData = async (projectId: number) => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategic-graph`);
      if (!res.ok) {
        throw new Error("خطا در دریافت شبکه استراتژیک پروژه.");
      }
      const data: StrategicGraphResponse = await res.json();
      setGraphData(data);
    } catch (err: any) {
      setError(err?.message || "خطای ناشناخته در دریافت داده‌های گراف.");
      setGraphData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchGraphData(selectedProjectId);
      setSelectedActivity(null);
    }
  }, [selectedProjectId]);

  // اجرای همگام‌سازی خودکار و بازخوانی تمام فعالیت‌های پروژه (ناهمگام بدون ارور ۵۲۴)
  const handleBatchSync = async () => {
    if (!selectedProjectId || isSyncing) return;
    if (!window.confirm("آیا مایلید تمام فعالیت‌های ثبت‌شده در گزارش‌های این پروژه مجدداً در حلقه خود-پالایشی هوش مصنوعی تحلیل و به WBS متصل شوند؟")) {
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
        throw new Error(result.error || "خطا در همگام‌سازی گروهی فعالیت‌ها.");
      }

      setToastMessage({
        text: "ممیزی هوشمند در پس‌زمینه آغاز شد. گراف به‌صورت خودکار به‌روزرسانی می‌شود...",
        type: "success",
      });

      // پلینگ وضعیت زنده تا زمان اتمام
      const interval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/projects/${selectedProjectId}/sync-status`);
          const job = await statusRes.json();
          if (job.status === "running") {
            setSyncProgress(`در حال پردازش گزارش ${toPersianDigits(job.processedReports)} از ${toPersianDigits(job.totalReports)}...`);
            await fetchGraphData(selectedProjectId);
          } else if (job.status === "completed") {
            clearInterval(interval);
            setIsSyncing(false);
            setSyncProgress(null);
            setToastMessage({
              text: `ممیزی هوشمند با موفقیت تکمیل شد: ${toPersianDigits(job.activitiesCreated)} فعالیت پردازش و متصل گردید.`,
              type: "success",
            });
            await fetchGraphData(selectedProjectId);
          } else if (job.status === "failed") {
            clearInterval(interval);
            setIsSyncing(false);
            setSyncProgress(null);
            setToastMessage({
              text: job.error || "پردازش ممیزی با خطا مواجه شد.",
              type: "error",
            });
          }
        } catch {
          // خطای موقت شبکه در پولینگ
        }
      }, 3000);
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

  // اصلاح یا تایید دستی اتصال فعالیت
  const handleUpdateActivityLink = async (newWbsId: number | null, newStatus: string) => {
    if (!selectedActivity) return;
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

      setToastMessage({ text: "پیوند فعالیت با موفقیت اصلاح شد.", type: "success" });
      setSelectedActivity((prev) => (prev ? { ...prev, wbs_node_id: newWbsId, status: newStatus } : null));
      await fetchGraphData(selectedProjectId);
    } catch (err: any) {
      setToastMessage({ text: err?.message || "خطا در اصلاح پیوند.", type: "error" });
    } finally {
      setIsUpdatingLink(false);
      setTimeout(() => setToastMessage(null), 4000);
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
                <span>نمای شبکه لایه‌ای (DAG)</span>
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

          {/* دکمه همگام‌سازی حلقه بازتاب */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleBatchSync}
              disabled={isSyncing || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className={`w-4 h-4 ${isSyncing ? "animate-spin text-amber-300" : ""}`} />
              <span>{isSyncing ? (syncProgress || "در حال اجرای ممیزی و پالایش هوشمند...") : "بازخوانی و ممیزی هوشمند فعالیت‌ها"}</span>
            </button>
          </div>
        </div>

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
                <AlertCircle className="w-3 h-3 text-rose-600" /> انحراف / خارج محدوده
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
            placeholder="جستجو در شرح فعالیت‌ها یا دوره‌ها..."
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
            انحراف از محدوده
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
            /* =================== نمای شبکه لایه‌ای (Layered DAG Flow) =================== */
            <div className="relative bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden p-6 text-slate-100">
              {/* ابزارهای بزرگ‌نمایی */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-slate-800/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-700 shadow-md">
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.min(1.4, z + 0.1))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl cursor-pointer"
                  title="بزرگ‌نمایی"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl cursor-pointer"
                  title="کوچک‌نمایی"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomLevel(1)}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl cursor-pointer"
                  title="بازنشانی اندازه"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <span className="text-[10px] font-black text-slate-400 px-1">
                  %{toPersianDigits(Math.round(zoomLevel * 100))}
                </span>
              </div>

              {/* راهنمای لایه‌ها */}
              <div className="mb-4 flex flex-wrap items-center justify-between text-xs text-slate-400 border-b border-slate-800 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-200">
                    جریان معنایی پروژه: بسته‌های مرجع WBS ➔ فعالیت‌های دوره‌ای ➔ تعهدات و شاخص‌ها
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> تایید خودکار گذر ۲
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> نیاز به بازبینی مدیر
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> انحراف از محدوده
                  </span>
                </div>
              </div>

              {/* شبکه ۴ ستونه لایه‌ای با زوم داینامیک */}
              <div
                className="grid grid-cols-1 md:grid-cols-3 gap-6 transition-transform duration-200 origin-top-right"
                style={{ transform: `scale(${zoomLevel})` }}
              >
                {/* ستون ۱: ساختار شکست کار (WBS Ground Truth) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" /> ساختار شکست کار مصوب (WBS)
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                      {toPersianDigits(graphData.nodes.wbsNodes.length)} گره
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                    {graphData.nodes.wbsNodes.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">گره WBS فعالی یافت نشد.</p>
                    ) : (
                      graphData.nodes.wbsNodes.map((wbs) => {
                        const isHovered = hoveredNodeId === `wbs-${wbs.id}`;
                        const isLinkedToSelected = selectedActivity?.wbs_node_id === wbs.id;

                        return (
                          <div
                            key={wbs.id}
                            onMouseEnter={() => setHoveredNodeId(`wbs-${wbs.id}`)}
                            onMouseLeave={() => setHoveredNodeId(null)}
                            className={`p-3 rounded-2xl border transition-all text-xs ${
                              isLinkedToSelected
                                ? "bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/50 shadow-lg"
                                : isHovered
                                ? "bg-slate-800 border-slate-600 shadow-md"
                                : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="font-black text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-lg border border-emerald-800/60 text-[11px]">
                                {wbs.code}
                              </span>
                              <span className="text-[10px] text-slate-400">سطح {toPersianDigits(wbs.level)}</span>
                            </div>

                            <p className="font-bold text-slate-100 leading-5">{wbs.title}</p>

                            {wbs.deliverable_text && (
                              <div className="mt-2 text-[10px] text-teal-300 bg-teal-950/50 p-1.5 rounded-xl border border-teal-800/40">
                                <span className="font-bold">خروجی: </span>
                                <span>{wbs.deliverable_text}</span>
                              </div>
                            )}

                            {wbs.kpis.length > 0 && (
                              <div className="mt-2 flex items-center gap-1 flex-wrap">
                                {wbs.kpis.map((k) => (
                                  <span
                                    key={k.id}
                                    className="text-[9px] bg-cyan-950/80 text-cyan-300 px-1.5 py-0.5 rounded-lg border border-cyan-800/50"
                                  >
                                    🎯 {k.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ستون ۲: فعالیت‌های ثبت‌شده گزارش‌ها (Report Activities) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" /> فعالیت‌های اتمیک دوره‌ای
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-300">
                      {toPersianDigits(filteredActivities.length)} مورد
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[700px] overflow-y-auto pr-1">
                    {filteredActivities.length === 0 ? (
                      <p className="text-xs text-slate-500 text-center py-8">فعالیتی منطبق با فیلتر یافت نشد.</p>
                    ) : (
                      filteredActivities.map((act) => {
                        const isSelected = selectedActivity?.id === act.id;
                        const targetWbs = act.wbs_node_id ? wbsMap.get(act.wbs_node_id) : null;

                        let badgeColor = "bg-amber-950/70 border-amber-600/70 text-amber-300";
                        let badgeLabel = "نیاز به بازبینی";
                        if (act.status === "auto_confirmed") {
                          badgeColor = "bg-emerald-950/70 border-emerald-600/70 text-emerald-300";
                          badgeLabel = "تایید خودکار هوش مصنوعی";
                        } else if (act.status === "confirmed" || act.status === "overridden") {
                          badgeColor = "bg-blue-950/70 border-blue-600/70 text-blue-300";
                          badgeLabel = "تایید مدیر";
                        } else if (act.status === "unmapped") {
                          badgeColor = "bg-rose-950/70 border-rose-600/70 text-rose-300";
                          badgeLabel = "خارج از محدوده";
                        }

                        return (
                          <div
                            key={act.id}
                            onClick={() => {
                              setSelectedActivity(act);
                              setEditingWbsId(act.wbs_node_id || "none");
                            }}
                            className={`p-3 rounded-2xl border transition-all text-xs cursor-pointer ${
                              isSelected
                                ? "bg-slate-800 border-amber-400 shadow-xl ring-2 ring-amber-400/50"
                                : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg">
                                {act.period_title}
                              </span>
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg border ${badgeColor}`}>
                                {badgeLabel}
                              </span>
                            </div>

                            <p className="text-slate-100 font-bold leading-5 line-clamp-3">{act.activity_text}</p>

                            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                              {targetWbs ? (
                                <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1 truncate">
                                  <span>➔ متصل به WBS {targetWbs.code}:</span>
                                  <span className="text-slate-300 truncate">{targetWbs.title}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-rose-400 font-bold">بدون بسته WBS متصل</span>
                              )}

                              {typeof act.confidence === "number" && (
                                <span className="text-[9px] text-slate-400 shrink-0">
                                  اطمینان: %{toPersianDigits(Math.round(act.confidence * 100))}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ستون ۳: پنل بازرسی هوش مصنوعی و اصلاح رابطه */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-black text-cyan-400 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" /> کشوی ممیزی و تصمیم‌گیری
                    </span>
                  </div>

                  {selectedActivity ? (
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-4">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block mb-1">متن کامل فعالیت:</span>
                        <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-xs font-bold text-white leading-5">
                          {selectedActivity.activity_text}
                        </div>
                      </div>

                      {/* نتایج حلقه گذر ۱ و گذر ۲ */}
                      <div className="space-y-2">
                        <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-amber-400 font-bold block mb-1">
                            گذر اول (استدلال اولیه انتخاب گره):
                          </span>
                          <p className="text-[11px] text-slate-300 leading-5">
                            {selectedActivity.ai_reasoning || "استدلال اولیه ثبت نشده است."}
                          </p>
                        </div>

                        <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                          <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                            گذر دوم (ممیزی سازگاری و خود-پالایشی):
                          </span>
                          <p className="text-[11px] text-slate-300 leading-5">
                            {selectedActivity.audit_feedback || "انطباق با قوانین پروژه مورد تایید است."}
                          </p>
                        </div>
                      </div>

                      {/* اصلاح دستی اتصال به WBS */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        <span className="text-[10px] text-slate-300 font-bold block">
                          تغییر بسته کاری متصل (WBS Link):
                        </span>
                        <select
                          value={editingWbsId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditingWbsId(val === "none" ? "none" : Number(val));
                          }}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                        >
                          <option value="none">بدون اتصال (خارج از محدوده WBS)</option>
                          {graphData.nodes.wbsNodes.map((w) => (
                            <option key={w.id} value={w.id}>
                              کد {w.code} - {w.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* دکمه‌های اقدام و تایید */}
                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            const targetId = editingWbsId === "none" ? null : editingWbsId;
                            handleUpdateActivityLink(targetId, targetId ? "confirmed" : "unmapped");
                          }}
                          disabled={isUpdatingLink}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isUpdatingLink ? "در حال ثبت..." : "ثبت و تایید اصلاحیه مدیر"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleUpdateActivityLink(null, "unmapped")}
                          disabled={isUpdatingLink}
                          className="w-full py-1.5 bg-rose-950/80 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                        >
                          علامت‌گذاری به عنوان انحراف از محدوده (Scope Creep)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
                      <Info className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                      یک فعالیت از ستون وسط انتخاب کنید تا ریز استدلال هوش مصنوعی و امکان تغییر پیوند نمایش داده شود.
                    </div>
                  )}

                  {/* اقدامات آتی متصل به این پروژه */}
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                    <span className="text-xs font-black text-purple-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> اقدامات آتی فعال (Next Actions)
                    </span>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
                      {graphData.nodes.nextActions.length === 0 ? (
                        <p className="text-[11px] text-slate-500">اقدام بازی ثبت نشده است.</p>
                      ) : (
                        graphData.nodes.nextActions.slice(0, 10).map((na) => (
                          <div
                            key={na.id}
                            className="bg-slate-900/70 p-2 rounded-xl border border-slate-800 text-[11px] text-slate-300 flex items-start justify-between gap-2"
                          >
                            <span className="leading-4">{na.action_text}</span>
                            {na.wbs_node_id && (
                              <span className="text-[9px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800 shrink-0">
                                WBS متصل
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
                          statusText = "خارج از محدوده";
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
