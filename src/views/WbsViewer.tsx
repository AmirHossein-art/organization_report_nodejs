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
  ChevronLeft,
  Search,
  GitBranch,
  Table,
  Brain,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import WbsTreePane from "./WbsTree";
import { CustomSelect } from "../components";
import { toPersianDigits, normalizeDigits } from "../dateUtils";
import { Project, CompositeKpi, ProjectMemory } from "../types";

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

// ---------- ساختار گره‌های سلسله‌مراتبی درخت WBS ----------
interface WbsTreeNode {
  task: WbsTask;
  code: string;
  depth: number;
  isSynthetic?: boolean;
  children: WbsTreeNode[];
}

function buildWbsTreeNodes(tasks: WbsTask[]): WbsTreeNode[] {
  const map = new Map<string, WbsTreeNode>();

  for (const t of tasks) {
    const code = (t.wbs_code || "").trim();
    const norm = normalizeDigits(code);
    map.set(norm, {
      task: t,
      code,
      depth: 1,
      children: [],
    });
  }

  const getParentNorm = (norm: string): string | null => {
    if (norm.includes(".")) {
      const parts = norm.split(".");
      if (parts.length > 1) return parts.slice(0, -1).join(".");
      return null;
    }
    if (norm.toUpperCase().includes("-WP-")) {
      return norm.split("-")[0];
    }
    if (norm.includes("-")) {
      const parts = norm.split("-");
      if (parts.length > 1) return parts.slice(0, -1).join("-");
    }
    return null;
  };

  // ایجاد خودکار والدهای مفقود در صورت عدم وجود
  for (const t of tasks) {
    let cur = normalizeDigits((t.wbs_code || "").trim());
    let parent = getParentNorm(cur);
    while (parent) {
      if (!map.has(parent)) {
        let name = `فاز ${parent}`;
        if (t.phase && (parent.length === 1 || parent.startsWith("P"))) {
          name = t.phase;
        } else if (t.deliverables && parent.split(".").length === 2) {
          name = t.deliverables.slice(0, 40);
        } else {
          name = `بسته کاری ${parent}`;
        }
        map.set(parent, {
          task: {
            wbs_code: parent,
            level: String(parent.split(".").length),
            name,
            deliverables: "",
            owner: "",
            start_date: "",
            duration: "",
            prerequisite: "",
            note: "گره سرفصل ساختاری",
            phase: t.phase,
          },
          code: parent,
          depth: parent.split(".").length,
          isSynthetic: true,
          children: [],
        });
      }
      cur = parent;
      parent = getParentNorm(cur);
    }
  }

  const roots: WbsTreeNode[] = [];
  const isChild = new Set<string>();

  for (const [norm, node] of map.entries()) {
    const pNorm = getParentNorm(norm);
    if (pNorm && map.has(pNorm) && pNorm !== norm) {
      map.get(pNorm)!.children.push(node);
      isChild.add(norm);
    }
  }

  for (const [norm, node] of map.entries()) {
    if (!isChild.has(norm)) {
      roots.push(node);
    }
  }

  // مرتب‌سازی عددی
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

  const sortAndDepth = (n: WbsTreeNode, d: number) => {
    n.depth = d;
    n.children.sort((x, y) => cmp(x.code, y.code));
    n.children.forEach((c) => sortAndDepth(c, d + 1));
  };

  roots.sort((x, y) => cmp(x.code, y.code));
  roots.forEach((r) => sortAndDepth(r, 1));

  return roots;
}

function flattenVisibleTreeRows(
  roots: WbsTreeNode[],
  expandedMap: Record<string, boolean>,
  searchQuery: string = "",
  levelFilter: "all" | "phases" | "workpackages" = "all"
): Array<{ node: WbsTreeNode; depth: number; hasChildren: boolean }> {
  const result: Array<{ node: WbsTreeNode; depth: number; hasChildren: boolean }> = [];
  const q = searchQuery.trim().toLowerCase();

  const isMatch = (n: WbsTreeNode): boolean => {
    if (!q) return true;
    const norm = normalizeDigits(n.code).toLowerCase();
    const nameMatch = n.task.name.toLowerCase().includes(q);
    const codeMatch = n.code.toLowerCase().includes(q) || norm.includes(q);
    const delivMatch = n.task.deliverables?.toLowerCase().includes(q);
    const ownerMatch = n.task.owner?.toLowerCase().includes(q);
    const kpiMatch = n.task.kpi?.toLowerCase().includes(q);
    return Boolean(nameMatch || codeMatch || delivMatch || ownerMatch || kpiMatch);
  };

  const anyDescendantMatch = (n: WbsTreeNode): boolean => {
    if (isMatch(n)) return true;
    return n.children.some(anyDescendantMatch);
  };

  const traverse = (node: WbsTreeNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isLevel1 = node.depth === 1;

    if (levelFilter === "phases" && !isLevel1) return;
    if (levelFilter === "workpackages" && isLevel1) {
      node.children.forEach((c) => traverse(c, depth + 1));
      return;
    }

    if (q && !anyDescendantMatch(node)) return;

    result.push({ node, depth, hasChildren });

    const shouldExpand = q ? true : Boolean(expandedMap[node.code]);
    if (hasChildren && shouldExpand) {
      node.children.forEach((c) => traverse(c, depth + 1));
    }
  };

  roots.forEach((r) => traverse(r, 1));
  return result;
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

  // وضعیت‌های فیلتر و جستجو در جدول سلسله‌مراتبی فعالیت‌های WBS
  const [taskSearch, setTaskSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<"all" | "phases" | "workpackages">("all");
  const closeAll = () => {};

  // فوکوس روی کد خاص هنگام هدایت از درخت
  const [focusCode, setFocusCode] = useState<string | null>(null);

  // شاخص‌های ترکیبی تخصیص‌یافته به این پروژه
  const [projectCompositeKpis, setProjectCompositeKpis] = useState<CompositeKpi[]>([]);

  // داده‌های گراف شبکه WBS شامل پیوندهای مصوب KPI و اقدامات فعال
  const [wbsGraphNodes, setWbsGraphNodes] = useState<any[]>([]);

  // حافظه زنده و تکاملی هوش مصنوعی از این پروژه (Project Memory Dossier)
  const [projectMemory, setProjectMemory] = useState<ProjectMemory | null>(null);
  const [evolvingMemory, setEvolvingMemory] = useState(false);

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
      setProjectCompositeKpis([]);
      return;
    }
    setLoading(true);
    closeAll();

    // واکشی شاخص‌های ترکیبی تخصیص‌یافته به این پروژه
    fetch(`/api/projects/${projectId}/composite-kpis`)
      .then((r) => (r.ok ? r.json() : []))
      .then((cks) => setProjectCompositeKpis(Array.isArray(cks) ? cks : []))
      .catch(() => setProjectCompositeKpis([]));

    // واکشی گره‌های گراف WBS و پیوندهای KPI و اقدامات فعال
    fetch(`/api/projects/${projectId}/wbs-nodes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((gnodes) => setWbsGraphNodes(Array.isArray(gnodes) ? gnodes : []))
      .catch(() => setWbsGraphNodes([]));

    // واکشی حافظه تکاملی هوش مصنوعی از پروژه
    fetch(`/api/projects/${projectId}/memory`)
      .then((r) => (r.ok ? r.json() : null))
      .then((mem) => setProjectMemory(mem?.version > 0 ? mem : null))
      .catch(() => setProjectMemory(null));

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

  // همگام‌سازی و تکامل دستی حافظه تکاملی پروژه توسط مدیر
  const handleEvolveMemory = async () => {
    if (!selectedProjectId) return;
    setEvolvingMemory(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/memory/evolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.memory) {
          setProjectMemory(json.memory);
          setFeedback({ type: "success", text: "شناخت و حافظه تکاملی پروژه با موفقیت توسط هوش مصنوعی به‌روزرسانی شد." });
        }
      } else {
        const err = await res.json().catch(() => null);
        setFeedback({ type: "error", text: err?.error || "خطا در به‌روزرسانی حافظه تکاملی پروژه." });
      }
    } catch {
      setFeedback({ type: "error", text: "ارتباط با سرور جهت تکامل حافظه برقرار نشد." });
    } finally {
      setEvolvingMemory(false);
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

  // ساخت درخت سلسله‌مراتبی فعالیت‌ها برای جدول WBS
  const wbsTreeNodes = useMemo(() => {
    if (!data?.tasks) return [];
    return buildWbsTreeNodes(data.tasks);
  }, [data?.tasks]);

  // نگاشت دسترسی سریع به اطلاعات گره‌های گراف (شامل شاخص‌ها و اقدامات فعال) بر اساس کد
  const wbsGraphByCode = useMemo(() => {
    const map = new Map<string, any>();
    for (const n of wbsGraphNodes) {
      if (n.code) {
        map.set(n.code.trim(), n);
        map.set(normalizeDigits(n.code.trim()), n);
      }
    }
    return map;
  }, [wbsGraphNodes]);

  // وضعیت باز/بسته بودن سطوح مختلف در جدول
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<Record<string, boolean>>({});

  // هنگام بارگذاری پروژه، گره‌های سطوح ۱ و ۲ پیش‌فرض باز باشند
  useEffect(() => {
    if (wbsTreeNodes.length > 0) {
      const initMap: Record<string, boolean> = {};
      const walk = (nodes: WbsTreeNode[]) => {
        for (const n of nodes) {
          if (n.depth <= 2 && n.children.length > 0) {
            initMap[n.code] = true;
          }
          walk(n.children);
        }
      };
      walk(wbsTreeNodes);
      setExpandedTreeNodes(initMap);
    }
  }, [wbsTreeNodes]);

  const toggleTreeNode = (code: string) => {
    setExpandedTreeNodes((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const expandAllLevels = () => {
    const allMap: Record<string, boolean> = {};
    const walk = (nodes: WbsTreeNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) allMap[n.code] = true;
        walk(n.children);
      }
    };
    walk(wbsTreeNodes);
    setExpandedTreeNodes(allMap);
  };

  const collapseToPhases = () => {
    setExpandedTreeNodes({});
  };

  const expandParentsOf = (targetCode: string) => {
    const clean = normalizeDigits(targetCode);
    const parts = clean.split(".");
    setExpandedTreeNodes((prev) => {
      const nextMap = { ...prev };
      let prefix = "";
      for (let i = 0; i < parts.length - 1; i++) {
        prefix = prefix ? `${prefix}.${parts[i]}` : parts[i];
        nextMap[prefix] = true;
      }
      return nextMap;
    });
  };

  // ردیف‌های سلسله‌مراتبی فلت‌شده برای رندر در جدول
  const flattenedTreeRows = useMemo(() => {
    return flattenVisibleTreeRows(wbsTreeNodes, expandedTreeNodes, taskSearch, levelFilter);
  }, [wbsTreeNodes, expandedTreeNodes, taskSearch, levelFilter]);

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
                  download={data.file_name || undefined}
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
                <Table className="w-3.5 h-3.5 text-emerald-600" />
                <span>جدول فعالیت‌ها (WBS)</span>
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
                      {data.projectInfo.filter((row) => !row.key.includes("مرجع") && !row.key.includes("منبع")).map((row, i) => {
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

                {/* شاخص‌های ترکیبی تخصیص‌یافته به پروژه */}
                {projectCompositeKpis.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-700" />
                      <span>شاخص‌های ترکیبی تخصیص‌یافته به این پروژه ({toPersianDigits(projectCompositeKpis.length)})</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {projectCompositeKpis.map((ck) => (
                        <div
                          key={ck.id}
                          className="rounded-xl border border-indigo-100 p-4 bg-indigo-50/30 hover:border-indigo-300 transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-xs">{ck.name}</span>
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200 font-mono">
                              {ck.formula ? `فرمول: ${ck.formula}` : `ترکیبی (${ck.operator})`}
                            </span>
                          </div>
                          {ck.description && (
                            <p className="text-xs text-slate-600 leading-relaxed font-normal">{ck.description}</p>
                          )}
                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-indigo-100/60">
                            <span>واحد: <strong className="text-slate-800">{ck.unit}</strong></span>
                            {ck.latest_value !== null && ck.latest_value !== undefined ? (
                              <span className="font-bold text-emerald-800">
                                آخرین عملکرد: {toPersianDigits(ck.latest_value)} {ck.unit}
                              </span>
                            ) : (
                              <span className="text-slate-400">در انتظار محاسبه</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ۴. شناخت و حافظه تکاملی هوش مصنوعی از پروژه (Living AI Dossier) */}
                <div className="bg-white rounded-2xl border border-emerald-100/90 shadow-sm p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-100/60 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200 shrink-0">
                        <Brain className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-850 text-sm">
                            شناخت و حافظه تکاملی هوش مصنوعی از این پروژه
                          </h3>
                          {projectMemory && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                              نسخه {toPersianDigits(projectMemory.version)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">تحلیل انباشته از ذات پروژه، موانع مزمن، الگوی تعهدات و درس‌آموخته‌ها</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleEvolveMemory}
                      disabled={evolvingMemory}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${evolvingMemory ? "animate-spin" : "text-amber-500"}`} />
                      <span>{evolvingMemory ? "در حال همگام‌سازی..." : "همگام‌سازی و تکامل حافظه"}</span>
                    </button>
                  </div>

                  {projectMemory ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                      {/* ۱. ذات و بافتار هویتی */}
                      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-4 h-4 text-emerald-700" />
                          <span>شناخت ماهیت و بافتار پروژه (DNA):</span>
                        </span>
                        <p className="text-slate-600 leading-relaxed font-normal">
                          {projectMemory.dna_summary}
                        </p>
                      </div>

                      {/* ۲. الگوی تعهدپذیری */}
                      <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-blue-700" />
                          <span>الگوی وفای به عهد و سابقه ددلاین‌ها:</span>
                        </span>
                        <p className="text-slate-600 leading-relaxed font-normal">
                          {projectMemory.reliability_notes || "داده‌های کافی جهت ارزیابی آماری ثبت نشده است."}
                        </p>
                      </div>

                      {/* ۳. موانع و گره‌های مزمن */}
                      <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200/70 space-y-2">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span>موانع و گلوگاه‌های مزمن تکرارشونده:</span>
                        </span>
                        {projectMemory.chronic_bottlenecks ? (
                          <div className="space-y-1 text-slate-700 pr-1">
                            {projectMemory.chronic_bottlenecks.split("\n").map((b, idx) => (
                              <p key={idx} className="leading-relaxed">{b}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic font-normal">مانع یا تاخیر حاد تکرارشونده‌ای گزارش نشده است.</p>
                        )}
                      </div>

                      {/* ۴. درس‌آموخته‌ها */}
                      <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-200/70 space-y-2">
                        <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          <span>درس‌آموخته‌ها و تجارب راهبردی انباشته:</span>
                        </span>
                        {projectMemory.lessons_learned ? (
                          <div className="space-y-1 text-slate-700 pr-1">
                            {projectMemory.lessons_learned.split("\n").map((l, idx) => (
                              <p key={idx} className="leading-relaxed">{l}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-slate-400 italic font-normal">با ثبت و ممیزی گزارش‌های دوره‌ای، تجارب جدید انباشته خواهند شد.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-2 text-slate-400">
                      <Brain className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="text-xs">هنوز پرونده حافظه تکاملی برای این پروژه شکل نگرفته است.</p>
                      <p className="text-[11px] text-slate-400">با اولین ممیزی گزارش یا کلیک روی دکمه «همگام‌سازی و تکامل حافظه»، شناخت اولیه هوش مصنوعی ایجاد خواهد شد.</p>
                    </div>
                  )}
                </div>
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
                    {/* نوار ابزار جستجو و کنترل سطوح جدول WBS */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* ورودی جستجوی متنی در تمام ستون‌های جدول */}
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

                      {/* دکمه‌های کنترل آکاردئونی باز/بستن سطوح و فیلترها */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={expandAllLevels}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                            title="باز کردن تمام شاخه‌ها و زیرمجموعه‌ها"
                          >
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-700" />
                            <span>بازکردن همه سطوح</span>
                          </button>
                          <button
                            type="button"
                            onClick={collapseToPhases}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                            title="بستن تمام زیرمجموعه‌ها و نمایش فقط فازها"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
                            <span>بستن زیرمجموعه‌ها</span>
                          </button>
                        </div>

                        {phaseCount > 0 && (
                          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
                            <button
                              type="button"
                              onClick={() => setLevelFilter("all")}
                              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                levelFilter === "all" ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              همه
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
                              بسته‌ها ({toPersianDigits(wpCount)})
                            </button>
                          </div>
                        )}

                        <span className="text-[11px] font-semibold text-slate-400 hidden lg:inline">
                          {toPersianDigits(flattenedTreeRows.length)} ردیف نمایش‌داده‌شده
                        </span>
                      </div>
                    </div>

                    {/* جدول سلسله‌مراتبی فعالیت‌های ساختار شکست کار (WBS Tree-Table) */}
                    {flattenedTreeRows.length === 0 ? (
                      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-400">
                        موردی منطبق با فیلتر یا جستجوی شما یافت نشد.
                      </div>
                    ) : (
                      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto min-w-full max-h-[75vh]">
                          <table className="w-full text-right text-xs border-collapse">
                            <thead className="bg-slate-100/95 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 shadow-2xs select-none">
                              <tr>
                                <th className="py-3 px-2 w-28 text-center shrink-0 border-l border-slate-200/80">کد WBS</th>
                                <th className="py-3 px-4 min-w-[280px] shrink-0 border-l border-slate-200/80">عنوان فعالیت / بسته کاری</th>
                                <th className="py-3 px-2 w-24 text-center shrink-0 border-l border-slate-200/80">سطح</th>
                                <th className="py-3 px-3 min-w-[240px] shrink-0 border-l border-slate-200/80">قلم تحویل‌دادنی / خروجی</th>
                                <th className="py-3 px-3 min-w-[130px] shrink-0 border-l border-slate-200/80">مسئول</th>
                                <th className="py-3 px-2 w-24 text-center shrink-0 border-l border-slate-200/80">مدت زمان</th>
                                <th className="py-3 px-2 w-24 text-center shrink-0 border-l border-slate-200/80">تاریخ شروع</th>
                                <th className="py-3 px-3 min-w-[160px] shrink-0 border-l border-slate-200/80">شاخص (KPI)</th>
                                <th className="py-3 px-2 w-20 text-center shrink-0 border-l border-slate-200/80">پیش‌نیاز</th>
                                <th className="py-3 px-3 min-w-[150px] shrink-0">ملاحظات / توضیحات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {flattenedTreeRows.map(({ node, depth, hasChildren }, i) => (
                                <WbsTreeTableRow
                                  key={`${node.code}-${i}`}
                                  node={node}
                                  depth={depth}
                                  hasChildren={hasChildren}
                                  isExpanded={Boolean(expandedTreeNodes[node.code])}
                                  onToggle={() => toggleTreeNode(node.code)}
                                  highlighted={focusCode === node.code}
                                  graphNode={wbsGraphByCode.get(node.code.trim()) || wbsGraphByCode.get(normalizeDigits(node.code.trim()))}
                                />
                              ))}
                            </tbody>
                          </table>
                        </div>
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
                      expandParentsOf(code);
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
// کامپوننت ردیف جدول سلسله‌مراتبی فعالیت‌های WBS (Tree-Table Row)
// ============================================================
function WbsTreeTableRow({
  node,
  depth,
  hasChildren,
  isExpanded,
  onToggle,
  highlighted,
  graphNode,
}: {
  node: WbsTreeNode;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  highlighted?: boolean;
  graphNode?: any;
}) {
  const code = (node.code || "").trim();
  const isPhase = depth === 1 || (node.task.phase && node.task.name.includes("فاز"));
  const t = node.task;

  return (
    <tr
      data-code={code}
      className={`transition-colors text-right select-text ${
        highlighted
          ? "bg-amber-50 ring-2 ring-amber-400 font-bold"
          : isPhase
          ? "bg-emerald-50/50 hover:bg-emerald-50/80 font-bold border-r-4 border-r-emerald-600"
          : depth === 2
          ? "bg-white hover:bg-slate-50/80 font-semibold border-r-2 border-r-emerald-300"
          : "bg-white hover:bg-slate-50/60 font-normal"
      }`}
    >
      {/* ۱. کد WBS */}
      <td className="py-3 px-2 text-center border-l border-slate-100 font-mono shrink-0">
        <span
          className={`inline-block px-2.5 py-0.5 rounded-lg text-xs font-black tracking-wider shadow-2xs ${
            isPhase
              ? "bg-emerald-800 text-white"
              : depth === 2
              ? "bg-slate-800 text-white"
              : "bg-slate-700 text-slate-100"
          }`}
        >
          {toPersianDigits(code)}
        </span>
      </td>

      {/* ۲. عنوان فعالیت / بسته کاری با تورفتگی و آکاردئون باز/بستن */}
      <td
        className="py-3 px-3 border-l border-slate-100 min-w-[260px]"
        style={{ paddingRight: `${Math.max(12, (depth - 1) * 22 + 12)}px` }}
      >
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {hasChildren ? (
            <button
              type="button"
              onClick={onToggle}
              className="w-5 h-5 rounded-md bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
              title={isExpanded ? "بستن زیرمجموعه‌ها" : "باز کردن زیرمجموعه‌ها"}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
              />
            </button>
          ) : (
            <span className="w-5 shrink-0 flex items-center justify-center text-slate-300">•</span>
          )}

          {isPhase ? (
            <Layers className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : hasChildren ? (
            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}

          <span
            className={`${
              isPhase
                ? "text-slate-900 text-sm font-extrabold"
                : depth === 2
                ? "text-slate-900 text-xs font-bold"
                : "text-slate-800 text-xs font-medium"
            }`}
          >
            {t.name}
          </span>

          {hasChildren && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium shrink-0">
              {toPersianDigits(node.children.length)} زیرمجموعه
            </span>
          )}

          {graphNode?.active_actions && graphNode.active_actions.length > 0 && (
            <span
              className="inline-flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs cursor-help mr-auto"
              title={graphNode.active_actions.map((a: any) => `• ${a.action_text} (موعد: ${toPersianDigits(a.target_date || "نامشخص")}${a.user_name ? ` - مسئول: ${a.user_name}` : ""})`).join("\n")}
            >
              <Clock className="w-2.5 h-2.5 text-amber-600" />
              <span>{toPersianDigits(graphNode.active_actions.length)} اقدام فعال</span>
            </span>
          )}
        </div>
      </td>

      {/* ۳. سطح */}
      <td className="py-3 px-2 text-center border-l border-slate-100 shrink-0">
        <span
          className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
            isPhase
              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
              : depth === 2
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          سطح {toPersianDigits(t.level || depth)}
        </span>
      </td>

      {/* ۴. قلم تحویل‌دادنی / خروجی */}
      <td className="py-3 px-3 border-l border-slate-100 min-w-[220px]">
        {t.deliverables && t.deliverables !== "-" && t.deliverables !== "---" ? (
          <div className="flex items-start gap-1.5 bg-emerald-50/70 border border-emerald-100 text-emerald-950 p-1.5 rounded-lg text-[11px] leading-relaxed">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span className="line-clamp-2" title={t.deliverables}>
              {toPersianDigits(t.deliverables)}
            </span>
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* ۵. مسئول */}
      <td className="py-3 px-3 border-l border-slate-100 text-slate-700 font-semibold min-w-[120px]">
        {t.owner && t.owner !== "-" && t.owner !== "---" ? (
          <div className="flex items-center gap-1">
            <User className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate" title={t.owner}>
              {t.owner}
            </span>
          </div>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* ۶. مدت زمان */}
      <td className="py-3 px-2 text-center border-l border-slate-100 font-semibold text-slate-700 shrink-0">
        {t.duration && t.duration !== "-" && t.duration !== "---" ? (
          <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/80 inline-flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{toPersianDigits(t.duration)}</span>
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* ۷. تاریخ شروع */}
      <td className="py-3 px-2 text-center border-l border-slate-100 font-mono text-[11px] text-slate-600 shrink-0">
        {t.start_date && t.start_date !== "-" ? toPersianDigits(t.start_date) : <span className="text-slate-300">—</span>}
      </td>

      {/* ۸. شاخص (KPI) */}
      <td className="py-3 px-3 border-l border-slate-100 min-w-[150px]">
        <div className="space-y-1">
          {graphNode?.linked_kpis && graphNode.linked_kpis.length > 0 && (
            <div className="flex flex-col gap-1">
              {graphNode.linked_kpis.map((kpi: any) => (
                <div key={kpi.id} className="flex items-center gap-1 text-emerald-950 bg-emerald-100/90 px-1.5 py-0.5 rounded-md border border-emerald-300 text-[10px] font-bold shadow-2xs">
                  <Target className="w-3 h-3 text-emerald-700 shrink-0" />
                  <span className="truncate" title={`شاخص عملکردی متصل: ${kpi.name} (${kpi.unit || ""})`}>
                    {kpi.name}
                  </span>
                </div>
              ))}
            </div>
          )}
          {t.kpi && t.kpi !== "-" && t.kpi !== "---" && (
            <div className="flex items-center gap-1 text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 text-[10px] font-medium">
              <span className="text-[9px] text-slate-400 font-bold shrink-0">اکسل:</span>
              <span className="truncate" title={t.kpi}>
                {t.kpi}
              </span>
            </div>
          )}
          {(!graphNode?.linked_kpis || graphNode.linked_kpis.length === 0) && (!t.kpi || t.kpi === "-" || t.kpi === "---") && (
            <span className="text-slate-300">—</span>
          )}
        </div>
      </td>

      {/* ۹. پیش‌نیازها */}
      <td className="py-3 px-2 text-center border-l border-slate-100 text-[11px] text-slate-600 font-mono shrink-0">
        {t.prerequisite && t.prerequisite !== "-" && t.prerequisite !== "---" ? (
          <span className="inline-flex items-center gap-1">
            <GitBranch className="w-3 h-3 text-slate-400 shrink-0" />
            <span>{toPersianDigits(t.prerequisite)}</span>
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>

      {/* ۱۰. ملاحظات / توضیحات */}
      <td className="py-3 px-3 text-slate-500 text-[11px] min-w-[140px]">
        {t.note && t.note !== "-" && t.note !== "---" ? (
          <span className="line-clamp-2" title={t.note}>
            {toPersianDigits(t.note)}
          </span>
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}
