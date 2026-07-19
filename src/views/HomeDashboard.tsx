// src/views/HomeDashboard.tsx
import { Folder, Clock, CheckCircle2 } from "lucide-react";
import { User, Project, ReportPeriod } from "../types";
import { toPersianDigits } from "../dateUtils";

interface HomeDashboardProps {
  users: User[];
  projects: Project[];
  periods: ReportPeriod[];
  user: User;
}

export default function HomeDashboard({ users, projects, periods, user }: HomeDashboardProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* بنر خوش‌آمدگویی شیک و مدرن */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
        <div className="space-y-2 relative z-10">
          <span className="bg-white/10 backdrop-blur-xs text-indigo-200 text-[10px] px-2.5 py-1 rounded-full font-semibold tracking-wide">نسخه جدید ماژولار ۱.۱.۰</span>
          <h2 className="text-xl md:text-2xl font-extrabold">{user.full_name} عزیز، خوش آمدید</h2>
          <p className="text-slate-300 text-xs md:text-sm max-w-xl leading-relaxed">
            به پرتال پایش استراتژیک پروژه‌های سازمان حمل‌ونقل و ترافیک خوش آمدید. گزارش‌های عملکرد شما مستقیماً در دیتابیس مرکز ذخیره و تحلیل می‌شود.
          </p>
        </div>
      </div>

      {/* کارت‌های آماری با استایل مینیمال */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-medium block">کاربران فعال سیستم</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {toPersianDigits(users.filter(u => u.is_active).length)} نفر
            </span>
          </div>
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-medium block">پروژه‌های در حال پایش</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {toPersianDigits(projects.filter(p => p.is_active).length)} پروژه
            </span>
          </div>
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><Folder className="w-5 h-5" /></div>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-medium block">بازه‌های گزارش‌دهی فعال</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {toPersianDigits(periods.filter(p => p.is_open).length)} بازه
            </span>
          </div>
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><Clock className="w-5 h-5" /></div>
        </div>
      </div>
    </div>
  );
}