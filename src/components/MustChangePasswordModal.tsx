// src/components/MustChangePasswordModal.tsx
import { useState } from "react";
import { KeyRound, Lock, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import { User } from "../types";

interface MustChangePasswordModalProps {
  user: User;
  onSuccess: (updatedUser: User) => void;
}

export default function MustChangePasswordModal({ user, onSuccess }: MustChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (newPassword.length < 6) {
      setErrorMsg("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("تکرار رمز عبور جدید با اصل آن مطابقت ندارد.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onSuccess(data.user);
      } else {
        setErrorMsg(data.error || "خطا در تغییر رمز عبور.");
      }
    } catch (err) {
      setErrorMsg("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 dir-rtl text-right font-sans">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-5 animate-fade-in relative">
        
        {/* هدر مودال */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">تغییر اجباری رمز عبور اولیه</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">
              جهت ارتقای امنیت حساب کاربری، لطفاً رمز عبور جدید تعیین کنید.
            </p>
          </div>
        </div>

        {/* پیام هشدار */}
        <div className="bg-amber-50 border border-amber-200/80 text-amber-900 p-3.5 rounded-2xl text-[11px] flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            جناب آقای <strong>{user.full_name}</strong>؛ رمز عبور فعلی شما موقت است. تا زمان تعیین رمز عبور جدید، امکان استفاده از پورتال وجود ندارد.
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold animate-fade-in">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-700 font-bold mb-1 text-xs">رمز عبور جدید:</label>
            <div className="relative">
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-9 text-left font-sans text-xs focus:outline-none focus:border-emerald-600"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1 text-xs">تکرار رمز عبور جدید:</label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="تکرار رمز جدید"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pl-9 text-left font-sans text-xs focus:outline-none focus:border-emerald-600"
              />
              <CheckCircle2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>در حال ثبت رمز جدید...</span>
              </>
            ) : (
              <span>ثبت رمز عبور جدید و ورود به سامانه</span>
            )}
          </button>
        </form>

      </div>
    </div>
  );
}