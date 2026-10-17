// src/views/ProjectKpiManagement.tsx
import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  X,
  Target,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Layers,
  Link,
  Unlink,
} from "lucide-react";
import { Project, CompositeKpi } from "../types";
import { CustomSelect } from "../components";

// 🌐 تبدیل اعداد به فارسی
export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

const INPUT_TYPE_LABELS: Record<string, string> = {
  direct: "مقدار مستقیم",
  percentage_change: "درصد تغییر نسبت به مبنا",
};

const TARGET_DIRECTION_LABELS: Record<string, string> = {
  minimum: "حداقل",
  maximum: "حداکثر",
};

function renderScope(reportType: string | null): string {
  if (!reportType) return "هر دو";
  return reportType === "weekly" ? "هفتگی" : "ماهانه";
}

interface ProjectKpiManagementProps {
  projects: Project[];
  onRefresh?: () => void;
}

interface Kpi {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  unit: string;
  input_type: "direct" | "percentage_change";
  baseline_value?: number | null;
  target_value?: number | null;
  target_direction: "minimum" | "maximum";
  report_type: "weekly" | "monthly" | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export default function ProjectKpiManagement({ projects = [], onRefresh }: ProjectKpiManagementProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);

  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // استیت‌های فرم ایجاد
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("");
  const [inputType, setInputType] = useState<"direct" | "percentage_change">("direct");
  const [baselineValue, setBaselineValue] = useState<string>("");
  const [targetDirection, setTargetDirection] = useState<"minimum" | "maximum">("maximum");
  const [targetValue, setTargetValue] = useState<string>("");
  const [reportType, setReportType] = useState<"weekly" | "monthly" | "both">("both");
  const [sortOrder, setSortOrder] = useState<string>("0");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // استیت‌های مودال ویرایش
  const [editingKpi, setEditingKpi] = useState<Kpi | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editInputType, setEditInputType] = useState<"direct" | "percentage_change">("direct");
  const [editBaselineValue, setEditBaselineValue] = useState<string>("");
  const [editTargetDirection, setEditTargetDirection] = useState<"minimum" | "maximum">("maximum");
  const [editTargetValue, setEditTargetValue] = useState<string>("");
  const [editReportType, setEditReportType] = useState<"weekly" | "monthly" | "both">("both");
  const [editSortOrder, setEditSortOrder] = useState<string>("0");
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // شاخص‌های ترکیبی تخصیص‌یافته به این پروژه
  const [projectCompositeKpis, setProjectCompositeKpis] = useState<CompositeKpi[]>([]);
  const [allCompositeKpis, setAllCompositeKpis] = useState<CompositeKpi[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [selectedCompositeToAssign, setSelectedCompositeToAssign] = useState<number>(0);
  const [assignLoading, setAssignLoading] = useState<boolean>(false);

  const flashSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };
  const flashError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 5000);
  };

  // انتخاب پیش‌فرض اولین پروژه در زمان بارگذاری
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const fetchKpis = async () => {
    if (!selectedProjectId) {
      setKpis([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/kpis`);
      if (res.ok) {
        setKpis(await res.json());
      } else {
        flashError("خطا در دریافت شاخص‌های پروژه.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    } finally {
      setLoading(false);
    }
  };

  // دریافت شاخص‌های ترکیبی تخصیص‌یافته به این پروژه
  const fetchProjectCompositeKpis = async () => {
    if (!selectedProjectId) {
      setProjectCompositeKpis([]);
      return;
    }
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/composite-kpis`);
      if (res.ok) {
        setProjectCompositeKpis(await res.json());
      }
    } catch (err) {
      console.error("Error fetching project composite KPIs:", err);
    }
  };

  // دریافت کل شاخص‌های ترکیبی سیستم جهت منوی تخصیص
  const fetchAllCompositeKpis = async () => {
    try {
      const res = await fetch("/api/composite-kpis");
      if (res.ok) {
        setAllCompositeKpis(await res.json());
      }
    } catch (err) {
      console.error("Error fetching all composite KPIs:", err);
    }
  };

  const handleAssignComposite = async () => {
    if (!selectedCompositeToAssign || !selectedProjectId) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/assign-composite-kpi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composite_kpi_id: selectedCompositeToAssign, action: "assign" }),
      });
      if (res.ok) {
        flashSuccess("شاخص ترکیبی با موفقیت به این پروژه تخصیص یافت.");
        setAssignModalOpen(false);
        setSelectedCompositeToAssign(0);
        fetchProjectCompositeKpis();
        fetchAllCompositeKpis();
      } else {
        const d = await res.json();
        flashError(d.error || "خطا در تخصیص شاخص ترکیبی.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignComposite = async (compositeId: number, compositeName: string) => {
    if (!confirm(`آیا از لغو تخصیص شاخص ترکیبی «${compositeName}» از این پروژه اطمینان دارید؟\nاین شاخص حذف نمی‌شود و در سطح کلان سازمانی باقی خواهد ماند.`)) return;
    try {
      const res = await fetch(`/api/projects/${selectedProjectId}/assign-composite-kpi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ composite_kpi_id: compositeId, action: "unassign" }),
      });
      if (res.ok) {
        flashSuccess(`تخصیص شاخص «${compositeName}» از این پروژه لغو شد.`);
        fetchProjectCompositeKpis();
        fetchAllCompositeKpis();
      } else {
        const d = await res.json();
        flashError(d.error || "خطا در لغو تخصیص شاخص.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    }
  };

  useEffect(() => {
    fetchKpis();
    fetchProjectCompositeKpis();
  }, [selectedProjectId]);

  const resetCreateForm = () => {
    setName("");
    setDescription("");
    setUnit("");
    setInputType("direct");
    setBaselineValue("");
    setTargetDirection("maximum");
    setTargetValue("");
    setReportType("both");
    setSortOrder("0");
    setIsActive(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      flashError("نام شاخص نمی‌تواند خالی باشد.");
      return;
    }
    if (!unit.trim()) {
      flashError("واحد سنجش نمی‌تواند خالی باشد.");
      return;
    }
    if (targetValue !== "" && isNaN(Number(targetValue))) {
      flashError("مقدار هدف باید عددی معتبر باشد.");
      return;
    }
    if (baselineValue !== "" && isNaN(Number(baselineValue))) {
      flashError("مقدار مبنا باید عددی معتبر باشد.");
      return;
    }

    setIsSubmitting(true);
    try {
      const body: any = {
        project_id: selectedProjectId,
        name: name.trim(),
        description: description.trim() || null,
        unit: unit.trim(),
        input_type: inputType,
        baseline_value: baselineValue === "" ? null : Number(baselineValue),
        target_value: targetValue === "" ? null : Number(targetValue),
        target_direction: targetDirection,
        is_active: isActive,
        sort_order: sortOrder === "" ? 0 : Number(sortOrder),
      };
      if (reportType === "both") {
        body.report_type = null;
      } else {
        body.report_type = reportType;
      }

      const res = await fetch("/api/project-kpis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        flashSuccess("شاخص با موفقیت ایجاد شد.");
        resetCreateForm();
        fetchKpis();
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در ایجاد شاخص.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (kpi: Kpi) => {
    try {
      const res = await fetch(`/api/project-kpis/${kpi.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !kpi.is_active }),
      });
      if (res.ok) {
        flashSuccess(kpi.is_active ? "شاخص با موفقیت غیرفعال شد." : "شاخص با موفقیت فعال شد.");
        fetchKpis();
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در تغییر وضعیت شاخص.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    }
  };

  const handleMoveOrder = async (kpi: Kpi, direction: "up" | "down") => {
    const currentIdx = kpis.findIndex((k) => k.id === kpi.id);
    if (currentIdx === -1) return;

    const adjacentIdx = direction === "up" ? currentIdx - 1 : currentIdx + 1;
    if (adjacentIdx < 0 || adjacentIdx >= kpis.length) return;

    const adjacentKpi = kpis[adjacentIdx];
    const newOrderThis = adjacentKpi.sort_order;
    const newOrderAdjacent = kpi.sort_order;

    try {
      const [res1, res2] = await Promise.all([
        fetch(`/api/project-kpis/${kpi.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: newOrderThis }),
        }),
        fetch(`/api/project-kpis/${adjacentKpi.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: newOrderAdjacent }),
        }),
      ]);

      if (res1.ok && res2.ok) {
        flashSuccess("ترتیب شاخص‌ها با موفقیت تغییر کرد.");
        fetchKpis();
      } else {
        const data = await res1.json();
        flashError(data.error || "خطا در تغییر ترتیب نمایش.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    }
  };

  const handleDelete = async (kpi: Kpi) => {
    if (!confirm(`آیا از حذف شاخص «${kpi.name}» اطمینان دارید؟`)) return;
    try {
      const res = await fetch(`/api/project-kpis/${kpi.id}`, { method: "DELETE" });
      if (res.ok) {
        flashSuccess("شاخص با موفقیت حذف شد.");
        fetchKpis();
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در حذف شاخص.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    }
  };

  const openEditModal = (kpi: Kpi) => {
    setEditingKpi(kpi);
    setEditName(kpi.name);
    setEditDescription(kpi.description || "");
    setEditUnit(kpi.unit);
    setEditInputType(kpi.input_type);
    setEditBaselineValue(kpi.baseline_value !== null && kpi.baseline_value !== undefined ? String(kpi.baseline_value) : "");
    setEditTargetDirection(kpi.target_direction);
    setEditTargetValue(kpi.target_value !== null && kpi.target_value !== undefined ? String(kpi.target_value) : "");
    setEditReportType(kpi.report_type || "both");
    setEditSortOrder(String(kpi.sort_order));
    setEditIsActive(kpi.is_active);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKpi || isSubmitting) return;

    if (!editName.trim()) {
      flashError("نام شاخص نمی‌تواند خالی باشد.");
      return;
    }
    if (!editUnit.trim()) {
      flashError("واحد سنجش نمی‌تواند خالی باشد.");
      return;
    }
    if (editTargetValue !== "" && isNaN(Number(editTargetValue))) {
      flashError("مقدار هدف باید عددی معتبر باشد.");
      return;
    }
    if (editBaselineValue !== "" && isNaN(Number(editBaselineValue))) {
      flashError("مقدار مبنا باید عددی معتبر باشد.");
      return;
    }

    setIsSubmitting(true);
    try {
      const body: any = {
        name: editName.trim(),
        description: editDescription.trim() || null,
        unit: editUnit.trim(),
        input_type: editInputType,
        baseline_value: editBaselineValue === "" ? null : Number(editBaselineValue),
        target_value: editTargetValue === "" ? null : Number(editTargetValue),
        target_direction: editTargetDirection,
        is_active: editIsActive,
        sort_order: editSortOrder === "" ? 0 : Number(editSortOrder),
      };
      if (editReportType === "both") {
        body.report_type = null;
      } else {
        body.report_type = editReportType;
      }

      const res = await fetch(`/api/project-kpis/${editingKpi.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        flashSuccess("تغییرات شاخص با موفقیت ذخیره شد.");
        setEditingKpi(null);
        fetchKpis();
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        flashError(data.error || "خطا در ویرایش شاخص.");
      }
    } catch (err) {
      flashError("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-700" />
            <span>مدیریت شاخص‌های عملکرد پروژه (KPI)</span>
          </h1>
        </div>
        <div className="bg-amber-50 text-amber-800 p-6 rounded-2xl border border-amber-200 flex gap-4">
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600" />
          <div>
            <h4 className="font-bold">هیچ پروژه‌ای تعریف نشده است</h4>
            <p className="text-sm">برای تعریف شاخص ابتدا باید حداقل یک پروژه ایجاد کنید.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">

      {/* پیام‌های وضعیت */}
      {successMessage && (
        <div className="fixed top-4 left-4 z-50 bg-green-600 text-white font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-4 left-4 z-50 bg-red-600 text-white font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-red-700">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* هدر */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
          <Target className="w-6 h-6 text-emerald-700" />
          <span>مدیریت شاخص‌های عملکرد پروژه (KPI)</span>
        </h1>
        <p className="text-slate-500 text-xs mt-1">
          تعریف و مدیریت شاخص‌های ساختاریافته هر پروژه جهت ثبت عددی در گزارش‌های عملکرد.
        </p>
      </div>

      {/* انتخاب پروژه */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <label className="text-slate-700 text-sm font-medium shrink-0">انتخاب پروژه:</label>
        <div className="sm:w-80">
          <CustomSelect
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(Number(val))}
            options={projects.filter((p) => p.is_active !== false).map((p) => ({ value: p.id, label: p.title }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* فرم ایجاد شاخص جدید */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 h-fit space-y-4 shadow-2xs">
          <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-3 text-sm">
            تعریف شاخص جدید
          </h3>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-slate-600 font-bold mb-1">نام شاخص *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: میانگین تعداد کلیک تا پرداخت"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">توضیحات</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="توضیح مختصر (اختیاری)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
              ></textarea>
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">واحد سنجش *</label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="مثال: کلیک، درصد، ثانیه"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">نوع محاسبه *</label>
              <CustomSelect
                value={inputType}
                onChange={(val) => setInputType(val as "direct" | "percentage_change")}
                options={[
                  { value: "direct", label: "مقدار مستقیم" },
                  { value: "percentage_change", label: "درصد تغییر نسبت به مبنا" },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 font-bold mb-1">جهت هدف *</label>
                <CustomSelect
                  value={targetDirection}
                  onChange={(val) => setTargetDirection(val as "minimum" | "maximum")}
                  options={[
                    { value: "minimum", label: "هرچه بیشتر بهتر" },
                    { value: "maximum", label: "هرچه کمتر بهتر" },
                  ]}
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {targetDirection === "maximum"
                    ? "با شروع از مبنا، رسیدن به مقدار کمتر یعنی پیشرفت (مثل کلیک تا درگاه پرداخت)"
                    : "با شروع از مبنا، رسیدن به مقدار بیشتر یعنی پیشرفت (مثل درصد پیشرفت)"}
                </span>
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">مقدار هدف (اختیاری)</label>
                <input
                  type="number"
                  step="any"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="اختیاری (مثال: 3)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-600 font-bold mb-1">مقدار مبنای اولیه (پایه)</label>
                <input
                  type="number"
                  step="any"
                  value={baselineValue}
                  onChange={(e) => setBaselineValue(e.target.value)}
                  placeholder="اختیاری (مثال: 5)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  نقطه شروع سنجش (در صورت خالی بودن، اولین عدد ثبت‌شده مبنا خواهد شد)
                </span>
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">دوره گزارش‌دهی *</label>
                <CustomSelect
                  value={reportType}
                  onChange={(val) => setReportType(val as "weekly" | "monthly" | "both")}
                  options={[
                    { value: "both", label: "هر دو" },
                    { value: "weekly", label: "هفتگی" },
                    { value: "monthly", label: "ماهانه" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-slate-600 font-bold mb-1">ترتیب نمایش</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-emerald-600"
              />
              <span className="text-slate-700 font-bold">شاخص فعال باشد</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-400 text-white py-2.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>ایجاد شاخص</span>
            </button>
          </form>
        </div>

        {/* لیست شاخص‌های پروژه */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
            <span>شاخص‌های پروژه انتخاب‌شده</span>
            <span className="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px]">
              {toPersianDigits(kpis.length)} شاخص
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                <span>در حال بارگذاری شاخص‌ها...</span>
              </div>
            ) : kpis.length === 0 ? (
              <div className="p-8 text-center text-slate-400">هنوز شاخصی برای این پروژه تعریف نشده است.</div>
            ) : (
              kpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className={`p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                    kpi.is_active ? "" : "opacity-60 bg-slate-50"
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-sm">{kpi.name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        kpi.is_active
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          : "bg-slate-200 text-slate-500 border border-slate-300"
                      }`}>
                        {kpi.is_active ? "فعال" : "غیرفعال"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                        {renderScope(kpi.report_type)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                        {INPUT_TYPE_LABELS[kpi.input_type]}
                      </span>
                    </div>
                    {kpi.description && (
                      <p className="text-slate-500 text-[11px] leading-relaxed">{kpi.description}</p>
                    )}
                    <p className="text-[11px] text-slate-600">
                      {kpi.baseline_value !== null && kpi.baseline_value !== undefined && (
                        <>
                          <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 ml-2">
                            مبنا: {toPersianDigits(kpi.baseline_value)} {kpi.unit}
                          </span>
                          {" • "}
                        </>
                      )}
                      {kpi.target_value !== null && kpi.target_value !== undefined ? (
                        <>هدف: {TARGET_DIRECTION_LABELS[kpi.target_direction]} {toPersianDigits(kpi.target_value)} {kpi.unit}</>
                      ) : (
                        <span className="text-slate-400">بدون مقدار هدف</span>
                      )}
                      {" • "}ترتیب: {toPersianDigits(kpi.sort_order)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleMoveOrder(kpi, "up")}
                      className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title="جابجایی به بالا"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveOrder(kpi, "down")}
                      className="p-2 text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                      title="جابجایی به پایین"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(kpi)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer ${
                        kpi.is_active
                          ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                          : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                      }`}
                      title={kpi.is_active ? "غیرفعال کردن" : "فعال کردن"}
                    >
                      {kpi.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEditModal(kpi)}
                      className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                      title="ویرایش"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(kpi)}
                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* بخش شاخص‌های ترکیبی تخصیص‌یافته به این پروژه */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-700" />
            <span>شاخص‌های ترکیبی تخصیص‌یافته به این پروژه</span>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
              {toPersianDigits(projectCompositeKpis.length)} شاخص
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              fetchAllCompositeKpis();
              setAssignModalOpen(true);
            }}
            className="bg-emerald-800 hover:bg-emerald-900 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ تخصیص شاخص ترکیبی به این پروژه</span>
          </button>
        </div>

        <div className="p-4">
          {projectCompositeKpis.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              هنوز هیچ شاخص ترکیبی به این پروژه تخصیص داده نشده است.
              <span className="block text-[11px] text-slate-400 mt-1">
                می‌توانید با دکمه بالا یکی از شاخص‌های ترکیبی موجود را به این پروژه منتسب کنید تا در پایش و گزارش‌های PDF نمایش داده شود.
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {projectCompositeKpis.map((comp) => (
                <div
                  key={comp.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-xs">{comp.name}</h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          ترکیبی ({comp.operator})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleUnassignComposite(comp.id, comp.name)}
                        className="text-rose-500 hover:text-rose-700 bg-rose-50 p-1.5 rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                        title="لغو تخصیص از پروژه"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                        <span>لغو تخصیص</span>
                      </button>
                    </div>

                    {comp.description && (
                      <p className="text-slate-500 text-[11px] leading-relaxed">{comp.description}</p>
                    )}

                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-xl space-y-1">
                      <span className="text-slate-400 block text-[10px] font-bold">شاخص‌های تشکیل‌دهنده:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {comp.items.map((it) => (
                          <span key={it.id} className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[10.5px]">
                            {it.projectKpi?.name || "شاخص"}
                            <span className="text-slate-400 text-[9px] mr-1">({it.projectKpi?.project?.title})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">
                      واحد: <span className="font-bold text-slate-800">{comp.unit}</span>
                      {comp.target_value !== null && comp.target_value !== undefined && (
                        <> • هدف: <span className="font-bold text-slate-800">{toPersianDigits(comp.target_value)}</span></>
                      )}
                    </span>
                    {comp.latest_value !== null && comp.latest_value !== undefined ? (
                      <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        آخرین عملکرد: {toPersianDigits(comp.latest_value)} {comp.unit}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">در انتظار محاسبه</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* مودال ویرایش */}
      {editingKpi && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">ویرایش شاخص</h3>
              <button onClick={() => setEditingKpi(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-slate-600 font-bold mb-1">نام شاخص *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">توضیحات</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                ></textarea>
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">واحد سنجش *</label>
                <input
                  type="text"
                  required
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">نوع محاسبه *</label>
                <CustomSelect
                  value={editInputType}
                  onChange={(val) => setEditInputType(val as "direct" | "percentage_change")}
                  options={[
                    { value: "direct", label: "مقدار مستقیم" },
                    { value: "percentage_change", label: "درصد تغییر نسبت به مبنا" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">جهت هدف *</label>
                  <CustomSelect
                    value={editTargetDirection}
                    onChange={(val) => setEditTargetDirection(val as "minimum" | "maximum")}
                    options={[
                      { value: "minimum", label: "حداقل" },
                      { value: "maximum", label: "حداکثر" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">مقدار هدف (اختیاری)</label>
                  <input
                    type="number"
                    step="any"
                    value={editTargetValue}
                    onChange={(e) => setEditTargetValue(e.target.value)}
                    placeholder="اختیاری (مثال: 3)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-bold mb-1">مقدار مبنای اولیه (پایه)</label>
                  <input
                    type="number"
                    step="any"
                    value={editBaselineValue}
                    onChange={(e) => setEditBaselineValue(e.target.value)}
                    placeholder="اختیاری (مثال: 5)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    نقطه شروع سنجش (در صورت خالی بودن، اولین عدد ثبت‌شده مبنا خواهد شد)
                  </span>
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">دوره گزارش‌دهی *</label>
                  <CustomSelect
                    value={editReportType}
                    onChange={(val) => setEditReportType(val as "weekly" | "monthly" | "both")}
                    options={[
                      { value: "both", label: "هر دو" },
                      { value: "weekly", label: "هفتگی" },
                      { value: "monthly", label: "ماهانه" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-bold mb-1">ترتیب نمایش</label>
                  <input
                    type="number"
                    value={editSortOrder}
                    onChange={(e) => setEditSortOrder(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-slate-700 font-bold">شاخص فعال باشد</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-emerald-800 text-white py-2.5 rounded-xl font-bold hover:bg-emerald-900 disabled:bg-slate-400 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  <span>ذخیره تغییرات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingKpi(null)}
                  className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold cursor-pointer hover:bg-slate-200"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال تخصیص شاخص ترکیبی به این پروژه */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <Link className="w-4 h-4 text-emerald-700" />
                <span>تخصیص شاخص ترکیبی به این پروژه</span>
              </h3>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-slate-500 text-xs leading-relaxed">
                از منوی زیر شاخص ترکیبی مورد نظر را انتخاب کنید تا به پروژه «{projects.find((p) => p.id === selectedProjectId)?.title}» متصل شود:
              </p>

              <div>
                <label className="block text-slate-700 font-bold text-xs mb-1">انتخاب شاخص ترکیبی:</label>
                <CustomSelect
                  options={[
                    { value: "0", label: "انتخاب شاخص..." },
                    ...allCompositeKpis
                      .filter((c) => c.project_id !== selectedProjectId)
                      .map((c) => ({
                        value: String(c.id),
                        label: `${c.name} (${c.unit})${c.project ? ` [فعلاً در ${c.project.title}]` : " [کلان سازمانی]"}`,
                      })),
                  ]}
                  value={String(selectedCompositeToAssign)}
                  onChange={(val) => setSelectedCompositeToAssign(Number(val))}
                  searchable={true}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  disabled={!selectedCompositeToAssign || assignLoading}
                  onClick={handleAssignComposite}
                  className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:bg-slate-300 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {assignLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>تایید و تخصیص به پروژه</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
