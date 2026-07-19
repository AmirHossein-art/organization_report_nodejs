// src/views/ManageProjects.tsx
import { useState } from "react";
import { Plus, Folder, Trash2, Edit2, X, CheckCircle2 } from "lucide-react";
import { Project } from "../types";
import { toPersianDigits } from "../dateUtils";

interface ManageProjectsProps {
  projects: Project[];
  onRefresh: () => void;
}

export default function ManageProjects({ projects, onRefresh }: ManageProjectsProps) {
  const [newProjCode, setNewProjCode] = useState("");
  const [newProjTitle, setNewProjTitle] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjTitle, setEditProjTitle] = useState("");
  const [editProjDesc, setEditProjDesc] = useState("");
  const [editProjCode, setEditProjCode] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newProjCode, title: newProjTitle, description: newProjDesc }),
      });
      if (res.ok) {
        setNewProjCode("");
        setNewProjTitle("");
        setNewProjDesc("");
        onRefresh();
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleActive = async (proj: Project) => {
    try {
      await fetch(`/api/projects/${proj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !proj.is_active }),
      });
      onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف این پروژه اطمینان دارید؟ تمامی گزارش‌های متصل به آن حذف خواهند شد.")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editProjTitle, description: editProjDesc, code: editProjCode }),
      });
      if (res.ok) {
        setEditingProject(null);
        onRefresh();
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">📂 مدیریت و پایش پروژه‌ها</h1>
        <p className="text-slate-500 text-xs mt-1">تعریف پروژه‌های کلان، بروزرسانی کد شناسایی و کنترل سطح دسترسی پرسنل.</p>
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
              <input type="text" required value={newProjCode} onChange={(e) => setNewProjCode(e.target.value)} placeholder="مثال: PRJ-TRAFFIC-201" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none" />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">عنوان کامل پروژه</label>
              <input type="text" required value={newProjTitle} onChange={(e) => setNewProjTitle(e.target.value)} placeholder="مثال: هوشمندسازی تقاطعات" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="block text-slate-600 font-semibold mb-1">توضیحات اهداف</label>
              <textarea value={newProjDesc} onChange={(e) => setNewProjDesc(e.target.value)} rows={3} placeholder="شرح اهداف کلان..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none" />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-xl font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" /> ثبت نهایی پروژه
            </button>
          </form>
        </div>

        {/* لیست پروژه‌ها */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200/70 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {projects.map((proj) => (
              <div key={proj.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                <div className="space-y-1 max-w-[65%]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{proj.title}</span>
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-500 font-mono font-bold">{toPersianDigits(proj.code)}</code>
                  </div>
                  <p className="text-slate-400 leading-relaxed">{proj.description || "بدون توضیحات تکمیلی."}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleActive(proj)} className={`px-2.5 py-1 rounded-xl font-bold transition-all ${proj.is_active ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-green-600 bg-green-50 hover:bg-green-100"}`}>
                    {proj.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                  </button>
                  <button onClick={() => { setEditingProject(proj); setEditProjTitle(proj.title); setEditProjCode(proj.code); setEditProjDesc(proj.description || ""); }} className="text-blue-600 bg-blue-50 p-1.5 rounded-xl hover:bg-blue-100"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(proj.id)} className="text-red-600 bg-red-50 p-1.5 rounded-xl hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* مودال ویرایش اطلاعات پروژه */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">ویرایش اطلاعات پروژه</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <input type="text" required value={editProjCode} onChange={(e) => setEditProjCode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none" />
              <input type="text" required value={editProjTitle} onChange={(e) => setEditProjTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
              <textarea value={editProjDesc} onChange={(e) => setEditProjDesc(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none" />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-slate-900 text-white py-2 rounded-xl hover:bg-slate-800 transition-all font-semibold">ذخیره</button>
                <button type="button" onClick={() => setEditingProject(null)} className="flex-1 bg-slate-100 py-2 rounded-xl font-semibold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}