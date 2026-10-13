import React, { useState, useEffect, useRef, useCallback } from "react";
import { Clock, ShieldCheck, LogOut, CheckCircle2 } from "lucide-react";
import { toPersianDigits } from "../dateUtils";

interface SessionTimeoutModalProps {
  /**
   * مدت زمان عدم فعالیت قبل از نمایش اخطار (به میلی‌ثانیه). پیش‌فرض: ۲۵ دقیقه
   */
  inactivityLimitMs?: number;
  /**
   * مدت زمان فرصت شمارش معکوس قبل از خروج قطعی (به ثانیه). پیش‌فرض: ۳۰۰ ثانیه (۵ دقیقه)
   */
  countdownSeconds?: number;
  /**
   * تابعی که هنگام خروج قطعی کاربر فراخوانی می‌شود
   */
  onLogout: () => Promise<void> | void;
}

export const SessionTimeoutModal: React.FC<SessionTimeoutModalProps> = ({
  inactivityLimitMs = 25 * 60 * 1000, // ۲۵ دقیقه
  countdownSeconds = 300, // ۵ دقیقه
  onLogout,
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(countdownSeconds);
  const lastActivityRef = useRef<number>(Date.now());
  const countdownTimerRef = useRef<any>(null);

  // ثبت فعالیت کاربر و ریست زمان عدم فعالیت
  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // ادامه کار در سامانه: مخفی کردن مودال و تمدید نشست
  const handleStayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setRemainingSeconds(countdownSeconds);
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    // پینگ سبک به سرور جهت اطمینان از اعتبار نشست و تازه نگه‌داشتن کوکی
    fetch("/api/auth/me").catch(() => {});
  }, [countdownSeconds]);

  // شنود رویدادهای تعامل کاربر (ماوس، کیبورد، تاچ، اسکرول)
  useEffect(() => {
    const events = ["mousedown", "keydown", "touchstart", "scroll", "wheel"];
    let throttleTimeout: any = null;

    const handleUserEvent = () => {
      // فقط زمانی که مودال هشدار باز نیست، فعالیت‌های معمولی زمان را ریست می‌کنند
      if (!showWarning) {
        if (!throttleTimeout) {
          throttleTimeout = setTimeout(() => {
            registerActivity();
            throttleTimeout = null;
          }, 1000); // تراتل ۱ ثانیه‌ای برای عدم درگیری مکرر پردازنده
        }
      }
    };

    events.forEach((event) => window.addEventListener(event, handleUserEvent, { passive: true }));

    // حلقه بررسی وضعیت عدم فعالیت هر ۱۰ ثانیه
    const checkInterval = setInterval(() => {
      if (!showWarning) {
        const inactiveDuration = Date.now() - lastActivityRef.current;
        if (inactiveDuration >= inactivityLimitMs) {
          setShowWarning(true);
          setRemainingSeconds(countdownSeconds);
        }
      }
    }, 5000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserEvent));
      clearInterval(checkInterval);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [inactivityLimitMs, countdownSeconds, showWarning, registerActivity]);

  // مدیریت تایمر شمارش معکوس زمانی که اخطار فعال می‌شود
  useEffect(() => {
    if (showWarning) {
      countdownTimerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
            setShowWarning(false);
            onLogout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (countdownTimerRef.current) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
        }
      };
    }
  }, [showWarning, onLogout]);

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedMinutes = toPersianDigits(minutes.toString().padStart(2, "0"));
  const formattedSeconds = toPersianDigits(seconds.toString().padStart(2, "0"));
  const formattedTime = `${formattedMinutes}:${formattedSeconds}`;
  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / countdownSeconds) * 100));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-md w-full overflow-hidden text-right font-sans">
        {/* هدر مودال — تم سبز ملایم و سرمه‌ای سازمانی */}
        <div className="bg-gradient-to-r from-emerald-800 to-slate-900 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-md">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight font-sans">حفظ امنیت نشست کاربری</h3>
              <p className="text-emerald-200/80 text-[11px] font-sans">سامانه پیگیری استراتژیک سازمان</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/25 border border-white/10 text-emerald-200 font-bold text-xs font-sans">
            <Clock className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />
            <span className="tracking-wider">{formattedTime}</span>
          </div>
        </div>

        {/* بدنه و توضیحات */}
        <div className="p-6 space-y-4 font-sans">
          <div className="text-xs text-slate-600 leading-relaxed space-y-2.5">
            <p>
              به دلیل عدم فعالیت در سامانه طی <strong className="text-emerald-950 font-bold">{toPersianDigits(25)} دقیقه گذشته</strong>، جهت محافظت از اطلاعات سازمان، نشست کاری شما به صورت خودکار پایان خواهد یافت.
            </p>
            <div className="bg-emerald-50/70 border border-emerald-200/60 p-3 rounded-2xl text-[11px] text-emerald-900 flex items-start gap-2">
              <span className="text-emerald-600 font-bold">ℹ</span>
              <span>در صورتی که پشت سیستم حضور دارید، لطفاً جهت ادامه فعالیت و حفظ فرم‌های در حال تکمیل، روی دکمه «ادامه کار در سامانه» کلیک فرمایید.</span>
            </div>
          </div>

          {/* نوار زمان باقی‌مانده */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-500">
              <span>فرصت باقی‌مانده تا خروج خودکار:</span>
              <span className="text-emerald-800 font-bold">{toPersianDigits(remainingSeconds)} ثانیه</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
              <div
                className={`h-full transition-all duration-1000 rounded-full ${
                  remainingSeconds < 30 ? "bg-rose-500 animate-pulse" : "bg-emerald-600"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* دکمه‌های اقدام */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleStayLoggedIn}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-800 hover:bg-emerald-900 text-white font-medium py-2.5 px-4 rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] text-xs cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>ادامه کار در سامانه</span>
            </button>
            <button
              type="button"
              onClick={() => onLogout()}
              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2.5 px-4 rounded-xl transition-all text-xs cursor-pointer border border-slate-200/60"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>خروج</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
