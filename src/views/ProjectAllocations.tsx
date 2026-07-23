// src/views/ProjectAllocations.tsx
import { useState, useEffect } from "react";
import { User, Project } from "../types";
import { 
  FolderGit2, 
  UserCheck, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  ShieldAlert 
} from "lucide-react";

// تابع کمکی تبدیل اعداد به فارسی
const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

interface ProjectAllocationsProps {
  users: User[];
  projects: Project[];
}

export default function ProjectAllocations({ users = [], projects = [] }: ProjectAllocationsProps) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userProjectsMap, setUserProjectsMap] = useState<Record<number, number[]>>({});
  const [loadingAllocations, setLoadingAllocations] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");

  // 🟢 دریافت تمامی تخصیص‌های دیتابیس با فیلدهای صحیح user_id و project_id
  const fetchAllocations = async () => {
    setLoadingAllocations(true);
    try {
      const res = await fetch("/api/user-projects");
      if (res.ok) {
        const data: Array<{ user_id: number; project_id: number }> = await res.json();
        const map: Record<number, number[]> = {};
        
        data.forEach((item) => {
          if (!map[item.user_id]) map[item.user_id] = [];
          // جلوگیری از ثبت تکراری در نقشه فرانت‌اَند
          if (!map[item.user_id].includes(item.project_id)) {
            map[item.user_id].push(item.project_id);
          }
        });

        setUserProjectsMap(map);
      }
    } catch (err) {
      console.error("Error loading allocations:", err);
    } finally {
      setLoadingAllocations(false);
    }
  };

  useEffect(() => {
    fetchAllocations();
  }, []);

  // انتخاب اولین کاربر به صورت پیش‌فرض
  useEffect(() => {
    if (users.length > 0 && selectedUserId === null) {
      setSelectedUserId(users[0].id);
    }
  }, [users]);

  const activeUser = users.find((u) => u.id === selectedUserId);
  const currentAllocatedProjectIds = selectedUserId ? (userProjectsMap[selectedUserId] || []) : [];

  // تغییر وضعیت تخصیص پروژه با کلیک روی کادر
  const handleToggleProject = (projectId: number) => {
    if (!selectedUserId) return;

    setUserProjectsMap((prev) => {
      const userProjects = prev[selectedUserId] || [];
      const isAllocated = userProjects.includes(projectId);

      const updated = isAllocated
        ? userProjects.filter((id) => id !== projectId)
        : Array.from(new Set([...userProjects, projectId])); // یکتا کردن لیست

      return { ...prev, [selectedUserId]: updated };
    });
  };

  // 💾 ذخیره نهایی تخصیص‌ها
  const handleSaveAllocations = async () => {
    if (!selectedUserId) return;

    setIsSaving(true);
    setSuccessMessage("");
    try {
      const res = await fetch(`/api/users/${selectedUserId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectIds: currentAllocatedProjectIds }),
      });

      if (res.ok) {
        setSuccessMessage(`سطح دسترسی پروژه‌ای ${activeUser?.full_name} با موفقیت ذخیره شد.`);
        // 🟢 دریافت مجدد اطلاعات از سرور برای اطمینان از سینک بودن داده‌های UI
        await fetchAllocations();
        setTimeout(() => setSuccessMessage(""), 4000);
      } else {
        const data = await res.json();
        alert(data.error || "خطا در ذخیره‌سازی تخصیص‌ها.");
      }
    } catch (err) {
      alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">
      
      {/* هدر صفحه */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
          <FolderGit2 className="w-6 h-6 text-emerald-700" />
          <span>تخصیص پروژه‌ها به مدیران و مسئولین</span>
        </h1>
        <p className="text-slate-500 text-xs mt-1">
          تعیین حوزه نظارت و گزارش‌دهی؛ هر مسئول صرفاً به پروژه‌های اختصاص‌یافته به خود دسترسی خواهد داشت.
        </p>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* ۱. ستون سمت راست: لیست مدیران و مسئولین */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-4 shadow-2xs space-y-3 h-fit">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 text-xs flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>انتخاب مسئول مربوطه</span>
          </h3>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pl-1">
            {users.map((usr) => {
              const allocatedCount = (userProjectsMap[usr.id] || []).length;
              const isSelected = usr.id === selectedUserId;

              return (
                <button
                  key={usr.id}
                  onClick={() => setSelectedUserId(usr.id)}
                  className={`w-full p-3 rounded-2xl text-right transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-md"
                      : "bg-slate-50 hover:bg-slate-100/80 text-slate-800"
                  }`}
                >
                  <div>
                    <span className="font-bold block text-xs">{usr.full_name}</span>
                    <span className={`text-[10px] block mt-0.5 ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                      {usr.job_title || (usr.role === "manager" ? "مدیر سیستم" : "مسئول واحد")}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isSelected 
                      ? "bg-emerald-500 text-slate-950" 
                      : "bg-slate-200 text-slate-700"
                  }`}>
                    {toPersianDigits(allocatedCount)} پروژه
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ۲. ستون سمت چپ: کارت‌های قابل کلیک پروژه‌ها */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
          
          {activeUser ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    پروژه‌های تحت نظارت: <span className="text-emerald-700">{activeUser.full_name}</span>
                    {activeUser.job_title && <span className="text-slate-400 text-xs font-normal"> ({activeUser.job_title})</span>}
                  </h3>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    جهت فعال یا غیرفعال‌سازی دسترسی، روی هر نقطه از کادر پروژه کلیک کنید.
                  </p>
                </div>

                <button
                  onClick={handleSaveAllocations}
                  disabled={isSaving || loadingAllocations}
                  className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white font-bold px-5 py-2.5 rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-md shrink-0"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>ذخیره تغییرات دسترسی</span>
                </button>
              </div>

              {/* لیست کارت پروژه‌ها */}
              {loadingAllocations ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                  <span>در حال دریافت ماتریس دسترسی‌ها...</span>
                </div>
              ) : projects.length === 0 ? (
                <div className="py-12 text-center text-slate-400">هیچ پروژه‌ای در سیستم تعریف نشده است.</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {projects.map((proj) => {
                    const isChecked = currentAllocatedProjectIds.includes(proj.id);

                    return (
                      <div
                        key={proj.id}
                        onClick={() => handleToggleProject(proj.id)}
                        className={`p-4 rounded-2xl border transition-all flex items-start gap-3 cursor-pointer select-none ${
                          isChecked
                            ? "bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-2xs ring-1 ring-emerald-300"
                            : "bg-slate-50/60 border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-100/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer pointer-events-none shrink-0"
                        />
                        <div className="space-y-1">
                          <span className="font-bold block text-xs text-slate-900">{proj.title}</span>
                          <span className="text-[10px] text-slate-400 block font-sans">
                            کد شناسایی: {toPersianDigits(proj.code)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
              <ShieldAlert className="w-8 h-8 text-slate-300" />
              <span>لطفاً یکی از مسئولین را از لیست سمت راست انتخاب کنید.</span>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}