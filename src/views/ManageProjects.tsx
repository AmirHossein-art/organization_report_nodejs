// src/views/ManageProjects.tsx
import { useState } from "react";
import { Plus, Trash2, Edit2, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { Project } from "../types";
import { toPersianDigits } from "../dateUtils";

interface ManageProjectsProps {
  projects: Project[];
  onRefresh: () => void;
}

export default function ManageProjects({ projects, onRefresh }: ManageProjectsProps) {
  // استیت‌های فرم ساخت پروژه
  const [newProjCode, setNewProjCode] = useState("");
  const [newProjTitle, setNewProjTitle] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [newWbsFile, setNewWbsFile] = useState<File | null>(null);

  // استیت‌های مودال ویرایش پروژه
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjTitle, setEditProjTitle] = useState("");
  const [editProjDesc, setEditProjDesc] = useState("");
  const [editProjCode, setEditProjCode] = useState("");
  const [editWbsFile, setEditWbsFile] = useState<File | null>(null);

  // 🟢 تابع ساخت پروژه جدید با قابلیت ارسال فایل اکسل (FormData)
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("code", newProjCode);
      formData.append("title", newProjTitle);
      formData.append("description", newProjDesc);
      if (newWbsFile) {
        formData.append("wbs_file", newWbsFile); // 👈 اضافه کردن فایل اکسل WBS
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        // ⚠️ هنگام ارسال FormData نباید Header "Content-Type" ست شود! مرورگر خودش آن را می‌سازد.
        body: formData,
      });

      if (res.ok) {
        setNewProjCode("");
        setNewProjTitle("");
        setNewProjDesc("");
        setNewWbsFile(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در ثبت پروژه");
      }
    } catch (err) {
      console.error(err);
      alert("خطا در ارتباط با سرور");
    }
  };

  // 🟢 تابع ویرایش پروژه و آپدیت فایل WBS
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      const formData = new FormData();
      formData.append("code", editProjCode);
      formData.append("title", editProjTitle);
      formData.append("description", editProjDesc);
      if (editWbsFile) {
        formData.append("wbs_file", editWbsFile); // 👈 آپلود فایل جدید در صورت تغییر
      }

      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        setEditingProject(null);
        setEditWbsFile(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در بروزرسانی پروژه");
      }
    } catch (err) {
      console.error(err);
      alert("خطا در ارتباط با سرور");
    }
  };

  const handleToggleActive = async (proj: Project) => {
    try {
      await fetch(`/api/projects/${proj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !proj.is_active }),
      });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف این پروژه اطمینان دارید؟ تمامی گزارش‌های متصل به آن حذف خواهند شد.")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">📂 مدیریت و پایش پروژه‌ها</h1>
        <p className="text-slate-500 text-xs mt-1">
          تعریف پروژه‌های کلان، بارگذاری اسناد WBS مرجع و کنترل سطح دسترسی پرسنل.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* فرم ساخت پروژه */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/70 h-fit space-y-4 shadow-2xs">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-blue-600" /> ساخت پروژه جدید سازمان
          </h3>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">کد یونیک پروژه</label>
              <input
                type="text"
                required
                value={newProjCode}
                onChange={(e) => setNewProjCode(e.target.value)}
                placeholder="مثال: PRJ-TRAFFIC-201"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">عنوان کامل پروژه</label>
              <input
                type="text"
                required
                value={newProjTitle}
                onChange={(e) => setNewProjTitle(e.target.value)}
                placeholder="مثال: هوشمندسازی تقاطعات"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">توضیحات اهداف</label>
              <textarea
                value={newProjDesc}
                onChange={(e) => setNewProjDesc(e.target.value)}
                rows={2}
                placeholder="شرح اهداف کلان..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
              />
            </div>

            {/* 🌟 ورودی انتخاب فایل اکسل WBS مرجع */}
            <div>
              <label className="block text-slate-600 font-semibold mb-1">
                سند WBS پروژه (فایل اکسل)
              </label>
              <div className="border border-dashed border-slate-300 hover:border-amber-400 p-3 rounded-xl bg-slate-50 text-center transition-colors cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setNewWbsFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="new-wbs-input"
                />
                <label htmlFor="new-wbs-input" className="cursor-pointer block space-y-1">
                  <span className="text-amber-700 font-bold text-[11px] flex items-center justify-center gap-1">
                    <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                    {newWbsFile ? `📄 ${newWbsFile.name}` : "انتخاب فایل اکسل WBS"}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    شامل شیت‌های پروژه، فازها و شاخص‌ها
                  </span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 text-white py-2 rounded-xl font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> ثبت نهایی پروژه
            </button>
          </form>
        </div>

        {/* لیست پروژه‌ها */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/40 transition-colors"
              >
                <div className="space-y-1 max-w-[65%]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{proj.title}</span>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-mono font-bold">
                      {toPersianDigits(proj.code)}
                    </code>
                    {/* نشانگر داشتن فایل WBS */}
                    {(proj as any).wbs_file_name && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        سند WBS دارد
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 leading-relaxed">{proj.description || "بدون توضیحات تکمیلی."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(proj)}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                      proj.is_active
                        ? "text-red-600 bg-red-50 hover:bg-red-100"
                        : "text-green-600 bg-green-50 hover:bg-green-100"
                    }`}
                  >
                    {proj.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </button>
                  <button
                    onClick={() => {
                      setEditingProject(proj);
                      setEditProjTitle(proj.title);
                      setEditProjCode(proj.code);
                      setEditProjDesc(proj.description || "");
                      setEditWbsFile(null);
                    }}
                    className="text-blue-600 bg-blue-50 p-1.5 rounded-xl hover:bg-blue-100 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(proj.id)}
                    className="text-red-600 bg-red-50 p-1.5 rounded-xl hover:bg-red-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* مودال ویرایش اطلاعات و سند WBS پروژه */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
              ویرایش اطلاعات و سند پروژه
            </h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block text-slate-500 text-[11px] mb-1">کد پروژه</label>
                <input
                  type="text"
                  required
                  value={editProjCode}
                  onChange={(e) => setEditProjCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-500 text-[11px] mb-1">عنوان پروژه</label>
                <input
                  type="text"
                  required
                  value={editProjTitle}
                  onChange={(e) => setEditProjTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-slate-500 text-[11px] mb-1">توضیحات</label>
                <textarea
                  value={editProjDesc}
                  onChange={(e) => setEditProjDesc(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none"
                />
              </div>

              {/* ورودی آپدیت فایل WBS در مودال ویرایش */}
              <div>
                <label className="block text-slate-500 text-[11px] mb-1">
                  تغییر/بروزرسانی فایل اکسل WBS
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setEditWbsFile(e.target.files?.[0] || null)}
                  className="w-full text-[11px] text-slate-500 file:ml-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:bg-amber-50 file:text-amber-700 file:font-bold hover:file:bg-amber-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-slate-900 text-white py-2 rounded-xl hover:bg-slate-800 transition-all font-semibold cursor-pointer"
                >
                  ذخیره تغییرات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="flex-1 bg-slate-100 py-2 rounded-xl font-semibold cursor-pointer"
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