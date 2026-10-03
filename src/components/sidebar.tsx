// src/components/Sidebar.tsx
import { useState } from "react";
import {
  Folder,
  ClipboardList,
  FileText,
  BarChart3,
  Users,
  Calendar,
  LogOut,
  Menu,
  Target,
  ChevronRight,
  ChevronLeft,
  FolderGit2,
} from "lucide-react";
import { User } from "../types";

interface SidebarProps {
  user: User;
  currentView: string;
  setCurrentView: (view: string) => void;
  onLogout: () => void;
}

export default function Sidebar({ user, currentView, setCurrentView, onLogout }: SidebarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("report_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("report_sidebar_collapsed", String(next));
      } catch (_) {}
      return next;
    });
  };

  // کمکی برای تشخیص فعال بودن تب‌های ادغام‌شده
  const isCalendarActive = currentView === "report_periods" || currentView === "deadline_settings";
  const isKpiActive =
    currentView === "project_kpis" ||
    currentView === "project_kpi_management" ||
    currentView === "project_kpi_analytics";

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="لوگوی سازمان" className="h-9 w-9 object-contain inline-block" />
          <span className="font-bold text-base">پیگیری استراتژیک سازمانی</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white"
          aria-label="منوی موبایل"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Sidebar Navigation - Fixed/Sticky & Collapsible */}
      <aside
        className={`${
          mobileMenuOpen ? "block fixed inset-0 z-50 overflow-y-auto" : "hidden"
        } md:flex md:sticky md:top-0 md:h-screen md:overflow-hidden bg-slate-900 text-slate-300 flex-col border-l border-slate-800 flex-shrink-0 z-30 transition-[width] duration-300 ease-in-out ${
          isCollapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        {/* Desktop Sidebar Header with Collapse Toggle */}
        <div className="p-4 hidden md:flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img src="/logo.png" alt="لوگوی سازمان" className="h-10 w-10 object-contain shrink-0" />
            {!isCollapsed && (
              <div className="overflow-hidden">
                <h1 className="font-bold text-white text-sm truncate">پیگیری استراتژیک</h1>
                <p className="text-[10px] text-slate-400 truncate">پورتال خدمات هوشمند</p>
              </div>
            )}
          </div>

          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? "باز کردن سایدبار" : "جمع کردن سایدبار"}
          >
            {isCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* User Info Badge */}
        <div className={`bg-slate-950/90 border-b border-slate-800 shrink-0 ${isCollapsed ? "p-3 flex justify-center" : "p-3.5 flex items-center gap-3"}`}>
          <div
            className="w-9 h-9 bg-emerald-950 text-emerald-300 border border-emerald-700/60 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
            title={`${user.full_name} (${user.role === "manager" ? "مدیر سیستم" : "کاربر عادی"})`}
          >
            {user.full_name.charAt(0)}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <h4 className="font-semibold text-white text-xs truncate">{user.full_name}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                نقش: {user.role === "manager" ? "مدیر سیستم" : "کاربر عادی"}
              </p>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto overflow-x-hidden">
          {/* Public Views */}
          <button
            onClick={() => {
              setCurrentView("home");
              setMobileMenuOpen(false);
            }}
            title="پیشخوان کاربری"
            className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              currentView === "home" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <Folder className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>پیشخوان کاربری</span>}
          </button>

          <button
            onClick={() => {
              setCurrentView("submit_report");
              setMobileMenuOpen(false);
            }}
            title="ثبت گزارش عملکرد"
            className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              currentView === "submit_report" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>ثبت گزارش عملکرد</span>}
          </button>

          <button
            onClick={() => {
              setCurrentView("my_reports");
              setMobileMenuOpen(false);
            }}
            title="گزارش‌های من"
            className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              currentView === "my_reports" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>گزارش‌های من</span>}
          </button>

          {/* Manager-only Views */}
          {user.role === "manager" && (
            <>
              {isCollapsed ? (
                <div className="border-t border-slate-800 my-2" />
              ) : (
                <div className="pt-3 pb-1.5 px-3 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-t border-slate-800 mt-2">
                  بخش مدیریت سازمان
                </div>
              )}

              <button
                onClick={() => {
                  setCurrentView("manager_dashboard");
                  setMobileMenuOpen(false);
                }}
                title="داشبورد نظارتی مدیر"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  currentView === "manager_dashboard" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <BarChart3 className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>داشبورد نظارتی مدیر</span>}
              </button>

              <button
                onClick={() => {
                  setCurrentView("manage_projects");
                  setMobileMenuOpen(false);
                }}
                title="مدیریت پروژه‌ها"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  currentView === "manage_projects" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Folder className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>مدیریت پروژه‌ها</span>}
              </button>

              <button
                onClick={() => {
                  setCurrentView("project_allocations");
                  setMobileMenuOpen(false);
                }}
                title="تخصیص پروژه به پرسنل"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  currentView === "project_allocations" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <FolderGit2 className="w-4 h-4 shrink-0 text-emerald-400" />
                {!isCollapsed && <span>تخصیص پروژه به پرسنل</span>}
              </button>

              {/* هاب تقویم و مهلت‌های گزارش‌دهی (ادغام دوره‌ها و تنظیمات ددلاین) */}
              <button
                onClick={() => {
                  setCurrentView("report_periods");
                  setMobileMenuOpen(false);
                }}
                title="تقویم و مهلت‌های گزارش‌دهی"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isCalendarActive ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>تقویم و مهلت‌های گزارش‌دهی</span>}
              </button>

              {/* هاب شاخص‌های عملکرد (KPI) (ادغام پایش و تعریف) */}
              <button
                onClick={() => {
                  setCurrentView("project_kpis");
                  setMobileMenuOpen(false);
                }}
                title="شاخص‌های کلیدی عملکرد (KPI)"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  isKpiActive ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Target className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>شاخص‌های عملکرد (KPI)</span>}
              </button>

              <button
                onClick={() => {
                  setCurrentView("manage_users");
                  setMobileMenuOpen(false);
                }}
                title="مدیریت کاربران"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  currentView === "manage_users" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                {!isCollapsed && <span>مدیریت کاربران</span>}
              </button>
            </>
          )}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className={`p-3 border-t border-slate-800 shrink-0 ${isCollapsed ? "flex justify-center" : ""}`}>
          <button
            onClick={onLogout}
            title="خروج از حساب"
            className={`flex items-center ${isCollapsed ? "justify-center p-2" : "w-full gap-3 px-3 py-2"} rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>خروج از حساب</span>}
          </button>
        </div>
      </aside>
    </>
  );
}