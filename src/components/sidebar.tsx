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
  X,
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
  const handleNavClick = (view: string) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const isCalendarActive = currentView === "report_periods" || currentView === "deadline_settings";
  const isKpiActive =
    currentView === "project_kpis" ||
    currentView === "project_kpi_management" ||
    currentView === "project_kpi_analytics";

  return (
    <>
      {/* ============================================================== */}
      {/* 📱 ۱. هدر بالای صفحه در گوشی موبایل (کاملاً مستقل و زیبا) */}
      {/* ============================================================== */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="لوگوی سازمان" className="h-10 w-10 object-contain shrink-0" />
          <div>
            <span className="font-extrabold text-sm block leading-tight">پیگیری استراتژیک سازمانی</span>
            <span className="text-[11px] text-slate-400 block font-normal">پورتال خدمات هوشمند</span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-200 hover:text-white"
          aria-label="باز کردن منو"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* منوی کشویی در موبایل (با دراور استاندارد و خوانا) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" dir="rtl">
          {/* پس‌زمینه تیره و مات */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* دراور موبایل */}
          <aside className="relative w-72 max-w-[85vw] bg-slate-900 text-slate-200 z-10 flex flex-col shadow-2xl border-l border-slate-800 h-full overflow-hidden">
            {/* هدر دراور موبایل */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="لوگو" className="h-10 w-10 object-contain" />
                <div>
                  <span className="font-extrabold text-sm text-white block">پیگیری استراتژیک</span>
                  <span className="text-[10px] text-slate-400 block">پورتال هوشمند</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* مشخصات کاربر در موبایل (بدون دایره «ع») */}
            <div className="p-4 bg-slate-950/50 border-b border-slate-800 text-right">
              <h4 className="font-extrabold text-white text-sm">{user.full_name}</h4>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                نقش: {user.role === "manager" ? "مدیر سیستم" : "کاربر عادی"}
              </p>
            </div>

            {/* لیست گزینه‌های منو در موبایل */}
            <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto font-sans">
              <button
                onClick={() => handleNavClick("home")}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                  currentView === "home" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                }`}
              >
                <Folder className="w-5 h-5 shrink-0 text-amber-400" />
                <span>پیشخوان کاربری</span>
              </button>

              <button
                onClick={() => handleNavClick("submit_report")}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                  currentView === "submit_report" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                }`}
              >
                <ClipboardList className="w-5 h-5 shrink-0" />
                <span>ثبت گزارش عملکرد</span>
              </button>

              <button
                onClick={() => handleNavClick("my_reports")}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                  currentView === "my_reports" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                }`}
              >
                <FileText className="w-5 h-5 shrink-0" />
                <span>گزارش‌های من</span>
              </button>

              {user.role === "manager" && (
                <>
                  <div className="pt-3 pb-1 px-3 text-xs uppercase tracking-wider font-bold text-slate-400 border-t border-slate-800 mt-2">
                    بخش مدیریت سازمان
                  </div>

                  <button
                    onClick={() => handleNavClick("manager_dashboard")}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                      currentView === "manager_dashboard" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <BarChart3 className="w-5 h-5 shrink-0" />
                    <span>داشبورد نظارتی مدیر</span>
                  </button>

                  <button
                    onClick={() => handleNavClick("manage_projects")}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                      currentView === "manage_projects" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <Folder className="w-5 h-5 shrink-0" />
                    <span>مدیریت پروژه‌ها</span>
                  </button>

                  <button
                    onClick={() => handleNavClick("project_allocations")}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                      currentView === "project_allocations" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <FolderGit2 className="w-5 h-5 shrink-0 text-emerald-400" />
                    <span>تخصیص پروژه به پرسنل</span>
                  </button>

                  <button
                    onClick={() => handleNavClick("report_periods")}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                      isCalendarActive ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <Calendar className="w-5 h-5 shrink-0" />
                    <span>تقویم و مهلت‌های گزارش‌دهی</span>
                  </button>

                  <button
                    onClick={() => handleNavClick("project_kpis")}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                      isKpiActive ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <Target className="w-5 h-5 shrink-0" />
                    <span>شاخص‌های عملکرد (KPI)</span>
                  </button>

                  <button
                    onClick={() => handleNavClick("manage_users")}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-colors text-right cursor-pointer ${
                      currentView === "manage_users" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 text-slate-300"
                    }`}
                  >
                    <Users className="w-5 h-5 shrink-0" />
                    <span>مدیریت کاربران</span>
                  </button>
                </>
              )}
            </nav>

            {/* دکمه خروج در موبایل */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer text-right"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span>خروج از حساب کاربری</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ============================================================== */}
      {/* 🖥️ ۲. سایدبار دسکتاپ (ایستا، بدون Wiggle، با چیدمان عمودی آرم و دکمه) */}
      {/* ============================================================== */}
      <aside
        className={`hidden md:flex md:sticky md:top-0 md:h-screen md:overflow-hidden bg-slate-900 text-slate-300 flex-col border-l border-slate-800 flex-shrink-0 z-30 transition-[width] duration-300 ease-in-out ${
          isCollapsed ? "md:w-20" : "md:w-64"
        }`}
      >
        {/* هدر دسکتاپ: آرم سازمان در بالای دکمه، بدون له شدن یا تداخل */}
        <div className="p-4 border-b border-slate-800 shrink-0 flex flex-col items-center">
          {/* آرم سازمان در بالاترین نقطه */}
          <div className="mb-2">
            <img
              src="/logo.png"
              alt="لوگوی سازمان"
              className={`object-contain transition-all duration-300 ${
                isCollapsed ? "h-11 w-11 mx-auto" : "h-14 w-14 mx-auto"
              }`}
            />
          </div>

          {/* عناوین پورتال در صورت باز بودن */}
          {!isCollapsed && (
            <div className="mb-3 text-center">
              <h1 className="font-extrabold text-white text-base leading-snug">پیگیری استراتژیک سازمانی</h1>
              <p className="text-xs text-slate-400 mt-0.5">پورتال خدمات هوشمند</p>
            </div>
          )}

          {/* دکمه جمع و باز کردن سایدبار (دقیقاً در زیر آرم، بدون تداخل افقی) */}
          <button
            type="button"
            onClick={toggleCollapse}
            className={`rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center ${
              isCollapsed ? "w-10 h-8 mt-1" : "w-full py-1.5 px-3 gap-2 text-xs font-medium"
            }`}
            title={isCollapsed ? "باز کردن سایدبار" : "جمع کردن سایدبار"}
          >
            {isCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <>
                <ChevronRight className="w-4 h-4" />
                <span>جمع کردن سایدبار</span>
              </>
            )}
          </button>
        </div>

        {/* مشخصات کاربر در دسکتاپ (بدون دایره «ع») */}
        {!isCollapsed && (
          <div className="px-4 py-3 bg-slate-950/70 border-b border-slate-800 text-right shrink-0">
            <h4 className="font-extrabold text-white text-sm leading-snug truncate">
              {user.full_name}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5 truncate font-medium">
              نقش: {user.role === "manager" ? "مدیر سیستم" : "کاربر عادی"}
            </p>
          </div>
        )}

        {/* لینک‌های ناوبری دسکتاپ با فونت درشت‌تر (text-sm) و آیکون‌های متناسب (w-5 h-5) */}
        <nav className="flex-1 p-2.5 space-y-1.5 overflow-y-auto overflow-x-hidden font-sans">
          {/* Public Views */}
          <button
            onClick={() => handleNavClick("home")}
            title="پیشخوان کاربری"
            className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
              currentView === "home" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <Folder className="w-5 h-5 shrink-0 text-amber-400" />
            {!isCollapsed && <span>پیشخوان کاربری</span>}
          </button>

          <button
            onClick={() => handleNavClick("submit_report")}
            title="ثبت گزارش عملکرد"
            className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
              currentView === "submit_report" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <ClipboardList className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>ثبت گزارش عملکرد</span>}
          </button>

          <button
            onClick={() => handleNavClick("my_reports")}
            title="گزارش‌های من"
            className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
              currentView === "my_reports" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <FileText className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>گزارش‌های من</span>}
          </button>

          {/* Manager-only Views */}
          {user.role === "manager" && (
            <>
              {isCollapsed ? (
                <div className="border-t border-slate-800 my-2" />
              ) : (
                <div className="pt-3 pb-1.5 px-3 text-xs uppercase tracking-wider font-bold text-slate-400 border-t border-slate-800 mt-2">
                  بخش مدیریت سازمان
                </div>
              )}

              <button
                onClick={() => handleNavClick("manager_dashboard")}
                title="داشبورد نظارتی مدیر"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                  currentView === "manager_dashboard" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <BarChart3 className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>داشبورد نظارتی مدیر</span>}
              </button>

              <button
                onClick={() => handleNavClick("manage_projects")}
                title="مدیریت پروژه‌ها"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                  currentView === "manage_projects" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Folder className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>مدیریت پروژه‌ها</span>}
              </button>

              <button
                onClick={() => handleNavClick("project_allocations")}
                title="تخصیص پروژه به پرسنل"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                  currentView === "project_allocations" ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <FolderGit2 className="w-5 h-5 shrink-0 text-emerald-400" />
                {!isCollapsed && <span>تخصیص پروژه به پرسنل</span>}
              </button>

              {/* هاب تقویم و مهلت‌های گزارش‌دهی */}
              <button
                onClick={() => handleNavClick("report_periods")}
                title="تقویم و مهلت‌های گزارش‌دهی"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                  isCalendarActive ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Calendar className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>تقویم و مهلت‌های گزارش‌دهی</span>}
              </button>

              {/* هاب شاخص‌های عملکرد (KPI) */}
              <button
                onClick={() => handleNavClick("project_kpis")}
                title="شاخص‌های کلیدی عملکرد (KPI)"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                  isKpiActive ? "bg-white/10 text-amber-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Target className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>شاخص‌های عملکرد (KPI)</span>}
              </button>

              <button
                onClick={() => handleNavClick("manage_users")}
                title="مدیریت کاربران"
                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-3"} rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                  currentView === "manage_users" ? "bg-white/10 text-amber-400 font-bold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Users className="w-5 h-5 shrink-0" />
                {!isCollapsed && <span>مدیریت کاربران</span>}
              </button>
            </>
          )}
        </nav>

        {/* دکمه خروج در دسکتاپ */}
        <div className={`p-3 border-t border-slate-800 shrink-0 ${isCollapsed ? "flex justify-center" : ""}`}>
          <button
            onClick={onLogout}
            title="خروج از حساب کاربری"
            className={`flex items-center ${isCollapsed ? "justify-center p-2.5" : "w-full gap-3 px-3.5 py-2.5"} rounded-2xl text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>خروج از حساب</span>}
          </button>
        </div>
      </aside>
    </>
  );
}