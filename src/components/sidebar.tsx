// src/components/Sidebar.tsx
import { useState } from "react";
import {
  Folder,
  ClipboardList,
  FileText,
  BarChart3,
  Clock,
  Users,
  Calendar,
  Settings,
  LogOut,
  Menu,
  Target,
  TrendingUp,
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

  return (
    <>
      {/* Mobile Top Header - دقیقاً مطابق با ساختار کدهای اصلی */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="لوگوی سازمان" className="h-10 w-10 object-contain inline-block" />
          <span className="font-bold text-lg">پیگیری استراتژیک سازمانی</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 hover:bg-slate-800 rounded transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } md:block w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col border-l border-slate-800 md:min-h-screen flex-shrink-0 z-30`}
      >
        {/* Desktop Sidebar Header - پدینگ پدینگ p-6 و ابعاد h-15 اصلاح شد */}
        <div className="p-6 hidden md:flex items-center gap-3 border-b border-slate-800">
          <img src="/logo.png" alt="لوگوی سازمان" className="h-15 w-15 object-contain inline-block" />
          <div>
            <h1 className="font-bold text-white text-base">پیگیری استراتژیک سازمانی</h1>
            <p className="text-xs text-slate-400 mt-0.5">پورتال خدمات هوشمند</p>
          </div>
        </div>

        {/* User Info Badge - پیشوند «نقش:» بازگردانده شد */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold">
            {user.full_name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-white text-sm truncate">{user.full_name}</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              نقش: {user.role === "manager" ? "مدیر سیستم" : "کاربر عادی"}
            </p>
          </div>
        </div>

        {/* Navigation Links - به همراه تم طلایی به جای آبی برای وضعیت فعال */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Public Views */}
          <button
            onClick={() => {
              setCurrentView("home");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentView === "home" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>پیشخوان کاربری</span>
          </button>

          <button
            onClick={() => {
              setCurrentView("submit_report");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentView === "submit_report" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span> ثبت گزارش عملکرد</span>
          </button>

          <button
            onClick={() => {
              setCurrentView("my_reports");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentView === "my_reports" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span> گزارش‌های من</span>
          </button>

          {/* Manager-only Views - هدر تفکیک‌کننده بخش مدیریت مو به مو احیا شد */}
          {user.role === "manager" && (
            <>
              <div className="pt-4 pb-2 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-t border-slate-800 mt-4">
                بخش مدیریت سازمان
              </div>

              <button
                onClick={() => {
                  setCurrentView("manager_dashboard");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "manager_dashboard" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span> داشبورد نظارتی مدیر</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("manage_projects");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "manage_projects" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Folder className="w-4 h-4" />
                <span> مدیریت پروژه‌ها</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("deadline_settings");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "deadline_settings" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span> تنظیمات ددلاین</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("manage_users");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "manage_users" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Users className="w-4 h-4" />
                <span> مدیریت کاربران</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("report_periods");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "report_periods" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span> بازه‌های گزارش‌دهی</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("project_allocations");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "project_allocations" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span> تخصیص پروژه به پرسنل</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("project_kpi_management");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "project_kpi_management" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Target className="w-4 h-4" />
                <span> مدیریت شاخص‌های KPI</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("project_kpi_analytics");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "project_kpi_analytics" ? "bg-white/10 text-amber-400 font-semibold" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span> تحلیل و روند شاخص‌ها</span>
              </button>
            </>
          )}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج از حساب</span>
          </button>
        </div>
      </aside>
    </>
  );
}