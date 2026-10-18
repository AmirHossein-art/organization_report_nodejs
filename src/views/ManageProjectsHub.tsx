import { useState } from "react";
import { Folder, Users, Network, BrainCircuit } from "lucide-react";
import ManageProjects from "./ManageProjects";
import ProjectAllocations from "./ProjectAllocations";
import WbsViewer from "./WbsViewer";
import StrategicNetworkExplorer from "./StrategicNetworkExplorer";
import { Project, User } from "../types";

interface ManageProjectsHubProps {
  projects: Project[];
  users: User[];
  onRefresh: () => void;
  initialTab?: "projects" | "allocations" | "wbs" | "strategic_graph";
}

export default function ManageProjectsHub({
  projects = [],
  users = [],
  onRefresh,
  initialTab = "projects",
}: ManageProjectsHubProps) {
  const [activeTab, setActiveTab] = useState<"projects" | "allocations" | "wbs" | "strategic_graph">(initialTab);

  return (
    <div className="space-y-6 animate-fade-in font-sans dir-rtl text-right">
      {/* هدر یکپارچه و سوئیچر زبانه‌های بالای صفحه */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Folder className="w-6 h-6 text-emerald-700" />
            <span>مدیریت پروژه‌ها</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            تعریف پروژه‌ها، تنظیم اولویت و ترتیب نمایش، تخصیص مسئولین و مدیریت ساختار شکست کار (WBS)
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto flex-wrap">
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
          <button
            type="button"
            onClick={() => setActiveTab("wbs")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "wbs"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Network className="w-4 h-4 text-emerald-600" />
            <span>مدیریت و نمایش WBS</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("strategic_graph")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "strategic_graph"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <BrainCircuit className="w-4 h-4 text-emerald-600" />
            <span>شبکه معنایی استراتژیک (گراف هوشمند)</span>
          </button>
        </div>
      </div>

      {/* محتوای زبانه فعال */}
      {activeTab === "projects" && (
        <ManageProjects
          projects={projects}
          users={users}
          onRefresh={onRefresh}
          onNavigateToAllocations={() => setActiveTab("allocations")}
        />
      )}
      {activeTab === "allocations" && (
        <ProjectAllocations users={users} projects={projects.filter((p) => p.is_active !== false)} />
      )}
      {activeTab === "wbs" && (
        <WbsViewer projects={projects.filter((p) => p.is_active !== false)} onRefresh={onRefresh} />
      )}
      {activeTab === "strategic_graph" && (
        <StrategicNetworkExplorer projects={projects.filter((p) => p.is_active !== false)} />
      )}
    </div>
  );
}
