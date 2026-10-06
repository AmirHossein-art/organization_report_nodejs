import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  X,
  TrendingUp,
  Edit2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FolderGit2,
  Check,
  Calculator,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  CompositeKpi,
  CompositeOperator,
  CompositeKpiValueDetail,
} from "../types";
import { toPersianDigits } from "../dateUtils";
import { CustomSelect } from "../components";

interface BaseKpiItem {
  id: number;
  name: string;
  unit: string;
  input_type: string;
  baseline_value: number | null;
  target_value: number | null;
  target_direction: string;
  project_id: number;
  project_title: string;
  deputy_title: string;
  user_full_name?: string;
}

interface DeputyTreeItem {
  id: string;
  userId: number;
  title: string;
  userName: string;
  projects: Array<{
    id: number;
    title: string;
    code: string;
    kpis: BaseKpiItem[];
  }>;
  totalKpisCount: number;
}

const OPERATOR_CONFIG: Record<
  CompositeOperator,
  {
    label: string;
    symbol: string;
    desc: string;
    formulaSample: string;
    badgeClass: string;
  }
> = {
  sum: {
    label: "جمع مقادیر",
    symbol: "+",
    desc: "مجموع مقادیر تمامی شاخص‌های انتخاب‌شده",
    formulaSample: "A + B + ...",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  average: {
    label: "میانگین حسابی",
    symbol: "Avg",
    desc: "معدل و میانگین مقادیر شاخص‌های انتخاب‌شده",
    formulaSample: "(A + B + ...) / N",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  difference: {
    label: "تفریق مقادیر",
    symbol: "−",
    desc: "شاخص اول منهای مجموع سایر شاخص‌های بعدی",
    formulaSample: "A − B − C",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  multiply: {
    label: "ضرب مقادیر",
    symbol: "×",
    desc: "حاصل‌ضرب مقادیر تمامی شاخص‌ها در یکدیگر",
    formulaSample: "A × B × ...",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
  ratio_percentage: {
    label: "نسبت درصدی",
    symbol: "%",
    desc: "نسبت شاخص اول به شاخص دوم ضربدر ۱۰۰",
    formulaSample: "(A / B) × 100",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
};

export default function CompositeKpiManagement() {
  const [deputies, setDeputies] = useState<DeputyTreeItem[]>([]);
  const [allKpis, setAllKpis] = useState<BaseKpiItem[]>([]);
  const [compositeKpis, setCompositeKpis] = useState<CompositeKpi[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // پیام‌ها
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // پنجره‌های فعال معاونت‌ها
  const [openDeputyIds, setOpenDeputyIds] = useState<Set<string>>(new Set());

  // جستجوی سراسری شاخص‌های پایه
  const [globalSearch, setGlobalSearch] = useState<string>("");
  const [showSearchResults, setShowSearchResults] = useState<boolean>(false);

  // جستجوی لیست شاخص‌های ترکیبی
  const [directorySearch, setDirectorySearch] = useState<string>("");

  // استیت فرمول‌ساز مرکزی (Builder)
  const [selectedKpis, setSelectedKpis] = useState<BaseKpiItem[]>([]);
  const [operator, setOperator] = useState<CompositeOperator>("sum");
  const [name, setName] = useState<string>("");
  const [unit, setUnit] = useState<string>("درصد");
  const [targetValue, setTargetValue] = useState<string>("");
  const [targetDirection, setTargetDirection] = useState<"minimum" | "maximum">("minimum");
  const [description, setDescription] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // مودال تحلیل روند و تاریخچه شاخص ترکیبی
  const [trendModalOpen, setTrendModalOpen] = useState<boolean>(false);
  const [selectedCompositeForTrend, setSelectedCompositeForTrend] = useState<CompositeKpi | null>(null);
  const [trendDetail, setTrendDetail] = useState<any | null>(null);
  const [trendLoading, setTrendLoading] = useState<boolean>(false);
  const [expandedPeriodRowId, setExpandedPeriodRowId] = useState<number | null>(null);

  // مودال ویرایش شاخص ترکیبی
  const [editingComposite, setEditingComposite] = useState<CompositeKpi | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editUnit, setEditUnit] = useState<string>("درصد");
  const [editTargetValue, setEditTargetValue] = useState<string>("");
  const [editTargetDirection, setEditTargetDirection] = useState<"minimum" | "maximum">("minimum");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editOperator, setEditOperator] = useState<CompositeOperator>("sum");
  const [editItems, setEditItems] = useState<BaseKpiItem[]>([]);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editCandidateKpiId, setEditCandidateKpiId] = useState<number>(0);

  const flashSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4500);
  };

  const flashError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 5500);
  };

  // دریافت درخت معاونت‌ها و شاخص‌ها
  const fetchTree = async () => {
    try {
      const res = await fetch("/api/composite-kpis/deputies-tree");
      if (res.ok) {
        const data = await res.json();
        setDeputies(data.deputies || []);
        setAllKpis(data.allKpis || []);
        // پیش‌فرض: باز کردن ۲ معاونت اول
        if (data.deputies && data.deputies.length > 0) {
          setOpenDeputyIds((prev) => {
            if (prev.size > 0) return prev;
            const initialSet = new Set<string>();
            data.deputies.slice(0, 2).forEach((d: DeputyTreeItem) => initialSet.add(d.id));
            return initialSet;
          });
        }
      }
    } catch (err) {
      console.error("Error fetching deputies tree:", err);
    }
  };

  // دریافت شاخص‌های ترکیبی تعریف‌شده
  const fetchCompositeKpis = async () => {
    try {
      const res = await fetch("/api/composite-kpis");
      if (res.ok) {
        const data = await res.json();
        setCompositeKpis(data);
      }
    } catch (err) {
      console.error("Error fetching composite KPIs:", err);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchTree(), fetchCompositeKpis()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTree(), fetchCompositeKpis()]);
    setRefreshing(false);
    flashSuccess("اطلاعات شاخص‌ها با موفقیت به‌روزرسانی شد.");
  };

  // نتایج جستجوی سراسری شاخص‌های پایه
  const searchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    return allKpis.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.project_title.toLowerCase().includes(q) ||
        k.deputy_title.toLowerCase().includes(q)
    );
  }, [allKpis, globalSearch]);

  // فیلتر لیست شاخص‌های ترکیبی تعریف‌شده
  const filteredCompositeKpis = useMemo(() => {
    const q = directorySearch.trim().toLowerCase();
    if (!q) return compositeKpis;
    return compositeKpis.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        c.items.some(
          (it) =>
            it.projectKpi?.name.toLowerCase().includes(q) ||
            it.projectKpi?.project?.title.toLowerCase().includes(q)
        )
    );
  }, [compositeKpis, directorySearch]);

  // بستن یا باز کردن پنجره معاونت
  const toggleDeputyWindow = (deputyId: string) => {
    setOpenDeputyIds((prev) => {
      const next = new Set(prev);
      if (next.has(deputyId)) {
        next.delete(deputyId);
      } else {
        next.add(deputyId);
      }
      return next;
    });
  };

  const handleOpenAllDeputies = () => {
    const allIds = new Set<string>();
    deputies.forEach((d) => allIds.add(d.id));
    setOpenDeputyIds(allIds);
  };

  const handleCloseAllDeputies = () => {
    setOpenDeputyIds(new Set());
  };

  // افزودن شاخص به میزکار مرکزی
  const addKpiToFormula = (kpi: BaseKpiItem) => {
    setSelectedKpis((prev) => {
      // بررسی عدم اضافه کردن تکراری پشت سر هم
      return [...prev, kpi];
    });
  };

  // حذف شاخص از فرمول
  const removeKpiFromFormula = (index: number) => {
    setSelectedKpis((prev) => prev.filter((_, idx) => idx !== index));
  };

  // جابجایی ترتیب شاخص در فرمول
  const moveKpiOrder = (index: number, direction: "up" | "down") => {
    setSelectedKpis((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  // هندل کردن Drag and Drop
  const handleDragStart = (e: React.DragEvent, kpi: BaseKpiItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify(kpi));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (dataStr) {
        const kpi = JSON.parse(dataStr) as BaseKpiItem;
        if (kpi && kpi.id) {
          addKpiToFormula(kpi);
        }
      }
    } catch (err) {
      console.error("Error parsing dropped KPI:", err);
    }
  };

  // پیش‌نمایش فرمول به فارسی
  const formulaPreviewText = useMemo(() => {
    if (selectedKpis.length === 0) return "هنوز شاخصی انتخاب نشده است.";
    const names = selectedKpis.map((k) => `«${k.name}»`);
    if (operator === "sum") {
      return names.join(" + ");
    }
    if (operator === "average") {
      return `( ${names.join(" + ")} ) ÷ ${toPersianDigits(names.length)}`;
    }
    if (operator === "difference") {
      return names.join(" − ");
    }
    if (operator === "multiply") {
      return names.join(" × ");
    }
    if (operator === "ratio_percentage") {
      if (names.length === 2) {
        return `( ${names[0]} ÷ ${names[1]} ) × ۱۰۰٪`;
      }
      return `نسبت ${names.join(" به ")} × ۱۰۰٪`;
    }
    return names.join(" + ");
  }, [selectedKpis, operator]);

  // ثبت شاخص ترکیبی جدید
  const handleCreateComposite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!name.trim()) {
      flashError("عنوان شاخص ترکیبی الزامی است.");
      return;
    }
    if (!unit.trim()) {
      flashError("واحد سنجش الزامی است.");
      return;
    }
    if (selectedKpis.length < 2) {
      flashError("برای ترکیب، حداقل دو شاخص پایه را انتخاب کنید.");
      return;
    }
    if (targetValue !== "" && isNaN(Number(targetValue))) {
      flashError("مقدار هدف باید عددی معتبر باشد.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        unit: unit.trim(),
        operator,
        target_value: targetValue === "" ? null : Number(targetValue),
        target_direction: targetDirection,
        item_kpi_ids: selectedKpis.map((k) => k.id),
      };

      const res = await fetch("/api/composite-kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        flashSuccess("شاخص ترکیبی با موفقیت ذخیره و مقادیر دوره‌ها محاسبه شد.");
        // ریست فرم
        setName("");
        setDescription("");
        setTargetValue("");
        setSelectedKpis([]);
        fetchCompositeKpis();
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در ثبت شاخص ترکیبی.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSaving(false);
    }
  };

  // محاسبه مجدد دستی
  const handleRecalculate = async (compositeId: number) => {
    try {
      const res = await fetch(`/api/composite-kpis/${compositeId}/recalculate`, {
        method: "POST",
      });
      if (res.ok) {
        flashSuccess("محاسبه مجدد تاریخچه برای کلیه دوره‌ها با موفقیت انجام شد.");
        fetchCompositeKpis();
        if (selectedCompositeForTrend && selectedCompositeForTrend.id === compositeId) {
          openTrendModal(selectedCompositeForTrend);
        }
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در محاسبه مجدد شاخص.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    }
  };

  // حذف شاخص ترکیبی
  const handleDeleteComposite = async (composite: CompositeKpi) => {
    if (!window.confirm(`آیا از حذف شاخص ترکیبی «${composite.name}» اطمینان دارید؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/composite-kpis/${composite.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        flashSuccess("شاخص ترکیبی با موفقیت حذف شد.");
        fetchCompositeKpis();
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در حذف شاخص.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    }
  };

  // باز کردن مودال تحلیل روند
  const openTrendModal = async (composite: CompositeKpi) => {
    setSelectedCompositeForTrend(composite);
    setTrendModalOpen(true);
    setTrendLoading(true);
    setExpandedPeriodRowId(null);
    try {
      const res = await fetch(`/api/composite-kpis/${composite.id}`);
      if (res.ok) {
        const data = await res.json();
        setTrendDetail(data);
      }
    } catch (err) {
      console.error("Error fetching trend data:", err);
    } finally {
      setTrendLoading(false);
    }
  };

  // باز کردن مودال ویرایش
  const openEditModal = (composite: CompositeKpi) => {
    setEditingComposite(composite);
    setEditName(composite.name);
    setEditUnit(composite.unit);
    setEditTargetValue(
      composite.target_value !== null && composite.target_value !== undefined
        ? String(composite.target_value)
        : ""
    );
    setEditTargetDirection(composite.target_direction || "minimum");
    setEditDescription(composite.description || "");
    setEditOperator(composite.operator || "sum");
    setEditCandidateKpiId(0);

    const mappedItems: BaseKpiItem[] = composite.items.map((it) => {
      const foundInAll = allKpis.find((k) => k.id === it.project_kpi_id);
      if (foundInAll) return foundInAll;
      return {
        id: it.project_kpi_id,
        name: it.projectKpi?.name || "شاخص",
        unit: it.projectKpi?.unit || composite.unit,
        input_type: it.projectKpi?.input_type || "direct",
        baseline_value: null,
        target_value: null,
        target_direction: "minimum",
        project_id: it.projectKpi?.project_id || 0,
        project_title: it.projectKpi?.project?.title || "",
        deputy_title: "سازمانی",
      };
    });
    setEditItems(mappedItems);
  };

  const handleUpdateComposite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComposite || isUpdating) return;

    if (!editName.trim()) {
      flashError("عنوان شاخص ترکیبی الزامی است.");
      return;
    }
    if (!editUnit.trim()) {
      flashError("واحد سنجش الزامی است.");
      return;
    }
    if (editItems.length < 2) {
      flashError("حداقل دو شاخص برای ترکیب الزامی است.");
      return;
    }
    if (editTargetValue !== "" && isNaN(Number(editTargetValue))) {
      flashError("مقدار هدف باید عددی معتبر باشد.");
      return;
    }

    setIsUpdating(true);
    try {
      const payload = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        unit: editUnit.trim(),
        operator: editOperator,
        target_value: editTargetValue === "" ? null : Number(editTargetValue),
        target_direction: editTargetDirection,
        item_kpi_ids: editItems.map((k) => k.id),
      };

      const res = await fetch(`/api/composite-kpis/${editingComposite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        flashSuccess("شاخص ترکیبی با موفقیت ویرایش و مقادیر دوره‌ها بازسنجی شد.");
        setEditingComposite(null);
        fetchCompositeKpis();
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در ویرایش شاخص ترکیبی.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsUpdating(false);
    }
  };

  const moveEditItem = (index: number, direction: "up" | "down") => {
    setEditItems((prev) => {
      const next = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const removeEditItem = (index: number) => {
    setEditItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addEditItem = (kpiId: number) => {
    if (!kpiId) return;
    const targetKpi = allKpis.find((k) => k.id === kpiId);
    if (targetKpi) {
      setEditItems((prev) => [...prev, targetKpi]);
      setEditCandidateKpiId(0);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-24 space-y-3 font-sans dir-rtl">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
        <p className="text-xs text-slate-500 font-bold">در حال بارگذاری شاخص‌های معاونت‌ها و پروژه‌ها...</p>
      </div>
    );
  }

  return (
    <div className="space-y-7 animate-fade-in font-sans dir-rtl text-right">
      {/* اعلان‌های وضعیت */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* بخش هدر و ابزارهای سراسری */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-700" />
              <span>فرمول‌ساز شاخص‌های ترکیبی مدیریتی (Composite KPIs)</span>
            </h2>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              ترکیب و تجمیع شاخص‌های معاونت‌ها و پروژه‌های مختلف با عملگرهای ریاضی؛ اختصاصی برای دیدگاه کلان مدیریت سازمان.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
              <span>به‌روزرسانی داده‌ها</span>
            </button>
            <button
              onClick={handleOpenAllDeputies}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              نمایش همه پنجره‌ها
            </button>
            <button
              onClick={handleCloseAllDeputies}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
            >
              بستن همه
            </button>
          </div>
        </div>

        {/* کادر جستجوی سریع سراسری در کل شاخص‌ها */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 focus-within:border-emerald-600 focus-within:bg-white transition-all">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setShowSearchResults(Boolean(e.target.value.trim()));
              }}
              onFocus={() => {
                if (globalSearch.trim()) setShowSearchResults(true);
              }}
              placeholder="جستجوی سریع بین کلیه شاخص‌های تمام معاونت‌ها و پروژه‌ها (عنوان شاخص، نام پروژه، معاونت)..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none font-sans"
            />
            {globalSearch && (
              <button
                onClick={() => {
                  setGlobalSearch("");
                  setShowSearchResults(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* نتایج زنده جستجوی سراسری */}
          {showSearchResults && (
            <div className="absolute top-full right-0 left-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 z-30 max-h-72 overflow-y-auto space-y-2">
              <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-100 text-[11px] text-slate-500">
                <span>نتایج جستجو: {toPersianDigits(searchResults.length)} شاخص منطبق</span>
                <button
                  onClick={() => setShowSearchResults(false)}
                  className="text-slate-400 hover:text-slate-600 text-[11px] cursor-pointer"
                >
                  بستن
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  شاخصی با این مشخصات یافت نشد.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {searchResults.map((kpi) => (
                    <div
                      key={`search_${kpi.id}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, kpi)}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50/50 hover:border-emerald-300 transition-all flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-xs truncate">{kpi.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {kpi.deputy_title} • {kpi.project_title}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => addKpiToFormula(kpi)}
                        className="px-2 py-1 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                        title="افزودن به فرمول"
                      >
                        <Plus className="w-3 h-3" />
                        <span>افزودن</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* دکمه‌های تگ بازکردن پنجره‌های معاونت‌ها */}
        <div className="space-y-1.5 pt-1">
          <label className="text-[11px] font-bold text-slate-500 block">
            پنجره‌های معاونت‌ها جهت مشاهده و Drag & Drop شاخص‌ها:
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {deputies.map((deputy) => {
              const isOpen = openDeputyIds.has(deputy.id);
              return (
                <button
                  key={deputy.id}
                  onClick={() => toggleDeputyWindow(deputy.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isOpen
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Building2 className={`w-3.5 h-3.5 ${isOpen ? "text-emerald-600" : "text-slate-400"}`} />
                  <span>{deputy.title}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isOpen ? "bg-emerald-200/80 text-emerald-900" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {toPersianDigits(deputy.totalKpisCount)}
                  </span>
                  {isOpen ? <Check className="w-3 h-3 text-emerald-700 mr-0.5" /> : <Plus className="w-3 h-3 text-slate-400 mr-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* پنجره‌های بازشده معاونت‌ها (Deputy Window Pods) */}
      {openDeputyIds.size > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
            <span className="flex items-center gap-1.5">
              <FolderGit2 className="w-4 h-4 text-emerald-600" />
              <span>پنجره‌های باز معاونت‌ها (شاخص‌ها را بکشید و در میزکار رها کنید):</span>
            </span>
            <span className="text-[11px] text-slate-400">
              {toPersianDigits(openDeputyIds.size)} پنجره فعال
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {deputies
              .filter((d) => openDeputyIds.has(d.id))
              .map((deputy) => (
                <div
                  key={deputy.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col max-h-[380px]"
                >
                  {/* هدر پنجره معاونت */}
                  <div className="p-3.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-slate-900 text-xs truncate flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="truncate">{deputy.title}</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        مسئول: {deputy.userName} • {toPersianDigits(deputy.totalKpisCount)} شاخص فعال
                      </p>
                    </div>
                    <button
                      onClick={() => toggleDeputyWindow(deputy.id)}
                      className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="بستن پنجره"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* لیست پروژه‌ها و شاخص‌ها در این پنجره */}
                  <div className="p-3 overflow-y-auto space-y-3 grow divide-y divide-slate-100">
                    {deputy.projects.length === 0 || deputy.totalKpisCount === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        هیچ شاخص فعالی برای این معاونت تعریف نشده است.
                      </div>
                    ) : (
                      deputy.projects
                        .filter((p) => p.kpis.length > 0)
                        .map((proj) => (
                          <div key={proj.id} className="pt-2 first:pt-0 space-y-1.5">
                            <span className="text-[10.5px] font-bold text-slate-500 block truncate">
                              📁 پروژه: {proj.title}
                            </span>
                            <div className="space-y-1.5">
                              {proj.kpis.map((kpi) => (
                                <div
                                  key={kpi.id}
                                  draggable={true}
                                  onDragStart={(e) => handleDragStart(e, kpi)}
                                  className="p-2.5 rounded-xl border border-slate-200/90 bg-white hover:bg-emerald-50/40 hover:border-emerald-300 transition-all flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing shadow-2xs group"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-slate-800 truncate">{kpi.name}</p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        واحد: {kpi.unit}
                                        {kpi.target_value !== null && kpi.target_value !== undefined && (
                                          <> • هدف: {toPersianDigits(kpi.target_value)}</>
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => addKpiToFormula(kpi)}
                                    className="p-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-600 hover:text-white rounded-lg transition-all shrink-0 cursor-pointer"
                                    title="افزودن به فرمول ترکیبی"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* میزکار و پنجره مرکزی فرمول‌ساز شاخص ترکیبی (Central Formula Drop Zone & Builder Window) */}
      <div className="bg-white rounded-3xl border-2 border-emerald-600/30 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-700" />
              <span>میزکار و پنجره مرکزی ترکیب شاخص‌ها</span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              شاخص‌های مورد نظر را از پنجره‌های بالا به اینجا بکشید (Drag & Drop) یا با دکمه (+) اضافه کنید.
            </p>
          </div>

          {selectedKpis.length > 0 && (
            <button
              onClick={() => setSelectedKpis([])}
              className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>پاک‌سازی میزکار</span>
            </button>
          )}
        </div>

        {/* ناحیه رهاسازی (Drop Zone) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-4 transition-all min-h-[140px] flex flex-col justify-center ${
            isDragOver
              ? "border-emerald-600 bg-emerald-50/60 scale-[1.01]"
              : selectedKpis.length === 0
              ? "border-slate-300 bg-slate-50/70"
              : "border-slate-200 bg-slate-50/40"
          }`}
        >
          {selectedKpis.length === 0 ? (
            <div className="text-center py-6 space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100/70 text-emerald-800 flex items-center justify-center mx-auto">
                <Layers className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                شاخص‌ها را از پنجره‌های بالا به این کادر بکشید و رها کنید (Drop Zone)
              </p>
              <p className="text-[11px] text-slate-400">
                یا می‌توانید از دکمه (+) روی هر شاخص در پنجره‌های معاونت‌ها یا کادر جستجو استفاده کنید.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <span>شاخص‌های ورودی ترکیب ({toPersianDigits(selectedKpis.length)} شاخص):</span>
                <span className="text-emerald-700">عملگر انتخابی: {OPERATOR_CONFIG[operator].label}</span>
              </div>

              {/* زنجیره اجزای فرمول */}
              <div className="space-y-2">
                {selectedKpis.map((kpi, idx) => (
                  <React.Fragment key={`${kpi.id}_${idx}`}>
                    <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                          {toPersianDigits(idx + 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{kpi.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                            معاونت: <span className="font-medium text-slate-600">{kpi.deputy_title}</span> • پروژه:{" "}
                            <span className="font-medium text-slate-600">{kpi.project_title}</span> • واحد: {kpi.unit}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() => moveKpiOrder(idx, "up")}
                          disabled={idx === 0}
                          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="جابجایی به بالا"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveKpiOrder(idx, "down")}
                          disabled={idx === selectedKpis.length - 1}
                          className="p-1.5 text-slate-500 hover:text-slate-800 disabled:opacity-30 bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="جابجایی به پایین"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeKpiFromFormula(idx)}
                          className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف از ترکیب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* نماد عملگر بین شاخص‌ها */}
                    {idx < selectedKpis.length - 1 && (
                      <div className="flex items-center justify-center -my-1">
                        <span className="w-8 h-8 rounded-full text-base font-black bg-emerald-600 text-white shadow-xs flex items-center justify-center">
                          {OPERATOR_CONFIG[operator].symbol}
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* پیش‌نمایش فرمول تولیدشده */}
        {selectedKpis.length > 0 && (
          <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-1.5">
            <span className="text-[10px] text-slate-400 block font-bold">پیش‌نمایش رابطه منطقی شاخص:</span>
            <div className="text-xs font-bold text-emerald-300 leading-relaxed font-sans" dir="rtl">
              {formulaPreviewText}
            </div>
          </div>
        )}

        {/* فرم مشخصات شاخص ترکیبی */}
        <form onSubmit={handleCreateComposite} className="space-y-4">
          {/* انتخاب عملگر */}
          <div>
            <label className="block text-slate-700 font-bold text-xs mb-2">
              عملگر ریاضی ترکیب شاخص‌ها *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
              {(Object.keys(OPERATOR_CONFIG) as CompositeOperator[]).map((op) => {
                const conf = OPERATOR_CONFIG[op];
                const isSelected = operator === op;
                return (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setOperator(op)}
                    className={`p-3.5 rounded-2xl text-right border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? "bg-emerald-50/90 border-emerald-500 shadow-sm text-emerald-950 ring-2 ring-emerald-500/20"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/80"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-black text-xs text-slate-900">{conf.label}</span>
                      <span
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg transition-transform shrink-0 ${
                          isSelected
                            ? "bg-emerald-600 text-white scale-110 shadow-xs"
                            : "bg-slate-200/80 text-slate-700"
                        }`}
                      >
                        {conf.symbol}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-normal">{conf.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* فیلدهای نام، واحد، هدف */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">عنوان شاخص ترکیبی *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: سرجمع متراژ حفاری مترو"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">واحد سنجش *</label>
              <div className="space-y-1.5">
                <input
                  type="text"
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="مثال: درصد یا کیلومتر"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["درصد", "کیلومتر", "متر", "دستگاه", "عدد", "تن"].map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setUnit(u)}
                      className={`text-[9.5px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                        unit === u
                          ? "bg-emerald-600 text-white border-emerald-600 font-bold"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold text-xs mb-1">مقدار هدف (اختیاری)</label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="اختیاری (مثال: ۱۰۰)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
                <div className="w-28 shrink-0">
                  <CustomSelect
                    value={targetDirection}
                    onChange={(val) => setTargetDirection(val as "minimum" | "maximum")}
                    options={[
                      { value: "minimum", label: "حداقل" },
                      { value: "maximum", label: "حداکثر" },
                    ]}
                    searchable={false}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold text-xs mb-1">توضیحات و کاربرد مدیریتی</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات تکمیلی پیرامون منطق و تصمیم‌گیری مدیریتی این شاخص..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 font-sans"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || selectedKpis.length < 2}
              className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-extrabold px-6 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 text-xs cursor-pointer"
            >
              <Calculator className="w-4 h-4" />
              <span>{isSaving ? "در حال محاسبه و ذخیره..." : "ثبت و محاسبه شاخص ترکیبی"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* کارتابل شاخص‌های ترکیبی تعریف‌شده (Directory) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>شاخص‌های ترکیبی تعریف‌شده در سیستم</span>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {toPersianDigits(compositeKpis.length)} شاخص
              </span>
            </h3>
            <p className="text-slate-400 text-xs mt-0.5">
              مشاهده روند، مقادیر آخرین دوره و سهم معاونت‌ها در هر شاخص کلان
            </p>
          </div>

          <div className="w-full sm:w-64">
            <input
              type="text"
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              placeholder="جستجو بین شاخص‌های ترکیبی..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-right dir-rtl font-sans focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {filteredCompositeKpis.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            {directorySearch
              ? "شاخص ترکیبی با این عبارت جستجو یافت نشد."
              : "هنوز هیچ شاخص ترکیبی ثبت نشده است. از فرم بالا برای ساخت اولین شاخص ترکیبی استفاده کنید."}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredCompositeKpis.map((composite) => {
              const opConf = OPERATOR_CONFIG[composite.operator] || OPERATOR_CONFIG.sum;
              return (
                <div
                  key={composite.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-4 flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-slate-900 text-sm">{composite.name}</h4>
                        {composite.description && (
                          <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                            {composite.description}
                          </p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border shrink-0 ${opConf.badgeClass}`}>
                        {opConf.label}
                      </span>
                    </div>

                    {/* اجزای فرمول */}
                    <div className="bg-slate-50 rounded-xl p-2.5 space-y-1 text-[11px]">
                      <span className="text-slate-400 font-bold block text-[10px]">اجزای سازنده:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {composite.items.map((it, idx) => (
                          <React.Fragment key={it.id}>
                            <span className="font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                              {it.projectKpi?.name || "شاخص"}
                              <span className="text-[9.5px] text-slate-400 mr-1">
                                ({it.projectKpi?.project?.title})
                              </span>
                            </span>
                            {idx < composite.items.length - 1 && (
                              <span className="font-black text-emerald-700 text-xs">{opConf.symbol}</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* وضعیت و آخرین مقدار */}
                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-[10px] text-slate-400 block">آخرین عملکرد محاسبه‌شده:</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-base font-black text-emerald-800">
                          {composite.latest_value !== null && composite.latest_value !== undefined
                            ? `${toPersianDigits(composite.latest_value)} ${composite.unit}`
                            : "بدون محاسبه"}
                        </span>
                        {composite.target_value !== null && composite.target_value !== undefined && (
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            هدف: {toPersianDigits(composite.target_value)} {composite.unit}
                          </span>
                        )}
                      </div>
                      {composite.latest_period_title && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          دوره: {composite.latest_period_title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => openTrendModal(composite)}
                        className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        title="مشاهده روند و سهم معاونت‌ها"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>روند و جزئیات</span>
                      </button>
                      <button
                        onClick={() => openEditModal(composite)}
                        className="p-1.5 text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                        title="ویرایش شاخص ترکیبی"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRecalculate(composite.id)}
                        className="p-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                        title="محاسبه مجدد تاریخچه"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteComposite(composite)}
                        className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                        title="حذف شاخص ترکیبی"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* مودال تحلیل روند و سهم معاونت‌ها */}
      {trendModalOpen && selectedCompositeForTrend && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  <span>تحلیل روند شاخص ترکیبی «{selectedCompositeForTrend.name}»</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  روند زمانی مقادیر در دوره‌های مختلف و تفکیک سهم هر یک از معاونت‌ها
                </p>
              </div>
              <button
                onClick={() => setTrendModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {trendLoading ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                در حال بارگذاری اطلاعات تاریخچه و روند...
              </div>
            ) : !trendDetail || !trendDetail.values || trendDetail.values.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                هنوز هیچ رکوردی در دوره‌های مختلف برای این شاخص محاسبه نشده است.
              </div>
            ) : (
              <div className="space-y-6">
                {/* نمودار روند سری زمانی */}
                <div className="bg-slate-50/70 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>نمودار تغییرات در طول دوره‌ها ({selectedCompositeForTrend.unit})</span>
                  </h4>
                  <div dir="ltr" className="w-full h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendDetail.values.map((v: any) => ({
                          period_title: v.period?.title || "دوره",
                          value: v.calculated_value,
                          status: v.status,
                        }))}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period_title"
                          tick={{ fontSize: 10, fill: "#64748b" }}
                          tickFormatter={(val) => toPersianDigits(val)}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                        <Tooltip
                          contentStyle={{ direction: "rtl", fontFamily: "inherit", fontSize: 11 }}
                          labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
                          formatter={(value: any) => [
                            value !== null ? `${toPersianDigits(value)} ${selectedCompositeForTrend.unit}` : "بدون مقدار",
                            "مقدار ترکیبی",
                          ]}
                        />
                        {selectedCompositeForTrend.target_value !== null &&
                          selectedCompositeForTrend.target_value !== undefined && (
                            <ReferenceLine
                              y={selectedCompositeForTrend.target_value}
                              stroke="#6366f1"
                              strokeDasharray="5 4"
                              label={{
                                value: `هدف: ${toPersianDigits(selectedCompositeForTrend.target_value)}`,
                                position: "insideTopRight",
                                fontSize: 10,
                                fill: "#6366f1",
                              }}
                            />
                          )}
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="مقدار ترکیبی"
                          stroke="#059669"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#059669" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* جدول مقادیر به تفکیک دوره و سهم معاونت‌ها */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800">
                    جدول ریزعملکرد دوره‌ها (روی هر ردیف کلیک کنید تا سهم معاونت‌ها باز شود):
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200 text-xs">
                    <div className="bg-slate-100/80 p-3 font-bold text-slate-700 grid grid-cols-12 gap-2 text-[11px]">
                      <span className="col-span-1 text-center">ردیف</span>
                      <span className="col-span-4">دوره گزارش‌دهی</span>
                      <span className="col-span-3 text-center">مقدار ترکیبی</span>
                      <span className="col-span-2 text-center">وضعیت داده</span>
                      <span className="col-span-2 text-center">جزئیات سهم</span>
                    </div>

                    {trendDetail.values.map((v: any, idx: number) => {
                      const isExpanded = expandedPeriodRowId === v.id;
                      const details = Array.isArray(v.details) ? (v.details as CompositeKpiValueDetail[]) : [];
                      return (
                        <div key={v.id} className="bg-white">
                          <div
                            onClick={() => setExpandedPeriodRowId(isExpanded ? null : v.id)}
                            className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                          >
                            <span className="col-span-1 text-center text-slate-500 font-semibold">
                              {toPersianDigits(idx + 1)}
                            </span>
                            <span className="col-span-4 font-bold text-slate-900">
                              {v.period?.title || "دوره"}
                            </span>
                            <span className="col-span-3 text-center font-extrabold text-emerald-800">
                              {v.calculated_value !== null
                                ? `${toPersianDigits(v.calculated_value)} ${selectedCompositeForTrend.unit}`
                                : "—"}
                            </span>
                            <span className="col-span-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.status === "computed"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : v.status === "partial"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {v.status === "computed" ? "کامل" : v.status === "partial" ? "ناقص" : "عدم پایش"}
                              </span>
                            </span>
                            <span className="col-span-2 text-center text-emerald-700 font-bold flex items-center justify-center gap-1 text-[11px]">
                              <span>{isExpanded ? "بستن" : "مشاهده"}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </div>

                          {/* زیرجدول جزئیات سهم معاونت‌ها در این دوره */}
                          {isExpanded && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 space-y-2">
                              <span className="text-[11px] font-bold text-slate-600 block">
                                جزئیات مقادیر خام ثبت‌شده توسط معاونت‌ها در این دوره:
                              </span>
                              {details.length === 0 ? (
                                <p className="text-slate-400 text-xs">جزئیاتی ثبت نشده است.</p>
                              ) : (
                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                  <table className="w-full text-right text-[11px]">
                                    <thead className="bg-slate-100 text-slate-700 font-bold">
                                      <tr>
                                        <th className="p-2">معاونت</th>
                                        <th className="p-2">پروژه</th>
                                        <th className="p-2">شاخص پایه</th>
                                        <th className="p-2 text-center">مقدار گزارش‌شده</th>
                                        <th className="p-2 text-center">وضعیت پایش</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {details.map((d: any, dIdx: number) => (
                                        <tr key={dIdx} className="hover:bg-slate-50">
                                          <td className="p-2 font-bold text-slate-800">{d.deputy_name || "—"}</td>
                                          <td className="p-2 text-slate-600">{d.project_title || "—"}</td>
                                          <td className="p-2 font-semibold text-slate-800">{d.kpi_name}</td>
                                          <td className="p-2 text-center font-bold text-emerald-800">
                                            {d.value !== null ? `${toPersianDigits(d.value)} ${d.unit || ""}` : "—"}
                                          </td>
                                          <td className="p-2 text-center">
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                d.measured
                                                  ? "bg-emerald-50 text-emerald-700 font-bold"
                                                  : "bg-rose-50 text-rose-700"
                                              }`}
                                            >
                                              {d.measured ? "ثبت‌شده" : "عدم پایش"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* مودال ویرایش شاخص ترکیبی */}
      {editingComposite && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-700" />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  ویرایش شاخص ترکیبی «{editingComposite.name}»
                </h3>
              </div>
              <button
                onClick={() => setEditingComposite(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateComposite} className="space-y-4">
              {/* انتخاب عملگر با دکمه‌های شکیل و فونت بزرگ */}
              <div>
                <label className="block text-slate-700 font-bold text-xs mb-2">عملگر ریاضی ترکیب شاخص‌ها *</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(Object.keys(OPERATOR_CONFIG) as CompositeOperator[]).map((op) => {
                    const conf = OPERATOR_CONFIG[op];
                    const isSelected = editOperator === op;
                    return (
                      <button
                        key={`edit_op_${op}`}
                        type="button"
                        onClick={() => setEditOperator(op)}
                        className={`p-2.5 rounded-xl text-right border transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-500 shadow-2xs text-emerald-950 ring-1 ring-emerald-500"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 w-full">
                          <span className="font-bold text-[11px] truncate">{conf.label}</span>
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
                              isSelected ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {conf.symbol}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">عنوان شاخص ترکیبی *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">واحد سنجش *</label>
                  <input
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold text-xs mb-1">مقدار هدف (اختیاری)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      step="any"
                      value={editTargetValue}
                      onChange={(e) => setEditTargetValue(e.target.value)}
                      placeholder="اختیاری"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                    />
                    <div className="w-24 shrink-0">
                      <CustomSelect
                        value={editTargetDirection}
                        onChange={(val) => setEditTargetDirection(val as "minimum" | "maximum")}
                        options={[
                          { value: "minimum", label: "حداقل" },
                          { value: "maximum", label: "حداکثر" },
                        ]}
                        searchable={false}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">توضیحات</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600 font-sans"
                ></textarea>
              </div>

              {/* لیست اجزای شاخص با امکان مرتب‌سازی و حذف */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span>اجزای فرمول ({toPersianDigits(editItems.length)} شاخص):</span>
                  <span className="text-[11px] text-slate-400">ترتیب قرارگیری برای تفریق و نسبت درصدی دارای اهمیت است</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {editItems.map((it, idx) => (
                    <div
                      key={`edit_it_${it.id}_${idx}`}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                          {toPersianDigits(idx + 1)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{it.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {it.deputy_title} • {it.project_title}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveEditItem(idx, "up")}
                          className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 bg-white border border-slate-200 rounded-lg cursor-pointer"
                          title="بالا"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === editItems.length - 1}
                          onClick={() => moveEditItem(idx, "down")}
                          className="p-1 text-slate-500 hover:text-slate-800 disabled:opacity-30 bg-white border border-slate-200 rounded-lg cursor-pointer"
                          title="پایین"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeEditItem(idx)}
                          className="p-1 text-rose-600 hover:text-rose-800 bg-white border border-rose-200 rounded-lg cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* افزودن شاخص جدید به این فرمول */}
                <div className="pt-2">
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">افزودن شاخص جدید به این فرمول:</label>
                  <div className="flex gap-2">
                    <CustomSelect
                      value={editCandidateKpiId}
                      onChange={(val) => setEditCandidateKpiId(Number(val))}
                      options={[
                        { value: 0, label: "-- انتخاب شاخص برای افزودن --" },
                        ...allKpis.map((k) => ({
                          value: k.id,
                          label: `${k.name} (${k.deputy_title} - ${k.project_title})`,
                        })),
                      ]}
                      className="grow"
                    />
                    <button
                      type="button"
                      onClick={() => addEditItem(editCandidateKpiId)}
                      disabled={!editCandidateKpiId}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>افزودن</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingComposite(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || editItems.length < 2}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold rounded-xl text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isUpdating ? "در حال ذخیره و بازسنجی..." : "ذخیره تغییرات و بازسنجی"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
