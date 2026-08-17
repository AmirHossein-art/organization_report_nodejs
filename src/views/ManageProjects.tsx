import React, { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Upload,
  X,
  FileSpreadsheet,
  FolderKanban,
  RefreshCw,
  Printer,
  ArrowUp,
  ArrowDown,
  Power,
  PowerOff
} from "lucide-react";
import { Project } from "../types";
import ReportsPdfDocument from "../components/ReportsPdfDocument";

// 🌐 تابع کمکی تبدیل اعداد به فارسی
export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

interface ManageProjectsProps {
  projects: Project[];
  onRefresh: () => void;
}

export default function ManageProjects({ projects = [], onRefresh }: ManageProjectsProps) {
  // --- استیت‌های فرم ساخت پروژه ---
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wbsFile, setWbsFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- استیت‌های مودال ویرایش پروژه ---
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editWbsFile, setEditWbsFile] = useState<File | null>(null);
  const [removeEditWbsFile, setRemoveEditWbsFile] = useState(false);
  const [isEditDragging, setIsEditDragging] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState<boolean>(false);

  // 🔢 توابع جابجایی و مرتب‌سازی پروژه‌ها برای خروجی
  const handleMoveProject = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= projects.length) return;

    const newProjects = [...projects];
    const temp = newProjects[index];
    newProjects[index] = newProjects[targetIndex];
    newProjects[targetIndex] = temp;

    const orderedIds = newProjects.map((p) => p.id);
    try {
      const res = await fetch("/api/projects/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
      });
      if (res.ok && onRefresh) onRefresh();
    } catch (e) {
      console.error("Error reordering projects:", e);
    }
  };

  const handleSetOrderIndex = async (projectId: number, newOrder: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/order`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_index: newOrder }),
      });
      if (res.ok && onRefresh) onRefresh();
    } catch (e) {
      console.error("Error setting project order:", e);
    }
  };

  // 📂 مدیریت تغییر فایل ساخت
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setWbsFile(e.target.files[0]);
    }
  };

  // 📂 مدیریت تغییر فایل ویرایش
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setEditWbsFile(e.target.files[0]);
      setRemoveEditWbsFile(false);
    }
  };

  // ❌ حذف فایل در فرم ثبت
  const handleRemoveFile = () => {
    setWbsFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ❌ حذف فایل جدید انتخابی در فرم ویرایش
  const handleRemoveEditFile = () => {
    setEditWbsFile(null);
    if (editFileInputRef.current) editFileInputRef.current.value = "";
  };

  // 🚀 ثبت پروژه جدید
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // بررسی تکراری بودن نام فایل در فرانت‌اند
    if (wbsFile) {
      const duplicate = projects.find((p) => p.wbs_file_name === wbsFile.name);
      if (duplicate) {
        alert(`فایلی با نام «${wbsFile.name}» قبلاً برای پروژه «${duplicate.title}» ثبت شده است.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("code", code);
      formData.append("title", title);
      formData.append("description", description);
      if (wbsFile) formData.append("wbs_file", wbsFile);

      const res = await fetch("/api/projects", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setCode("");
        setTitle("");
        setDescription("");
        handleRemoveFile();
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در ساخت پروژه");
      }
    } catch (err) {
      alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 🔄 تغییر وضعیت فعال / غیرفعال بودن پروژه توسط مدیر
  const handleToggleProjectStatus = async (proj: Project) => {
    const nextStatus = !proj.is_active;
    const confirmMsg = nextStatus
      ? `آیا از فعال‌سازی مجدد پروژه «${proj.title}» اطمینان دارید؟`
      : `آیا از غیرفعال‌سازی پروژه «${proj.title}» اطمینان دارید؟ (سوابق و گزارش‌های پروژه محفوظ خواهد ماند)`;

    if (!confirm(confirmMsg)) return;

    try {
      const formData = new FormData();
      formData.append("is_active", String(nextStatus));
      const res = await fetch(`/api/projects/${proj.id}`, {
        method: "PUT",
        body: formData,
      });
      if (res.ok && onRefresh) {
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در تغییر وضعیت پروژه");
      }
    } catch (err) {
      console.error(err);
      alert("ارتباط با سرور برقرار نشد.");
    }
  };

  // 🗑️ غیرفعال‌سازی نرم پروژه
  const handleDeleteProject = async (id: number) => {
    if (!confirm("آیا از غیرفعال‌سازی این پروژه اطمینان دارید؟ (کلیه سوابق و گزارش‌های پروژه محفوظ خواهد ماند)")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok && onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // ✏️ باز کردن مودال ویرایش
  const handleOpenEditModal = (proj: Project) => {
    setEditingProject(proj);
    setEditTitle(proj.title);
    setEditCode(proj.code);
    setEditDescription(proj.description || "");
    setEditIsActive(proj.is_active !== false);
    setEditWbsFile(null);
    setRemoveEditWbsFile(false);
  };

  // 💾 ذخیره تغییرات پروژه (ویرایش)
  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || isSubmitting) return;

    // بررسی تکراری بودن نام فایل در سایر پروژه‌ها
    if (editWbsFile) {
      const duplicate = projects.find(
        (p) => p.wbs_file_name === editWbsFile.name && p.id !== editingProject.id
      );
      if (duplicate) {
        alert(`فایلی با نام «${editWbsFile.name}» قبلاً برای پروژه «${duplicate.title}» ثبت شده است.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("code", editCode);
      formData.append("title", editTitle);
      formData.append("description", editDescription);
      formData.append("is_active", String(editIsActive));

      if (editWbsFile) {
        formData.append("wbs_file", editWbsFile);
      } else if (removeEditWbsFile) {
        formData.append("remove_wbs_file", "true");
      }

      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        setEditingProject(null);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در ویرایش پروژه");
      }
    } catch (err) {
      alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">

      {/* هدر */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-emerald-700" />
            <span>مدیریت پروژه‌ها و سندهای WBS</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            تعریف پروژه‌های جدید، بارگذاری ساختار شکست کار (WBS)، تنظیم چیدمان و صدور نسخه PDF گزارش‌ها.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPdfModalOpen(true)}
          className="bg-emerald-800 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-emerald-600/40 whitespace-nowrap shrink-0"
          title="صدور نسخه رسمی PDF از تمامی گزارش‌ها با امکان تنظیم ترتیب چینش"
        >
          <Printer className="w-4 h-4 text-emerald-300" />
          <span>خروجی PDF تمام گزارش‌ها</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* 📝 فرم تعریف پروژه جدید */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/90 h-fit space-y-4 shadow-2xs">
          <h3 className="font-extrabold text-slate-900 border-b border-slate-100 pb-3 text-sm">
            تعریف پروژه جدید
          </h3>

          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="block text-slate-600 font-bold mb-1">کد پروژه (یکتا):</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="مثلاً: PRJ-TRAFFIC-101"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">عنوان پروژه:</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: توسعه خطوط بی‌آرتی"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">شرح خلاصه پروژه:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="توضیحات و اهداف کلیدی پروژه..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
              ></textarea>
            </div>

            {/* 📂 بخش بارگذاری فایل WBS با قابلیت Drag & Drop */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">سند ساختار شکست کار WBS (اکسل):</label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />

              {wbsFile ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs animate-fade-in">
                  <div className="flex items-center gap-2 truncate">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800 truncate">{wbsFile.name}</span>
                  </div>
                  <button type="button" onClick={handleRemoveFile} className="text-rose-600 p-1 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      setWbsFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                    isDragging ? "border-emerald-500 bg-emerald-50/60" : "border-slate-300 hover:border-emerald-500 bg-slate-50"
                  }`}
                >
                  <Upload className="w-5 h-5 text-emerald-700" />
                  <span className="font-bold text-slate-700 text-xs">فایل اکسل WBS را اینجا رها کنید یا کلیک کنید</span>
                  <span className="text-[10px] text-slate-400 font-sans">فقط فرمت‌های xlsx و xls</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 text-white py-2.5 rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-400 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>ثبت و ایجاد پروژه</span>
            </button>
          </form>
        </div>

        {/* 📊 لیست پروژه‌ها */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
            <span>لیست پروژه‌های سازمان</span>
            <span className="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px]">
              {toPersianDigits(projects.length)} پروژه
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-slate-400">هیچ پروژه‌ای ثبت نشده است.</div>
            ) : (
              projects.map((proj, idx) => (
                <div key={proj.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center font-sans shrink-0">
                        {proj.order_index || idx + 1}
                      </span>
                      <h4 className={`font-bold text-sm ${proj.is_active ? "text-slate-900" : "text-slate-400 line-through"}`}>
                        {proj.title}
                      </h4>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 font-bold">
                        {toPersianDigits(proj.code)}
                      </span>
                      {proj.is_active ? (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          فعال
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-full">
                          غیرفعال
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-[11px] line-clamp-1">{proj.description}</p>
                    {proj.wbs_file_name && (
                      <a
                        href={`/api/projects/${proj.id}/wbs-file`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-700 hover:text-emerald-800 font-bold bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-100 transition-colors"
                        title="دانلود فایل اکسل WBS"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> فایل WBS: {proj.wbs_file_name}
                      </a>
                    )}
                  </div>

                  {/* کنترل‌های رتبه‌بندی، وضعیت، ویرایش و حذف پروژه */}
                  <div className="flex items-center gap-2 shrink-0 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">

                    {/* فیلد وارد کردن عدد ترتیب خروجی */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-600 font-bold px-1.5" title="ترتیب این پروژه در خروجی PDF">
                      <span className="hidden sm:inline">ترتیب:</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        defaultValue={proj.order_index || idx + 1}
                        key={`${proj.id}-${proj.order_index}`}
                        onBlur={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) handleSetOrderIndex(proj.id, val);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const val = parseInt((e.target as HTMLInputElement).value);
                            if (!isNaN(val)) handleSetOrderIndex(proj.id, val);
                          }
                        }}
                        className="w-10 h-7 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-sans shadow-2xs"
                      />
                    </div>

                    {/* دکمه‌های بالا و پایین برای جابجایی سریع */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveProject(idx, "up")}
                        disabled={idx === 0}
                        className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-white rounded transition-colors disabled:opacity-20 cursor-pointer"
                        title="انتقال به ردیف بالا در خروجی"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveProject(idx, "down")}
                        disabled={idx === projects.length - 1}
                        className="p-1 text-slate-600 hover:text-emerald-700 hover:bg-white rounded transition-colors disabled:opacity-20 cursor-pointer"
                        title="انتقال به ردیف پایین در خروجی"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="w-[1px] h-6 bg-slate-300 mx-0.5"></div>

                    {/* دکمه فعال/غیرفعال‌سازی سریع */}
                    <button
                      type="button"
                      onClick={() => handleToggleProjectStatus(proj)}
                      className={`p-2 rounded-xl transition-colors cursor-pointer border border-slate-200/60 ${
                        proj.is_active
                          ? "text-emerald-600 bg-white hover:bg-emerald-50"
                          : "text-slate-400 bg-white hover:bg-slate-100"
                      }`}
                      title={proj.is_active ? "غیرفعال‌سازی پروژه" : "فعال‌سازی مجدد پروژه"}
                    >
                      {proj.is_active ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* دکمه ویرایش */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(proj)}
                      className="p-2 text-blue-600 bg-white hover:bg-blue-50 rounded-xl transition-colors cursor-pointer border border-slate-200/60"
                      title="ویرایش مشخصات پروژه"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* دکمه غیرفعال‌سازی */}
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(proj.id)}
                      className="p-2 text-rose-600 bg-white hover:bg-rose-50 rounded-xl transition-colors cursor-pointer border border-slate-200/60"
                      title="غیرفعال‌سازی پروژه"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* ✏️ مودال ویرایش پروژه (با امکان مدیریت فایل WBS و وضعیت فعال بودن) */}
      {editingProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">ویرایش اطلاعات و فایل WBS پروژه</h3>
              <button type="button" onClick={() => setEditingProject(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProject} className="space-y-4">
              <div>
                <label className="block text-slate-600 font-bold mb-1">کد پروژه:</label>
                <input
                  type="text"
                  required
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">عنوان پروژه:</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-bold mb-1">شرح پروژه:</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                ></textarea>
              </div>

              <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="edit-is-active" className="text-slate-700 font-bold text-xs cursor-pointer">
                  پروژه فعال است (پروژه‌های غیرفعال در لیست گزارش‌دهی پرسنل نمایش داده نمی‌شوند)
                </label>
              </div>

              {/* 📂 مدیریت و ویرایش فایل WBS در مودال */}
              <div>
                <label className="block text-slate-600 font-bold mb-1">مدیریت فایل WBS (اکسل):</label>

                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={handleEditFileChange}
                  accept=".xlsx, .xls"
                  className="hidden"
                />

                {/* ۱. اگر فایل جدیدی انتخاب شده باشد */}
                {editWbsFile ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate">فایل جدید: {editWbsFile.name}</span>
                    </div>
                    <button type="button" onClick={handleRemoveEditFile} className="text-rose-600 p-1 hover:bg-rose-100 rounded-lg cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : editingProject.wbs_file_name && !removeEditWbsFile ? (
                  /* ۲. اگر فایل قبلی وجود دارد و هنوز حذف نشده است */
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <a
                        href={`/api/projects/${editingProject.id}/wbs-file`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 transition-colors"
                        title="دانلود فایل اکسل WBS"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        فایل فعلی: {editingProject.wbs_file_name}
                      </a>
                      <button
                        type="button"
                        onClick={() => setRemoveEditWbsFile(true)}
                        className="text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold border border-rose-200 text-[11px] cursor-pointer"
                      >
                        حذف فایل فعلی
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full text-center py-1.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl text-slate-600 font-medium text-[11px] cursor-pointer"
                    >
                      جایگزینی با فایل جدید...
                    </button>
                  </div>
                ) : (
                  /* ۳. اگر فایلی وجود ندارد یا حذف شده است -> نمایش کادر Drag & Drop */
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsEditDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsEditDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsEditDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        setEditWbsFile(e.dataTransfer.files[0]);
                        setRemoveEditWbsFile(false);
                      }
                    }}
                    onClick={() => editFileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${
                      isEditDragging ? "border-emerald-500 bg-emerald-50/60" : "border-slate-300 hover:border-emerald-500 bg-slate-50"
                    }`}
                  >
                    <Upload className="w-5 h-5 text-emerald-700" />
                    <span className="font-bold text-slate-700 text-xs">فایل جدید WBS را اینجا رها کنید یا کلیک کنید</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-bold hover:bg-slate-800 disabled:bg-slate-400 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
                  <span>ذخیره تغییرات</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold cursor-pointer hover:bg-slate-200"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📄 رندر مودال خروجی PDF جامع تمام گزارش‌ها با قابلیت تنظیم ترتیب چینش */}
      <ReportsPdfDocument
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        projects={projects}
      />

    </div>
  );
}