// src/components/Sidebar.tsx
import { useState } from "react";
import { 
  Folder, ClipboardList, FileText, BarChart3, Users, Clock, Calendar, Settings, LogOut, Menu, X 
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

  const menuItems = [
    { id: "home", label: "پیشخوان کاربری", icon: Folder, role: "all" },
    { id: "submit_report", label: "ثبت گزارش عملکرد", icon: ClipboardList, role: "all" },
    { id: "my_reports", label: "گزارش‌های من", icon: FileText, role: "all" },
    { id: "manager_dashboard", label: "داشبورد نظارتی مدیر", icon: BarChart3, role: "manager" },
    { id: "manage_projects", label: "مدیریت پروژه‌ها", icon: Folder, role: "manager" },
    { id: "deadline_settings", label: "تنظیمات ددلاین", icon: Clock, role: "manager" },
    { id: "manage_users", label: "مدیریت کاربران", icon: Users, role: "manager" },
    { id: "report_periods", label: "بازه‌های گزارش‌دهی", icon: Calendar, role: "manager" },
    { id: "project_allocations", label: "تخصیص پروژه به پرسنل", icon: Settings, role: "manager" },
  ];

  const handleNav = (viewId: string) => {
    setCurrentView(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* هدر موبایل */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md w-full">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="لوگو" className="h-9 w-9 object-contain" />
          <span className="font-bold text-sm">پیگیری استراتژیک سازمانی</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-1 hover:bg-slate-800 rounded">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* سایدبار اصلی (مشترک دسکتاپ و موبایل) */}
      <aside className={`${mobileMenuOpen ? "block" : "hidden"} md:block w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col border-l border-slate-800 md:min-h-screen flex-shrink-0 z-30`}>
        <div className="p-5 hidden md:flex items-center gap-3 border-b border-slate-800">
          <img src="/logo.png" alt="لوگو" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="font-bold text-white text-sm">پیگیری استراتژیک</h1>
            <p className="text-[10px] text-slate-400 mt-0.5">سازمان حمل‌ونقل و ترافیک</p>
          </div>
        </div>

        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold text-sm">
            {user.full_name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-white text-xs truncate">{user.full_name}</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {user.role === "manager" ? "مدیر سیستم" : "کاربر عادی"}
            </p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto text-xs">
          {menuItems.map((item) => {
            if (item.role === "manager" && user.role !== "manager") return null;
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-all ${
                  isActive ? "bg-white/10 text-blue-400 font-bold shadow-xs" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-4 h-4" />
            <span>خروج از حساب</span>
          </button>
        </div>
      </aside>
    </>
  );
}