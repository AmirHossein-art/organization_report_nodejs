// src/views/WbsViewer.tsx
// مشاهده ساختار شکست پروژه (WBS) — سه مرحله: انتخاب پروژه → جزئیات پروژه → ساختار شکست
import { useEffect, useRef, useState } from "react";
import {
  Folder,
  ArrowRight,
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
  ChevronLeft,
  Network,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import WbsTreePane from "./WbsTree";

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
  const [stage, setStage] = useState<"pick" | "detail" | "tree" | "tree2">("pick");
  const [selected, setSelected] = useState<WbsProjectRow | null>(null);

  // ---------- داده ----------
  const [projects, setProjects] = useState<WbsProjectRow[]>([]);
  const [data, setData] = useState<WbsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------- تگ‌های باز (چندتا همزمان؛ ترتیب = تازگی باز شدن) ----------
  const [openAttrs, setOpenAttrs] = useState<string[]>([]);

  const toggleAttr = (id: string) => {
    setOpenAttrs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const closeAll = () => setOpenAttrs([]);

  // ---------- فوکوس روی آیتم خاص (رسیدن از نمای درخت) ----------
  const [focusCode, setFocusCode] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { submissionId: number; code: string } | undefined;
      if (!detail) return;
      // اگر همین پروژه باز است فقط به جزئیاتِ همان آیتم برو؛ وگرنه اول پروژه را باز کن
      const goFocus = () => {
        closeAll();
        setFocusCode(detail.code);
        setStage("detail");
        window.setTimeout(() => {
          const el = document.querySelector<HTMLElement>(`[data-code="${detail.code}"]`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          window.setTimeout(() => setFocusCode(null), 2600);
        }, 420);
      };
      if (selected && selected.submission_id === detail.submissionId) {
        goFocus();
      } else {
        // پروژه را از روی شناسه پیدا و باز کن، بعد به آیتم برو
        fetch("/api/wbs-data/projects")
          .then((r) => (r.ok ? r.json() : []))
          .then((rows: WbsProjectRow[]) => {
            const row = rows.find((x) => x.submission_id === detail.submissionId);
            if (row) return openProjectRef.current(row).then(goFocus);
          })
          .catch(() => {});
      }
    };
    window.addEventListener("wbs:navigate", handler);
    return () => window.removeEventListener("wbs:navigate", handler);
  }, [selected]);

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
    closeAll();
    setStage("tree");
  };

  // رفرنس پایدار برای استفاده داخل listener رویداد درخت
  const openProjectRef = useRef(openProject);
  openProjectRef.current = openProject;

  const back = () => {
    closeAll();
    if (stage === "tree2") setStage("tree");
    else if (stage === "tree") setStage("detail");
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
          {stage === "tree" || stage === "tree2" ? "بازگشت به جزئیات پروژه" : "بازگشت به انتخاب پروژه"}
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
      <div className="flex gap-2">
        <button
          onClick={() => {
            closeAll();
            setStage("detail");
          }}
          className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 transition-colors cursor-pointer ${
            stage === "detail"
              ? "font-semibold text-amber-600 bg-amber-50"
              : "font-medium text-slate-600 hover:text-amber-600 hover:bg-amber-50"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          جزئیات پروژه
        </button>
        <button
          onClick={goTree}
          className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 transition-colors cursor-pointer ${
            stage === "tree"
              ? "font-semibold text-amber-600 bg-amber-50"
              : "font-medium text-slate-600 hover:text-amber-600 hover:bg-amber-50"
          }`}
        >
          <ListTree className="w-4 h-4" />
          ساختار شکست پروژه
        </button>
        <button
          onClick={() => {
            closeAll();
            setStage("tree2");
          }}
          className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 transition-colors cursor-pointer ${
            stage === "tree2"
              ? "font-semibold text-amber-600 bg-amber-50"
              : "font-medium text-slate-600 hover:text-amber-600 hover:bg-amber-50"
          }`}
        >
          <Network className="w-4 h-4" />
          ساختار درختی
        </button>
      </div>

      <AnimatePresence mode="wait">
        {/* ------------------ مرحله ۲: شناسنامه پروژه ------------------ */}
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

            {/* دکمه‌های رفتن به ساختار شکست (لیست / درخت) */}
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={goTree}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-colors cursor-pointer"
              >
                <ListTree className="w-4 h-4" />
                مشاهده ساختار شکست پروژه
              </button>
              <button
                onClick={() => {
                  closeAll();
                  setStage("tree2");
                }}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-colors cursor-pointer"
              >
                <Network className="w-4 h-4" />
                مشاهده ساختار درختی
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
          >
            {data.tasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <ListTree className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-400">در این فایل، ردیف فعالیتی (WBS) یافت نشد.</p>
              </div>
            ) : (
              /* پنجره ثابت با اسکرول داخلی */
              <div className="wbs-scroll h-[calc(100vh-260px)] min-h-[420px] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 shadow-inner">
                <div className="flex flex-col items-center py-14">
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

        {/* ------------------ مرحله ۴: ساختار درختی ------------------ */}
        {stage === "tree2" && (
          <motion.div
            key="tree2"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            {data.tasks.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                <Network className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm text-slate-400">در این فایل، ردیف فعالیتی (WBS) یافت نشد.</p>
              </div>
            ) : (
              <WbsTreePane
                data={{ projectTitle: data.projectTitle, tasks: data.tasks }}
                onOpenDetails={(code) => {
                  closeAll();
                  setFocusCode(code);
                  setStage("tree");
                  window.setTimeout(() => {
                    const el = document.querySelector<HTMLElement>(`[data-code="${code}"]`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                    window.setTimeout(() => setFocusCode(null), 2600);
                  }, 420);
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  کارت تعاملی هر فعالیت
//  - چند تگ می‌توانند همزمان باز باشند؛ بازشدهٔ جدیدتر روی قبلی‌ها
//    (هالهٔ سفید + z-index بالاتر بر اساس تازگی) قرار می‌گیرد
//  - مقدار کوتاه → نوار افقی تک‌خطی؛ مقدار بلند → کارت عمودی
// ============================================================
const SHORT_VALUE_LIMIT = 42; // کاراکتر — بیش از این = حالت کارت عمودی

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
  const hasRealValue = (v: string) => v.trim() !== "" && v !== "-" && v !== "---";

  // ---------- تگ‌های سمت راست و چپ ----------
  const renderSideTag = (spec: AttrSpec) => {
    const id = `${code}:side:${spec.key}`;
    const value = (task[spec.key] as string) || "";
    const hasValue = hasRealValue(value);
    const isOpen = openAttrs.includes(id);
    const isRight = spec.side === "right";
    const recency = openAttrs.indexOf(id); // -1 اگر بسته
    const popoverZ = 40 + Math.max(recency, 0);

    const posStyle: React.CSSProperties = isRight
      ? { top: `${spec.top}%`, left: "100%", transform: "translateY(-50%)" }
      : { top: `${spec.top}%`, right: "100%", transform: "translateY(-50%)" };

    const radius = isRight ? "rounded-r-xl" : "rounded-l-xl";

    // تگ خالی: قرمز، غیرقابل کلیک
    if (!hasValue) {
      return (
        <div key={spec.key} className="absolute z-10 select-none" style={posStyle}>
          <div
            className={`flex items-center gap-1.5 whitespace-nowrap border bg-red-50 text-red-400 border-red-200 px-2.5 py-1 text-[11px] font-medium cursor-not-allowed opacity-90 ${radius}`}
            title="این مورد ثبت نشده است"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-300 flex-shrink-0" />
            {spec.label}
          </div>
        </div>
      );
    }

    // تگ دارای مقدار: سبزِ تم — کلیک برای باز/بستن (مستقل از بقیه تگ‌ها)
    return (
      <div key={spec.key} className="absolute" style={posStyle}>
        <motion.button
          onClick={() => toggleAttr(id)}
          whileHover={{ x: isRight ? 2 : -2 }}
          whileTap={{ scale: 0.95 }}
          className={`relative flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-sm ${radius} ${
            isOpen
              ? "bg-emerald-600 text-white border-emerald-600 z-20"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 z-10"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? "bg-white" : "bg-emerald-500"}`} />
          {spec.label}
        </motion.button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, x: isRight ? -6 : 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRight ? -6 : 6 }}
              transition={{ duration: 0.18 }}
              className={`absolute z-40 -top-1 ${isRight ? "left-[calc(100%+10px)]" : "right-[calc(100%+10px)]"}`}
              style={{ zIndex: popoverZ }}
            >
              {value.length <= SHORT_VALUE_LIMIT && !value.includes("\n") ? (
                /* مقدار کوتاه: نوار افقی تک‌خطی روبروی تگ */
                <div className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[12px] px-3.5 py-2 border border-slate-700 shadow-xl ring-2 ring-white/90">
                  <span className="text-amber-300 text-[10px] font-bold flex-shrink-0">{spec.label}:</span>
                  <span>{value}</span>
                </div>
              ) : (
                /* مقدار بلند: کارت عمودی که به پایین رشد می‌کند و متن کامل را نشان می‌دهد */
                <div className="w-64 max-w-[70vw] rounded-xl bg-slate-900 text-white px-4 py-3 border border-slate-700 shadow-2xl ring-2 ring-white/90">
                  <span className="text-amber-300 text-[10px] font-bold block mb-1">{spec.label}</span>
                  <p className="text-[12px] leading-6 break-words whitespace-pre-wrap">{value}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ---------- تگ زیرین: نتایج بسته‌های کاری ----------
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
          <div className="flex items-center gap-1.5 whitespace-nowrap border bg-red-50 text-red-400 border-red-200 px-2.5 py-1 text-[11px] font-medium opacity-90 rounded-b-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-red-300 flex-shrink-0" />
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
          className={`flex items-center gap-1.5 whitespace-nowrap border px-2.5 py-1 text-[11px] font-semibold cursor-pointer transition-colors shadow-sm rounded-b-xl ${
            isOpen
              ? "bg-emerald-600 text-white border-emerald-600 z-20"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 z-10"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOpen ? "bg-white" : "bg-emerald-500"}`} />
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
                <div className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-slate-900 text-white text-[12px] px-3.5 py-2 border border-slate-700 shadow-xl ring-2 ring-white/90">
                  <span className="text-amber-300 text-[10px] font-bold flex-shrink-0">{spec.label}:</span>
                  <span>{value}</span>
                </div>
              ) : (
                <div className="w-72 max-w-[80vw] rounded-xl bg-slate-900 text-white px-4 py-3 border border-slate-700 shadow-2xl ring-2 ring-white/90">
                  <span className="text-amber-300 text-[10px] font-bold block mb-1">{spec.label}</span>
                  <p className="text-[12px] leading-6 break-words whitespace-pre-wrap">{value}</p>
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

      {/* مستطیل اصلی */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index * 0.05, 0.6), duration: 0.3 }}
        className={`relative w-[26rem] max-w-full bg-white rounded-2xl border-2 flex flex-col items-center justify-center text-center px-6 py-6 transition-shadow ${
          highlighted
            ? "border-amber-500 shadow-xl ring-4 ring-amber-200"
            : anyOpen
              ? "border-amber-400 shadow-lg"
              : "border-slate-200 hover:border-slate-300 hover:shadow-md"
        }`}
        style={{ minHeight: 118 }}
      >
        {/* نوار کد WBS */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold rounded-lg px-3 py-1 shadow-md tracking-wider whitespace-nowrap">
          {code}
        </div>

        {/* نام فعالیت */}
        <p className="text-base sm:text-lg font-bold text-slate-900 leading-7 break-words">{task.name}</p>
      </motion.div>
    </div>
  );
}
