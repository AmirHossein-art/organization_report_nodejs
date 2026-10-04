// src/components/ReportsPdfDocument.tsx
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Printer,
  X,
  FileText,
  RefreshCw,
} from "lucide-react";
import { Report, ReportPeriod, Project, User, ProjectKpi } from "../types";
import { CustomSelect } from "../components";
import { toPersianDigits } from "../dateUtils";
import { KpiMatrixTable } from "./KpiMatrixTable";

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
  currentUser?: User;
  defaultPeriodId?: number;
}

export interface PageSectionItem {
  text: string;
  date?: string | null;
  status?: "completed" | "overdue" | "upcoming" | "cancelled";
  cancellationReason?: string | null;
}

interface PageSection {
  heading: string;
  type?: "bullets" | "kpi_table";
  items: Array<PageSectionItem>;
  kpiValues?: any[];
  kpiText?: string | null;
}

interface PageBlock {
  reportId: number;
  projectTitle: string;
  isContinuation: boolean;
  sections: PageSection[];
}

interface ReportPageData {
  blocks: PageBlock[];
}

const PDF_DOCUMENT_STYLES = `
  /* ==========================================================================
     گزارش جامع عملکرد - استایل‌های استاندارد مشترک بین وب و پرینت کروم
     Single Source of Truth: Web Preview & Chrome Print
     ========================================================================== */

  * {
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  #printable-pdf-document {
    direction: rtl !important;
    text-align: right !important;
    font-family: 'Vazirmatn', Sahel, Vazir, Shabnam, Tahoma, system-ui, -apple-system, sans-serif !important;
    color: #0f172a !important;
    -webkit-font-smoothing: antialiased !important;
  }

  /* ۱. ابعاد و کانتینر استاندارد برگه A4 */
  .pdf-page-container {
    width: 210mm !important;
    max-width: 210mm !important;
    height: 296.5mm !important;
    min-height: 296.5mm !important;
    max-height: 296.5mm !important;
    padding: 10mm 14mm 10mm 14mm !important;
    box-sizing: border-box !important;
    background-color: #ffffff !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
    position: relative !important;
    overflow: hidden !important;
    direction: rtl !important;
  }

  /* استایل اختصاصی پیش‌نمایش در وب (داخل مودال سایت) */
  @media screen {
    .pdf-page-container {
      margin: 0 auto 28px auto !important;
      border-radius: 20px !important;
      border: 1px solid #cbd5e1 !important;
      box-shadow: 0 12px 30px -6px rgba(15, 23, 42, 0.15), 0 4px 12px -2px rgba(15, 23, 42, 0.08) !important;
    }
  }

  /* استایل اختصاصی چاپ در کروم (Print / Save as PDF) */
  @media print {
    @page {
      size: A4;
      margin: 0;
    }

    html, body {
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background-color: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    #printable-pdf-document {
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .pdf-page-container {
      width: 210mm !important;
      max-width: 210mm !important;
      height: 296.5mm !important;
      min-height: 296.5mm !important;
      max-height: 296.5mm !important;
      padding: 10mm 14mm 10mm 14mm !important;
      margin: 0 auto !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      box-sizing: border-box !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .pdf-page-container:first-child {
      page-break-before: avoid !important;
      break-before: avoid !important;
      margin-top: 0 !important;
    }

    .pdf-page-container:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
  }

  /* ۲. استایل‌های صفحه کاور اول */
  .cover-page-box {
    background-color: #55913e !important;
    border-radius: 20px !important;
    width: 100% !important;
    height: 100% !important;
    padding: 36px 32px !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: space-between !important;
    color: #ffffff !important;
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .cover-subtitle {
    font-size: 20px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    opacity: 0.95 !important;
    margin-bottom: 6px !important;
  }

  .cover-title {
    font-size: 28px !important;
    font-weight: 900 !important;
    color: #ffffff !important;
    letter-spacing: -0.5px !important;
    margin-bottom: 16px !important;
  }

  .cover-divider {
    width: 100% !important;
    height: 2px !important;
    background-color: rgba(255, 255, 255, 0.85) !important;
    margin-bottom: 24px !important;
  }

  .cover-center {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    text-align: center !important;
    margin: auto 0 !important;
  }

  .cover-logo-circle {
    background-color: #ffffff !important;
    border-radius: 50% !important;
    width: 120px !important;
    height: 120px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    margin-bottom: 20px !important;
    box-shadow: 0 6px 16px rgba(0,0,0,0.12) !important;
  }

  .cover-logo-circle img {
    width: 82px !important;
    height: 82px !important;
    object-fit: contain !important;
  }

  .cover-org-title {
    font-size: 20px !important;
    font-weight: 800 !important;
    color: #ffffff !important;
  }

  .cover-bottom-date {
    font-size: 15px !important;
    font-weight: 700 !important;
    color: #ffffff !important;
    text-align: right !important;
  }

  /* ۳. استایل‌های صفحات گزارش */
  .page-top-content {
    width: 100% !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    flex: 1 1 auto !important;
  }

  .page-header-banner {
    background-color: #4a8b38 !important;
    color: #ffffff !important;
    font-weight: 800 !important;
    font-size: 14.5px !important;
    text-align: center !important;
    padding: 6px 14px !important;
    border-radius: 6px !important;
    margin-bottom: 8px !important;
    width: 100% !important;
    box-sizing: border-box !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .page-project-title {
    font-size: 17px !important;
    font-weight: 900 !important;
    color: #0f172a !important;
    margin: 0 0 8px 0 !important;
    text-align: right !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
  }

  .page-project-title .continuation-tag {
    font-size: 13.5px !important;
    font-weight: 700 !important;
    color: #64748b !important;
  }

  .project-main-card {
    border: 1.5px solid #1e293b !important;
    border-radius: 16px !important;
    padding: 14px 18px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    background-color: #ffffff !important;
    box-sizing: border-box !important;
  }

  .section-block {
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
  }

  .section-heading {
    font-size: 14.5px !important;
    font-weight: 800 !important;
    color: #0f172a !important;
    margin-bottom: 4px !important;
  }

  .bullet-list {
    list-style: none !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 5px !important;
  }

  .bullet-item {
    position: relative !important;
    padding-right: 16px !important;
    font-size: 14px !important;
    line-height: 1.5 !important;
    color: #1e293b !important;
    text-align: justify !important;
    word-break: break-word !important;
  }

  .bullet-item .bullet-dot {
    position: absolute !important;
    right: 0 !important;
    top: 0px !important;
    font-size: 15px !important;
    font-weight: bold !important;
    line-height: 1 !important;
  }

  .action-status-badge {
    display: inline-block !important;
    padding: 2px 7px !important;
    border-radius: 4px !important;
    font-size: 11.5px !important;
    font-weight: 700 !important;
    margin-left: 8px !important;
    vertical-align: middle !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .action-status-badge.completed {
    background-color: #ecfdf5 !important;
    color: #065f46 !important;
    border: 1px solid #6ee7b7 !important;
  }

  .action-status-badge.overdue {
    background-color: #fff1f2 !important;
    color: #be123c !important;
    border: 1px solid #fecdd3 !important;
  }

  .action-status-badge.cancelled {
    background-color: #f8fafc !important;
    color: #475569 !important;
    border: 1px solid #cbd5e1 !important;
  }

  .action-target-date {
    display: inline-block !important;
    direction: ltr !important;
    font-weight: 700 !important;
    color: #475569 !important;
    margin-right: 6px !important;
    font-size: 12.5px !important;
  }

  .action-cancellation-reason {
    color: #9f1239 !important;
    font-weight: 700 !important;
    font-size: 12px !important;
    margin-right: 6px !important;
  }

  .kpi-matrix-table {
    width: 100% !important;
    border-collapse: collapse !important;
    border: 1px solid #cbd5e1 !important;
    font-size: 11.5px !important;
    line-height: 1.35 !important;
  }

  .kpi-matrix-table th, .kpi-matrix-table td {
    border: 1px solid #cbd5e1 !important;
    padding: 4px 6px !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .kpi-matrix-table thead tr {
    background-color: #f1f5f9 !important;
    color: #1e293b !important;
    font-weight: bold !important;
  }

  /* ۴. نوار فوتر امن در پایین برگه A4 */
  .page-footer-bar {
    width: 100% !important;
    height: 24px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border-top: 1px solid #e2e8f0 !important;
    padding-top: 4px !important;
    margin-top: auto !important;
    flex-shrink: 0 !important;
    box-sizing: border-box !important;
  }

  .page-footer-text {
    font-size: 12px !important;
    font-weight: 700 !important;
    color: #64748b !important;
    letter-spacing: -0.2px !important;
  }
`;

export default function ReportsPdfDocument({
  isOpen,
  onClose,
  reports,
  periods,
  projects,
  users,
  currentUser,
  defaultPeriodId = 0,
}: ReportsPdfDocumentProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(defaultPeriodId);
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedDeputy, setSelectedDeputy] = useState<string>("");
  const [actionsFilter, setActionsFilter] = useState<"all" | "future_only">("all");

  const [localReports, setLocalReports] = useState<Report[]>([]);
  const [localPeriods, setLocalPeriods] = useState<ReportPeriod[]>([]);
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [localUsers, setLocalUsers] = useState<User[]>([]);
  const [localKpis, setLocalKpis] = useState<ProjectKpi[]>([]);
  const [localNextActions, setLocalNextActions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const printAreaRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef<boolean>(false);

  const isManager = !currentUser || currentUser.role === "manager";

  // استخراج لیست یکتای نام معاونت‌ها (برای پرسنل عادی فقط معاونت خودش)
  const deputyOptions = useMemo(() => {
    if (!isManager) {
      const userDeputy = currentUser?.job_title?.trim();
      if (userDeputy) return [userDeputy];
      const set = new Set<string>();
      localReports.forEach((r) => {
        const dep = r.deputy_name || r.user_job_title;
        if (dep && dep.trim()) set.add(dep.trim());
      });
      return Array.from(set);
    }
    const set = new Set<string>();
    (localUsers || []).filter((u) => u.role === "user" && u.job_title).forEach((u) => {
      if (u.job_title && u.job_title.trim()) set.add(u.job_title.trim());
    });
    return Array.from(set);
  }, [localUsers, localReports, currentUser, isManager]);

  // پروژه‌های در دسترس (برای پرسنل عادی فقط پروژه‌های مربوط به گزارش‌های خودش)
  const availableProjects = useMemo(() => {
    if (isManager) return localProjects;
    const projectIdsInReports = new Set(localReports.map((r) => r.project_id));
    return localProjects.filter((p) => projectIdsInReports.has(p.id));
  }, [localProjects, localReports, isManager]);

  // دوره‌های در دسترس (برای پرسنل عادی فقط دوره‌هایی که گزارش دارند)
  const availablePeriods = useMemo(() => {
    if (isManager) return localPeriods;
    const periodIdsInReports = new Set(localReports.map((r) => r.period_id));
    return localPeriods.filter((p) => periodIdsInReports.has(p.id));
  }, [localPeriods, localReports, isManager]);

  // بارگذاری داده‌ها هنگام باز شدن مودال — با اولویت نمایش بلادرنگ و کش محلی
  useEffect(() => {
    if (!isOpen) {
      isFetchingRef.current = false;
      return;
    }

    if (defaultPeriodId !== undefined && defaultPeriodId !== null) {
      setSelectedPeriodId(defaultPeriodId);
    }

    // ۱. همگام‌سازی بلادرنگ داده‌های ارسال‌شده از صفحه والد (نمایش بدون ۱ میلی‌ثانیه تاخیر)
    const hasPropsReports = Array.isArray(reports) && reports.length > 0;
    const hasPropsPeriods = Array.isArray(periods) && periods.length > 0;
    const hasPropsProjects = Array.isArray(projects) && projects.length > 0;
    const hasPropsUsers = Array.isArray(users) && users.length > 0;

    if (hasPropsReports) setLocalReports(reports);
    if (hasPropsPeriods) {
      setLocalPeriods(periods);
      if (defaultPeriodId === undefined) {
        const openPeriod = periods.find((p: any) => p.is_open) || periods[0];
        if (openPeriod) setSelectedPeriodId(openPeriod.id);
      }
    }
    if (hasPropsProjects) setLocalProjects(projects);
    if (hasPropsUsers) setLocalUsers(users);

    // تنها در صورتی که هیچ گزارشی از قبل موجود نباشد لودینگ نمایش داده می‌شود
    if (!hasPropsReports && localReports.length === 0) {
      setLoading(true);
    }

    // جلوگیری از ارسال مکرر درخواست‌های همزمان به سرور Railway
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    // واکشی موازی داده‌های تکمیلی بدون بلاک کردن نمایش گزارش‌ها
    Promise.all([
      !hasPropsReports && localReports.length === 0 ? fetch("/api/reports").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(null),
      !hasPropsPeriods && localPeriods.length === 0 ? fetch("/api/report-periods").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(null),
      !hasPropsProjects && localProjects.length === 0 ? fetch("/api/projects").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(null),
      !hasPropsUsers && localUsers.length === 0 ? fetch("/api/users").then((r) => (r.ok ? r.json() : [])) : Promise.resolve(null),
      localKpis.length === 0 ? fetch("/api/project-kpis").then((r) => (r.ok ? r.json() : [])).catch(() => []) : Promise.resolve(null),
      localNextActions.length === 0 ? fetch("/api/next-actions").then((r) => (r.ok ? r.json() : [])).catch(() => []) : Promise.resolve(null),
    ])
      .then(([reps, pers, projs, usrs, kps, acts]) => {
        if (Array.isArray(reps)) setLocalReports(reps);
        if (Array.isArray(pers) && pers.length > 0) {
          setLocalPeriods(pers);
          if (defaultPeriodId === undefined) {
            const openPeriod = pers.find((p: any) => p.is_open) || pers[0];
            if (openPeriod) setSelectedPeriodId(openPeriod.id);
          }
        }
        if (Array.isArray(projs)) setLocalProjects(projs);
        if (Array.isArray(usrs)) setLocalUsers(usrs);
        if (Array.isArray(kps) && kps.length > 0) setLocalKpis(kps);
        if (Array.isArray(acts) && acts.length > 0) setLocalNextActions(acts);
      })
      .catch((err) => console.error("Error fetching supplemental PDF data:", err))
      .finally(() => setLoading(false));
  }, [isOpen, defaultPeriodId]);

  // نقشه‌بندی اقدامات آتی تعریف‌شده به تفکیک پروژه
  const projectActionsMap = useMemo(() => {
    const map: Record<number, any[]> = {};
    (localNextActions || []).forEach((action: any) => {
      const pid = action.project_id || action.report?.project_id;
      if (pid) {
        if (!map[pid]) map[pid] = [];
        if (!action.is_cancelled) {
          map[pid].push(action);
        }
      }
    });
    return map;
  }, [localNextActions]);

  // مپ سریع شاخص‌ها برای دسترسی به نام، واحد و هدف
  const kpiMap = useMemo(() => {
    const map: Record<number, ProjectKpi> = {};
    (localKpis || []).forEach((k) => {
      map[k.id] = k;
    });
    return map;
  }, [localKpis]);

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

  // کمکی برای تفکیک خطوط به بالت‌ها (با شکستن پاراگراف‌های بسیار طولانی جهت جلوگیری از سرریز در صفحه A4)
  const parseBulletPoints = (text: string | null | undefined): string[] => {
    if (!text) return [];
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/^([•\-\*\d+\.\s\u06F0-\u06F9\.\-\–\—])+\s*/, "").trim())
      .filter((l) => l.length > 0);

    const result: string[] = [];
    lines.forEach((line) => {
      // اگر یک پاراگراف بدون اینتر طولانی باشد (بیش از ۱۸۰ کاراکتر)،
      // آن را بر اساس علائم نگارشی به جملات کوچکتر تفکیک کن تا در صورت لزوم بین صفحات بشکند
      if (line.length > 180) {
        const sentences = line.split(/(?<=[.!?؛؟\n])\s+/).filter((s) => s.trim().length > 0);
        if (sentences.length > 1) {
          result.push(...sentences);
          return;
        }
      }
      result.push(line);
    });
    return result;
  };

  // الگوریتم صفحه‌بندی هوشمند: چند گزارش کوتاه در یک صفحه، گزارش‌های بلند به چند صفحه
  const paginatedReportPages = useMemo(() => {
    // 📏 محاسبات استاندارد صفحه A4 (فونت ۱۴ و فاصله‌بندی متوازن)
    const pages: ReportPageData[] = [];
    const MAX_PAGE_LINES = 38; // گنجایش ایمن و استاندارد صفحه A4 با فونت ۱۴
    const BLOCK_OVERHEAD_LINES = 3.5; // هزینه عنوان پروژه، کادر و حاشیه‌ها
    const BLOCK_GAP_LINES = 1.5; // فاصله بین دو گزارش در یک صفحه مشترک
    const MAX_PAGE_CONTENT_LINES = MAX_PAGE_LINES - BLOCK_OVERHEAD_LINES; // گنجایش محتوای مفید (۳۴.۵ خط)

    const estimateItemLines = (text: string): number => {
      if (!text) return 1;
      const lines = Math.max(1, Math.ceil(text.length / 80));
      return lines + 0.25;
    };

    // هزینه هر گزارش به خطوط معادل صفحه‌ای
    const measureReport = (report: Report) => {
      const activitiesList = parseBulletPoints(report.activities_done);
      const resultsList =
        report.achievedActions && report.achievedActions.length > 0
          ? report.achievedActions.map((a) => a.action_text)
          : parseBulletPoints(report.results_achieved);

      // جمع‌آوری تمامی اقدامات آتی تعریف‌شده برای این پروژه (شامل دوره‌های گذشته و جاری و لغوشده‌ها)
      const allProjectActions = [
        ...(projectActionsMap[report.project_id] || []),
        ...(report.nextActions || []),
      ];

      const seenActionTexts = new Set<string>();
      const deduplicatedActions: any[] = [];
      allProjectActions.forEach((na: any) => {
        if (!na) return;
        const textKey = (na.action_text || "").trim();
        if (textKey && !seenActionTexts.has(textKey)) {
          seenActionTexts.add(textKey);
          deduplicatedActions.push(na);
        }
      });

      // اعمال فیلتر اقدامات آتی در صورت انتخاب کاربر (فقط اقدامات آینده که تاریخشان نرسیده است)
      let filteredActions = deduplicatedActions;
      if (actionsFilter === "future_only") {
        const nowTime = Date.now();
        filteredActions = deduplicatedActions.filter((item: any) => {
          if (item.is_completed || item.is_cancelled) return false;
          if (!item.target_date) return true;
          return new Date(item.target_date).getTime() >= nowTime;
        });
      }

      // اولویت‌بندی مرتب‌سازی:
      // ۱. اقدامات در دست اقدام (آتی نرسیده)
      // ۲. اقدامات گذشته از موعد / دارای تأخیر
      // ۳. اقدامات تکمیل‌شده
      // ۴. اقدامات لغو/حذف‌شده توسط پرسنل با ذکر دلیل
      filteredActions.sort((a, b) => {
        const getPriority = (item: any) => {
          if (item.is_cancelled) return 4;
          if (item.is_completed) return 3;
          const isOverdue = item.target_date && new Date(item.target_date).getTime() < Date.now();
          if (isOverdue) return 2;
          return 1;
        };
        return getPriority(a) - getPriority(b);
      });

      const nextActionsList: PageSectionItem[] =
        filteredActions.length > 0
          ? filteredActions.map((na) => {
            let status: "completed" | "overdue" | "upcoming" | "cancelled" = "upcoming";
            const isOverdue = !na.is_completed && !na.is_cancelled && na.target_date && new Date(na.target_date).getTime() < Date.now();
            if (na.is_cancelled) status = "cancelled";
            else if (na.is_completed) status = "completed";
            else if (isOverdue) status = "overdue";

            return {
              text: na.action_text,
              date: na.target_date_raw || (na.target_date ? formatPersianDate(na.target_date) : null),
              status,
              cancellationReason: na.cancellation_reason,
            };
          })
          : [];

      // ایجاد بخش‌های خام
      const rawSections: Array<PageSection> = [];

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

      // بخش ۳: شاخص‌های کلیدی عملکرد (KPI) با جدول ماتریسی فشرده
      const hasStructuredKpis = Array.isArray(report.kpiValues) && report.kpiValues.length > 0;
      const hasKpiText = Boolean(report.kpi_text && report.kpi_text.trim());

      if (hasStructuredKpis || hasKpiText) {
        rawSections.push({
          heading: ".۳ شاخص‌های کلیدی عملکرد (KPI):",
          type: "kpi_table",
          items: [],
          kpiValues: report.kpiValues || [],
          kpiText: report.kpi_text,
        });
      } else {
        rawSections.push({
          heading: ".۳ شاخص‌های کلیدی عملکرد (KPI):",
          type: "bullets",
          items: [{ text: "شاخص عملکردی برای این دوره ثبت نشده است." }],
        });
      }

      let totalLinesInReport = 0;
      rawSections.forEach((sec) => {
        totalLinesInReport += 1.4; // عنوان بخش
        if (sec.type === "kpi_table") {
          const rowCount = sec.kpiValues && sec.kpiValues.length > 0 ? sec.kpiValues.length : 1;
          totalLinesInReport += 3.0 + (rowCount * 2.1);
        } else {
          sec.items.forEach((item) => {
            totalLinesInReport += estimateItemLines(item.text);
          });
        }
      });

      return { rawSections, totalLinesInReport };
    };

    // ساخت بلوک‌های صفحات یک گزارش طولانی
    const splitLongReport = (
      report: Report,
      rawSections: PageSection[]
    ): PageBlock[] => {
      const blocks: PageBlock[] = [];
      let currentPageSections: PageSection[] = [];
      let currentLines = 0;
      let isContinuation = false;

      rawSections.forEach((section) => {
        const headingLines = 1.4;

        if (section.type === "kpi_table") {
          const rowCount = section.kpiValues && section.kpiValues.length > 0 ? section.kpiValues.length : 1;
          const tableLines = 3.0 + (rowCount * 2.1);

          if (
            currentLines + headingLines + tableLines > MAX_PAGE_CONTENT_LINES &&
            currentPageSections.length > 0
          ) {
            blocks.push({
              reportId: report.id,
              projectTitle: report.project_title,
              isContinuation,
              sections: currentPageSections,
            });
            currentPageSections = [];
            currentLines = 0;
            isContinuation = true;
          }

          currentPageSections.push({
            heading: isContinuation && currentPageSections.length === 0 ? `${section.heading} (ادامه)` : section.heading,
            type: "kpi_table",
            items: [],
            kpiValues: section.kpiValues,
            kpiText: section.kpiText,
          });
          currentLines += headingLines + tableLines;
          return;
        }

        if (section.items.length === 0) return;

        if (
          currentLines + headingLines + estimateItemLines(section.items[0].text) > MAX_PAGE_CONTENT_LINES &&
          currentPageSections.length > 0
        ) {
          blocks.push({
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
          heading: isContinuation && currentPageSections.length === 0 ? `${section.heading} (ادامه)` : section.heading,
          items: [],
        };
        currentLines += headingLines;

        section.items.forEach((item) => {
          const l = estimateItemLines(item.text);

          if (
            currentLines + l > MAX_PAGE_CONTENT_LINES &&
            (currentSection.items.length > 0 || currentPageSections.length > 0)
          ) {
            if (currentSection.items.length > 0) {
              currentPageSections.push(currentSection);
            }

            blocks.push({
              reportId: report.id,
              projectTitle: report.project_title,
              isContinuation,
              sections: currentPageSections,
            });

            currentPageSections = [];
            currentLines = headingLines;
            isContinuation = true;
            currentSection = {
              heading: `${section.heading} (ادامه)`,
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
        blocks.push({
          reportId: report.id,
          projectTitle: report.project_title,
          isContinuation,
          sections: currentPageSections,
        });
      }

      return blocks;
    };

    let currentPage: ReportPageData = { blocks: [] };
    let currentPageLines = 0;

    const flushPage = () => {
      if (currentPage.blocks.length > 0) {
        pages.push(currentPage);
      }
      currentPage = { blocks: [] };
      currentPageLines = 0;
    };

    orderedReports.forEach((report) => {
      const { rawSections, totalLinesInReport } = measureReport(report);

      if (rawSections.length === 0) {
        // گزارش خالی: بلوک ساده در صفحه جاری
        const emptyBlockCost = BLOCK_OVERHEAD_LINES + 2;
        if (currentPageLines + emptyBlockCost > MAX_PAGE_LINES) {
          flushPage();
        }
        currentPage.blocks.push({
          reportId: report.id,
          projectTitle: report.project_title,
          isContinuation: false,
          sections: [],
        });
        currentPageLines += emptyBlockCost + (currentPage.blocks.length > 1 ? BLOCK_GAP_LINES : 0);
        return;
      }

      // گزارشی که کلش در یک صفحه جا می‌شود: در صورت امکان به صفحه جاری اضافه شود
      if (totalLinesInReport + BLOCK_OVERHEAD_LINES <= MAX_PAGE_LINES) {
        const blockCost =
          BLOCK_OVERHEAD_LINES + totalLinesInReport + (currentPage.blocks.length > 0 ? BLOCK_GAP_LINES : 0);

        if (currentPageLines + blockCost <= MAX_PAGE_LINES) {
          currentPage.blocks.push({
            reportId: report.id,
            projectTitle: report.project_title,
            isContinuation: false,
            sections: rawSections,
          });
          currentPageLines += blockCost;
        } else {
          flushPage();
          currentPage.blocks.push({
            reportId: report.id,
            projectTitle: report.project_title,
            isContinuation: false,
            sections: rawSections,
          });
          currentPageLines += BLOCK_OVERHEAD_LINES + totalLinesInReport;
        }
        return;
      }

      // گزارش بسیار طولانی است: صفحه جاری بسته شود و گزارش روی صفحات متعدد شکسته شود
      flushPage();
      splitLongReport(report, rawSections).forEach((block) => {
        pages.push({ blocks: [block] });
      });
    });

    flushPage();

    return pages;
  }, [orderedReports, actionsFilter, projectActionsMap]);

  if (!isOpen) return null;

  const activePeriod = localPeriods.find((p) => p.id === selectedPeriodId);
  const coverDate = activePeriod?.period_end
    ? formatPersianLongDate(activePeriod.period_end)
    : activePeriod?.title
      ? toPersianDigits(activePeriod.title)
      : formatPersianLongDate(new Date().toISOString());

  const reportTypeName = activePeriod?.report_type === "monthly" ? "گزارش ماهانه" : "گزارش هفتگی";

  // پرینت خروجی PDF با تمپلیت استاندارد سایز A4 بدون سرریز و با لود آنی
  const handlePrint = () => {
    if (!printAreaRef.current) return;
    const content = printAreaRef.current.innerHTML;

    // استخراج تمامی کدهای CSS کامپایل‌شده اپلیکیشن بدون نیاز به دانلود مجدد شبکه
    let combinedCss = "";
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (rules) {
          for (let i = 0; i < rules.length; i++) {
            combinedCss += rules[i].cssText + "\n";
          }
        }
      } catch (e) {
        // نادیده گرفتن استایل‌های cross-origin
      }
    });

    // پاک‌سازی پرینت‌فریم قبلی در صورت وجود
    const existingFrame = document.getElementById("reports-a4-print-iframe");
    if (existingFrame) existingFrame.remove();

    const printFrame = document.createElement("iframe");
    printFrame.id = "reports-a4-print-iframe";
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.visibility = "hidden";
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <base href="${window.location.origin}">
        <title>گزارش پروژه‌های استراتژیک - ${formatPersianDateTime(new Date())}</title>
        <style>
          ${combinedCss}
          ${PDF_DOCUMENT_STYLES}
        </style>
      </head>
      <body>
        <div id="printable-pdf-document">
          ${content}
        </div>
      </body>
      </html>
    `);
    doc.close();

    // اجرای فوری چاپ به محض آماده شدن سند بدون معطلی لودینگ مرورگر
    const executePrint = () => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();
    };

    if (doc.readyState === "complete") {
      setTimeout(executePrint, 60);
    } else {
      printFrame.onload = () => setTimeout(executePrint, 60);
    }
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
                ...availablePeriods.map((p) => ({ value: p.id, label: toPersianDigits(p.title) })),
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
                ...availableProjects.map((pr) => ({ value: pr.id, label: pr.title })),
              ]}
            />
          </div>

          {/* فیلتر معاونت (فقط برای مدیران یا در صورت وجود چند معاونت نمایش داده می‌شود) */}
          {(isManager || deputyOptions.length > 1) && (
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
          )}

          {/* فیلتر اقدامات آتی */}
          <div className="w-56 sm:w-64">
            <label className="text-[10px] text-slate-400 font-bold block mb-1">اقدامات آتی:</label>
            <CustomSelect
              value={actionsFilter}
              onChange={(val) => setActionsFilter(String(val) as "all" | "future_only")}
              options={[
                { value: "all", label: "همه اقدامات تعریف‌شده (پایه)" },
                { value: "future_only", label: "فقط اقدامات آینده (سررسید نرسیده)" },
              ]}
            />
          </div>
        </div>

        {/* بدنه پیش‌نمایش سند PDF با ابعاد استاندارد A4 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-300/80 space-y-6 flex flex-col items-center">
          {/* استایل‌های جامع مشترک خروجی و پیش‌نمایش A4 */}
          <style dangerouslySetInnerHTML={{ __html: PDF_DOCUMENT_STYLES }} />

          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
              <span>در حال بارگذاری اطلاعات گزارش‌ها...</span>
            </div>
          ) : (
            <div
              id="printable-pdf-document"
              ref={printAreaRef}
            >
              {/* ۱. صفحه کاور و شروع گزارش (Starter Page) با سایز A4 */}
              <div className="pdf-page-container">
                <div className="cover-page-box">
                  {/* بخش بالا */}
                  <div>
                    <div className="cover-subtitle">
                      {reportTypeName}
                    </div>
                    <div className="cover-title">
                      پروژه‌های استراتژیک
                    </div>
                    <div className="cover-divider" />
                  </div>

                  {/* بخش میانی با لوگوی رسمی سازمان */}
                  <div className="cover-center">
                    <div className="cover-logo-circle">
                      <img
                        src="/logo.png"
                        alt="سازمان حمل و نقل و ترافیک شهرداری تهران"
                      />
                    </div>
                    <div className="cover-org-title">
                      سازمان حمل‌و‌نقل و ترافیک شهرداری تهران
                    </div>
                  </div>

                  {/* تاریخ پایین صفحه */}
                  <div className="cover-bottom-date">
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
                      key={`page-${pageIdx}`}
                      className="pdf-page-container"
                    >
                      {/* محتوای بالا و اصلی صفحه */}
                      <div className="page-top-content">
                        {/* نوار هدر سبز سراسری */}
                        <div className="page-header-banner">
                          گزارش پروژه‌های استراتژیک سازمان حمل‌و‌نقل وترافیک شهرداری تهران
                        </div>

                        {/* چند گزارش می‌توانند در یک صفحه باشند */}
                        {pageData.blocks.map((block, bIdx) => (
                          <div key={`p${pageIdx}-b${bIdx}`}>
                            {/* عنوان پروژه */}
                            <h2 className="page-project-title">
                              <span>{block.projectTitle}</span>
                              {block.isContinuation && (
                                <span className="continuation-tag">
                                  (ادامه)
                                </span>
                              )}
                            </h2>

                            {/* کادر احاطه‌کننده محتوای پروژه */}
                            <div className="project-main-card">
                              {block.sections.length === 0 ? (
                                <p style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>
                                  موردی برای این پروژه ثبت نشده است.
                                </p>
                              ) : (
                                block.sections.map((sec, sIdx) => (
                                  <div key={sIdx} className="section-block">
                                    <div className="section-heading">
                                      {sec.heading}
                                    </div>

                                    {sec.type === "kpi_table" ? (
                                      <KpiMatrixTable
                                        kpiValues={sec.kpiValues}
                                        kpiMap={kpiMap}
                                        kpiText={sec.kpiText}
                                        compactForPrint={true}
                                      />
                                    ) : (
                                      <ul className="bullet-list">
                                        {sec.items.map((it, itIdx) => {
                                          if (it.status === "cancelled") {
                                            return (
                                              <li key={itIdx} className="bullet-item">
                                                <span className="bullet-dot" style={{ color: "#f43f5e" }}>•</span>
                                                <span className="action-status-badge cancelled">
                                                  ✕ حذف‌شده
                                                </span>
                                                <span style={{ textDecoration: "line-through", color: "#64748b" }}>{it.text}</span>
                                                {it.cancellationReason && (
                                                  <span className="action-cancellation-reason">
                                                    (علت حذف: {it.cancellationReason})
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          }

                                          if (it.status === "completed") {
                                            return (
                                              <li key={itIdx} className="bullet-item">
                                                <span className="bullet-dot" style={{ color: "#059669" }}>•</span>
                                                <span className="action-status-badge completed">
                                                  ✓ تکمیل‌شده
                                                </span>
                                                <span>{it.text}</span>
                                                {it.date && (
                                                  <span className="action-target-date">
                                                    ({toPersianDigits(it.date)})
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          }

                                          if (it.status === "overdue") {
                                            return (
                                              <li key={itIdx} className="bullet-item">
                                                <span className="bullet-dot" style={{ color: "#d97706" }}>•</span>
                                                <span className="action-status-badge overdue">
                                                  ⚠️ گذشته از موعد
                                                </span>
                                                <span>{it.text}</span>
                                                {it.date && (
                                                  <span className="action-target-date" style={{ color: "#be123c" }}>
                                                    ({toPersianDigits(it.date)})
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          }

                                          return (
                                            <li key={itIdx} className="bullet-item">
                                              <span className="bullet-dot" style={{ color: "#0f172a" }}>•</span>
                                              <span>{it.text}</span>
                                              {it.date && (
                                                <span className="action-target-date">
                                                  ({toPersianDigits(it.date)})
                                                </span>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ۳. نوار فوتر امن در پایین برگه A4 */}
                      <div className="page-footer-bar">
                        <span className="page-footer-text">
                          صفحه {toPersianDigits(pageIdx + 1)} از {toPersianDigits(paginatedReportPages.length)}
                        </span>
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

