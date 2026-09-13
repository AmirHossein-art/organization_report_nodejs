// src/views/WbsTree.tsx
// نمودار درختی ساختار شکست کار (WBS) — به‌صورت «پنجرهٔ قابل embed» داخل WbsViewer (تب «ساختار درختی»)
// ظاهر دقیقاً مطابق نمونهٔ مرجع:
// - کارت fit-content تک‌خطی، گرادیان سبز پویا بر اساس حداکثر عمق، خط نقطه‌چین والد→فرزند
// - پیش‌فرض تا سطح ۳ باز؛ عمیق‌تر با دکمهٔ گرد دستی باز می‌شود
// - کلیک روی بدنهٔ کارت → پرش به همان آیتم در نمای جزئیات (از طریق onOpenDetails)
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

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

interface WbsTreeData {
  projectTitle: string;
  tasks: WbsTask[];
}

// ---------- ساخت درخت از کدهای WBS واقعی ----------
interface WBSNode {
  code: string;
  name: string;
  children: WBSNode[];
}

function buildTree(tasks: WbsTask[]): WBSNode[] {
  const map = new Map<string, WBSNode>();
  for (const t of tasks) {
    map.set(t.wbs_code, { code: t.wbs_code, name: t.name, children: [] });
  }
  const roots: WBSNode[] = [];
  for (const t of tasks) {
    const node = map.get(t.wbs_code)!;
    const parts = t.wbs_code.split(".");
    if (parts.length === 1) {
      roots.push(node);
    } else {
      const parent = map.get(parts.slice(0, -1).join("."));
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  }
  // مرتب‌سازی عددی طبیعی (1.10 بعد از 1.9)
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

// ---------- رنگ‌ها: گرادیان سبز پویا بر اساس حداکثر عمق ----------
const HUE = 152;
const SATURATION = 42;
const MIN_LIGHTNESS = 20;
const MAX_LIGHTNESS = 88;
const ROOT_COLOR = "#0f2419";

function depthOf(code: string): number {
  return code.split(".").length;
}

function computeMaxDepth(nodes: WBSNode[]): number {
  let max = 1;
  const walk = (node: WBSNode) => {
    max = Math.max(max, depthOf(node.code));
    node.children.forEach(walk);
  };
  nodes.forEach(walk);
  return max;
}

function getColor(depth: number, maxDepth: number): { bg: string; text: string } {
  const ratio = maxDepth <= 1 ? 0 : (depth - 1) / (maxDepth - 1);
  const lightness = MIN_LIGHTNESS + ratio * (MAX_LIGHTNESS - MIN_LIGHTNESS);
  const bg = `hsl(${HUE}, ${SATURATION}%, ${lightness}%)`;
  const text = lightness < 55 ? "#ffffff" : "#0f2b1c";
  return { bg, text };
}

function defaultOpen(depth: number): boolean {
  // تا سطح سه به‌طور کامل باز نمایش داده می‌شود؛ عمیق‌تر با دکمه دستی باز می‌شود
  return depth < 3;
}

// ---------------------------------------------------------------------------
// کارت هر گره — Fit-to-content: عرض دقیقاً به اندازه متن، تک‌خطی (ظاهر نمونه مرجع)
// ---------------------------------------------------------------------------
interface NodeCardProps {
  node: WBSNode;
  depth: number;
  maxDepth: number;
  isOpen: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  onOpenDetails: () => void;
}

function NodeCard({ node, depth, maxDepth, isOpen, hasChildren, onToggle, onOpenDetails }: NodeCardProps) {
  const { bg, text } = getColor(depth, maxDepth);

  return (
    <motion.div
      whileHover={{ scale: 1.035, boxShadow: "0 10px 24px rgba(15,36,25,0.22)" }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="relative select-none rounded-xl px-4 pt-2.5 pb-4 shadow-sm cursor-pointer"
      style={{ backgroundColor: bg, width: "fit-content", maxWidth: "none" }}
      onClick={onOpenDetails}
      title="مشاهده جزئیات این فعالیت"
    >
      <div className="text-center text-[11px] font-bold tracking-wide whitespace-nowrap" style={{ color: text, opacity: 0.82 }}>
        {node.code}
      </div>
      <div dir="rtl" className="text-center text-[13px] leading-snug mt-1 whitespace-nowrap" style={{ color: text }}>
        {node.name}
      </div>

      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // کلیک روی دکمه باز/بسته نباید به جزئیات برود
            onToggle();
          }}
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

// ---------------------------------------------------------------------------
// شاخه (بازگشتی) — فرزندان به سمت پایین و راست تورفتگی می‌گیرند
// ---------------------------------------------------------------------------
interface BranchProps {
  node: WBSNode;
  openState: Record<string, boolean>;
  toggle: (code: string) => void;
  maxDepth: number;
  onOpenDetails: (code: string) => void;
}

function Branch({ node, openState, toggle, maxDepth, onOpenDetails }: BranchProps) {
  const depth = depthOf(node.code);
  const hasChildren = node.children.length > 0;
  const isOpen = openState[node.code] ?? defaultOpen(depth);

  return (
    <div className="flex flex-col items-start" style={{ width: "fit-content" }}>
      <NodeCard
        node={node}
        depth={depth}
        maxDepth={maxDepth}
        isOpen={isOpen}
        hasChildren={hasChildren}
        onToggle={() => toggle(node.code)}
        onOpenDetails={() => onOpenDetails(node.code)}
      />

      <AnimatePresence initial={false}>
        {isOpen && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden ml-7 mt-5 pl-5 border-l-2 border-dashed border-emerald-300/70"
          >
            <div className="flex flex-col gap-5 py-0.5">
              {node.children.map((child) => (
                <Branch
                  key={child.code}
                  node={child}
                  openState={openState}
                  toggle={toggle}
                  maxDepth={maxDepth}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
//  پنجرهٔ درخت — داخل تب «ساختار درختی» در WbsViewer رندر می‌شود
// ============================================================
export default function WbsTreePane({ data, onOpenDetails }: { data: WbsTreeData; onOpenDetails: (code: string) => void }) {
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  // با عوض شدن پروژه، وضعیت باز/بسته از نو
  useEffect(() => {
    setOpenState({});
  }, [data]);

  const tree = useMemo(() => buildTree(data.tasks), [data]);
  const maxDepth = useMemo(() => (tree.length ? computeMaxDepth(tree) : 1), [tree]);

  const toggle = (code: string) => {
    setOpenState((prev) => {
      const current = prev[code] ?? defaultOpen(depthOf(code));
      return { ...prev, [code]: !current };
    });
  };

  /* پنجرهٔ ثابت با اسکرول داخلی (افقی + عمودی) — ابعاد صفحه تغییر نمی‌کند */
  return (
    <div
      className="wbs-scroll overflow-auto bg-white rounded-2xl border border-slate-200 shadow-sm"
      style={{ height: "calc(100vh - 280px)", minHeight: 420 }}
    >
      <div dir="ltr" className="w-full py-6 min-w-max">
        <div dir="rtl" className="px-6 text-[13px] font-semibold text-neutral-400 mb-4">
          ساختار شکست کار (WBS)
        </div>

        <div className="relative">
          {/* نام پروژه — بالای نمودار، با اسکرول افقی جابه‌جا نمی‌شود */}
          <div className="flex flex-col items-center mb-8 px-4">
            <div
              className="rounded-xl px-6 py-3 shadow-md"
              style={{ backgroundColor: ROOT_COLOR, width: "fit-content", margin: "0 auto" }}
            >
              <div dir="rtl" className="text-white text-[15px] font-bold text-center whitespace-nowrap">
                {data.projectTitle}
              </div>
            </div>
          </div>

          {/* شاخه‌ها — هر تعداد شاخه اصلی، با اسکرول افقی */}
          <div className="overflow-x-auto pb-6" style={{ scrollbarWidth: "thin" }}>
            <div className="flex flex-row gap-x-12 justify-center min-w-max px-10">
              {tree.map((node) => (
                <Branch
                  key={node.code}
                  node={node}
                  openState={openState}
                  toggle={toggle}
                  maxDepth={maxDepth}
                  onOpenDetails={onOpenDetails}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
