import { useState, useEffect } from "react";
import { TrendingUp, Target, Layers } from "lucide-react";
import ProjectKpiAnalytics from "./ProjectKpiAnalytics";
import ProjectKpiManagement from "./ProjectKpiManagement";
import CompositeKpiManagement from "./CompositeKpiManagement";
import { Project, User } from "../types";

interface ProjectKpiHubProps {
  projects: Project[];
  onRefresh: () => void;
  currentUser?: User | null;
  initialTab?: "analytics" | "composite" | "management";
}

export default function ProjectKpiHub({
  projects = [],
  onRefresh,
  currentUser,
  initialTab = "analytics",
}: ProjectKpiHubProps) {
  const isManager = currentUser?.role === "manager";
  const [activeTab, setActiveTab] = useState<"analytics" | "composite" | "management">(initialTab);

  useEffect(() => {
    if (activeTab === "composite" && !isManager) {
      setActiveTab("analytics");
    }
  }, [activeTab, isManager]);

  return (
    <div className="space-y-6 animate-fade-in font-sans dir-rtl text-right">
      {/* هدر یکپارچه و سوئیچر زبانه‌های بالای صفحه */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-700" />
            <span>شاخص‌های کلیدی عملکرد (KPI)</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            پایش و تحلیل نمودار روند شاخص‌ها، تعریف مقادیر هدف و ساخت شاخص‌های ترکیبی مدیریتی
          </p>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab("analytics")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "analytics"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>پایش شاخص‌های پروژه</span>
          </button>

          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab("composite")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "composite"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>شاخص‌های ترکیبی مدیریتی</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab("management")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "management"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Target className="w-4 h-4 text-emerald-600" />
            <span>تعریف و مدیریت شاخص‌ها</span>
          </button>
        </div>
      </div>

      {/* محتوای زبانه فعال */}
      {activeTab === "analytics" && <ProjectKpiAnalytics projects={projects} />}
      {activeTab === "composite" && isManager && <CompositeKpiManagement />}
      {activeTab === "management" && <ProjectKpiManagement projects={projects} onRefresh={onRefresh} />}
    </div>
  );
}
