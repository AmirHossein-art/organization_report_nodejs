// src/views/WbsTree.tsx
// نمای درختی ساختار شکست کار (WBS) — نمای کلی برای مخاطب، فقط عنوان‌ها
// - کادرها دقیقاً fit به متن (تک‌خطی، بدون فضای اضافه)
// - پشتیبانی کامل از چند شاخه اصلی (1، 2، 3، ...) و هر عمقی از کد
// - عنوان پروژه ثابت بالای پنجره، درخت داخل پنجره اسکرول‌پذیر (افقی + عمودی) بدون تغییر ابعاد صفحه
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  Download,
  Folder,
  ListTree,
  Loader2,
  Network,
  TableProperties,
  User,
} from "lucide-react";
import { WbsTask } from "../utils/wbsDataParser";

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

interface WbsData extends WbsProjectRow {
  projectTitle: string;
  projectInfo: WbsProjectInfoRow[];
  tasks: WbsTask[];
}

// ---------- ساخت درخت از کدهای WBS ----------
interface TreeNode {
  code: string;
  name: string;
  children: TreeNode[];
}

function buildTree(tasks: WbsTask[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const map = new Map<string, TreeNode>();

  for (const t of tasks) {
    map.set(t.wbs_code, { code: t.wbs_code, name: t.name, children: [] });
  }

  for (const t of tasks) {
    const node = map.get(t.wbs_code)!;
    const parts = t.wbs_code.split(".");
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parentCode = parts.slice(0, -1).join(".");
      const parent = map.get(parentCode);
      if (parent) parent.children.push(node);
      else roots.push(node); // اگر والد یافت نشد، همان‌جا ریشه می‌شود
    }
  }

  // مرتب‌سازی: کد عددی (1.2.3) به‌صورت اعداد مقایسه می‌شود
  const cmp = (a: string, b: string) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  };
  roots.sort((x, y) => cmp(x.code, y.code));
  map.forEach((n) => n.children.sort((x, y) => cmp(x.code, y.code)));

  return roots;
}

// ---------- رنگ‌بندی سبز بر اساس عمق ----------
const HUE = 152;
const SAT = 42;
const L_MIN = 22;
const L_MAX = 86;
const ROOT_COLOR = "#0f2419";

function depthOf(code: string): number {
  return code.split(".").length;
}

function maxDepthOf(nodes: TreeNode[]): number {
  let max = 1;
  for (const n of nodes) {
    max = Math.max(max, depthOf(n.code));
    if (n.children.length) max = Math.max(max, maxDepthOf(n.children));
  }
  return max;
}

function colorFor(depth: number, maxDepth: number): { bg: string; text: string } {
  const ratio = maxDepth <= 1 ? 0 : (depth - 1) / (maxDepth - 1);
  const l = L_MIN + ratio * (L_MAX - L_MIN);
  return { bg: `hsl(${HUE}, ${SAT}%, ${l}%)`, text: l < 55 ? "#ffffff" : "#0f2b1c" };
}

function defaultOpen(depth: number): boolean {
  return depth < 3; // تا سطح ۳ باز نمایش داده می‌شود
}

// ============================================================
//  کارت گره — عرض دقیقاً fit به متن، تک‌خطی
// ============================================================
interface NodeCardProps {
  node: TreeNode;
  depth: number;
  maxDepth: number;
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
}

function NodeCard({ node, depth, maxDepth, isOpen, hasChildren, onToggle }: NodeCardProps) {
  const { bg, text } = colorFor(depth, maxDepth);

  return (
    <motion.div
      whileHover={{ scale: 1.03, boxShadow: "0 10px 24px rgba(15,36,25,0.22)" }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="relative inline-flex flex-col items-center select-none rounded-xl px-4 pt-2 pb-3.5 shadow-sm"
      style={{ backgroundColor: bg }}
    >
      <div className="text-center text-[11px] font-bold tracking-wide" style={{ color: text, opacity: 0.85 }}>
        {node.code}
      </div>
      <div
        dir="rtl"
        className="text-center text-[13px] font-semibold leading-snug mt-1 whitespace-nowrap max-w-[62vw]"
        style={{ color: text }}
      >
        {node.name}
      </div>

      {hasChildren && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "بستن زیرمجموعه" : "بازکردن زیرمجموعه"}
          aria-expanded={isOpen}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-white shadow border border-black/10 hover:scale-110 transition-transform cursor-pointer"
        >
          <ChevronDown
            size={14}
            style={{ color: bg }}
            className={`transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
          />
        </button>
      )}
    </motion.div>
  );
}

// ============================================================
//  شاخه (بازگشتی) — فرزندان زیر هر گره با خط اتصال نقطه‌چین
// ============================================================
interface BranchProps {
  node: TreeNode;
  depth: number;
  maxDepth: number;
  openState: Record<string, boolean>;
  onToggle: (code: string) => void;
}

function Branch({ node, depth, maxDepth, openState, onToggle }: BranchProps) {
  const hasChildren = node.children.length > 0;
  const isOpen = openState[node.code] ?? defaultOpen(depth);

  return (
    <div className="flex flex-col items-center">
      <NodeCard
        node={node}
        depth={depth}
        maxDepth={maxDepth}
        isOpen={isOpen}
        hasChildren={hasChildren}
        onToggle={() => onToggle(node.code)}
      />

      <AnimatePresence initial={false}>
        {hasChildren && isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden mt-5 pt-1"
          >
            <div className="flex flex-col items-center gap-5">
              {node.children.map((child) => (
                <div key={child.code} className="relative flex flex-col items-center">
                  {/* خط عمودی اتصال از والد به فرزند */}
                  <div
                    className="absolute -top-5 left-1/2 -translate-x-1/2 border-l-2 border-dashed"
                    style={{ borderColor: "rgba(47,107,79,0.55)", height: 20 }}
                  />
                  <Branch
                    node={child}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                    openState={openState}
                    onToggle={onToggle}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  کامپوننت اصلی صفحه
// ============================================================
export default function WbsTree() {
  const [projects, setProjects] = useState<WbsProjectRow[]>([]);
  const [selected, setSelected] = useState<WbsProjectRow | null>(null);
  const [data, setData] = useState<WbsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<"tree" | "list">("tree"); // پیش‌فرض: درخت

  // لیست پروژه‌های دارای WBS
  useEffect(() => {
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
  }, []);

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
      const d: WbsData = await res.json();
      setData(d);
      setOpenState({}); // ریست وضعیت باز/بسته
      setView("tree");
    } catch (e: any) {
      setError(e.message || "خطای ناشناخته");
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  const tree = useMemo(() => (data ? buildTree(data.tasks) : []), [data]);
  const maxDepth = useMemo(() => (tree.length ? maxDepthOf(tree) : 1), [tree]);

  const toggle = (code: string) => {
    setOpenState((prev) => {
      const depth = depthOf(code);
      const current = prev[code] ?? defaultOpen(depth);
      return { ...prev, [code]: !current };
    });
  };

  // ---------- صفحه انتخاب پروژه ----------
  if (!selected) {
    return (
      <div className="space-y-6" dir="rtl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">ساختار درختی پروژه‌ها</h2>
          <p className="text-sm text-slate-500 mt-1">
            نمای کلی و درختی ساختار شکست — پروژه موردنظر را انتخاب کنید.
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
            <Network className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm text-slate-400">هنوز هیچ ساختار شکستی ثبت نشده است.</p>
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
                    مشاهده درخت
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- صفحه درخت ----------
  return (
    <div className="space-y-5" dir="rtl">
      {/* هدر ثابت: برگشت + عنوان پروژه + دانلود */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-wrap items-center gap-3">
        <button
          onClick={() => {
            setSelected(null);
            setData(null);
          }}
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-amber-600 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
          بازگشت به انتخاب پروژه
        </button>
        <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
        <h2 className="text-lg font-bold text-slate-900 flex-1 min-w-0 truncate">
          {data?.projectTitle || "در حال بارگذاری..."}
        </h2>
        {data && (
          <a
            href={`/api/wbs-submissions/${data.submission_id}/download`}
            className="flex items-center gap-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            دانلود اکسل
          </a>
        )}
      </div>

      {/* سوییچ دو نما: درخت (کلی) / جزئیات (صفحه قبلی) */}
      <div className="flex gap-2">
        <button
          onClick={() => setView("tree")}
          className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 transition-colors cursor-pointer ${
            view === "tree"
              ? "font-semibold text-amber-600 bg-amber-50"
              : "font-medium text-slate-600 hover:text-amber-600 hover:bg-amber-50"
          }`}
        >
          <Network className="w-4 h-4" />
          نمای درختی (کلی)
        </button>
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-2 text-sm rounded-xl px-4 py-2 transition-colors cursor-pointer ${
            view === "list"
              ? "font-semibold text-amber-600 bg-amber-50"
              : "font-medium text-slate-600 hover:text-amber-600 hover:bg-amber-50"
          }`}
        >
          <TableProperties className="w-4 h-4" />
          نمای جزئیات
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="p-16 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
        </div>
      ) : !data ? null : view === "list" ? (
        /* دکمه فقط برای پرش به نمای جزئیاتِ کامل (صفحه WbsViewer) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-4">
          <ListTree className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm text-slate-500">
            نمای جزئیات (شناسنامه + مستطیل‌های تعاملی) در صفحه «مشاهده ساختار شکست پروژه‌ها» ارائه می‌شود.
          </p>
          <button
            onClick={() => setView("tree")}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl px-5 py-2.5 transition-colors cursor-pointer"
          >
            <Network className="w-4 h-4" />
            بازگشت به نمای درختی
          </button>
        </div>
      ) : tree.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Network className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-sm text-slate-400">در این فایل، ردیف فعالیتی (WBS) یافت نشد.</p>
        </div>
      ) : (
        /* ---------- نمای درخت: عنوان پروژه ثابت، درخت در پنجره اسکرول‌پذیر ---------- */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* عنوان پروژه — ثابت (بیرون از ناحیه اسکرول) */}
          <div className="flex justify-center py-5 border-b border-slate-100 bg-gradient-to-b from-emerald-50/60 to-white">
            <div
              className="rounded-xl px-8 py-3 shadow-md"
              style={{ backgroundColor: ROOT_COLOR }}
            >
              <div dir="rtl" className="text-white text-[15px] font-bold text-center whitespace-nowrap">
                {data.projectTitle}
              </div>
            </div>
          </div>

          {/* پنجره اسکرول‌پذیر: افقی + عمودی — ابعاد صفحه ثابت می‌ماند */}
          <div
            className="wbs-scroll overflow-auto"
            style={{ height: "calc(100vh - 330px)", minHeight: 420 }}
          >
            <div className="min-w-max flex flex-col items-center px-16 py-10">
              {/* شاخه‌های اصلی — هر تعداد (1، 2، 3، ...) */}
              <div className="flex flex-row items-start gap-x-14 flex-wrap justify-center gap-y-10">
                {tree.map((root) => (
                  <Branch
                    key={root.code}
                    node={root}
                    depth={depthOf(root.code)}
                    maxDepth={maxDepth}
                    openState={openState}
                    onToggle={toggle}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
