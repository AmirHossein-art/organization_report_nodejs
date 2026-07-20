// src/views/GatewayPortal.tsx
import { useState } from "react";
import { ShieldCheck, Truck, Cpu, ArrowLeft } from "lucide-react";

export default function GatewayPortal({ onSelectTraffic }: { onSelectTraffic: () => void }) {
  const [selectedTenant, setSelectedTenant] = useState<"traffic" | "new_unit" | null>(null);

  // ۲. این متد را به این صورت تغییر بده تا پروپ را صدا بزند:
  const handleRedirect = (tenant: "traffic" | "new_unit") => {
    if (tenant === "traffic") {
      if (onSelectTraffic) onSelectTraffic(); // به جای window.location.href
    } else {
      window.location.href = "/new-unit"; 
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans" dir="rtl">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-12">
        
        {/* بخش خوش‌آمدگویی و معرفی سازمان (تم سبز یشمی) */}
        <div className="md:col-span-5 bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 p-6 md:p-8 text-white flex flex-col justify-between text-center md:text-right relative">
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-amber-500/5 rounded-full blur-2xl"></div>
          
          <div className="space-y-4 relative z-10">
            <img src="/logo.png" alt="لوگوی سازمان" className="h-24 w-24 object-contain mx-auto md:margin-0" />
            <h1 className="text-xl font-bold tracking-tight leading-relaxed">
              پورتال یکپارچه مدیریت پروژه‌های سازمان حمل‌ونقل و ترافیک
            </h1>
            <p className="text-slate-400 text-xs leading-relaxed">
              به سامانه هوشمند پایش عملکرد دوره‌ای معاونت‌ها و واحدهای سازمانی خوش آمدید. لطفاً برای ورود، حوزه خود را انتخاب کنید.
            </p>
          </div>

          <div className="pt-6 border-t border-emerald-800/40 text-[10px] text-slate-400 flex items-center justify-center md:justify-start gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>اتصال امن و رمزنگاری شده به سرور مرکزی</span>
          </div>
        </div>

        {/* بخش داینامیک انتخاب Tenant / واحد سازمانی */}
        <div className="md:col-span-7 p-6 md:p-10 flex flex-col justify-center bg-slate-50/50">
          {!selectedTenant ? (
            /* گام اول: انتخاب واحد سازمانی */
            <div className="space-y-6 animate-fade-in">
              <div className="text-center md:text-right">
                <h2 className="text-lg font-bold text-slate-900">انتخاب واحد سازمانی</h2>
                <p className="text-slate-400 text-xs mt-1">لطفاً حوزه پایش استراتژیک خود را مشخص کنید:</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* کارت واحد شما (حمل و نقل و ترافیک) */}
                <div 
                  onClick={() => setSelectedTenant("traffic")}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-700 hover:shadow-md transition-all cursor-pointer text-center space-y-3 group"
                >
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-emerald-700 group-hover:text-white transition-all">
                    <Truck className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs">واحد استراتژی</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">سامانه پایش  پروژه‌های استراتژیک</p>
                </div>

                {/* کارت واحد جدید (مثلاً فناوری یا هر واحد دیگر) */}
                <div 
                  onClick={() => setSelectedTenant("new_unit")}
                  className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-amber-500 hover:shadow-md transition-all cursor-pointer text-center space-y-3 group"
                >
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-amber-500 group-hover:text-white transition-all">
                    <Cpu className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-xs">اداره‌ی ارزیابی عملکرد</h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">فرم‌ها، فیلدها و ابزارهای پایش اختصاصی واحد جدید</p>
                </div>
              </div>
            </div>
          ) : (
            /* گام دوم: هدایت هوشمند به پورت اختصاصی واحد انتخاب شده */
            <div className="space-y-6 text-center animate-fade-in">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-700 animate-pulse">
                <ShieldCheck className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-sm">در حال انتقال به پورتال اختصاصی...</h3>
                <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed">
                  شما واحد <strong className="text-slate-800">{selectedTenant === "traffic" ? "استراتژی" : "جدید سازمان"}</strong> را انتخاب کردید و در حال هدایت به فرم‌های اختصاصی هستید.
                </p>
              </div>

              <div className="flex flex-col gap-2 max-w-xs mx-auto pt-4">
                <button 
                  onClick={() => handleRedirect(selectedTenant)}
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-medium py-2 rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                >
                  ورود به پورتال اختصاصی واحد
                </button>
                
                <button 
                  onClick={() => setSelectedTenant(null)}
                  className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium py-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>تغییر واحد انتخاب شده</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}