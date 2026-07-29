// src/components/ProjectNextActionsDrawer.tsx
import { useState } from "react";
import { 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  XCircle, 
  FolderGit2, 
  User as UserIcon,
  Calendar
} from "lucide-react";
import { Project } from "../types";

export interface NextActionItem {
  id: number;
  action_text: string;
  target_date: string;
  is_completed: boolean;
  completed_at: string | null;
  project?: { id: number; title: string };
  user?: { id: number; full_name: string; job_title: string | null };
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  actions: NextActionItem[];
  onToggleStatus: (actionId: number, currentStatus: boolean) => void;
}

export default function ProjectNextActionsModal({
  isOpen,
  onClose,
  project,
  actions,
  onToggleStatus,
}: ModalProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");

  if (!isOpen || !project) return null;

  // 🎨 تعیین منطق رنگ‌بندی ۴‌گانه
  const getStatusInfo = (item: NextActionItem) => {
    const now = new Date().getTime();
    const targetTime = new Date(item.target_date).getTime();
    const completedTime = item.completed_at ? new Date(item.completed_at).getTime() : null;

    if (item.is_completed) {
      if (completedTime && completedTime <= targetTime) {
        return {
          label: "تحویل به‌موقع",
          bgColor: "bg-emerald-50/80 border-emerald-200 text-emerald-950",
          badgeColor: "bg-emerald-600 text-white",
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />,
        };
      } else {
        return {
          label: "تحویل با تاخیر",
          bgColor: "bg-amber-50/80 border-amber-200 text-amber-950",
          badgeColor: "bg-amber-600 text-white",
          icon: <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />,
        };
      }
    } else {
      if (now > targetTime) {
        return {
          label: "گذشته از ددلاین",
          bgColor: "bg-rose-50/80 border-rose-200 text-rose-950",
          badgeColor: "bg-rose-600 text-white",
          icon: <XCircle className="w-4 h-4 text-rose-600 shrink-0" />,
        };
      } else {
        return {
          label: "در جریان",
          bgColor: "bg-sky-50/80 border-sky-200 text-sky-950",
          badgeColor: "bg-sky-600 text-white",
          icon: <Clock className="w-4 h-4 text-sky-600 shrink-0" />,
        };
      }
    }
  };

  const pendingActions = actions.filter((a) => !a.is_completed);
  const completedActions = actions.filter((a) => a.is_completed);
  const activeList = activeTab === "pending" ? pendingActions : completedActions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans dir-rtl text-right animate-fade-in">
      
      {/* پس‌زمینه نیمه‌شفاف تاریک در مرکز */}
      <div 
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* 📦 پنجره اصلی مودال در مرکز تصویر */}
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] bg-white rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        
        {/* هدر مودال */}
        <div className="p-5 bg-slate-900 text-white space-y-3 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute left-4 top-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-emerald-400 text-[11px] font-bold">
            <FolderGit2 className="w-4 h-4" />
            <span>پایش و رصد اقدامات آتی پروژه</span>
          </div>

          <h2 className="text-base font-bold text-white leading-snug pl-8">
            {project.title}
          </h2>

          {/* تب‌های جابه‌جایی */}
          <div className="flex bg-slate-800/80 p-1 rounded-2xl gap-1 pt-1 mt-2 max-w-xs">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "pending"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>اقدامات جاری</span>
              <span className="bg-slate-900/60 px-2 py-0.5 rounded-full text-[10px]">
                {pendingActions.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("completed")}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "completed"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              <span>تکمیل‌شده‌ها</span>
              <span className="bg-slate-900/60 px-2 py-0.5 rounded-full text-[10px]">
                {completedActions.length}
              </span>
            </button>
          </div>
        </div>

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

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border shadow-2xs space-y-3 transition-all flex flex-col justify-between ${info.bgColor}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          {info.icon}
                          <p className="font-bold text-xs text-slate-900 leading-relaxed">
                            {item.action_text}
                          </p>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold shrink-0 ${info.badgeColor}`}>
                          {info.label}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between text-[10px] text-slate-600">
                        {item.user && (
                          <span className="flex items-center gap-1">
                            <UserIcon className="w-3 h-3 text-slate-400" />
                            {item.user.full_name}
                          </span>
                        )}

                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(item.target_date).toLocaleDateString("fa-IR")}
                        </span>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => onToggleStatus(item.id, item.is_completed)}
                          className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-[10px] font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${item.is_completed ? "text-emerald-600" : "text-slate-400"}`} />
                          <span>{item.is_completed ? "بازگرداندن به جاری" : "علامت‌گذاری به عنوان تحویل داده شده"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* فوتر راهنمای کدرنگ‌ها */}
        <div className="p-3 bg-white border-t border-slate-200 text-[10px] text-slate-500 flex justify-around shrink-0">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-600"></span> گذشته از ددلاین</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-600"></span> در جریان</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600"></span> تحویل به‌موقع</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-600"></span> تحویل با تاخیر</span>
        </div>

      </div>
    </div>
  );
}