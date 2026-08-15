// src/components/ProjectNextActionsDrawer.tsx
import { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FolderGit2,
  User as UserIcon,
  Calendar,
  Plus,
  Crown,
  Trash2,
  FileCheck2,
  RefreshCw
} from "lucide-react";
import { Project, User } from "../types";
import { ShamsiDatePicker, CustomSelect } from "../components";

export interface NextActionItem {
  id: number;
  report_id?: number | null;
  project_id?: number | null;
  user_id?: number | null;
  created_by_role?: "user" | "manager";
  action_text: string;
  target_date: string | null;
  target_date_raw?: string | null;
  claimed_completed?: boolean;
  claimed_at?: string | null;
  claimed_report_id?: number | null;
  claimed_report?: { id: number; period_title: string; user_full_name: string; submitted_at: string } | null;
  is_completed: boolean;
  completed_at: string | null;
  verified_at?: string | null;
  project?: { id: number; title: string };
  user?: { id: number; full_name: string; job_title: string | null };
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  actions: NextActionItem[];
  onToggleStatus: (actionId: number, currentStatus: boolean, resetClaim?: boolean) => void;
  onRefresh?: () => void;
}

export default function ProjectNextActionsModal({
  isOpen,
  onClose,
  project,
  actions,
  onToggleStatus,
  onRefresh,
}: ModalProps) {
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "claimed" | "completed">("all");

  // فرم افزودن اقدام مدیریتی
  const [showAddForm, setShowAddForm] = useState(false);
  const [newActionText, setNewActionText] = useState("");
  const [newTargetDate, setNewTargetDate] = useState("");
  const [newUserId, setNewUserId] = useState<number>(0);
  const [projectUsers, setProjectUsers] = useState<User[]>([]);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [formError, setFormError] = useState("");

  // واکشی اعضای پروژه برای انتصاب وظیفه
  useEffect(() => {
    if (!isOpen || !project) return;
    fetch("/api/user-projects")
      .then((r) => (r.ok ? r.json() : []))
      .then(async (allocations: any[]) => {
        const userIds = allocations
          .filter((a) => a.project_id === project.id)
          .map((a) => a.user_id);

        const usersRes = await fetch("/api/users");
        if (usersRes.ok) {
          const allUsers: User[] = await usersRes.json();
          setProjectUsers(allUsers.filter((u) => userIds.includes(u.id) && u.is_active));
        }
      })
      .catch(() => setProjectUsers([]));
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  // 🎨 تعیین وضعیت و رنگ‌بندی دقیق
  const getStatusInfo = (item: NextActionItem) => {
    const now = Date.now();
    const targetTime = item.target_date ? new Date(item.target_date).getTime() : null;
    const completedTime = item.completed_at ? new Date(item.completed_at).getTime() : null;

    // ۱. تایید نهایی توسط مدیر
    if (item.is_completed) {
      if (targetTime !== null && completedTime !== null && completedTime > targetTime) {
        return {
          label: "تایید مدیر (تحویل با تأخیر)",
          bgColor: "bg-amber-50/80 border-amber-200 text-amber-950",
          badgeColor: "bg-amber-600 text-white",
          icon: <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />,
        };
      }
      return {
        label: "تایید شده توسط مدیر",
        bgColor: "bg-emerald-50/80 border-emerald-200 text-emerald-950",
        badgeColor: "bg-emerald-600 text-white",
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
      };
    }

    // ۲. اعلام انجام توسط پرسنل (در انتظار تایید مدیر)
    if (item.claimed_completed) {
      return {
        label: "اعلام انجام توسط پرسنل (در انتظار تایید)",
        bgColor: "bg-indigo-50/90 border-indigo-200 text-indigo-950 ring-1 ring-indigo-300",
        badgeColor: "bg-indigo-600 text-white animate-pulse",
        icon: <FileCheck2 className="w-4 h-4 text-indigo-600 shrink-0" />,
      };
    }

    // ۳. اقدامات در جریان / گذشته از ددلاین
    if (targetTime === null) {
      return {
        label: "بدون تاریخ مشخص",
        bgColor: "bg-slate-50/80 border-slate-200 text-slate-950",
        badgeColor: "bg-slate-500 text-white",
        icon: <Clock className="w-4 h-4 text-slate-500 shrink-0" />,
      };
    }

    if (now > targetTime) {
      return {
        label: "گذشته از ددلاین",
        bgColor: "bg-rose-50/80 border-rose-200 text-rose-950",
        badgeColor: "bg-rose-600 text-white",
        icon: <XCircle className="w-4 h-4 text-rose-600 shrink-0" />,
      };
    }

    return {
      label: "در جریان",
      bgColor: "bg-sky-50/80 border-sky-200 text-sky-950",
      badgeColor: "bg-sky-600 text-white",
      icon: <Clock className="w-4 h-4 text-sky-600 shrink-0" />,
    };
  };

  const pendingActions = actions.filter((a) => !a.is_completed && !a.claimed_completed);
  const claimedActions = actions.filter((a) => !a.is_completed && a.claimed_completed);
  const completedActions = actions.filter((a) => a.is_completed);

  const getActiveList = () => {
    if (activeTab === "pending") return pendingActions;
    if (activeTab === "claimed") return claimedActions;
    if (activeTab === "completed") return completedActions;
    return actions;
  };

  const activeList = getActiveList();

  const handleCreateManagerAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionText.trim()) {
      setFormError("شرح اقدام یا ابلاغیه الزامی است.");
      return;
    }
    if (!newTargetDate) {
      setFormError("تاریخ سررسید ددلاین الزامی است.");
      return;
    }

    setIsSubmittingNew(true);
    setFormError("");

    try {
      const res = await fetch("/api/next-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          user_id: newUserId > 0 ? newUserId : null,
          action_text: newActionText.trim(),
          target_date: newTargetDate,
          created_by_role: "manager",
        }),
      });

      if (res.ok) {
        setNewActionText("");
        setNewTargetDate("");
        setNewUserId(0);
        setShowAddForm(false);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        setFormError(data.error || "خطا در ثبت اقدام جدید.");
      }
    } catch (err) {
      setFormError("خطا در برقراری ارتباط با سرور.");
    } finally {
      setIsSubmittingNew(false);
    }
  };

  const handleDeleteAction = async (actionId: number) => {
    if (!confirm("آیا از حذف این اقدام اطمینان دارید؟")) return;
    try {
      const res = await fetch(`/api/next-actions/${actionId}`, { method: "DELETE" });
      if (res.ok && onRefresh) onRefresh();
    } catch (err) {
      alert("خطا در حذف اقدام.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans dir-rtl text-right animate-fade-in">

      {/* پس‌زمینه نیمه‌شفاف تاریک */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* 📦 پنجره اصلی مودال */}
      <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">

        {/* هدر مودال */}
        <div className="p-5 bg-slate-900 text-white space-y-3 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-between pl-10">
            <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-bold">
              <FolderGit2 className="w-4 h-4" />
              <span>پایش و تایید اقدامات آتی و ابلاغیه‌های پروژه</span>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "بستن فرم" : "افزودن ابلاغیه مدیریتی"}</span>
            </button>
          </div>

          <h2 className="text-base font-bold text-white leading-snug pl-8">
            {project.title}
          </h2>

          {/* تب‌های جابه‌جایی ۴‌گانه */}
          <div className="flex flex-wrap bg-slate-800/80 p-1 rounded-2xl gap-1 pt-1 mt-2 max-w-lg">
            <button
              onClick={() => setActiveTab("all")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "all" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
            >
              <span>همه</span>
              <span className="bg-slate-900/60 px-2 py-0.5 rounded-full text-[10px]">
                {actions.length.toLocaleString("fa-IR")}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("claimed")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "claimed" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
            >
              <span className="flex items-center gap-1">
                <FileCheck2 className="w-3 h-3 text-indigo-300" />
                <span>اعلام‌شده (پرسنل)</span>
              </span>
              <span className="bg-indigo-900/80 px-2 py-0.5 rounded-full text-[10px] text-indigo-200">
                {claimedActions.length.toLocaleString("fa-IR")}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("pending")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "pending" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
            >
              <span>در جریان</span>
              <span className="bg-slate-900/60 px-2 py-0.5 rounded-full text-[10px]">
                {pendingActions.length.toLocaleString("fa-IR")}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("completed")}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === "completed" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-300 hover:text-white"
                }`}
            >
              <span>تایید مدیر</span>
              <span className="bg-slate-900/60 px-2 py-0.5 rounded-full text-[10px]">
                {completedActions.length.toLocaleString("fa-IR")}
              </span>
            </button>
          </div>
        </div>

        {/* فرم ثبت ابلاغیه مدیریتی */}
        {showAddForm && (
          <form onSubmit={handleCreateManagerAction} className="p-4 bg-emerald-50/70 border-b border-emerald-200/80 space-y-3 animate-fade-in shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                <Crown className="w-4 h-4 text-purple-600" />
                ثبت اقدام یا ابلاغیه جدید توسط مدیر
              </span>
              <span className="text-[10px] text-slate-500 font-medium">این اقدام در فرم گزارش پرسنل به عنوان چک‌باکس نمایش داده می‌شود.</span>
            </div>

            {formError && (
              <div className="p-2 bg-rose-100 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">شرح اقدام یا دستور کار *</label>
                <input
                  type="text"
                  required
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  placeholder="مثال: پیاده‌سازی تست‌های نهایی سامانه..."
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">تاریخ سررسید ددلاین *</label>
                <ShamsiDatePicker
                  value={newTargetDate}
                  onChange={(gregorianDate: string) => setNewTargetDate(gregorianDate)}
                  placeholder="انتخاب تاریخ"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-[11px] font-bold text-slate-700 block">ارجاع به پرسنل (اختیاری)</label>
                <CustomSelect
                  value={newUserId}
                  onChange={(val: string | number) => setNewUserId(Number(val))}
                  options={[
                    { value: 0, label: "همه پرسنل پروژه" },
                    ...projectUsers.map((u) => ({ value: u.id, label: u.full_name })),
                  ]}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={isSubmittingNew}
                className="px-5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingNew ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>ثبت و ابلاغ اقدام</span>
              </button>
            </div>
          </form>
        )}

        {/* بدنه و لیست اقدامات */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-slate-50/50">
          {activeList.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <Clock className="w-8 h-8 mx-auto text-slate-300" />
              <p>هیچ اقدامی در این بخش وجود ندارد.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeList.map((item) => {
                const info = getStatusInfo(item);
                const isManager = item.created_by_role === "manager";

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border shadow-2xs space-y-3 transition-all flex flex-col justify-between ${info.bgColor}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          {info.icon}
                          <div>
                            <p className="font-bold text-xs text-slate-900 leading-relaxed">
                              {item.action_text}
                            </p>
                            {isManager && (
                              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded mt-1">
                                <Crown className="w-2.5 h-2.5" />
                                ابلاغیه مدیریتی
                              </span>
                            )}
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 ${info.badgeColor}`}>
                          {info.label}
                        </span>
                      </div>

                      {/* اطلاعات گزارش اعلام‌کننده در صورت وجود */}
                      {item.claimed_report && (
                        <div className="bg-indigo-50/80 p-2 rounded-xl border border-indigo-100 text-[10px] text-indigo-900 space-y-0.5">
                          <p className="font-bold">📝 اعلام تکمیل توسط: {item.claimed_report.user_full_name}</p>
                          <p className="text-indigo-700">در بازه: {item.claimed_report.period_title}</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between text-[10px] text-slate-600">
                        {item.user && (
                          <span className="flex items-center gap-1 font-medium">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                            {item.user.full_name}
                          </span>
                        )}

                        <span className="flex items-center gap-1 font-sans">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {item.target_date
                            ? new Date(item.target_date).toLocaleDateString("fa-IR")
                            : "بدون تاریخ مشخص"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteAction(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                          title="حذف اقدام"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-1.5">
                          {/* اگر پرسنل ادعای انجام کرده ولی هنوز تایید نشده: مدیر می‌تواند تایید کند یا ادعا را رد کند */}
                          {item.claimed_completed && !item.is_completed && (
                            <button
                              type="button"
                              onClick={() => onToggleStatus(item.id, false, true)}
                              className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer shadow-2xs"
                              title="رد ادعای پرسنل و بازگرداندن به در جریان"
                            >
                              رد ادعا
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onToggleStatus(item.id, item.is_completed, false)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs ${item.is_completed
                                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
                                : item.claimed_completed
                                  ? "bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs"
                                  : "bg-white hover:bg-slate-100 text-slate-800 border border-slate-300"
                              }`}
                          >
                            <CheckCircle2 className={`w-3.5 h-3.5 ${item.is_completed ? "text-emerald-600" : item.claimed_completed ? "text-white" : "text-slate-400"}`} />
                            <span>
                              {item.is_completed
                                ? "لغو تایید مدیر"
                                : item.claimed_completed
                                  ? "تایید صحت عملکرد پرسنل"
                                  : "تایید و اتمام اقدام"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* فوتر راهنمای کدرنگ‌ها */}
        <div className="p-3 bg-white border-t border-slate-200 text-[10px] text-slate-500 flex flex-wrap justify-around gap-2 shrink-0">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-600"></span> گذشته از ددلاین</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-600"></span> در جریان</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600"></span> اعلام انجام توسط پرسنل</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600"></span> تایید شده توسط مدیر</span>
        </div>

      </div>
    </div>
  );
}