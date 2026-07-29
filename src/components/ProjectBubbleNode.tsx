// src/components/ProjectBubbleNode.tsx
import { useState } from "react";
import { FolderKanban, ArrowLeft } from "lucide-react";
import { Project } from "../types";
import { NextActionItem } from "./ProjectNextActionsDrawer";

export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

interface ProjectBubbleNodeProps {
  project: Project;
  actions: NextActionItem[];
  reportsCount?: number;
  hasLateReports?: boolean;
  onOpenModal: (project: Project) => void;
  onOpenReportsLayer?: (project: Project) => void;
}

export default function ProjectBubbleNode({
  project,
  actions = [],
  reportsCount = 0,
  hasLateReports = false,
  onOpenModal,
  onOpenReportsLayer,
}: ProjectBubbleNodeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const now = new Date().getTime();

  // تعیین استیت و کدرنگ سیارک‌های دور مدار
  const getActionStyle = (action: NextActionItem) => {
    if (action.is_completed) {
      return "bg-emerald-500 border-white text-white shadow-xs";
    }
    const target = new Date(action.target_date).getTime();
    if (now > target) {
      return "bg-rose-600 border-white text-white animate-pulse shadow-xs";
    }
    return "bg-sky-500 border-white text-white shadow-xs";
  };

  const totalActions = actions.length;
  const radius = 110; // شعاع مدار چرخش

  // 🔴/🟢 تغییر رنگ پویای حباب اصلی بر اساس وضعیت گزارش‌های تحویل داده شده
  const bubbleGradient = hasLateReports || reportsCount === 0
    ? "from-amber-500 via-amber-600 to-orange-600 shadow-[0_12px_35px_rgba(245,158,11,0.35)]"
    : "from-emerald-500 via-emerald-600 to-teal-700 shadow-[0_12px_35px_rgba(16,185,129,0.35)]";

  return (
    <div 
      className="relative flex items-center justify-center my-6 mx-6 group select-none shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 🔮 انیمیشن شناور ماندن زنده و نرم کل مجموعه */}
      <div className="bubble-floating relative flex items-center justify-center">
        
        {/* 🪐 ۱. مدار ظریف و مینیمال (Orbit Ring) */}
        <div 
          style={{ width: `${radius * 2}px`, height: `${radius * 2}px` }}
          className={`absolute rounded-full border border-dashed transition-all duration-300 pointer-events-none ${
            isHovered ? "border-emerald-500/50 scale-105" : "border-slate-300/40"
          }`}
        />

        {/* ☄️ ۲. سیارک‌ها (تعیین سایز با w-6 h-6) */}
        {actions.map((action, index) => {
          const angle = (index * (360 / Math.max(totalActions, 1)) - 90) * (Math.PI / 180);
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const styleClass = getActionStyle(action);

          return (
            <div
              key={action.id}
              onClick={(e) => {
                e.stopPropagation();
                onOpenModal(project);
              }}
              style={{
                transform: `translate(${x}px, ${y}px)`,
              }}
              /* 📌 نکته: برای تغییر سایز سیارک‌ها کافیست w-6 h-6 را تغییر دهید (مثلاً w-7 h-7) */
              className={`absolute z-20 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[9px] font-extrabold transition-all duration-300 cursor-pointer hover:scale-125 ${styleClass}`}
              title={`${action.action_text} (${new Date(action.target_date).toLocaleDateString("fa-IR")})`}
            >
              {toPersianDigits(index + 1)}
            </div>
          );
        })}

        {/* 🟢 ۳. حباب اصلی پروژه */}
        <div
          onClick={() => onOpenModal(project)}
          className={`relative z-10 w-48 h-48 rounded-full bg-gradient-to-br ${bubbleGradient} text-white p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 transform group-hover:scale-105 active:scale-95`}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1">
            <FolderKanban className="w-4 h-4 text-white" />
          </div>

          <h3 className="font-black text-xs md:text-sm leading-snug line-clamp-2 px-1 text-white">
            {project.title}
          </h3>

          {/* 🟢 دکمه مشاهده گزارش‌های خام مستقیماً درون حباب قرار گرفت */}
          {reportsCount > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenReportsLayer) onOpenReportsLayer(project);
              }}
              className="mt-2 text-[10px] bg-black/25 hover:bg-black/40 backdrop-blur-xs text-white font-extrabold px-3 py-1 rounded-full border border-white/20 transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
            >
              <span>مشاهده {toPersianDigits(reportsCount)} گزارش خام</span>
              <ArrowLeft className="w-3 h-3" />
            </button>
          ) : (
            <span className="mt-2 text-[10px] bg-black/20 text-white/80 px-2.5 py-0.5 rounded-full font-medium">
              بدون گزارش
            </span>
          )}
        </div>

      </div>
    </div>
  );
}