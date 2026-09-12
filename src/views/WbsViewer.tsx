// src/views/WbsViewer.tsx
// مشاهده ساختار شکست پروژه (WBS) — سه مرحله: انتخاب پروژه → جزئیات پروژه → ساختار شکست
import { useEffect, useState } from "react";
import {
  Folder,
  ArrowRight,
  FileSpreadsheet,
  Download,
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
  ChevronDown,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface WbsProjectRow {
  submission_id: number;
  project_id: number;
  project_title: string;
  project_code: string;
  uploaded_by: string;
  file_name: string;
  uploaded_at: string;
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

interface WbsData extends WbsProjectRow {
  projectTitle: string;
  projectInfo: WbsProjectInfoRow[];
  tasks: WbsTask[];
  kpis: WbsKpi[];
}

// ---------- اتریبیوت‌های مستطیل (۷ عدد) ----------
// top: موقعیت عمودی تگ نسبت به مستطیل (۰ تا ۱۰۰ درصد ارتفاع مستطیل)
// side: تگ سمت راست یا چپ مستطیل قرار می‌گیرد
interface AttrSpec {
  key: keyof WbsTask;
  label: string;
  side: "right" | "left";
  top: number; // درصد
}

const RIGHT_ATTRS: AttrSpec[] = [
  { key: "level", label: "سطح", side: "right", top: 22 },
  { key: "owner", label: "مسئول", side: "right", top: 50 },
  { key: "prerequisite", label: "پیش‌نیاز", side: "right", top: 78 },
];

const LEFT_ATTRS: AttrSpec[] = [
  { key: "start_date", label: "تاریخ شروع", side: "left", top: 22 },
  { key: "duration", label: "مدت (روز کاری)", side: "left", top: 50 },
  { key: "note", label: "توضیح", side: "left", top: 78 },
];

const BOTTOM_ATTR: AttrSpec = {
  key: "deliverables",
  label: "نتایج بسته‌های کاری",
  side: "right",
  top: 100,
};

// آیکون شناسنامه بر اساس کلید
function infoIcon(key: string) {
  if (key.includes("نام پروژه")) return <Folder className="w-4 h-4" />;
  if (key.includes("مدیر")) return <User className="w-4 h-4" />;
  if (key.includes("کارفرما")) return <Building2 className="w-4 h-4" />;
  if (key.includes("هدف")) return <Target className="w-4 h-4" />;
  if (key.includes("خروجی")) return <Rocket className="w-4 h-4" />;
  if (key.includes("شروع")) return <Calendar className="w-4 h-4" />;
  if (key.includes("پایان")) return <Flag className="w-4 h-4" />;
  if (key.includes("محدودیت")) return <AlertTriangle className="w-4 h-4" />;
  return <ListTree className="w-4 h-4" />;
}

export default function WbsViewer() {
  // ---------- ناوبری داخلی ----------
  const [stage, setStage] = useState<"pick" | "detail" | "tree">("pick");
  const [selected, setSelected] = useState<WbsProjectRow | null>(null);

  // ---------- داده ----------
  const [projects, setProjects] = useState<WbsProjectRow[]>([]);
  const [data, setData] = useState<WbsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------- انیمیشن باز شدن تگ ----------
  const [openAttr, setOpenAttr] = useState<string | null>(null); // مثال: "1.1:right:owner"

  // ---------- بارگذاری لیست پروژه‌های دارای WBS ----------
  useEffect(() => {
    if (stage !== "pick") return;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/wbs-data/projects");
        if (!res.ok) throw new Error("خطا در دریافت فهرست پروژه‌ها");
        setProjects(await res.json());
      } catch (e: any) {
        setError(e.message || "خطای ناشناخته");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [stage]);

  // ---------- بارگذاری داده کامل پروژه انتخابی ----------
  const openProject = async (row: WbsProjectRow) => {
    setSelected(row);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/wbs-data/${row.submission_id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "خطا در خواندن فایل اکسل");
      }
      setData(await res.json());
      setStage("detail");
    } catch (e: any) {
      setError(e.message || "خطای ناشناخته");
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const goTree = () => {
    setOpenAttr(null);
    setStage("tree");
  };

  const back = () => {
    setOpenAttr(null);
    if (stage === "tree") setStage("detail");
    else if (stage === "detail") {
      setStage("pick");
      setSelected(null);
      setData(null);
    }
  };

  // ============================================================
  //  مرحله ۱: انتخاب پروژه
  // ============================================================
  if (stage === "pick") {
    return (
      <div className="space-y-6" dir="rtl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">مشاهده ساختار شکست پروژه‌ها</h2>
          <p className="text-sm text-slate-500 mt-1">
            پروژه موردنظر را انتخاب کنید تا شناسنامه و ساختار شکست آن نمایش داده شود.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="p-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <ListTree className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm text-slate-400">هنوز هیچ ساختار شکستی توسط معاونان ثبت نشده است.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((p, i) => (
              <motion.button
                key={p.submission_id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                onClick={() => openProject(p)}
                className="group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-amber-300 hover:-translate-y-0.5 transition-all text-right p-5 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <Folder className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-800 truncate group-hover:text-amber-600 transition-colors">
                      {p.project_title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {p.project_code ? `کد: ${p.project_code}` : "بدون کد"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {p.uploaded_by}
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    مشاهده جزئیات
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  //  مرحله ۲ و ۳: جزئیات پروژه / ساختار شکست
  // ============================================================
  if (!selected || !data) return null;

  return (
    <div className="space-y-6" dir="rtl">
      {/* هدر ثابت: مسیر برگشت + نام پروژه + دانلود اکسل */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <button
          onClick={back}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-amber-600 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          {stage === "tree" ? "بازگشت به جزئیات پروژه" : "بازگشت به انتخاب پروژه"}
        </button>
        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
        <h2 className="text-lg font-bold text-slate-900 flex-1 min-w-0 truncate">{data.projectTitle}</h2>
        <a
          href={`/api/wbs-submissions/${data.submission_id}/download`}
          className="flex items-center gap-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          دانلود اکسل
        </a>
      </div>

      {/* ناوبری داخلی دو صفحه */}
      {stage === "detail" && (
        <div className="flex gap-2">
          <button
            onClick={() => setStage("detail")}
            className="flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 rounded-xl px-4 py-2 cursor-pointer"
          >
            <BarChart3 className="w-4 h-4" />
            جزئیات پروژه
          </button>
          <button
            onClick={goTree}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl px-4 py-2 transition-colors cursor-pointer"
          >
            <ListTree className="w-4 h-4" />
            ساختار شکست پروژه
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {stage === "tree" && (
        <div className="flex gap-2">
          <button
            onClick={() => setStage("detail")}
            className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl px-4 py-2 transition-colors cursor-pointer"
          >
            <BarChart3 className="w-4 h-4" />
            جزئیات پروژه
          </button>
          <button
            onClick={() => setStage("tree")}
            className="flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 rounded-xl px-4 py-2 cursor-pointer"
          >
            <ListTree className="w-4 h-4" />
            ساختار شکست پروژه
          </button>
        </div>
      )}

      {/* ------------------ مرحله ۲: شناسنامه پروژه ------------------ */}
      <AnimatePresence mode="wait">
        {stage === "detail" && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="bg-gradient-to-l from-amber-50 via-white to-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
                <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-200">
                  <Folder className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">شناسنامه پروژه</p>
                  <h1 className="text-2xl font-bold text-slate-900 mt-0.5">{data.projectTitle}</h1>
                  <p className="text-xs text-slate-400 mt-1">
                    فایل: {data.file_name} — ثبت توسط {data.uploaded_by}
                  </p>
                </div>
              </div>

              {/* کارت‌های کلید/مقدار شیت اول */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mt-5">
                {data.projectInfo.map((row, i) => {
                  const empty = !row.value;
                  return (
                    <motion.div
                      key={`${row.key}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      className={`rounded-xl border p-4 flex items-start gap-3 ${
                        empty ? "bg-red-50/50 border-red-100" : "bg-white border-slate-200"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          empty ? "bg-red-100 text-red-500" : "bg-slate-100 text-amber-600"
                        }`}
                      >
                        {infoIcon(row.key)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400 font-medium">{row.key}</p>
                        <p
                          className={`text-sm mt-1 font-medium break-words ${
                            empty ? "text-red-400 italic" : "text-slate-800"
                          }`}
                        >
                          {empty ? "— ثبت نشده" : row.value}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* شاخص‌ها (شیت سوم) — نمای خلاصه */}
            {data.kpis.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-amber-500" />
                  شاخص‌های کلیدی عملکرد
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {data.kpis.map((k, i) => (
                    <motion.div
                      key={`${k.name}-${i}`}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      className="rounded-xl border border-slate-200 p-4 hover:border-amber-200 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-slate-800 text-sm">{k.name}</p>
                        {k.threshold && (
                          <span className="text-[11px] bg-amber-50 text-amber-700 rounded-lg px-2 py-1 whitespace-nowrap">
                            حد آستانه: {k.threshold} {k.unit}
                          </span>
                        )}
                      </div>
                      {k.definition && <p className="text-xs text-slate-500 mt-2 leading-5">{k.definition}</p>}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* دکمه رفتن به ساختار شکست */}
            <div className="flex justify-center">
              <button
                onClick={goTree}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-colors cursor-pointer"
              >
                <ListTree className="w-4 h-4" />
                مشاهده ساختار شکست پروژه
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ------------------ مرحله ۳: ساختار شکست ------------------ */}
        {stage === "tree" && (
          <motion.div
            key="tree"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {data.tasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <ListTree className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-400">در این فایل، ردیف فعالیتی (WBS) یافت نشد.</p>
              </div>
            ) : (
              <div className="relative flex flex-col items-center gap-3">
                {data.tasks.map((task, i) => {
                  const code = task.wbs_code || `#${i + 1}`;
                  const levelNum = parseInt(task.level) || code.split(".").length;
                  // عمق بصری: هر سطح با حاشیه و عرض متفاوت تا سلسله‌مراتب مشخص باشد
                  const indent = Math.min(levelNum - 1, 3) * 28;

                  return (
                    <div
                      key={`${code}-${i}`}
                      className="relative flex justify-center w-full"
                      style={{ marginRight: indent }}
                    >
                      <WbsTaskCard
                        task={task}
                        index={i}
                        code={code}
                        openAttr={openAttr}
                        setOpenAttr={setOpenAttr}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  کارت تعاملی هر فعالیت: مستطیل مرکزی + ۶ تگ جانبی + ۱ تگ زیرین
// ============================================================
function WbsTaskCard({
  task,
  index,
  code,
  openAttr,
  setOpenAttr,
}: {
  task: WbsTask;
  index: number;
  code: string;
  openAttr: string | null;
  setOpenAttr: (v: string | null) => void;
}) {
  const toggle = (spec: AttrSpec) => {
    const id = `${code}:${spec.side}:${spec.key}`;
    setOpenAttr(openAttr === id ? null : id);
  };

  const renderTag = (spec: AttrSpec) => {
    const id = `${code}:${spec.side}:${spec.key}`;
    const value = (task[spec.key] as string) || "";
    const hasValue = value.trim() !== "" && value !== "-" && value !== "---";
    const isOpen = openAttr === id;

    // تگ‌های خالی: قرمز، غیرقابل کلیک، بدون باز شدن
    if (!hasValue) {
      return (
        <div
          key={spec.key}
          className="absolute z-10 select-none"
          style={
            spec.side === "right"
              ? { top: `${spec.top}%`, left: "100%", transform: "translateY(-50%) translateX(-6px)" }
              : { top: `${spec.top}%`, right: "100%", transform: "translateY(-50%) translateX(6px)" }
          }
        >
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-medium cursor-not-allowed ${
              spec.side === "right" ? "flex-row-reverse" : ""
            } bg-red-50 text-red-400 border-red-200 opacity-80`}
            title="این مورد ثبت نشده است"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
            {spec.label}
          </div>
        </div>
      );
    }

    // تگ‌های دارای مقدار: سبزِ هماهنگ با تم، قابل باز شدن با انیمیشن
    return (
      <div
        key={spec.key}
        className="absolute z-10"
        style={
          spec.side === "right"
            ? { top: `${spec.top}%`, left: "100%", transform: "translateY(-50%)" }
            : { top: `${spec.top}%`, right: "100%", transform: "translateY(-50%)" }
        }
      >
        <motion.button
          onClick={() => toggle(spec)}
          whileHover={{ x: spec.side === "right" ? 2 : -2 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-sm ${
            spec.side === "right" ? "flex-row-reverse" : ""
          } ${
            isOpen
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-white" : "bg-emerald-500"}`} />
          {spec.label}
        </motion.button>

        {/* نوار مقدار: از پشت تگ بیرون می‌آید */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: spec.side === "right" ? -8 : 8, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: spec.side === "right" ? -8 : 8, width: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`absolute top-1/2 -translate-y-1/2 overflow-hidden ${
                spec.side === "right" ? "left-full ml-1" : "right-full mr-1"
              }`}
            >
              <div className="whitespace-nowrap max-w-xs rounded-lg bg-slate-900 text-white text-[12px] leading-5 px-3.5 py-2 shadow-lg border border-slate-700 flex items-center gap-2">
                <span className="text-amber-300 text-[10px] font-bold flex-shrink-0">{spec.label}:</span>
                <span className="break-words">{value}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="relative" style={{ minHeight: 110 }}>
      {/* تگ‌های سمت راست */}
      {RIGHT_ATTRS.map(renderTag)}
      {/* تگ‌های سمت چپ */}
      {LEFT_ATTRS.map(renderTag)}

      {/* تگ زیرین: نتایج بسته‌های کاری */}
      {(() => {
        const spec = BOTTOM_ATTR;
        const id = `${code}:bottom:deliverables`;
        const value = task.deliverables || "";
        const hasValue = value.trim() !== "";
        const isOpen = openAttr === id;

        if (!hasValue) {
          return (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-10 cursor-not-allowed">
              <div className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-50 text-red-400 border border-red-200 px-2.5 py-1 text-[11px] font-medium opacity-80" title="این مورد ثبت نشده است">
                <span className="w-1.5 h-1.5 rounded-full bg-red-300" />
                {spec.label}
              </div>
            </div>
          );
        }

        return (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-10">
            <motion.button
              onClick={() => setOpenAttr(isOpen ? null : id)}
              whileTap={{ scale: 0.95 }}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-sm ${
                isOpen
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? "bg-white" : "bg-emerald-500"}`} />
              {spec.label}
            </motion.button>
            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, width: 0 }}
                  animate={{ opacity: 1, y: 0, width: "auto" }}
                  exit={{ opacity: 0, y: -6, width: 0 }}
                  transition={{ duration: 0.22 }}
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-1 overflow-hidden"
                >
                  <div className="whitespace-nowrap max-w-md rounded-lg bg-slate-900 text-white text-[12px] leading-5 px-3.5 py-2 shadow-lg border border-slate-700">
                    <span className="text-amber-300 text-[10px] font-bold">{spec.label}: </span>
                    <span className="break-words">{value}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })()}

      {/* مستطیل اصلی: کد WBS + نام فعالیت */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.05, 0.6), duration: 0.3 }}
        className={`relative w-80 sm:w-96 bg-white rounded-2xl border-2 px-6 pt-5 pb-9 text-center shadow-sm transition-shadow ${
          openAttr && openAttr.startsWith(`${code}:`)
            ? "border-amber-400 shadow-lg"
            : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        }`}
        style={{ marginTop: 14, marginBottom: 26 }}
      >
        {/* نوار کد WBS — وسط‌چین بالای کارت */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold rounded-lg px-3 py-1 shadow-md tracking-wider">
          {code}
        </div>

        {/* سطح فعالیت (نشان کوچک گوشه) */}
        <div className="absolute top-3 right-3 text-[10px] font-semibold text-slate-300">
          سطح {task.level || "-"}
        </div>

        {/* نام فعالیت — قهرمان اصلی صفحه */}
        <p className="text-base sm:text-lg font-bold text-slate-900 leading-7 mt-2 px-2">{task.name}</p>
      </motion.div>
    </div>
  );
}
