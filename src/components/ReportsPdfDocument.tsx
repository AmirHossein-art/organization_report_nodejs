// src/components/ReportsPdfDocument.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Printer,
  X,
  FileText,
  CheckSquare,
  Clock,
  Crown,
  FileCheck2,
  RefreshCw,
} from "lucide-react";
import { Report, ReportPeriod, Project, User } from "../types";
import { CustomSelect } from "../components";

export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

const formatPersianDate = (value: string | null | undefined): string => {
  if (!value) return "بدون تاریخ مشخص";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date);
};

const formatPersianDateTime = (date: Date): string => {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date);
};

interface ReportsPdfDocumentProps {
  isOpen: boolean;
  onClose: () => void;
  reports?: Report[];
  periods?: ReportPeriod[];
  projects?: Project[];
  users?: User[];
  defaultPeriodId?: number;
}

export default function ReportsPdfDocument({
  isOpen,
  onClose,
  reports,
  periods,
  projects,
  users,
  defaultPeriodId = 0,
}: ReportsPdfDocumentProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(defaultPeriodId);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedDeputy, setSelectedDeputy] = useState<string>("");

  const [localReports, setLocalReports] = useState<Report[]>([]);
  const [localPeriods, setLocalPeriods] = useState<ReportPeriod[]>([]);
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const printAreaRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef<boolean>(false);

  // استخراج لیست یکتای نام معاونت‌ها
  const deputyOptions = useMemo(() => {
    const set = new Set<string>();
    (localUsers || []).filter((u) => u.role === "user" && u.job_title).forEach((u) => {
      if (u.job_title && u.job_title.trim()) set.add(u.job_title.trim());
    });
    return Array.from(set);
  }, [localUsers]);

  // بارگذاری داده‌ها فقط هنگام باز شدن مودال
  useEffect(() => {
    if (!isOpen) {
      isFetchingRef.current = false;
      return;
    }

    if (defaultPeriodId) {
      setSelectedPeriodId(defaultPeriodId);
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    const needFetchReports = !reports || reports.length === 0;
    const needFetchPeriods = !periods || periods.length === 0;
    const needFetchProjects = !projects || projects.length === 0;
    const needFetchUsers = !users || users.length === 0;

    if (reports && reports.length > 0) setLocalReports(reports);
    if (periods && periods.length > 0) setLocalPeriods(periods);
    if (projects && projects.length > 0) setLocalProjects(projects);
    if (users && users.length > 0) setLocalUsers(users);

    if (needFetchReports || needFetchPeriods || needFetchProjects || needFetchUsers) {
      setLoading(true);
      Promise.all([
        needFetchReports ? fetch("/api/reports").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(reports || []),
        needFetchPeriods ? fetch("/api/report-periods").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(periods || []),
        needFetchProjects ? fetch("/api/projects").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(projects || []),
        needFetchUsers ? fetch("/api/users").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(users || []),
      ])
        .then(([reps, pers, projs, usrs]) => {
          if (Array.isArray(reps)) setLocalReports(reps);
          if (Array.isArray(pers)) {
            setLocalPeriods(pers);
            if (!defaultPeriodId && pers.length > 0) {
              const openPeriod = pers.find((p: any) => p.is_open) || pers[0];
              setSelectedPeriodId(openPeriod.id);
            }
          }
          if (Array.isArray(projs)) setLocalProjects(projs);
          if (Array.isArray(usrs)) setLocalUsers(usrs);
        })
        .catch((err) => console.error("Error fetching data in PDF modal:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, defaultPeriodId]);

  // لیست فیلترشده و مرتب‌شده بر اساس اولویت پروژه‌ها در صفحه مدیریت پروژه‌ها
  const orderedReports = useMemo(() => {
    const filtered = localReports.filter((r) => {
      if (selectedPeriodId > 0 && r.period_id !== selectedPeriodId) return false;
      if (selectedProjectId > 0 && r.project_id !== selectedProjectId) return false;
      if (selectedDeputy) {
        const user = localUsers.find((u) => u.id === r.user_id);
        const dep = r.deputy_name || r.user_job_title || user?.job_title;
        if (dep !== selectedDeputy) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const projA = localProjects.find((p) => p.id === a.project_id);
      const projB = localProjects.find((p) => p.id === b.project_id);
      const orderA = projA?.order_index ?? 999;
      const orderB = projB?.order_index ?? 999;
      if (orderA !== orderB) return orderA - orderB;

      const titleCompare = (a.project_title || "").localeCompare(b.project_title || "", "fa");
      if (titleCompare !== 0) return titleCompare;

      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    });
  }, [localReports, localProjects, localUsers, selectedPeriodId, selectedProjectId, selectedDeputy]);

  if (!isOpen) return null;

  const activePeriod = localPeriods.find((p) => p.id === selectedPeriodId);
  const activeProject = localProjects.find((p) => p.id === selectedProjectId);

  const onTimeCount = orderedReports.filter((r) => r.status === "submitted").length;
  const lateCount = orderedReports.filter((r) => r.status === "late").length;

  // موتور مستقل صدور PDF
  const handlePrint = () => {
    if (!printAreaRef.current) return;
    const content = printAreaRef.current.innerHTML;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>گزارش جامع عملکرد سازمان - ${formatPersianDateTime(new Date())}</title>
        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 12mm 10mm 15mm 10mm;
          }
          body {
            font-family: Sahel, Vazir, 'Vazirmatn', Shabnam, Tahoma, system-ui, -apple-system, sans-serif;
            direction: rtl;
            text-align: right;
            background-color: #ffffff;
            color: #0f172a;
            margin: 0;
            padding: 0;
            font-size: 11px;
            line-height: 1.5;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .no-print {
            display: none !important;
          }
          .border { border: 1px solid #cbd5e1; }
          .border-b { border-bottom: 1px solid #e2e8f0; }
          .border-b-2 { border-bottom: 2px solid #0f172a; }
          .border-t { border-top: 1px solid #cbd5e1; }
          .rounded-2xl { border-radius: 14px; }
          .rounded-xl { border-radius: 10px; }
          .rounded-lg { border-radius: 8px; }
          .rounded-full { border-radius: 9999px; }
          .bg-slate-50 { background-color: #f8fafc; }
          .bg-slate-100 { background-color: #f1f5f9; }
          .bg-slate-900 { background-color: #0f172a; }
          .bg-emerald-50 { background-color: #ecfdf5; }
          .bg-emerald-100 { background-color: #d1fae5; }
          .bg-emerald-600 { background-color: #059669; }
          .bg-rose-100 { background-color: #ffe4e6; }
          .bg-indigo-50 { background-color: #eef2ff; }
          .bg-indigo-600 { background-color: #4f46e5; }
          .bg-amber-100 { background-color: #fef3c7; }
          .bg-purple-100 { background-color: #f3e8ff; }
          .text-white { color: #ffffff; }
          .text-slate-400 { color: #94a3b8; }
          .text-slate-500 { color: #64748b; }
          .text-slate-600 { color: #475569; }
          .text-slate-700 { color: #334155; }
          .text-slate-800 { color: #1e293b; }
          .text-slate-900 { color: #0f172a; }
          .text-emerald-700 { color: #047857; }
          .text-emerald-800 { color: #065f46; }
          .text-emerald-900 { color: #064e3b; }
          .text-rose-700 { color: #be123c; }
          .text-rose-900 { color: #881337; }
          .text-indigo-700 { color: #4338ca; }
          .text-indigo-900 { color: #312e81; }
          .text-amber-900 { color: #78350f; }
          .text-purple-800 { color: #6b21a8; }
          .p-2 { padding: 8px; }
          .p-2\\.5 { padding: 10px; }
          .p-3 { padding: 12px; }
          .p-5 { padding: 18px; }
          .p-6 { padding: 20px; }
          .px-1\\.5 { padding-left: 6px; padding-right: 6px; }
          .px-2 { padding-left: 8px; padding-right: 8px; }
          .px-2\\.5 { padding-left: 10px; padding-right: 10px; }
          .py-0\\.5 { padding-top: 2px; padding-bottom: 2px; }
          .py-1 { padding-top: 4px; padding-bottom: 4px; }
          .pb-3 { padding-bottom: 12px; }
          .pb-5 { padding-bottom: 18px; }
          .pt-1 { padding-top: 4px; }
          .pt-4 { padding-top: 14px; }
          .space-y-0\\.5 > * + * { margin-top: 2px; }
          .space-y-1 > * + * { margin-top: 4px; }
          .space-y-1\\.5 > * + * { margin-top: 6px; }
          .space-y-2 > * + * { margin-top: 8px; }
          .space-y-3 > * + * { margin-top: 12px; }
          .space-y-4 > * + * { margin-top: 14px; }
          .space-y-6 > * + * { margin-top: 20px; }
          .flex { display: flex; }
          .flex-wrap { flex-wrap: wrap; }
          .items-center { align-items: center; }
          .items-start { align-items: flex-start; }
          .justify-between { justify-content: space-between; }
          .justify-center { justify-content: center; }
          .gap-1 { gap: 4px; }
          .gap-1\\.5 { gap: 6px; }
          .gap-2 { gap: 8px; }
          .gap-3 { gap: 12px; }
          .gap-4 { gap: 16px; }
          .grid { display: grid; }
          .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .font-medium { font-weight: 500; }
          .font-bold { font-weight: 700; }
          .font-black, .font-extrabold { font-weight: 900; }
          .text-xs { font-size: 11px; }
          .text-sm { font-size: 13px; }
          .text-lg { font-size: 16px; }
          .text-xl { font-size: 18px; }
          .text-\\[11px\\] { font-size: 10.5px; }
          .text-\\[10px\\] { font-size: 9.5px; }
          .text-\\[9px\\] { font-size: 8.5px; }
          .leading-relaxed { line-height: 1.7; }
          .leading-snug { line-height: 1.35; }
          .whitespace-pre-line { white-space: pre-line; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          .w-6 { width: 22px; }
          .h-6 { height: 22px; }
          .shrink-0 { flex-shrink: 0; }
        </style>
      </head>
      <body>
        ${content}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
      setTimeout(() => {
        if (document.body.contains(printFrame)) {
          document.body.removeChild(printFrame);
        }
      }, 1500);
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 md:p-6 dir-rtl font-sans animate-fade-in">
      
      {/* پنجره اصلی مدال */}
      <div className="relative w-full max-w-5xl bg-slate-100 rounded-3xl shadow-2xl border border-slate-700/60 overflow-hidden flex flex-col max-h-[92vh]">

        {/* هدر کنترلی بالای پنجره */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950 text-white flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-white">
                خروجی و صدور PDF جامع گزارش‌های عملکرد
              </h3>
              <p className="text-[11px] text-slate-300 font-medium">
                ویژه مدیریت ارشد — {toPersianDigits(orderedReports.length)} گزارش
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={orderedReports.length === 0 || loading}
              className="bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ / ذخیره به عنوان PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="بستن پنجره"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* نوار فیلترها */}
        <div className="bg-white p-3.5 border-b border-slate-200 text-xs flex flex-wrap items-center gap-3 shrink-0 shadow-2xs">
          
          {/* فیلتر دوره */}
          <div className="w-48 sm:w-56">
            <label className="text-[10px] text-slate-400 font-bold block mb-1">بازه زمانی:</label>
            <CustomSelect
              value={selectedPeriodId}
              onChange={(val) => setSelectedPeriodId(Number(val))}
              options={[
                { value: 0, label: "همه بازه‌ها" },
                ...localPeriods.map((p) => ({ value: p.id, label: toPersianDigits(p.title) })),
              ]}
            />
          </div>

          {/* فیلتر پروژه */}
          <div className="w-48 sm:w-56">
            <label className="text-[10px] text-slate-400 font-bold block mb-1">پروژه:</label>
            <CustomSelect
              value={selectedProjectId}
              onChange={(val) => setSelectedProjectId(Number(val))}
              options={[
                { value: 0, label: "همه پروژه‌ها" },
                ...localProjects.map((pr) => ({ value: pr.id, label: pr.title })),
              ]}
            />
          </div>

          {/* فیلتر معاونت */}
          <div className="w-48 sm:w-56">
            <label className="text-[10px] text-slate-400 font-bold block mb-1">معاونت سازمانی:</label>
            <CustomSelect
              value={selectedDeputy}
              onChange={(val) => setSelectedDeputy(String(val))}
              options={[
                { value: "", label: "همه معاونت‌ها" },
                ...deputyOptions.map((d) => ({ value: d, label: d })),
              ]}
            />
          </div>
        </div>

        {/* بدنه پیش‌نمایش سند PDF (نمایش روی صفحه و پرینت با IFrame) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-200/70">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
              <span>در حال بارگذاری اطلاعات گزارش‌ها...</span>
            </div>
          ) : (
            <div
              id="printable-pdf-document"
              ref={printAreaRef}
              className="max-w-4xl mx-auto bg-white p-6 sm:p-10 rounded-2xl shadow-md border border-slate-200 text-slate-900 space-y-6"
            >
              
              {/* سربرگ رسمی سند PDF */}
              <div className="border-b-2 border-slate-900 pb-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                      گزارش جامع عملکرد و پیشرفت پروژه‌ها
                    </h1>
                    <p className="text-xs text-slate-600 font-bold mt-1">
                      سامانه مدیریت و پایش یکپارچه گزارش‌های سازمانی
                    </p>
                  </div>

                  <div className="text-left text-[11px] text-slate-500 font-medium space-y-0.5">
                    <div>تاریخ صدور: <strong className="text-slate-800 font-sans">{formatPersianDateTime(new Date())}</strong></div>
                    <div>سطح دسترسی: <strong className="text-emerald-800">مدیریت ارشد</strong></div>
                  </div>
                </div>

                {/* نوار وضعیت فیلترها در سند چاپی */}
                <div className="flex flex-wrap items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                  <div className="flex flex-wrap gap-4">
                    <span>بازه زمانی: <strong>{activePeriod ? activePeriod.title : "کلیه بازه‌ها"}</strong></span>
                    <span>پروژه: <strong>{activeProject ? activeProject.title : "کلیه پروژه‌ها"}</strong></span>
                    <span>معاونت: <strong>{selectedDeputy || "کلیه معاونت‌ها"}</strong></span>
                  </div>

                  <div className="flex items-center gap-3 font-bold text-[11px]">
                    <span>کل گزارش‌ها: {toPersianDigits(orderedReports.length)}</span>
                    <span className="text-emerald-700">به‌موقع: {toPersianDigits(onTimeCount)}</span>
                    {lateCount > 0 && <span className="text-rose-700">با تأخیر: {toPersianDigits(lateCount)}</span>}
                  </div>
                </div>
              </div>

              {/* لیست گزارش‌ها بر اساس اولویت پروژه‌ها در صفحه مدیریت پروژه‌ها */}
              {orderedReports.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                  <FileText className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-bold">هیچ گزارشی با فیلترهای انتخابی یافت نشد.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {orderedReports.map((report, idx) => {
                    const isLate = report.status === "late";

                    return (
                      <div
                        key={report.id}
                        className="page-break-avoid bg-white p-5 rounded-2xl border border-slate-300 shadow-2xs space-y-4 text-xs relative group"
                      >
                        {/* هدر کارت گزارش */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                              {toPersianDigits(idx + 1)}
                            </span>
                            <div>
                              <h2 className="font-black text-sm text-slate-900">
                                {report.project_title}
                              </h2>
                              <div className="flex items-center gap-2 text-[11px] mt-0.5">
                                <span className="font-bold text-emerald-800">
                                  معاونت: {report.deputy_name || report.user_job_title || "عمومی"}
                                </span>
                                {report.user_full_name && (
                                  <span className="text-slate-400 font-medium">
                                    (مسئول: {report.user_full_name})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-bold">
                              بازه: {toPersianDigits(report.period_title)}
                            </span>

                            <span
                              className={`px-2.5 py-1 rounded-lg font-black ${
                                isLate
                                  ? "bg-rose-100 text-rose-900 border border-rose-200"
                                  : "bg-emerald-100 text-emerald-900 border border-emerald-200"
                              }`}
                            >
                              {isLate ? "ثبت با تأخیر" : "ثبت به‌موقع"} (📅 {formatPersianDate(report.submitted_at)})
                            </span>
                          </div>
                        </div>

                        {/* ۱. فعالیت‌های انجام‌شده */}
                        <div className="space-y-1.5">
                          <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 text-emerald-900">
                            <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                            فعالیت‌ها و اقدامات انجام‌شده:
                          </h3>
                          <p className="text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                            {report.activities_done || "متنی ثبت نشده است."}
                          </p>
                        </div>

                        {/* ۲. نتایج و اقدامات تحقق‌یافته (چک‌لیست) */}
                        <div className="space-y-2">
                          <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 text-indigo-900">
                            <FileCheck2 className="w-3.5 h-3.5 text-indigo-700" />
                            نتایج و دستاوردهای تحقق‌یافته در این بازه:
                          </h3>

                          {report.achievedActions && report.achievedActions.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {report.achievedActions.map((act) => {
                                const isManager = act.created_by_role === "manager";
                                const isVerified = act.is_completed;

                                return (
                                  <div
                                    key={act.id}
                                    className={`p-2.5 rounded-xl border flex items-start justify-between gap-2 ${
                                      isVerified
                                        ? "bg-emerald-50/60 border-emerald-200"
                                        : "bg-indigo-50/60 border-indigo-200"
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-slate-900 leading-snug">
                                          ✓ {act.action_text}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                        {isManager && (
                                          <span className="inline-flex items-center gap-0.5 text-purple-800 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
                                            <Crown className="w-2.5 h-2.5" /> ابلاغیه مدیر
                                          </span>
                                        )}
                                        {act.target_date && (
                                          <span>سررسید: {formatPersianDate(act.target_date)}</span>
                                        )}
                                      </div>
                                    </div>

                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                                        isVerified ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white"
                                      }`}
                                    >
                                      {isVerified ? "تایید مدیر" : "اعلام پرسنل"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : report.results_achieved ? (
                            <div className="text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                              {report.results_achieved}
                            </div>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic">موردی برای نتایج حاصل‌شده درج نشده است.</p>
                          )}

                          {/* توضیحات تکمیلی متفرقه اگر خارج از بالت‌ها بود */}
                          {report.achievedActions &&
                            report.achievedActions.length > 0 &&
                            report.results_achieved &&
                            !report.results_achieved.startsWith("•") && (
                              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] text-slate-700">
                                <strong className="text-slate-900">سایر توضیحات نتایج: </strong>
                                <span>{report.results_achieved}</span>
                              </div>
                            )}
                        </div>

                        {/* ۳. اقدامات آتی و برنامه دور بعد */}
                        {report.nextActions && report.nextActions.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 text-slate-800">
                              <Clock className="w-3.5 h-3.5 text-slate-600" />
                              اقدامات آتی و برنامه پیش‌رو:
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {report.nextActions.map((na, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-[11px]"
                                >
                                  <span className="text-slate-800 font-medium">{na.action_text}</span>
                                  {na.target_date && (
                                    <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-[10px] shrink-0 font-sans">
                                      📅 {formatPersianDate(na.target_date)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* پانویس سند PDF */}
              <div className="pt-4 border-t border-slate-300 text-center text-[10px] text-slate-500 font-medium">
                سامانه هوشمند گزارش‌دهی سازمانی — صفحه استخراج اختصاصی مدیر
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
