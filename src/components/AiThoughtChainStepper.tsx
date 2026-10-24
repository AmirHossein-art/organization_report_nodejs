import React, { useState, useEffect } from "react";
import {
  Layers,
  Brain,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Workflow,
  AlertCircle,
} from "lucide-react";
import { toPersianDigits } from "../dateUtils";

export interface ThoughtStep {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const DEFAULT_STEPS: ThoughtStep[] = [
  {
    id: "wbs_reading",
    title: "بازخوانی ساختار شکست کار (WBS) و بسته‌های مرجع",
    subtitle: "بررسی ساختار درختی فعالیت‌ها، تحویل‌دادنی‌ها و کدهای مصوب پروژه",
    icon: Layers,
  },
  {
    id: "memory_sync",
    title: "ارتباط با پرونده و حافظه تکاملی پروژه (ProjectMemory)",
    subtitle: "استخراج شناخت هویتی (DNA)، گلوگاه‌های مزمن و الگوی تعهدات قبلی",
    icon: Brain,
  },
  {
    id: "deep_reasoning",
    title: "استدلال داده‌محور، تطبیق ۳ ستونه و سنجش انحراف از محدوده",
    subtitle: "استنتاج روابط معنایی، پیشنهاد بسته‌های تکمیلی WBS و سنجش پیشرفت شاخص‌ها",
    icon: Sparkles,
  },
  {
    id: "rule_audit",
    title: "اعتبارسنجی قوانین سازمان، تقویم شمسی و صدور کارنامه",
    subtitle: "پالایش تکرارها، کنترل ددلاین‌های هجری شمسی و نهایی‌سازی کارنامه ارزیابی",
    icon: ShieldCheck,
  },
];

const REASONING_SUB_TICKERS = [
  "در حال تحلیل استنتاجی از طریق گیت‌وی هوش مصنوعی...",
  "تطبیق اقدامات آتی با بسته‌های کاری PMBOK...",
  "سنجش میزان اصالت و پیشرفت ملموس فیزیکی...",
  "بررسی انطباق اهداف کلان با تحویل‌دادنی‌های گزارش...",
  "سازمان‌دهی نتایج در ساختار استاندارد ممیزی...",
];

interface AiThoughtChainStepperProps {
  title?: string;
  projectOrReportTitle?: string;
  modelGateway?: string;
  customSteps?: ThoughtStep[];
}

export const AiThoughtChainStepper: React.FC<AiThoughtChainStepperProps> = ({
  title = "زنجیره استدلال و ممیزی هوش مصنوعی",
  projectOrReportTitle,
  modelGateway = "9Router AI Gateway",
  customSteps = DEFAULT_STEPS,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // تایمر ثانیه‌شمار زنده
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // شبیه‌سازی پیشرفت طبیعی زنجیره استدلال در طول فراخوانی
  useEffect(() => {
    const step1Timer = setTimeout(() => setCurrentStepIndex(1), 2200);
    const step2Timer = setTimeout(() => setCurrentStepIndex(2), 5500);

    return () => {
      clearTimeout(step1Timer);
      clearTimeout(step2Timer);
    };
  }, []);

  // چرخش عبارات فرعی در حین مرحله استنتاج عمیق (مرحله ۳)
  useEffect(() => {
    if (currentStepIndex >= 2) {
      const tickerTimer = setInterval(() => {
        setTickerIndex((idx) => (idx + 1) % REASONING_SUB_TICKERS.length);
      }, 3500);
      return () => clearInterval(tickerTimer);
    }
  }, [currentStepIndex]);

  return (
    <div className="w-full max-w-2xl mx-auto my-6 bg-slate-950/95 border border-slate-800 rounded-3xl shadow-2xl p-6 text-slate-100 dir-rtl text-right font-sans overflow-hidden relative">
      {/* هاله پس‌زمینه لطیف */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* هدر کامپوننت: عنوان زنجیره + نشانگر زنده مدل و ثانیه‌شمار */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4 mb-6 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-950">
            <Workflow className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="font-black text-sm text-white flex items-center gap-2">
              <span>{title}</span>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h4>
            {projectOrReportTitle && (
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-md font-medium">
                {projectOrReportTitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto text-xs">
          <span className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold">
            ⏱️ {toPersianDigits(elapsedSeconds)} ثانیه
          </span>
          <span className="bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shadow-xs">
            <Cpu className="w-3 h-3 text-emerald-400" />
            <span>{modelGateway}</span>
          </span>
        </div>
      </div>

      {/* لیست مراحل استدلال عمودی (Chain of Thought Stepper) */}
      <div className="space-y-6 relative z-10 pr-2">
        {customSteps.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx < currentStepIndex;
          const isActive = idx === currentStepIndex;

          return (
            <div key={step.id} className="relative flex items-start gap-3.5 group">
              {/* خط اتصال عمودی بین گام‌ها */}
              {idx < customSteps.length - 1 && (
                <div
                  className={`absolute right-4 top-9 bottom-[-14px] w-0.5 transition-colors duration-500 ${
                    idx < currentStepIndex
                      ? "bg-gradient-to-b from-emerald-500 to-teal-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                      : "bg-slate-800"
                  }`}
                />
              )}

              {/* آیکون وضعیت مرحله */}
              <div
                className={`relative z-10 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 border ${
                  isCompleted
                    ? "bg-emerald-950/90 border-emerald-500 text-emerald-400 shadow-sm shadow-emerald-900"
                    : isActive
                    ? "bg-amber-950/90 border-amber-400 text-amber-300 ring-4 ring-amber-500/20 shadow-md shadow-amber-950 scale-105"
                    : "bg-slate-900 border-slate-800 text-slate-600"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <StepIcon className={`w-4 h-4 ${isActive ? "animate-pulse" : ""}`} />
                )}
              </div>

              {/* متن مرحله */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-black text-xs leading-tight transition-colors ${
                      isCompleted
                        ? "text-slate-200"
                        : isActive
                        ? "text-amber-200"
                        : "text-slate-500"
                    }`}
                  >
                    {step.title}
                  </span>

                  {isActive && (
                    <span className="text-[10px] font-black text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-800/60 animate-pulse">
                      در حال اجرا...
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-800/40">
                      تکمیل شد ✓
                    </span>
                  )}
                </div>

                <p
                  className={`text-[11px] leading-5 mt-1 transition-colors ${
                    isActive ? "text-slate-300" : "text-slate-500"
                  }`}
                >
                  {step.subtitle}
                </p>

                {/* پیام زیرمجموعه متغیر در حین استدلال عمیق مرحله ۳ */}
                {isActive && idx === 2 && (
                  <div className="mt-2.5 flex items-center gap-2 bg-slate-900/90 border border-slate-800/90 p-2.5 rounded-xl text-[11px] text-teal-300 animate-fade-in shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-spin" />
                    <span className="truncate font-medium">{REASONING_SUB_TICKERS[tickerIndex]}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* نوار پایینی: یادداشت اطمینان و شفافیت استنتاج */}
      <div className="mt-6 pt-3.5 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5 text-slate-400">
          <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>پاسخ‌ها در پایگاه‌داده امن ذخیره و برای مراجعات بعدی کش می‌شوند.</span>
        </span>
        <span className="text-slate-500 font-mono text-[10px]">PMBOK Zero-Hallucination</span>
      </div>
    </div>
  );
};
