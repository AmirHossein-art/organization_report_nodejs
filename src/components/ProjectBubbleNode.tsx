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

    // اقدامات تاریخی ممکن است تاریخ دقیق نداشته باشند.
    if (!action.target_date) {
      return "bg-slate-500 border-white text-white shadow-xs";
    }

    const target = new Date(action.target_date).getTime();

    if (now > target) {
      return "bg-rose-600 border-white text-white animate-pulse shadow-xs";
    }

    return "bg-sky-500 border-white text-white shadow-xs";
  };

  // 🔴/🟢 تغییر رنگ پویای حباب اصلی بر اساس وضعیت گزارش‌های تحویل داده شده
  const bubbleGradient = hasLateReports || reportsCount === 0
    ? "from-amber-500 via-amber-600 to-orange-600 shadow-[0_12px_35px_rgba(245,158,11,0.35)]"
    : "from-emerald-500 via-emerald-600 to-teal-700 shadow-[0_12px_35px_rgba(16,185,129,0.35)]";

  const ACTIONS_PER_RING = 15;
  const ACTION_DOT_SIZE = 32;

  const actionCount = actions.length;

  const ringCount =
    actionCount === 0
      ? 0
      : Math.ceil(actionCount / ACTIONS_PER_RING);

  // با بیشترشدن تعداد حلقه‌ها، دایره مرکزی کمی بزرگ‌تر می‌شود.
  const centerSize = Math.min(
    250,
    200 + Math.max(0, ringCount - 1) * 18,
  );

  // فاصله مرکز پروژه تا حلقه اول
  const firstRingRadius =
    centerSize / 2 + ACTION_DOT_SIZE / 2 + 14;

  // فاصله بین حلقه‌های اقدامات
  const ringGap = ACTION_DOT_SIZE + 14;

  // شعاع بیرونی‌ترین حلقه
  const outerRadius =
    ringCount > 0
      ? firstRingRadius + (ringCount - 1) * ringGap
      : centerSize / 2;

  // اندازه کل فضایی که این پروژه اشغال می‌کند
  const orbitSize = Math.ceil(
    (outerRadius + ACTION_DOT_SIZE / 2 + 20) * 2,
  );

  const getActionPosition = (index: number) => {
    const ringIndex = Math.floor(index / ACTIONS_PER_RING);

    const firstIndexInRing =
      ringIndex * ACTIONS_PER_RING;

    const indexInRing =
      index - firstIndexInRing;

    const itemsInRing = Math.min(
      ACTIONS_PER_RING,
      actionCount - firstIndexInRing,
    );

    const angle =
      -Math.PI / 2 +
      (2 * Math.PI * indexInRing) / itemsInRing;

    const radius =
      firstRingRadius + ringIndex * ringGap;

    return {
      left:
        orbitSize / 2 +
        Math.cos(angle) * radius,

      top:
        orbitSize / 2 +
        Math.sin(angle) * radius,

      ringIndex,
    };
  };

  return (
    <div 
      className="relative flex items-center justify-center my-6 mx-6 group select-none shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 🔮 مجموعه کامل پروژه، مدارها و اقدامات آتی */}
      <div
        className="bubble-floating relative shrink-0"
        style={{
          width: `${orbitSize}px`,
          height: `${orbitSize}px`,
        }}
      >
        {/* 🪐 مدارهای داینامیک؛ برای هر ۱۵ اقدام یک حلقه */}
        {Array.from({ length: ringCount }).map((_, ringIndex) => {
          const currentRadius =
            firstRingRadius + ringIndex * ringGap;

          return (
            <div
              key={`orbit-${ringIndex}`}
              style={{
                width: `${currentRadius * 2}px`,
                height: `${currentRadius * 2}px`,
              }}
              className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed transition-all duration-300 pointer-events-none ${
                isHovered
                  ? "border-emerald-500/50"
                  : "border-slate-300/40"
              }`}
            />
          );
        })}

        {/* ☄️ اقدامات آتی؛ حداکثر ۱۵ مورد در هر حلقه */}
        {actions.map((action, index) => {
          const position = getActionPosition(index);
          const styleClass = getActionStyle(action);

          const targetDateLabel = action.target_date
            ? new Date(action.target_date).toLocaleDateString("fa-IR")
            : "بدون تاریخ مشخص";

          return (
            <div
              key={action.id}
              onClick={(event) => {
                event.stopPropagation();
                onOpenModal(project);
              }}
              style={{
                width: `${ACTION_DOT_SIZE}px`,
                height: `${ACTION_DOT_SIZE}px`,
                left: `${position.left}px`,
                top: `${position.top}px`,
                transform: "translate(-50%, -50%)",
              }}
              className={`absolute z-20 rounded-full border-2 flex items-center justify-center text-[9px] font-extrabold transition-all duration-300 cursor-pointer hover:scale-125 ${styleClass}`}
              title={`${action.action_text} (${targetDateLabel})`}
            >
              {toPersianDigits(index + 1)}
            </div>
          );
        })}

        {/* 🟢 حباب اصلی پروژه با اندازه داینامیک */}
        <div
          onClick={() => onOpenModal(project)}
          style={{
            width: `${centerSize}px`,
            height: `${centerSize}px`,
          }}
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 rounded-full bg-gradient-to-br ${bubbleGradient} text-white p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 group-hover:scale-105 active:scale-95`}
        >
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center mb-1">
            <FolderKanban className="w-4 h-4 text-white" />
          </div>

          <h3 className="font-black text-xs md:text-sm leading-snug line-clamp-2 px-1 text-white">
            {project.title}
          </h3>

          {reportsCount > 0 ? (
            <button
              onClick={(event) => {
                event.stopPropagation();

                if (onOpenReportsLayer) {
                  onOpenReportsLayer(project);
                }
              }}
              className="mt-2 text-[10px] bg-black/25 hover:bg-black/40 backdrop-blur-xs text-white font-extrabold px-3 py-1 rounded-full border border-white/20 transition-all cursor-pointer flex items-center gap-1 shadow-xs active:scale-95"
            >
              <span>
                مشاهده {toPersianDigits(reportsCount)} گزارش خام
              </span>

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