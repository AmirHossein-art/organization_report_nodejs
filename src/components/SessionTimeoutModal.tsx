import React, { useState, useEffect, useRef, useCallback } from "react";
import { Clock, ShieldAlert, LogOut, CheckCircle2 } from "lucide-react";

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
  const formattedTime = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / countdownSeconds) * 100));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-amber-200 max-w-md w-full overflow-hidden text-right">
        {/* هدر مودال */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base font-sans">هشدار پایان نشست امنیتی</h3>
              <p className="text-amber-100 text-xs">سامانه پیگیری استراتژیک سازمان</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/20 text-white font-mono font-bold text-sm">
            <Clock className="w-4 h-4 text-amber-200 animate-pulse" />
            <span>{formattedTime}</span>
          </div>
        </div>

        {/* بدنه و توضیحات */}
        <div className="p-6 space-y-5">
          <div className="text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              به دلیل حفظ امنیت اطلاعات سازمانی و عدم فعالیت در سامانه ظرف <strong className="text-slate-800">۲۵ دقیقه گذشته</strong>، نشست کاری شما به صورت خودکار پایان خواهد یافت.
            </p>
            <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200/60 p-3 rounded-2xl">
              ⚠️ در صورت خروج خودکار، فرم‌های ثبت‌نشده ذخیره نخواهند شد. اگر همچنان پشت سیستم هستید، روی دکمه «ادامه کار در سامانه» کلیک فرمایید.
            </p>
          </div>

          {/* نوار زمان باقی‌مانده */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-slate-500">
              <span>زمان باقی‌مانده تا خروج قطعی:</span>
              <span className="font-mono text-amber-600 font-bold">{remainingSeconds} ثانیه</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-1000 rounded-full ${
                  remainingSeconds < 60 ? "bg-rose-500 animate-pulse" : "bg-amber-500"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* دکمه‌های اقدام */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleStayLoggedIn}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-2xl shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>ادامه کار در سامانه</span>
            </button>
            <button
              type="button"
              onClick={() => onLogout()}
              className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-3 px-4 rounded-2xl transition-all text-sm cursor-pointer"
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
