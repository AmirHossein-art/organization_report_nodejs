// src/components/ReportsPdfDocument.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Printer,
  X,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Report, ReportPeriod, Project, User } from "../types";
import { CustomSelect } from "../components";
import { toPersianDigits } from "../dateUtils";

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

const formatPersianLongDate = (value: string | null | undefined): string => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return toPersianDigits(value);
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    day: "numeric",
    month: "long",
    year: "numeric",
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

interface PageSection {
  heading: string;
  items: Array<{
    text: string;
    date?: string | null;
  }>;
}

interface ReportPageData {
  reportId: number;
  projectTitle: string;
  isContinuation: boolean;
  sections: PageSection[];
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

  // بارگذاری داده‌ها هنگام باز شدن مودال
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

  // لیست فیلترشده و مرتب‌شده بر اساس اولویت پروژه‌ها
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

  // کمکی برای تفکیک خطوط به بالت‌ها
  const parseBulletPoints = (text: string | null | undefined): string[] => {
    if (!text) return [];
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/^([•\-\*\d+\.\s\u06F0-\u06F9\.\-\–\—])+\s*/, "").trim())
      .filter((l) => l.length > 0);
  };

  // الگوریتم صفحه‌بندی هوشمند پروژه‌های طولانی بر اساس ظرفیت واقعی برگه A4
  const paginatedReportPages = useMemo(() => {
    const pages: ReportPageData[] = [];
    const MAX_PAGE_LINES = 68; // گنجایش واقعی تعداد خطوط در یک صفحه A4

    const estimateItemLines = (text: string): number => {
      if (!text) return 1;
      const len = text.length;
      if (len <= 85) return 1.1;
      if (len <= 170) return 2.1;
      if (len <= 255) return 3.1;
      return Math.max(1, Math.ceil(len / 85)) + 0.1;
    };

    orderedReports.forEach((report) => {
      const activitiesList = parseBulletPoints(report.activities_done);
      const resultsList =
        report.achievedActions && report.achievedActions.length > 0
          ? report.achievedActions.map((a) => a.action_text)
          : parseBulletPoints(report.results_achieved);

      const nextActionsList =
        report.nextActions && report.nextActions.length > 0
          ? report.nextActions.map((na) => ({
            text: na.action_text,
            date: na.target_date_raw || (na.target_date ? formatPersianDate(na.target_date) : null),
          }))
          : [];

      // ایجاد بخش‌های خام
      const rawSections: Array<{ heading: string; items: Array<{ text: string; date?: string | null }> }> = [];

      if (activitiesList.length > 0) {
        rawSections.push({
          heading: ".۱ مهم‌ترین اقدامات انجام‌شده در هفته جاری:",
          items: activitiesList.map((text) => ({ text })),
        });
      } else if (report.activities_done) {
        rawSections.push({
          heading: ".۱ مهم‌ترین اقدامات انجام‌شده در هفته جاری:",
          items: [{ text: report.activities_done }],
        });
      }

      if (resultsList.length > 0) {
        rawSections.push({
          heading: "نتایج اقدامات:",
          items: resultsList.map((text) => ({ text })),
        });
      }

      if (nextActionsList.length > 0) {
        rawSections.push({
          heading: ".۲ اقدامات آتی:",
          items: nextActionsList,
        });
      }

      if (rawSections.length === 0) {
        pages.push({
          reportId: report.id,
          projectTitle: report.project_title,
          isContinuation: false,
          sections: [],
        });
        return;
      }

      // محاسبه کل خطوط گزارش
      let totalLinesInReport = 0;
      rawSections.forEach((sec) => {
        totalLinesInReport += 1.3; // عنوان بخش
        sec.items.forEach((item) => {
          totalLinesInReport += estimateItemLines(item.text);
        });
      });

      // اگر کل گزارش در یک صفحه A4 جا می‌شود، تماماً در یک صفحه قرار گیرد
      if (totalLinesInReport <= MAX_PAGE_LINES) {
        pages.push({
          reportId: report.id,
          projectTitle: report.project_title,
          isContinuation: false,
          sections: rawSections,
        });
        return;
      }

      // تقسیم‌بندی روی صفحات A4 در صورت بسیار طولانی بودن
      let currentPageSections: PageSection[] = [];
      let currentLines = 0;
      let isContinuation = false;

      rawSections.forEach((section) => {
        if (section.items.length === 0) return;

        const headingLines = 1.3;

        if (
          currentLines + headingLines + estimateItemLines(section.items[0].text) > MAX_PAGE_LINES &&
          currentPageSections.length > 0
        ) {
          pages.push({
            reportId: report.id,
            projectTitle: report.project_title,
            isContinuation,
            sections: currentPageSections,
          });
          currentPageSections = [];
          currentLines = 0;
          isContinuation = true;
        }

        let currentSection: PageSection = {
          heading: section.heading,
          items: [],
        };
        currentLines += headingLines;

        section.items.forEach((item) => {
          const l = estimateItemLines(item.text);

          if (
            currentLines + l > MAX_PAGE_LINES &&
            (currentSection.items.length > 0 || currentPageSections.length > 0)
          ) {
            if (currentSection.items.length > 0) {
              currentPageSections.push(currentSection);
            }

            pages.push({
              reportId: report.id,
              projectTitle: report.project_title,
              isContinuation,
              sections: currentPageSections,
            });

            currentPageSections = [];
            currentLines = headingLines;
            isContinuation = true;
            currentSection = {
              heading: section.heading + " (ادامه)",
              items: [],
            };
          }

          currentSection.items.push(item);
          currentLines += l;
        });

        if (currentSection.items.length > 0) {
          currentPageSections.push(currentSection);
        }
      });

      if (currentPageSections.length > 0) {
        pages.push({
          reportId: report.id,
          projectTitle: report.project_title,
          isContinuation,
          sections: currentPageSections,
        });
      }
    });

    return pages;
  }, [orderedReports]);

  if (!isOpen) return null;

  const activePeriod = localPeriods.find((p) => p.id === selectedPeriodId);
  const coverDate = activePeriod?.period_end
    ? formatPersianLongDate(activePeriod.period_end)
    : activePeriod?.title
      ? toPersianDigits(activePeriod.title)
      : formatPersianLongDate(new Date().toISOString());

  const reportTypeName = activePeriod?.report_type === "monthly" ? "گزارش ماهانه" : "گزارش هفتگی";

  // پرینت خروجی PDF با تمپلیت استاندارد سایز A4
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
        <title>گزارش پروژه‌های استراتژیک - ${formatPersianDateTime(new Date())}</title>
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
        <style>
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            background-color: #ffffff;
            font-family: 'Vazirmatn', Sahel, Vazir, Shabnam, Tahoma, system-ui, -apple-system, sans-serif;
            direction: rtl;
            text-align: right;
            color: #0f172a;
            font-size: 11.5px;
            line-height: 1.55;
          }

          /* ساختار دقیق صفحه استاندارد A4 */
          .pdf-page-container {
            width: 210mm;
            height: 297mm;
            min-height: 297mm;
            max-height: 297mm;
            padding: 12mm 14mm 10mm 14mm;
            margin: 0 auto;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            background-color: #ffffff;
            box-sizing: border-box;
            overflow: hidden;
          }

          /* صفحه اول / کاور استارتر */
          .cover-page-box {
            background-color: #55913e;
            border-radius: 20px;
            width: 100%;
            height: 100%;
            padding: 44px 36px 36px 36px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            color: #ffffff;
            box-sizing: border-box;
          }

          .cover-subtitle {
            font-size: 20px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 6px;
          }

          .cover-title {
            font-size: 30px;
            font-weight: 900;
            color: #ffffff;
            letter-spacing: -0.5px;
            margin-bottom: 24px;
          }

          .cover-divider {
            width: 100%;
            height: 2px;
            background-color: rgba(255, 255, 255, 0.85);
            margin-bottom: 40px;
          }

          .cover-center {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            margin: auto 0;
          }

          .cover-logo-circle {
            background-color: #ffffff;
            border-radius: 50%;
            width: 145px;
            height: 145px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 26px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          }

          .cover-logo-circle img {
            width: 100px;
            height: 100px;
            object-fit: contain;
          }

          .cover-org-title {
            font-size: 21px;
            font-weight: 800;
            color: #ffffff;
          }

          .cover-bottom-date {
            font-size: 16px;
            font-weight: 700;
            color: #ffffff;
            text-align: right;
            padding-right: 8px;
          }

          /* هدر سبز بالای صفحات گزارش */
          .page-header-banner {
            background-color: #4a8b38;
            color: #ffffff;
            font-weight: 800;
            font-size: 13.5px;
            text-align: center;
            padding: 7px 14px;
            border-radius: 4px;
            margin-bottom: 10px;
            width: 100%;
          }

          /* عنوان پروژه */
          .page-project-title {
            font-size: 14.5px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 8px 0;
            text-align: right;
          }

          /* باکس دور پروژه متناسب با حجم متن */
          .project-main-card {
            border: 1.5px solid #1e293b;
            border-radius: 18px;
            padding: 16px 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            background-color: #ffffff;
          }

          .section-block {
            margin-bottom: 4px;
          }

          .section-heading {
            font-size: 11.5px;
            font-weight: 900;
            color: #0f172a;
            margin-bottom: 5px;
          }

          .bullet-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }

          .bullet-item {
            position: relative;
            padding-right: 14px;
            margin-bottom: 5px;
            font-size: 10.8px;
            line-height: 1.55;
            color: #1e293b;
            text-align: justify;
          }

          .bullet-item::before {
            content: "•";
            position: absolute;
            right: 0;
            top: -1px;
            font-size: 13px;
            font-weight: bold;
            color: #0f172a;
          }

          .target-date-tag {
            display: inline-block;
            direction: ltr;
            font-weight: bold;
            color: #334155;
            margin-right: 4px;
          }

          /* شماره صفحه در وسط و پایین */
          .page-bottom-number {
            text-align: center;
            font-size: 13.5px;
            font-weight: 800;
            color: #0f172a;
            padding-top: 8px;
            margin-top: auto;
          }
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
    }, 450);
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
                قطع استاندارد A4 — {toPersianDigits(paginatedReportPages.length)} صفحه ({toPersianDigits(orderedReports.length)} پروژه)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={paginatedReportPages.length === 0 || loading}
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

        {/* بدنه پیش‌نمایش سند PDF با ابعاد استاندارد A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-300/80 space-y-6 flex flex-col items-center">
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
              <span>در حال بارگذاری اطلاعات گزارش‌ها...</span>
            </div>
          ) : (
            <div
              id="printable-pdf-document"
              ref={printAreaRef}
              className="space-y-6"
            >
              {/* ۱. صفحه کاور و شروع گزارش (Starter Page) با سایز A4 */}
              <div className="pdf-page-container w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] bg-white p-[12mm_14mm_10mm_14mm] rounded-2xl shadow-xl border border-slate-300 overflow-hidden box-border">
                <div className="cover-page-box bg-[#55913e] rounded-3xl p-10 flex flex-col justify-between text-white h-full box-border">
                  {/* بخش بالا */}
                  <div>
                    <div className="cover-subtitle text-xl font-bold opacity-95">
                      {reportTypeName}
                    </div>
                    <div className="cover-title text-3xl font-black mt-1 mb-4">
                      پروژه‌های استراتژیک
                    </div>
                    <div className="cover-divider w-full h-[2px] bg-white/80 my-4" />
                  </div>

                  {/* بخش میانی با لوگوی رسمی سازمان */}
                  <div className="cover-center flex flex-col items-center justify-center text-center my-auto">
                    <div className="cover-logo-circle bg-white rounded-full p-4 w-36 h-36 flex items-center justify-center shadow-xl mb-6">
                      <img
                        src="/logo.png"
                        alt="سازمان حمل و نقل و ترافیک شهرداری تهران"
                        className="w-24 h-24 object-contain"
                      />
                    </div>
                    <div className="cover-org-title text-xl font-extrabold text-white">
                      سازمان حمل‌و‌نقل و ترافیک شهرداری تهران
                    </div>
                  </div>

                  {/* تاریخ پایین صفحه */}
                  <div className="cover-bottom-date text-base font-bold text-white text-right">
                    {coverDate}
                  </div>
                </div>
              </div>

              {/* ۲. صفحات گزارش پروژه‌ها با ابعاد A4 و صفحه‌بندی هوشمند */}
              {paginatedReportPages.length === 0 ? (
                <div className="w-[210mm] bg-white p-12 rounded-2xl text-center text-slate-400 text-xs space-y-2 shadow-sm border border-slate-200">
                  <FileText className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-bold">هیچ گزارشی با فیلترهای انتخابی یافت نشد.</p>
                </div>
              ) : (
                paginatedReportPages.map((pageData, pageIdx) => {
                  return (
                    <div
                      key={`${pageData.reportId}-p${pageIdx}`}
                      className="pdf-page-container w-[210mm] h-[297mm] min-h-[297mm] max-h-[297mm] bg-white p-[12mm_14mm_10mm_14mm] rounded-2xl shadow-xl border border-slate-300 flex flex-col justify-between overflow-hidden box-border"
                    >
                      {/* محتوای بالا و اصلی صفحه */}
                      <div className="w-full">
                        {/* نوار هدر سبز سراسری */}
                        <div className="page-header-banner bg-[#4a8b38] text-white font-extrabold text-xs sm:text-sm text-center py-2 px-4 rounded mb-2.5 shadow-2xs shrink-0">
                          گزارش پروژه‌های استراتژیک سازمان حمل‌و‌نقل وترافیک شهرداری تهران
                        </div>

                        {/* عنوان پروژه */}
                        <h2 className="page-project-title text-sm sm:text-base font-black text-slate-900 mb-2 text-right shrink-0">
                          {pageData.projectTitle}
                          {pageData.isContinuation && (
                            <span className="text-xs font-bold text-slate-500 mr-2">
                              (ادامه)
                            </span>
                          )}
                        </h2>

                        {/* کادر احاطه‌کننده محتوای پروژه متناسب با حجم متن */}
                        <div className="project-main-card border-[1.5px] border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 bg-white">
                          {pageData.sections.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic">
                              موردی برای این پروژه ثبت نشده است.
                            </p>
                          ) : (
                            pageData.sections.map((sec, sIdx) => (
                              <div key={sIdx} className="section-block space-y-1">
                                <div className="section-heading text-xs font-black text-slate-900">
                                  {sec.heading}
                                </div>

                                <ul className="bullet-list space-y-1 pr-1">
                                  {sec.items.map((it, itIdx) => (
                                    <li
                                      key={itIdx}
                                      className="bullet-item text-[10.8px] leading-relaxed text-slate-800 text-justify relative pr-3.5"
                                    >
                                      <span className="absolute right-0 top-0 font-bold">•</span>
                                      <span>{it.text}</span>
                                      {it.date && (
                                        <span className="target-date-tag text-slate-700 font-bold mr-1">
                                          ({toPersianDigits(it.date)})
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* ۳. شماره صفحه به اعداد فارسی در وسط و پایین صفحه */}
                      <div className="page-bottom-number text-center font-bold text-sm text-slate-900 pt-2 shrink-0">
                        {toPersianDigits(pageIdx + 1)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

