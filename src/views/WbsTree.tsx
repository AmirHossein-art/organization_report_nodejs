// src/views/WbsTree.tsx
// نمودار درختی ساختار شکست کار (WBS) — به‌صورت «پنجرهٔ قابل embed» داخل WbsViewer (تب «ساختار درختی»)
// ظاهر دقیقاً مطابق نمونهٔ مرجع:
// - کارت fit-content تک‌خطی، گرادیان سبز پویا بر اساس حداکثر عمق، خط نقطه‌چین والد→فرزند
// - پیش‌فرض تا سطح ۳ باز؛ عمیق‌تر با دکمهٔ گرد دستی باز می‌شود
// - کلیک روی بدنهٔ کارت → پرش به همان آیتم در نمای جزئیات (از طریق onOpenDetails)
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { toPersianDigits } from "../dateUtils";

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

interface WbsTreeData {
  projectTitle: string;
  tasks: WbsTask[];
}

function normalizeDigits(str: string): string {
  if (!str) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let res = str;
  farsiDigits.forEach((d, i) => {
    res = res.replaceAll(d, String(i));
  });
  return res;
}

// ---------- ساخت درخت از کدهای WBS واقعی با بازیابی خودکار والدهای مفقود ----------
interface WBSNode {
  code: string;
  name: string;
  children: WBSNode[];
  isSynthetic?: boolean;
}

function buildTree(tasks: WbsTask[]): WBSNode[] {
  if (!tasks || tasks.length === 0) return [];

  const nodeMap = new Map<string, WBSNode>();

  // ۱. ثبت تسک‌های واقعی در مپ
  for (const t of tasks) {
    const code = (t.wbs_code || "").trim();
    if (!code) continue;
    const normCode = normalizeDigits(code);
    nodeMap.set(normCode, {
      code,
      name: (t.name || "").trim(),
      children: [],
      isSynthetic: false,
    });
  }

  // ۲. استخراج والد منطقی بر اساس الگوهای متداول
  const getParentCode = (code: string, task?: WbsTask): string | null => {
    const norm = normalizeDigits(code);

    // حالت دات‌دار: 1.1.1.a -> 1.1.1 -> 1.1 -> 1
    if (norm.includes(".")) {
      const parts = norm.split(".");
      if (parts.length > 1) {
        return parts.slice(0, -1).join(".");
      }
      return null;
    }

    // حالت کدهای خط تیره‌دار ورودی مثل P1-WP-1
    if (norm.toUpperCase().includes("-WP-")) {
      const parts = norm.split("-");
      return parts[0]; // e.g. P1
    }

    // حالت خط تیره عددی
    if (norm.includes("-")) {
      const parts = norm.split("-");
      if (parts.length > 1) {
        return parts.slice(0, -1).join("-");
      }
    }

    // اگر تسک در یک فاز مشخص قرار دارد
    if (task?.phase) {
      const normPhase = normalizeDigits(task.phase);
      const match = normPhase.match(/\d+/);
      if (match) {
        const phaseNum = match[0];
        if (norm !== phaseNum) return phaseNum;
      }
    }

    return null;
  };

  // ایجاد والدهای میانی مفقود به صورت سلسله‌مراتبی
  for (const t of tasks) {
    let curCode = normalizeDigits((t.wbs_code || "").trim());
    let parentCode = getParentCode(curCode, t);

    while (parentCode) {
      if (!nodeMap.has(parentCode)) {
        let parentName = `فاز ${parentCode}`;
        if (t.phase && (parentCode.length === 1 || parentCode.startsWith("P"))) {
          parentName = t.phase;
        } else if (t.deliverables && parentCode.split(".").length === 2) {
          parentName = t.deliverables.slice(0, 35);
        } else {
          parentName = `بسته کاری ${parentCode}`;
        }

        nodeMap.set(parentCode, {
          code: parentCode,
          name: parentName,
          children: [],
          isSynthetic: true,
        });
      }

      curCode = parentCode;
      parentCode = getParentCode(curCode);
    }
  }

  // ۳. پیوند فرزندان به والدین
  const roots: WBSNode[] = [];
  const registeredAsChild = new Set<string>();

  for (const [normCode, node] of nodeMap.entries()) {
    const parentCode = getParentCode(normCode);
    if (parentCode && nodeMap.has(parentCode) && parentCode !== normCode) {
      const parentNode = nodeMap.get(parentCode)!;
      if (!parentNode.children.some((c) => normalizeDigits(c.code) === normCode)) {
        parentNode.children.push(node);
        registeredAsChild.add(normCode);
      }
    }
  }

  for (const [normCode, node] of nodeMap.entries()) {
    if (!registeredAsChild.has(normCode)) {
      roots.push(node);
    }
  }

  // مرتب‌سازی هوشمند عددی و طبیعی
  const cmp = (a: string, b: string) => {
    const na = normalizeDigits(a).split(/[.\-]/).map((x) => (isNaN(Number(x)) ? x : Number(x)));
    const nb = normalizeDigits(b).split(/[.\-]/).map((x) => (isNaN(Number(x)) ? x : Number(x)));
    for (let i = 0; i < Math.max(na.length, nb.length); i++) {
      const va = na[i];
      const vb = nb[i];
      if (va === undefined) return -1;
      if (vb === undefined) return 1;
      if (typeof va === "number" && typeof vb === "number") {
        if (va !== vb) return va - vb;
      } else {
        const diff = String(va).localeCompare(String(vb));
        if (diff !== 0) return diff;
      }
    }
    return 0;
  };

  const sortNode = (n: WBSNode) => {
    n.children.sort((x, y) => cmp(x.code, y.code));
    n.children.forEach(sortNode);
  };

  roots.sort((x, y) => cmp(x.code, y.code));
  roots.forEach(sortNode);

  return roots;
}

// ---------- رنگ‌ها: گرادیان سبز پویا بر اساس حداکثر عمق ----------
const HUE = 152;
const SATURATION = 42;
const MIN_LIGHTNESS = 20;
const MAX_LIGHTNESS = 88;
const ROOT_COLOR = "#0f2419";

function depthOf(code: string): number {
  const parts = normalizeDigits(code).split(/[.\-]/).filter(Boolean);
  return parts.length > 0 ? parts.length : 1;
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
        {toPersianDigits(node.code)}
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
