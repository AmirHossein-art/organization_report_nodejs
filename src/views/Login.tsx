// src/views/Login.tsx
import { useState } from "react";
import { User as UserIcon, AlertCircle } from "lucide-react";
import { User } from "../types";

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  // این استیت‌ها دقیقاً مطابق با فایل App.old.tsx حفظ شده‌اند
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // منطق هندل کردن لاگین دقیقاً مطابق با فایل App.old.tsx
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        // ارسال کاربر لاگین شده به کامپوننت اصلی برای ثبت نشست
        onLoginSuccess(data.user);
      } else {
        setLoginError(data.error || "خطایی رخ داد.");
      }
    } catch (err) {
      setLoginError("ارتباط با سرور برقرار نشد.");
    }
  };

  // ساختار UI و کلاس‌های Tailwind کاملاً با کدهای قدیمی شما منطبق است
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 px-6 py-8 text-center text-white">
          <img src="/logo.png" alt="لوگوی سازمان" className="h-30 w-30 object-contain inline-block" />
          <h1 className="text-2xl font-bold font-sans tracking-tight">سامانه پیگیری استراتژیک سازمان حمل‌ونقل و ترافیک شهرداری تهران</h1>
          <p className="text-slate-400 mt-2 text-sm">دروازه ورود پرسنل و مدیریت پروژه‌ها</p>
        </div>

        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {loginError && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">نام کاربری</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثلاً ahmadi"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 text-sm font-medium mb-1.5">رمز عبور</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-xl py-2.5 font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
          >
            <UserIcon className="w-5 h-5" />
            <span>ورود به حساب کاربری</span>
          </button>

          <div className="pt-4 text-center border-t border-slate-100 text-xs text-slate-400">
            راهنما: رمز عبور پیش‌فرض برای تمامی پرسنل <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-medium text-slate-600">123456</code> می‌باشد.
          </div>
        </form>
      </div>
    </div>
  );
}