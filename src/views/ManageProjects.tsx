// src/views/ManageProjects.tsx
import React, { useState, useRef } from "react";
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Upload, 
  X, 
  FileSpreadsheet, 
  FolderKanban, 
  RefreshCw 
} from "lucide-react";
import { Project } from "../types";

import ProjectNextActionsDrawer, { NextActionItem } from "../components/ProjectNextActionsDrawer";

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
  const [editWbsFile, setEditWbsFile] = useState<File | null>(null);
  const [removeEditWbsFile, setRemoveEditWbsFile] = useState(false);
  const [isEditDragging, setIsEditDragging] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedProjectForDrawer, setSelectedProjectForDrawer] = useState<Project | null>(null);

  // 🟢 استیت و توابع جدید برای دریافت و تغییر وضعیت اقدامات آتی
  const [nextActions, setNextActions] = useState<NextActionItem[]>([]);

  const fetchNextActions = async () => {
    try {
      const res = await fetch("/api/next-actions");
      if (res.ok) setNextActions(await res.json());
    } catch (err) {
      console.error("Error fetching next actions:", err);
    }
  };

  React.useEffect(() => {
    fetchNextActions();
  }, []);

  const handleToggleActionStatus = async (actionId: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/next-actions/${actionId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: !currentStatus }),
      });
      if (res.ok) fetchNextActions();
    } catch (err) {
      alert("خطا در به‌روزرسانی وضعیت اقدام.");
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

  // 🗑️ حذف کامل پروژه
  const handleDeleteProject = async (id: number) => {
    if (!confirm("آیا از حذف این پروژه اطمینان دارید؟")) return;
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

      if (editWbsFile) {
        formData.append("wbs_file", editWbsFile);
      } else if (removeEditWbsFile) {
        // 🟢 ارسال صریح سیگنال حذف به بک‌اند
        formData.append("remove_wbs_file", "true");
      }

      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        setEditingProject(null);
        if (onRefresh) onRefresh(); // 🔄 فراخوانی لود مجدد لیست پروژه‌ها از سرور
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
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
          <FolderKanban className="w-6 h-6 text-emerald-700" />
          <span>مدیریت پروژه‌ها و سندهای WBS</span>
        </h1>
        <p className="text-slate-500 text-xs mt-1">
          تعریف پروژه‌های جدید، بارگذاری ساختار شکست کار (WBS) و ویرایش فایل‌های مربوطه.
        </p>
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
                placeholder="عنوان کامل پروژه را وارد کنید"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-bold mb-1">شرح و اهداف پروژه:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="توضیحات مختصر..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
              ></textarea>
            </div>

            {/* Drag and Drop فایل WBS */}
            <div>
              <label className="block text-slate-600 font-bold mb-1">فایل ساختار شکست (WBS Excel):</label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />

              {!wbsFile ? (
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
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800 truncate">{wbsFile.name}</span>
                  </div>
                  <button type="button" onClick={handleRemoveFile} className="text-rose-600 p-1 hover:bg-rose-100 rounded-lg cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-2.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-md"
            >
              {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>ثبت پروژه جدید</span>
            </button>
          </form>
        </div>

        {/* 📊 لیست پروژه‌ها */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
            <span>لیست پروژه‌های فعال سازمان</span>
            <span className="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full text-[11px]">
              {toPersianDigits(projects.length)} پروژه
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {projects.length === 0 ? (
              <div className="p-8 text-center text-slate-400">هیچ پروژه‌ای ثبت نشده است.</div>
            ) : (
              projects.map((proj) => (
                <div key={proj.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">{proj.title}</h4>
                      <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 font-bold">
                        {toPersianDigits(proj.code)}
                      </span>
                    </div>
                    <p className="text-slate-500 text-[11px] line-clamp-1">{proj.description}</p>
                    {proj.wbs_file_name && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> فایل WBS: {proj.wbs_file_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleOpenEditModal(proj)}
                      className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                      title="ویرایش پروژه"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteProject(proj.id)}
                      className="p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                      title="حذف پروژه"
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

      {/* ✏️ مودال ویرایش پروژه (با امکان مدیریت فایل WBS) */}
      {editingProject && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">ویرایش اطلاعات و فایل WBS پروژه</h3>
              <button onClick={() => setEditingProject(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        فایل فعلی: {editingProject.wbs_file_name}
                      </span>
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

    </div>
  );
}