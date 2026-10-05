import { useState } from "react";
import { Folder, Users } from "lucide-react";
import ManageProjects from "./ManageProjects";
import ProjectAllocations from "./ProjectAllocations";
import { Project, User } from "../types";

interface ManageProjectsHubProps {
  projects: Project[];
  users: User[];
  onRefresh: () => void;
  initialTab?: "projects" | "allocations";
}

export default function ManageProjectsHub({
  projects = [],
  users = [],
  onRefresh,
  initialTab = "projects",
}: ManageProjectsHubProps) {
  const [activeTab, setActiveTab] = useState<"projects" | "allocations">(initialTab);

  return (
    <div className="space-y-6 animate-fade-in font-sans dir-rtl text-right">
      {/* هدر یکپارچه و سوئیچر زبانه‌های بالای صفحه */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Folder className="w-6 h-6 text-emerald-700" />
            <span>مدیریت و تخصیص پروژه‌ها</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            تعریف پروژه‌ها، تنظیم اولویت و ترتیب نمایش، آپلود WBS و تخصیص حوزه نظارت مسئولین
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("projects")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "projects"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Folder className="w-4 h-4 text-emerald-600" />
            <span>لیست و مدیریت پروژه‌ها</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("allocations")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "allocations"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span>تخصیص پروژه به مسئولین</span>
          </button>
        </div>
      </div>

      {/* محتوای زبانه فعال */}
      {activeTab === "projects" ? (
        <ManageProjects
          projects={projects}
          users={users}
          onRefresh={onRefresh}
          onNavigateToAllocations={() => setActiveTab("allocations")}
        />
      ) : (
        <ProjectAllocations users={users} projects={projects.filter((p) => p.is_active !== false)} />
      )}
    </div>
  );
}
