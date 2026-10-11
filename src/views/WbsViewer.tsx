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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import WbsTreePane from "./WbsTree";
import { CustomSelect } from "../components";
import { toPersianDigits } from "../dateUtils";
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

// ---------- اتریبیوت‌های کارت فعالیت (WBS) ----------
interface AttrSpec {
  key: keyof WbsTask;
  label: string;
  side: "right" | "left";
  top: number; // درصد
}

const SIDE_ATTRS: AttrSpec[] = [
  { key: "level", label: "سطح", side: "right", top: 24 },
  { key: "owner", label: "مسئول", side: "right", top: 50 },
  { key: "prerequisite", label: "پیش‌نیاز", side: "right", top: 76 },
  { key: "start_date", label: "تاریخ شروع", side: "left", top: 24 },
  { key: "duration", label: "مدت (روز کاری)", side: "left", top: 50 },
  { key: "note", label: "توضیح", side: "left", top: 76 },
];

const BOTTOM_ATTR: AttrSpec = {
  key: "deliverables",
  label: "نتایج بسته‌های کاری",
  side: "right",
  top: 100,
};

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

  // تگ‌های باز در نمای کارت‌ها
  const [openAttrs, setOpenAttrs] = useState<string[]>([]);
  const toggleAttr = (id: string) => {
    setOpenAttrs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const closeAll = () => setOpenAttrs([]);

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
            <a
              href="/api/wbs/template"
              title="دانلود فایل تمپلیت خام و استاندارد ساختار شکست کار (WBS) همراه با گاردریل هوش مصنوعی"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all border border-slate-200 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>تمپلیت خام WBS</span>
            </a>

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

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{uploading ? "در حال آپلود..." : "انتخاب و بارگذاری فایل اکسل WBS"}</span>
            </button>
            <a
              href="/api/wbs/template"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer shadow-xs"
              title="دانلود فایل تمپلیت خام اکسل ساختار شکست کار همراه با راهنما و پرامپت هوش مصنوعی"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>دانلود تمپلیت خام WBS سازمان</span>
            </a>
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
                <span>کارت‌های فعالیت (WBS)</span>
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

            {/* ۲. کارت‌های فعالیت WBS با تگ‌های بازشونده */}
            {subView === "cards" && (
              <motion.div
                key="cards"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {!data.tasks || data.tasks.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                    <ListTree className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-xs text-slate-400">در این فایل، ردیف فعالیتی (WBS) یافت نشد.</p>
                  </div>
                ) : (
                  <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 sm:p-8 min-h-[460px] max-h-[75vh] overflow-y-auto">
                    <div className="flex flex-col items-center py-6">
                      {data.tasks.map((task, i) => {
                        const code = task.wbs_code || `#${i + 1}`;
                        return (
                          <WbsTaskCard
                            key={`${code}-${i}`}
                            task={task}
                            index={i}
                            code={code}
                            openAttrs={openAttrs}
                            toggleAttr={toggleAttr}
                            highlighted={focusCode === code}
                          />
                        );
                      })}
                    </div>
                  </div>
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
// کارت تعاملی هر فعالیت در WBS با تگ‌های بازشونده
// ============================================================
const SHORT_VALUE_LIMIT = 42;

function WbsTaskCard({
  task,
  index,
  code,
  openAttrs,
  toggleAttr,
  highlighted,
}: {
  task: WbsTask;
  index: number;
  code: string;
  openAttrs: string[];
  toggleAttr: (id: string) => void;
  highlighted?: boolean;
}) {
  const hasRealValue = (v: string) => v && v.trim() !== "" && v !== "-" && v !== "---";

  const renderSideTag = (spec: AttrSpec) => {
    const id = `${code}:side:${spec.key}`;
    const value = (task[spec.key] as string) || "";
    const hasValue = hasRealValue(value);
    const isOpen = openAttrs.includes(id);
    const isRight = spec.side === "right";
    const recency = openAttrs.indexOf(id);
    const popoverZ = 40 + Math.max(recency, 0);

    const posStyle: React.CSSProperties = isRight
      ? { top: `${spec.top}%`, left: "100%", transform: "translateY(-50%)" }
      : { top: `${spec.top}%`, right: "100%", transform: "translateY(-50%)" };

    const radius = isRight ? "rounded-r-xl" : "rounded-l-xl";

    if (!hasValue) {
      return (
        <div key={spec.key} className="absolute z-10 select-none" style={posStyle}>
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap border bg-slate-50 text-slate-400 border-slate-200 px-2 py-0.5 text-[10px] font-medium cursor-not-allowed opacity-80 ${radius}`}
            title="این مورد ثبت نشده است"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
            {spec.label}
          </div>
        </div>
      );
    }

    return (
      <div key={spec.key} className="absolute" style={posStyle}>
        <motion.button
          onClick={() => toggleAttr(id)}
          whileHover={{ x: isRight ? 2 : -2 }}
          whileTap={{ scale: 0.95 }}
          className={`relative flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-xs ${radius} ${
            isOpen
              ? "bg-emerald-700 text-white border-emerald-700 z-20"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 z-10"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOpen ? "bg-white" : "bg-emerald-500"}`} />
          {spec.label}
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: isRight ? -6 : 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRight ? -6 : 6 }}
              transition={{ duration: 0.18 }}
              className={`absolute z-40 -top-1 ${isRight ? "left-[calc(100%+8px)]" : "right-[calc(100%+8px)]"}`}
              style={{ zIndex: popoverZ }}
            >
              {value.length <= SHORT_VALUE_LIMIT && !value.includes("\n") ? (
                <div className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[11px] px-3 py-1.5 border border-slate-700 shadow-xl ring-2 ring-white/90">
                  <span className="text-emerald-400 font-bold shrink-0">{spec.label}:</span>
                  <span>{toPersianDigits(value)}</span>
                </div>
              ) : (
                <div className="w-64 max-w-[70vw] rounded-xl bg-slate-900 text-white px-3.5 py-2.5 border border-slate-700 shadow-2xl ring-2 ring-white/90">
                  <span className="text-emerald-400 text-[10px] font-bold block mb-1">{spec.label}</span>
                  <p className="text-[11px] leading-5 break-words whitespace-pre-wrap">{toPersianDigits(value)}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderBottomTag = () => {
    const spec = BOTTOM_ATTR;
    const id = `${code}:bottom:deliverables`;
    const value = task.deliverables || "";
    const hasValue = hasRealValue(value);
    const isOpen = openAttrs.includes(id);
    const recency = openAttrs.indexOf(id);
    const popoverZ = 40 + Math.max(recency, 0);

    if (!hasValue) {
      return (
        <div className="absolute top-full left-1/2 -translate-x-1/2 z-10 select-none cursor-not-allowed" title="این مورد ثبت نشده است">
          <div className="flex items-center gap-1.5 whitespace-nowrap border bg-slate-50 text-slate-400 border-slate-200 px-2 py-0.5 text-[10px] font-medium opacity-80 rounded-b-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
            {spec.label}
          </div>
        </div>
      );
    }

    return (
      <div className="absolute top-full left-1/2 -translate-x-1/2 z-10">
        <motion.button
          onClick={() => toggleAttr(id)}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-xs rounded-b-xl ${
            isOpen
              ? "bg-emerald-700 text-white border-emerald-700 z-20"
              : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 z-10"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOpen ? "bg-white" : "bg-emerald-500"}`} />
          {spec.label}
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="absolute z-40 top-full left-1/2 -translate-x-1/2 mt-1"
              style={{ zIndex: popoverZ }}
            >
              {value.length <= SHORT_VALUE_LIMIT && !value.includes("\n") ? (
                <div className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[11px] px-3 py-1.5 border border-slate-700 shadow-xl ring-2 ring-white/90">
                  <span className="text-emerald-400 font-bold shrink-0">{spec.label}:</span>
                  <span>{toPersianDigits(value)}</span>
                </div>
              ) : (
                <div className="w-72 max-w-[80vw] rounded-xl bg-slate-900 text-white px-3.5 py-2.5 border border-slate-700 shadow-2xl ring-2 ring-white/90">
                  <span className="text-emerald-400 text-[10px] font-bold block mb-1">{spec.label}</span>
                  <p className="text-[11px] leading-5 break-words whitespace-pre-wrap">{toPersianDigits(value)}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const anyOpen = openAttrs.some((id) => id.startsWith(`${code}:`));

  return (
    <div data-code={code} className="relative" style={{ marginTop: 16, marginBottom: 32 }}>
      {SIDE_ATTRS.map(renderSideTag)}
      {renderBottomTag()}

      {/* کارت اصلی فعالیت */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.04, 0.5), duration: 0.25 }}
        className={`relative w-[24rem] sm:w-[26rem] max-w-full bg-white rounded-2xl border-2 flex flex-col items-center justify-center text-center px-6 py-6 transition-all ${
          highlighted
            ? "border-emerald-600 shadow-xl ring-4 ring-emerald-200"
            : anyOpen
              ? "border-emerald-400 shadow-md"
              : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
        }`}
        style={{ minHeight: 110 }}
      >
        {/* نوار کد WBS */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] font-bold rounded-lg px-2.5 py-0.5 shadow-md tracking-wider whitespace-nowrap">
          {toPersianDigits(code)}
        </div>

        {/* نام فعالیت */}
        <p className="text-sm sm:text-base font-bold text-slate-900 leading-6 break-words">{task.name}</p>
      </motion.div>
    </div>
  );
}
