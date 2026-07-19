// src/views/ProjectAllocations.tsx
import { useState, useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { User, Project } from "../types";
import { CustomSelect } from ".././components";

interface ProjectAllocationsProps {
  users: User[];
  projects: Project[];
}

export default function ProjectAllocations({ users, projects }: ProjectAllocationsProps) {
  const [allocUserId, setAllocUserId] = useState<number>(0);
  const [allocUserProjects, setAllocUserProjects] = useState<number[]>([]);

  useEffect(() => {
    if (allocUserId !== 0) {
      fetch("/api/user-projects")
        .then((r) => r.json())
        .then((allocations: any[]) => {
          const userProjIds = allocations
            .filter((a) => a.user_id === allocUserId)
            .map((a) => a.project_id);
          setAllocUserProjects(userProjIds);
        });
    } else {
      setAllocUserProjects([]);
    }
  }, [allocUserId]);

  const handleSaveAllocations = async () => {
    if (allocUserId === 0) return;
    try {
      const res = await fetch("/api/user-projects/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: allocUserId, project_ids: allocUserProjects }),
      });
      if (res.ok) alert("تخصیص پروژه‌ها با موفقیت به روزرسانی شد.");
    } catch (err) { console.error(err); }
  };

  const handleToggleAllocation = (id: number) => {
    if (allocUserProjects.includes(id)) {
      setAllocUserProjects(allocUserProjects.filter(pId => pId !== id));
    } else {
      setAllocUserProjects([...allocUserProjects, id]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">📌 ماتریس تخصیص پروژه‌ها به کارشناسان</h1>
        <p className="text-slate-500 text-xs mt-1">مجاز کردن پرسنل فنی به منظور دسترسی به ثبت عملکرد در قالب ساختار دیتابیس زنده.</p>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-200/70 shadow-2xs space-y-6">
        <div className="w-full md:w-72">
          <label className="block text-slate-700 font-bold mb-1.5">انتخاب کارشناس فنی</label>
          <CustomSelect value={allocUserId} onChange={(v) => setAllocUserId(Number(v))} options={[{ value: 0, label: "-- یک مورد را انتخاب کنید --" }, ...users.filter(u => u.role === "user").map(u => ({ value: u.id, label: u.full_name }))]} />
        </div>

        {allocUserId !== 0 ? (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900">لیست پروژه‌های فعال سازمان:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.filter(p => p.is_active).map((proj) => {
                const isAllocated = allocUserProjects.includes(proj.id);
                return (
                  <div key={proj.id} onClick={() => handleToggleAllocation(proj.id)} className={`p-4 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${isAllocated ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"}`}>
                    <div>
                      <div className="font-bold">{proj.title}</div>
                      <div className={`text-[10px] mt-0.5 ${isAllocated ? "text-slate-300" : "text-slate-400"}`}>کد پروژه: {proj.code}</div>
                    </div>
                    <input type="checkbox" checked={isAllocated} readOnly className="rounded" />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button onClick={handleSaveAllocations} className="bg-slate-900 text-white px-6 py-2 rounded-xl flex items-center gap-1 font-bold hover:bg-slate-800 transition-all"><CheckCircle2 className="w-4 h-4" /> ذخیره دسترسی‌ها</button>
            </div>
          </div>
        ) : (
          <div className="text-center p-8 border border-dashed border-slate-200 rounded-xl text-slate-400">لطفاً ابتدا کارشناس مورد نظر را مشخص نمایید.</div>
        )}
      </div>
    </div>
  );
}