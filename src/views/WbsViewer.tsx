// src/views/WbsViewer.tsx
// مشاهده و مدیریت ساختار شکست پروژه (WBS)
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Folder,
  Download,
  Upload,
  Trash2,
  Loader2,
  User,
  Building2,
  Target,
  Calendar,
  Flag,
  AlertTriangle,
  Rocket,
  ListTree,
  BarChart3,
  Network,
  CheckCircle,
  FileSpreadsheet,
  X,
  Layers,
  MapPin,
  FileText,
  Sparkles,
  Clock,
  CheckCircle2,
  ChevronDown,
  Search,
  GitBranch,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import WbsTreePane from "./WbsTree";
import { CustomSelect } from "../components";
import { toPersianDigits, normalizeDigits } from "../dateUtils";
import { Project } from "../types";

interface WbsViewerProps {
  projects: Project[];
  onRefresh?: () => void;
}

interface WbsProjectSummary {
  project_id: number;
  project_title: string;
  project_code: string;
  has_wbs: boolean;
  file_name: string;
  submission_id?: number | null;
  uploaded_by?: string;
  uploaded_at?: string | null;
}

interface WbsProjectInfoRow {
  key: string;
  value: string;
}

interface WbsTask {
  wbs_code: string;
  level: string;
  name: string;
  deliverables: string;
  owner: string;
  start_date: string;
  duration: string;
  prerequisite: string;
  note: string;
  phase?: string;
  kpi?: string;
}

interface WbsKpi {
  name: string;
  type: string;
  definition: string;
  formula: string;
  unit: string;
  source: string;
  period: string;
  threshold: string;
}

interface WbsData {
  has_wbs: boolean;
  project_id: number;
  project_title: string;
  projectTitle?: string;
  file_name?: string;
  uploaded_by?: string;
  uploaded_at?: string | null;
  projectInfo?: WbsProjectInfoRow[];
  tasks?: WbsTask[];
  kpis?: WbsKpi[];
  message?: string;
}

function cleanDisplayFileName(name?: string | null): string {
  if (!name) return "";
  try {
    if (/[\u00C0-\u00FF]/.test(name) || name.includes("Ø") || name.includes("Ù") || name.includes("§")) {
      const decoded = decodeURIComponent(escape(name));
      if (decoded && !decoded.includes("\ufffd")) return decoded;
    }
  } catch (_) {}
  return name;
}

function infoIcon(key: string) {
  if (key.includes("نام پروژه")) return <Folder className="w-4 h-4 text-emerald-600" />;
  if (key.includes("مدیر")) return <User className="w-4 h-4 text-emerald-600" />;
  if (key.includes("کارفرما")) return <Building2 className="w-4 h-4 text-emerald-600" />;
  if (key.includes("هدف")) return <Target className="w-4 h-4 text-emerald-600" />;
  if (key.includes("دامنه") || key.includes("محدوده")) return <MapPin className="w-4 h-4 text-emerald-600" />;
  if (key.includes("مرجع")) return <FileText className="w-4 h-4 text-emerald-600" />;
  if (key.includes("فاز")) return <Layers className="w-4 h-4 text-emerald-600" />;
  if (key.includes("ضرورت")) return <Sparkles className="w-4 h-4 text-amber-500" />;
  if (key.includes("شاخص")) return <BarChart3 className="w-4 h-4 text-emerald-600" />;
  if (key.includes("خروجی")) return <Rocket className="w-4 h-4 text-emerald-600" />;
  if (key.includes("شروع")) return <Calendar className="w-4 h-4 text-emerald-600" />;
  if (key.includes("پایان")) return <Flag className="w-4 h-4 text-emerald-600" />;
  if (key.includes("محدودیت")) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <ListTree className="w-4 h-4 text-slate-500" />;
}

export default function WbsViewer({ projects = [], onRefresh }: WbsViewerProps) {
  const [wbsProjectList, setWbsProjectList] = useState<WbsProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [data, setData] = useState<WbsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [subView, setSubView] = useState<"detail" | "cards" | "tree">("detail");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // وضعیت‌های فیلتر و جستجو در لیست فعالیت‌های WBS
  const [taskSearch, setTaskSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "phases" | "workpackages">("all");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const toggleExpandNote = (code: string) => {
    setExpandedNotes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const closeAll = () => {};

  // فوکوس روی کد خاص هنگام هدایت از درخت
  const [focusCode, setFocusCode] = useState<string | null>(null);

  // بارگذاری لیست خلاصه پروژه‌های دارای WBS
  const loadWbsProjects = async () => {
    try {
      const res = await fetch("/api/wbs-data/projects");
      if (res.ok) {
        const list: WbsProjectSummary[] = await res.json();
        setWbsProjectList(list);
        return list;
      }
    } catch (e) {
      console.error("Error loading WBS project list:", e);
    }
    return [];
  };

  useEffect(() => {
    loadWbsProjects().then((list) => {
      if (!selectedProjectId && list && list.length > 0) {
        // انتخاب پیش‌فرض اولین پروژه (ترجیحاً دارای WBS، یا اولین پروژه فعال)
        const firstWithWbs = list.find((p) => p.has_wbs);
        const target = firstWithWbs ? firstWithWbs.project_id : list[0].project_id;
        setSelectedProjectId(String(target));
      } else if (!selectedProjectId && projects.length > 0) {
        setSelectedProjectId(String(projects[0].id));
      }
    });
  }, [projects]);

  // دریافت داده WBS پروژه انتخابی
  const fetchWbsData = async (projectId: string) => {
    if (!projectId) {
      setData(null);
      return;
    }
    setLoading(true);
    closeAll();
    try {
      const res = await fetch(`/api/wbs-data/${projectId}`);
      if (res.ok) {
        const json: WbsData = await res.json();
        setData(json);
      } else {
        const err = await res.json().catch(() => null);
        setData({
          has_wbs: false,
          project_id: Number(projectId),
          project_title: projects.find((p) => String(p.id) === projectId)?.title || "پروژه",
          message: err?.error || "خطا در خواندن فایل ساختار شکست.",
        });
      }
    } catch (e: any) {
      setData({
        has_wbs: false,
        project_id: Number(projectId),
        project_title: projects.find((p) => String(p.id) === projectId)?.title || "پروژه",
        message: e?.message || "خطا در اتصال به سرور.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchWbsData(selectedProjectId);
    }
  }, [selectedProjectId]);

  // ساخت گزینه‌های دراپ‌داون پروژه
  const projectOptions = useMemo(() => {
    const list = wbsProjectList.length > 0
      ? wbsProjectList
      : projects.map((p) => ({
          project_id: p.id,
          project_title: p.title,
          project_code: p.code || "",
          has_wbs: Boolean(p.wbs_file_name),
          file_name: p.wbs_file_name || "",
        }));

    return list.map((p) => ({
      value: String(p.project_id),
      label: `${p.project_title}${p.has_wbs ? " (دارای WBS)" : " (بدون WBS)"}`,
    }));
  }, [wbsProjectList, projects]);

  const currentProjectSummary = useMemo(() => {
    return wbsProjectList.find((p) => String(p.project_id) === selectedProjectId);
  }, [wbsProjectList, selectedProjectId]);

  // فیلتر و جستجوی لیست فعالیت‌های WBS
  const filteredTasks = useMemo(() => {
    if (!data?.tasks) return [];
    return data.tasks.filter((t) => {
      const cleanCode = normalizeDigits((t.wbs_code || "").trim());
      const isPhaseOrL1 = t.level === "1" || cleanCode.split(".").length === 1;

      if (levelFilter === "phases" && !isPhaseOrL1) return false;
      if (levelFilter === "workpackages" && isPhaseOrL1) return false;

      if (taskSearch.trim()) {
        const q = taskSearch.trim().toLowerCase();
        const normQ = normalizeDigits(q);
        const nameMatch = (t.name || "").toLowerCase().includes(q);
        const codeMatch = (t.wbs_code || "").toLowerCase().includes(q) || cleanCode.includes(normQ);
        const delivMatch = (t.deliverables || "").toLowerCase().includes(q);
        const ownerMatch = (t.owner || "").toLowerCase().includes(q);
        const phaseMatch = (t.phase || "").toLowerCase().includes(q);
        const kpiMatch = (t.kpi || "").toLowerCase().includes(q);
        return nameMatch || codeMatch || delivMatch || ownerMatch || phaseMatch || kpiMatch;
      }
      return true;
    });
  }, [data?.tasks, taskSearch, levelFilter]);

  const phaseCount = useMemo(() => {
    if (!data?.tasks) return 0;
    return data.tasks.filter((t) => {
      const code = normalizeDigits((t.wbs_code || "").trim());
      return t.level === "1" || code.split(".").length === 1 || (t.phase && t.name.includes("فاز"));
    }).length;
  }, [data?.tasks]);

  const wpCount = useMemo(() => {
    if (!data?.tasks) return 0;
    return data.tasks.filter((t) => {
      const code = normalizeDigits((t.wbs_code || "").trim());
      return !(t.level === "1" || code.split(".").length === 1 || (t.phase && t.name.includes("فاز")));
    }).length;
  }, [data?.tasks]);

  const allNotesExpanded = useMemo(() => {
    if (!data?.tasks || data.tasks.length === 0) return false;
    const tasksWithNotes = data.tasks.filter((t) => t.note && t.note.trim() !== "");
    if (tasksWithNotes.length === 0) return false;
    return tasksWithNotes.every((t) => expandedNotes[t.wbs_code || ""]);
  }, [data?.tasks, expandedNotes]);

  const toggleExpandAllNotes = () => {
    if (!data?.tasks) return;
    if (allNotesExpanded) {
      setExpandedNotes({});
    } else {
      const newMap: Record<string, boolean> = {};
      data.tasks.forEach((t) => {
        if (t.note) newMap[t.wbs_code || ""] = true;
      });
      setExpandedNotes(newMap);
    }
  };

  // بارگذاری و جایگزینی فایل WBS
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProjectId) return;

    setUploading(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("wbs_file", file);

      const res = await fetch(`/api/projects/${selectedProjectId}/wbs-submissions`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "خطا در بارگذاری فایل اکسل.");
      }

      setFeedback({ type: "success", text: "فایل ساختار شکست (WBS) با موفقیت ثبت شد." });
      await loadWbsProjects();
      await fetchWbsData(selectedProjectId);
      onRefresh?.();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "خطا در بارگذاری فایل." });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // حذف فایل WBS
  const handleDeleteWbs = async () => {
    if (!selectedProjectId) return;
    setDeleting(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/wbs-file`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "خطا در حذف فایل WBS.");
      }

      setFeedback({ type: "success", text: "فایل ساختار شکست با موفقیت حذف گردید." });
      setShowDeleteModal(false);
      await loadWbsProjects();
      await fetchWbsData(selectedProjectId);
      onRefresh?.();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "خطا در حذف فایل." });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in font-sans dir-rtl text-right" dir="rtl">
      {/* پیام بازخورد موقت */}
      {feedback && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs font-semibold border ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:bg-black/5 rounded-lg cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ورودی پنهان فایل برای ویرایش/جایگزینی */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* ============================================================== */}
      {/* نوار بالایی: انتخاب پروژه با دراپ‌داون سرچ‌دار + دکمه‌های عملیاتی */}
      {/* ============================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* فیلد دراپ‌داون سرچ‌دار پروژه بدون فیلد سرچ جداگانه */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <label className="text-xs font-bold text-slate-700 shrink-0 flex items-center gap-1.5">
            <Folder className="w-4 h-4 text-emerald-700" />
            <span>پروژه انتخابی:</span>
          </label>
          <div className="w-full sm:w-80 md:w-96 max-w-full">
            <CustomSelect
              value={selectedProjectId}
              onChange={(val) => {
                setSelectedProjectId(String(val));
                setFeedback(null);
              }}
              options={projectOptions}
              searchable={true}
              className="text-xs"
            />
          </div>
        </div>

        {/* دکمه‌های اقدام برای پروژه انتخابی (دانلود، ادیت/جایگزینی، حذف) */}
        {selectedProjectId && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {data?.has_wbs ? (
              <>
                <a
                  href={`/api/projects/${selectedProjectId}/wbs-file`}
                  title="دانلود فایل اکسل ساختار شکست"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>دانلود اکسل</span>
                </a>

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  title="ویرایش یا جایگزینی فایل اکسل WBS"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                  ) : (
                    <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  )}
                  <span>{uploading ? "در حال آپلود..." : "ویرایش / جایگزینی"}</span>
                </button>

                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setShowDeleteModal(true)}
                  title="حذف فایل ساختار شکست این پروژه"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>حذف فایل</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>{uploading ? "در حال ارسال..." : "بارگذاری فایل WBS"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* بدنه محتوا: لودینگ / بدون فایل / با فایل */}
      {/* ============================================================== */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">در حال خواندن اطلاعات فایل ساختار شکست...</p>
        </div>
      ) : !data || !data.has_wbs ? (
        /* وضعیت بدون فایل WBS */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {data?.project_title || currentProjectSummary?.project_title || "پروژه انتخابی"}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-5">
              برای این پروژه هنوز فایل ساختار شکست کار (WBS) بارگذاری نشده است. می‌توانید فایل اکسل استاندارد شامل شیت‌های شناسنامه و فازها را بارگذاری نمایید.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? "در حال آپلود..." : "انتخاب و بارگذاری فایل اکسل WBS"}</span>
            </button>
          </div>
        </div>
      ) : (
        /* وضعیت دارای فایل WBS */
        <div className="space-y-4">
          {/* هدر جزئیات فایل + زبانه‌های ناوبری سه‌گانه */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-slate-900 truncate">{data.projectTitle || data.project_title}</h2>
                  {data.file_name && (
                    <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {cleanDisplayFileName(data.file_name)}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  ثبت توسط {data.uploaded_by || "مدیر سیستم"}
                  {data.uploaded_at ? ` در تاریخ ${new Date(data.uploaded_at).toLocaleDateString("fa-IR")}` : ""}
                </p>
              </div>
            </div>

            {/* سوئیچر حالت نمایش سه‌گانه منطبق با تم سیستم */}
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  closeAll();
                  setSubView("detail");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  subView === "detail"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>شناسنامه و مشخصات</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeAll();
                  setSubView("cards");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  subView === "cards"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ListTree className="w-3.5 h-3.5 text-emerald-600" />
                <span>لیست فعالیت‌ها (WBS)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  closeAll();
                  setSubView("tree");
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  subView === "tree"
                    ? "bg-white text-emerald-800 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Network className="w-3.5 h-3.5 text-emerald-600" />
                <span>نمودار درختی (Tree)</span>
              </button>
            </div>
          </div>

          {/* محتوای زبانه فعال WBS */}
          <AnimatePresence mode="wait">
            {/* ۱. شناسنامه و مشخصات پروژه */}
            {subView === "detail" && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* کارت‌های شناسنامه */}
                {data.projectInfo && data.projectInfo.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Folder className="w-4 h-4 text-emerald-700" />
                      <span>مشخصات شناسنامه‌ای پروژه</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {data.projectInfo.map((row, i) => {
                        const empty = !row.value;
                        return (
                          <div
                            key={`${row.key}-${i}`}
                            className={`rounded-xl border p-3.5 flex items-start gap-2.5 transition-colors ${
                              empty ? "bg-slate-50/60 border-slate-200" : "bg-white border-slate-200 hover:border-emerald-200"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                              {infoIcon(row.key)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-slate-400 font-semibold">{row.key}</p>
                              <p
                                className={`text-xs mt-1 font-bold break-words leading-snug ${
                                  empty ? "text-slate-400 italic" : "text-slate-800"
                                }`}
                              >
                                {empty ? "— ثبت نشده" : row.value}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* شاخص‌های عملکرد (KPI) تعریف شده در فایل WBS */}
                {data.kpis && data.kpis.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Target className="w-4 h-4 text-emerald-700" />
                      <span>شاخص‌های کلیدی عملکرد مندرج در WBS ({toPersianDigits(data.kpis.length)})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {data.kpis.map((k, i) => (
                        <div
                          key={`${k.name}-${i}`}
                          className="rounded-xl border border-slate-200 p-4 bg-white hover:border-emerald-300 transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-800 text-xs">{k.name}</span>
                            {k.threshold && (
                              <span className="text-[11px] bg-emerald-50 text-emerald-800 font-semibold rounded-lg px-2 py-0.5 border border-emerald-200">
                                حد آستانه: {toPersianDigits(k.threshold)} {k.unit}
                              </span>
                            )}
                          </div>
                          {k.definition && (
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">{k.definition}</p>
                          )}
                          {k.formula && (
                            <p className="text-[11px] text-slate-400 font-medium">فرمول: {k.formula}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ۲. لیست فعالیت‌ها و بسته‌های کاری WBS */}
            {subView === "cards" && (
              <motion.div
                key="cards"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3.5"
              >
                {!data.tasks || data.tasks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                    <ListTree className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-xs text-slate-400">در این فایل، ردیف فعالیتی (WBS) یافت نشد.</p>
                  </div>
                ) : (
                  <>
                    {/* نوار ابزار جستجو و فیلترهای لیست */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* ورودی جستجوی متنی */}
                      <div className="relative flex-1 min-w-0 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={taskSearch}
                          onChange={(e) => setTaskSearch(e.target.value)}
                          placeholder="جستجو در نام فعالیت، کد WBS، خروجی یا مسئول..."
                          className="w-full pl-8 pr-9 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-sans"
                        />
                        {taskSearch && (
                          <button
                            type="button"
                            onClick={() => setTaskSearch("")}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* فیلترها و دکمه بازکردن یادداشت‌ها */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        {phaseCount > 0 && (
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                            <button
                              type="button"
                              onClick={() => setLevelFilter("all")}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                levelFilter === "all" ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              همه ({toPersianDigits(data.tasks.length)})
                            </button>
                            <button
                              type="button"
                              onClick={() => setLevelFilter("phases")}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                levelFilter === "phases" ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              فازها ({toPersianDigits(phaseCount)})
                            </button>
                            <button
                              type="button"
                              onClick={() => setLevelFilter("workpackages")}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                levelFilter === "workpackages" ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              بسته‌های کاری ({toPersianDigits(wpCount)})
                            </button>
                          </div>
                        )}

                        <span className="text-[11px] font-semibold text-slate-400 hidden lg:inline">
                          {toPersianDigits(filteredTasks.length)} از {toPersianDigits(data.tasks.length)} مورد
                        </span>

                        {data.tasks.some((t) => t.note) && (
                          <button
                            type="button"
                            onClick={toggleExpandAllNotes}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                          >
                            <span>{allNotesExpanded ? "بستن همه یادداشت‌ها" : "نمایش همه یادداشت‌ها"}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${allNotesExpanded ? "rotate-180" : ""}`} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* لیست سطرهای فعالیت‌ها */}
                    {filteredTasks.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-400">
                        موردی منطبق با جستجوی شما یافت نشد.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredTasks.map((task, i) => {
                          const code = task.wbs_code || `#${i + 1}`;
                          return (
                            <WbsTaskRow
                              key={`${code}-${i}`}
                              task={task}
                              index={i}
                              highlighted={focusCode === code}
                              isExpanded={Boolean(expandedNotes[code])}
                              onToggleExpand={() => toggleExpandNote(code)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}

            {/* ۳. ساختار درختی گرافیکی (WBS Tree) */}
            {subView === "tree" && (
              <motion.div
                key="tree"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {!data.tasks || data.tasks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                    <Network className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-xs text-slate-400">در این فایل، ردیف فعالیتی (WBS) یافت نشد.</p>
                  </div>
                ) : (
                  <WbsTreePane
                    data={{ projectTitle: data.projectTitle || data.project_title, tasks: data.tasks }}
                    onOpenDetails={(code) => {
                      closeAll();
                      setFocusCode(code);
                      setSubView("cards");
                      window.setTimeout(() => {
                        const el = document.querySelector<HTMLElement>(`[data-code="${code}"]`);
                        el?.scrollIntoView({ behavior: "smooth", block: "center" });
                        window.setTimeout(() => setFocusCode(null), 2500);
                      }, 350);
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ============================================================== */}
      {/* مودال تأیید حذف فایل WBS */}
      {/* ============================================================== */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 max-w-md w-full space-y-4 z-10 animate-fade-in text-right">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">حذف فایل ساختار شکست (WBS)</h3>
                <p className="text-xs text-slate-500 mt-0.5">پروژه: {data?.project_title || currentProjectSummary?.project_title}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              آیا از حذف کامل فایل اکسل و ساختار شکست کار این پروژه اطمینان دارید؟ با تأیید، فایل فیزیکی از سرور حذف شده و شناسنامه و درخت WBS آن پاک‌سازی می‌گردد. این عملیات غیرقابل بازگشت است.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteWbs}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{deleting ? "در حال حذف..." : "تأیید و حذف فایل"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// کامپوننت سطر فعالیت WBS در نمای لیستی (WBS Activity List Row)
// ============================================================
function WbsTaskRow({
  task,
  index,
  highlighted,
  isExpanded,
  onToggleExpand,
}: {
  task: WbsTask;
  index: number;
  highlighted?: boolean;
  isExpanded?: boolean;
  onToggleExpand: () => void;
}) {
  const code = (task.wbs_code || `#${index + 1}`).trim();
  const cleanCode = normalizeDigits(code);
  const isPhase = task.level === "1" || cleanCode.split(".").length === 1 || (task.phase && task.name.includes("فاز"));
  const hasDeliverables = task.deliverables && task.deliverables.trim() !== "" && task.deliverables !== "-" && task.deliverables !== "---";
  const hasNote = task.note && task.note.trim() !== "" && task.note !== "-" && task.note !== "---";
  const hasKpi = task.kpi && task.kpi.trim() !== "" && task.kpi !== "-" && task.kpi !== "---";

  if (isPhase) {
    // نمای سربرگ فاز کلان
    return (
      <div
        data-code={code}
        className={`w-full rounded-2xl border-2 p-4 sm:p-5 transition-all shadow-2xs ${
          highlighted
            ? "border-emerald-500 bg-emerald-50/80 ring-4 ring-emerald-200"
            : "bg-gradient-to-l from-emerald-50/60 via-white to-white border-emerald-200 hover:border-emerald-300"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-black text-xs shadow-xs tracking-wider">
                  {toPersianDigits(code)}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  فاز کلان پروژه
                </span>
              </div>
              <h3 className="font-extrabold text-base text-slate-900 mt-1">{task.name}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-600 shrink-0 flex-wrap">
            {task.duration && (
              <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-slate-700 font-semibold shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>مدت فاز: {toPersianDigits(task.duration)}</span>
              </span>
            )}
            {task.owner && (
              <span className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-slate-200 text-slate-700 font-semibold shadow-2xs">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>مسئول: {task.owner}</span>
              </span>
            )}
          </div>
        </div>

        {hasDeliverables && (
          <div className="mt-3 p-3 rounded-xl bg-white/90 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold text-emerald-800">خروجی کلان فاز: </span>
              <span className="font-medium leading-relaxed">{toPersianDigits(task.deliverables)}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // نمای سطر فعالیت / بسته کاری تفصیلی (Level 2+)
  return (
    <div
      data-code={code}
      className={`w-full rounded-2xl border p-4 sm:p-5 transition-all bg-white shadow-2xs ${
        highlighted
          ? "border-emerald-500 shadow-md ring-4 ring-emerald-200"
          : "border-slate-200 hover:border-emerald-300 hover:shadow-xs"
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-black text-xs shadow-xs tracking-wider">
              {toPersianDigits(code)}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              سطح {toPersianDigits(task.level || "۲")}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {task.phase && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {task.phase}
                </span>
              )}
              {hasKpi && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Target className="w-3 h-3 text-emerald-600" />
                  <span>شاخص: {task.kpi}</span>
                </span>
              )}
            </div>
            <h4 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">{task.name}</h4>
          </div>
        </div>

        {hasNote && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700 bg-slate-50 hover:bg-emerald-50 px-2.5 py-1 rounded-xl border border-slate-200 transition-colors shrink-0 self-start cursor-pointer"
          >
            <span>ملاحظات</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {hasDeliverables && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <span className="font-bold text-emerald-800">قلم تحویل‌دادنی / خروجی: </span>
            <span className="font-medium leading-relaxed">{toPersianDigits(task.deliverables)}</span>
          </div>
        </div>
      )}

      <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-slate-400">مسئول:</span>
          <span className="font-bold text-slate-800">{task.owner || "—"}</span>
        </div>

        {task.duration && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400">مدت زمان:</span>
            <span className="font-bold text-slate-800">{toPersianDigits(task.duration)}</span>
          </div>
        )}

        {task.start_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400">تاریخ شروع:</span>
            <span className="font-bold text-slate-800">{toPersianDigits(task.start_date)}</span>
          </div>
        )}

        {task.prerequisite && (
          <div className="flex items-center gap-1.5">
            <GitBranch className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400">پیش‌نیاز:</span>
            <span className="font-bold text-slate-800">{toPersianDigits(task.prerequisite)}</span>
          </div>
        )}
      </div>

      {isExpanded && hasNote && (
        <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1 animate-fade-in">
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>توضیحات و ملاحظات تکمیلی:</span>
          </div>
          <p className="leading-relaxed font-normal whitespace-pre-wrap text-slate-600">{toPersianDigits(task.note)}</p>
        </div>
      )}
    </div>
  );
}
