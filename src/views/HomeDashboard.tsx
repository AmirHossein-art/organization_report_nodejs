// src/views/HomeDashboard.tsx
import { Folder, Clock, CheckCircle2, User as UserIcon, FileText, AlertTriangle } from "lucide-react";
import { User, Project, ReportPeriod, Report } from "../types";
import { toPersianDigits } from "../dateUtils";

interface HomeDashboardProps {
  user: User;
  users: User[];
  projects: Project[];
  periods: ReportPeriod[];
  allReports: Report[];
}

export default function HomeDashboard({ user, users, projects, periods, allReports }: HomeDashboardProps) {
  const isManager = user.role === "manager";

  // محاسبات داینامیک مخصوص کارشناس عادی
  const myReports = allReports.filter((r) => r.user_id === user.id);
  const myTotalSubmitted = myReports.length;
  const activeOpenPeriods = periods.filter((p) => p.is_open).length;
  
  // ۳ گزارش اخیر کاربر برای نمایش در میز کار سریع
  const myRecentReports = myReports.slice(0, 3);

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* بنر خوش‌آمدگویی شیک با تم سبز تیره و طلایی */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-emerald-500/10">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl"></div>
        <div className="space-y-3 relative z-10">
          <span className="bg-amber-500/20 backdrop-blur-xs text-amber-400 text-[10px] px-3 py-1 rounded-full font-bold border border-amber-500/20">
            نسخه جدید ماژولار ۱.۱.۰
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold flex items-center gap-2">
            <span>{user.full_name}</span>
            <span className="text-amber-400 font-normal text-sm bg-white/5 px-2.5 py-0.5 rounded-lg border border-white/5">
              {isManager ? "مدیر سیستم" : "کارشناس فنی"}
            </span>
          </h2>
          <p className="text-slate-300 text-xs md:text-sm max-w-6xl leading-relaxed">
            به پورتال پایش استراتژیک پروژه‌های سازمان حمل‌ونقل و ترافیک شهرداری تهران خوش آمدید. 
            {isManager 
              ? " در این پنل دسترسی کامل به نظارت بر عملکرد پرسنل، وضعیت ددلاین‌ها و ابزارهای مدیریتی را در اختیار دارید."
              : " وضعیت دوره‌های گزارش‌دهی و پروژه‌های تخصیص‌یافته به خود را می‌توانید در زیر مدیریت کنید."}
          </p>
        </div>
      </div>

      {/* نمایش داینامیک کارت‌های آمار بر اساس نقش کاربر */}
      {isManager ? (
        /* لایه کارت‌های آماری مخصوص مدیر سیستم */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-medium block">کاربران فعال سیستم</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {toPersianDigits(users.filter((u) => u.is_active).length)} نفر
              </span>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
              <UserIcon className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-medium block">پروژه‌های سازمان</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {toPersianDigits(projects.filter((p) => p.is_active).length)} پروژه
              </span>
            </div>
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
              <Folder className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-medium block">بازه‌های گزارش‌دهی فعال</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {toPersianDigits(periods.filter((p) => p.is_open).length)} بازه فعال
              </span>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      ) : (
        /* لایه کارت‌های آماری شخصی‌سازی شده مخصوص کارشناس عادی */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-medium block">کل گزارش‌های ثبت‌شده توسط شما</span>
              <span className="text-2xl font-bold text-emerald-700 mt-1 block">
                {toPersianDigits(myTotalSubmitted)} گزارش
              </span>
            </div>
            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100">
              <FileText className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-slate-400 text-xs font-medium block">بازه‌های زمانی آماده ثبت گزارش</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">
                {toPersianDigits(activeOpenPeriods)} بازه فعال
              </span>
            </div>
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* بخش پایینی داینامیک پیشخوان */}
      {isManager ? (
        /* برای مدیر: اطلاعات و راهنمای کلی سیستم */
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>امکانات و ابزارهای نظارتی لایه مدیریت</span>
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600 text-xs leading-relaxed">
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.1 bg-amber-500 rounded-full flex-shrink-0"></span>
              داشبورد نظارتی آنلاین به همراه تفکیک درصد میزان مشارکت و تأخیرها
            </li>
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0"></span>
              تجمیع خودکار و خلاصه‌سازی هوشمند متون گزارشات با هوش مصنوعی هوشمند
            </li>
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0"></span>
              کنترل ماتریس دسترسی و تخصیص دقیق پروژه‌های مصوب به کارشناسان سازمان
            </li>
            <li className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0"></span>
              تعیین و بروزرسانی تقویم زمانی (ددلاین‌ها) برای دوره‌های هفتگی و ماهانه
            </li>
          </ul>
        </div>
      ) : (
        /* برای کارشناس: نمایش وضعیت آخرین گزارش‌های ارسالی خودش */
        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>آخرین فعالیت‌ها و گزارش‌های ارسالی شما</span>
            </h3>
            <span className="text-[11px] text-slate-400">نمایش وضعیت ۳ ارسال اخیر</span>
          </div>

          {myRecentReports.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              هنوز هیچ گزارشی توسط شما در سامانه ثبت نشده است.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {myRecentReports.map((rep) => (
                <div key={rep.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 text-xs block">{rep.project_title}</span>
                    <span className="text-[11px] text-slate-400 block">
                      بازه: {rep.period_title} | تاریخ ثبت: {new Date(rep.submitted_at).toLocaleDateString("fa-IR")}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    rep.status === "late" 
                      ? "bg-orange-50 text-orange-600 border border-orange-100" 
                      : "bg-green-50 text-green-600 border border-green-100"
                  }`}>
                    {rep.status === "late" ? "تأخیری" : "منظم"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}