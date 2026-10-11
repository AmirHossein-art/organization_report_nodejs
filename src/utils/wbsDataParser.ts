import XLSX from "xlsx";
import fs from "fs";

export interface WbsProjectInfoRow {
  key: string;
  value: string;
}

export interface WbsTask {
  wbs_code: string;
  level: string;
  name: string;
  deliverables: string;
  owner: string;
  start_date: string;
  duration: string;
  prerequisite: string;
  note: string;
  phase?: string;
  kpi?: string;
}

export interface WbsKpi {
  name: string;
  type: string;
  definition: string;
  formula: string;
  unit: string;
  source: string;
  period: string;
  threshold: string;
}

export interface ParsedWbsData {
  projectTitle: string;
  projectInfo: WbsProjectInfoRow[];
  tasks: WbsTask[];
  kpis: WbsKpi[];
}

function cellToString(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** نرمال‌سازی ارقام فارسی به انگلیسی برای مقایسه و محاسبات کدهای WBS */
export function normalizeDigits(str: string): string {
  if (!str) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let res = str;
  farsiDigits.forEach((d, i) => {
    res = res.replaceAll(d, String(i));
  });
  return res;
}

function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    for (const [colName, val] of Object.entries(row)) {
      if (colName.trim().toLowerCase() === k.trim().toLowerCase() || colName.trim().includes(k.trim())) {
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return cellToString(val);
        }
      }
    }
  }
  return "";
}

/**
 * پارسر فوق‌هوشمند و داینامیک فایل‌های ساختار شکست کار (WBS):
 * پشتیبانی از فایل‌های چندشیتی (تمپلیت استاندارد PMBOK) و تک‌شیتی (فایل‌های جامع سازمانی ترافیک)
 */
export function parseWbsWorkbook(filePath: string): ParsedWbsData {
  if (!fs.existsSync(filePath)) {
    throw new Error(`فایل اکسل WBS در مسیر یافت نشد: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;

  let projectTitle = "پروژه";
  const projectInfo: WbsProjectInfoRow[] = [];
  const tasks: WbsTask[] = [];
  const kpis: WbsKpi[] = [];

  // بررسی وضعیت شیت‌ها
  const explicitWbsSheetName = sheetNames.find(
    (s) => s.includes("فاز") || s.includes("شکست") || s.toLowerCase().includes("wbs") || s.includes("فعالیت")
  );
  const explicitProjectSheetName = sheetNames.find((s) => s.includes("پروژه") || s.includes("شناسنامه"));
  const explicitKpiSheetName = sheetNames.find((s) => s.includes("شاخص") || s.toLowerCase().includes("kpi"));
  const explicitDictSheetName = sheetNames.find((s) => s.includes("فرهنگ") || s.toLowerCase().includes("dict"));

  const isMultiSheet =
    sheetNames.length >= 3 &&
    explicitProjectSheetName &&
    explicitWbsSheetName &&
    explicitWbsSheetName !== explicitProjectSheetName;

  if (isMultiSheet) {
    // -------------------------------------------------------------
    // ۱) پارس فایل چندشیتی (تمپلیت استاندارد)
    // -------------------------------------------------------------
    // الف) شناسنامه
    const pSheet = workbook.Sheets[explicitProjectSheetName!];
    const pRows = XLSX.utils.sheet_to_json(pSheet, { header: 1, defval: "" }) as any[][];
    for (const row of pRows) {
      const key = cellToString(row?.[0]);
      if (!key) continue;
      // عدم گنجاندن سند مرجع منبع در مشخصات شناسنامه‌ای پروژه
      if (key.includes("مرجع") || key.includes("منبع")) continue;
      const value = cellToString(row?.[1]);
      projectInfo.push({ key, value });
      if ((key.includes("نام پروژه") || key.includes("عنوان پروژه")) && value) {
        projectTitle = value;
      }
    }
    if (projectTitle === "پروژه" && projectInfo.length > 0 && projectInfo[0].value) {
      projectTitle = projectInfo[0].value;
    }

    // ب) واژه‌نامه WBS Dictionary در صورت وجود
    const dictMap = new Map<string, { deliverables: string; owner: string; prerequisite: string; note: string; duration: string }>();
    if (explicitDictSheetName && workbook.Sheets[explicitDictSheetName]) {
      const dSheet = workbook.Sheets[explicitDictSheetName];
      const dRows = XLSX.utils.sheet_to_json(dSheet, { defval: "" }) as Record<string, any>[];
      for (const row of dRows) {
        const code = pick(row, ["کد WBS", "کد ساختار شکست", "WBS CODE", "کد"]);
        if (code) {
          dictMap.set(normalizeDigits(code), {
            deliverables: pick(row, ["نتایج و اقلام تحویل‌دادنی", "نتایج بسته‌های کاری", "خروجی", "تحویل‌دادنی"]),
            owner: pick(row, ["مسئول اجرا", "مسئول", "واحد متولی"]),
            prerequisite: pick(row, ["پیش‌نیازها", "پیش‌نیاز", "پیش نیاز"]),
            note: pick(row, ["ملاحظات", "توضیحات", "معیار پذیرش"]),
            duration: pick(row, ["مدت تخمینی", "مدت (روز کاری)", "مدت"]),
          });
        }
      }
    }

    // ج) فعالیت‌های WBS
    const wSheet = workbook.Sheets[explicitWbsSheetName!];
    const wRows = XLSX.utils.sheet_to_json(wSheet, { defval: "" }) as Record<string, any>[];
    for (const row of wRows) {
      const name = pick(row, ["نام فعالیت", "فعالیت", "عنوان فعالیت", "شرح فعالیت", "شرح بسته کاری"]);
      if (!name) continue;

      const codeRaw = pick(row, ["WBS CODE", "WBS Code", "wbs code", "کد WBS", "کد ساختار شکست", "کد"]);
      const normCode = normalizeDigits(codeRaw || "");
      const dictItem = dictMap.get(normCode);

      const level =
        pick(row, ["سطح", "Level", "level"]) || (codeRaw ? String(normCode.split(".").length) : "1");

      tasks.push({
        wbs_code: codeRaw || "-",
        level,
        name,
        deliverables:
          dictItem?.deliverables ||
          pick(row, ["نتایج بسته های کاری", "نتایج بسته‌های کاری", "خروجی", "تحویل‌دادنی", "نتایج"]),
        owner: dictItem?.owner || pick(row, ["مسئول", "مسئول اجرا", "واحد متولی"]),
        start_date: pick(row, ["تارخ شروع", "تاریخ شروع", "شروع"]),
        duration: dictItem?.duration || pick(row, ["مدت (روز کاری)", "مدت روز کاری", "مدت (روز)", "مدت"]),
        prerequisite: dictItem?.prerequisite || pick(row, ["پیش نیاز", "پیش‌نیاز"]),
        note: dictItem?.note || pick(row, ["توضیح", "توضیحات", "ملاحظات"]),
        phase: pick(row, ["عنوان سطح / فاز", "فاز", "عنوان فاز"]),
      });
    }

    // د) شاخص‌ها
    if (explicitKpiSheetName && workbook.Sheets[explicitKpiSheetName]) {
      const kSheet = workbook.Sheets[explicitKpiSheetName];
      const kRows = XLSX.utils.sheet_to_json(kSheet, { defval: "" }) as Record<string, any>[];
      for (const row of kRows) {
        const name = pick(row, ["نام شاخص", "شاخص", "عنوان شاخص"]);
        if (!name) continue;
        kpis.push({
          name,
          type: pick(row, ["نوع شاخص", "نوع"]),
          definition: pick(row, ["تعریف دقیق", "تعریف", "شرح"]),
          formula: pick(row, ["فرمول محاسبه", "فرمول"]),
          unit: pick(row, ["واحد"]),
          source: pick(row, ["منبع داده", "منبع"]),
          period: pick(row, ["دوره گزارش", "دوره"]),
          threshold: pick(row, ["حد آستانه", "آستانه", "مقدار هدف", "هدف"]),
        });
      }
    }
  } else {
    // -------------------------------------------------------------
    // ۲) پارس فایل تک‌شیتی جامع سازمانی (Single-Sheet Comprehensive WBS)
    // -------------------------------------------------------------
    const mainSheetName = explicitWbsSheetName || sheetNames[0];
    const sheet = workbook.Sheets[mainSheetName];
    const rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];

    // ۱. استخراج عنوان اصلی پروژه
    for (let r = 0; r < Math.min(rawGrid.length, 6); r++) {
      const row = rawGrid[r];
      const firstCell = cellToString(row?.[0]);
      if (
        firstCell &&
        firstCell.length > 3 &&
        !firstCell.includes("مرجع:") &&
        !firstCell.includes("هدف،") &&
        !firstCell.includes("نوع ردیف")
      ) {
        const parts = firstCell.split("|");
        projectTitle = parts[0].trim();
        break;
      }
    }

    // ۲. شناسایی ردیف هدر جدول فعالیت‌های تفصیلی
    let activityHeaderRowIndex = -1;
    let activityHeaders: string[] = [];

    for (let r = rawGrid.length - 1; r >= 0; r--) {
      const row = rawGrid[r].map((c) => cellToString(c));
      const rowStr = row.join(" ");
      const isHeader =
        (rowStr.includes("کد WBS") ||
          rowStr.includes("کد ساختار شکست") ||
          rowStr.includes("شناسه WP") ||
          rowStr.includes("WBS CODE") ||
          rowStr.includes("کد WP")) &&
        (rowStr.includes("شرح") || rowStr.includes("فعالیت") || rowStr.includes("نام"));

      if (isHeader) {
        activityHeaderRowIndex = r;
        activityHeaders = row;
        break;
      }
    }

    if (activityHeaderRowIndex === -1) {
      for (let r = 0; r < rawGrid.length; r++) {
        const row = rawGrid[r].map((c) => cellToString(c));
        const rowStr = row.join(" ");
        if (
          (rowStr.includes("فاز") || rowStr.includes("WBS")) &&
          (rowStr.includes("فعالیت") || rowStr.includes("عنوان") || rowStr.includes("شرح"))
        ) {
          activityHeaderRowIndex = r;
          activityHeaders = row;
          break;
        }
      }
    }

    // ۳. استخراج هوشمند شناسنامه از ردیف‌های بالای جدول
    const metaEndRow = activityHeaderRowIndex !== -1 ? activityHeaderRowIndex : rawGrid.length;
    let phaseCount = 0;

    for (let r = 0; r < metaEndRow; r++) {
      const row = rawGrid[r];
      const c0 = cellToString(row?.[0]);
      const c1 = cellToString(row?.[1]);
      const c2 = cellToString(row?.[2]);
      const fullText = row.map(cellToString).filter(Boolean).join(" ");

      if (c0.includes("هدف اصلی") || fullText.includes("هدف اصلی:")) {
        const val = c2 || c1 || fullText.replace(/.*هدف اصلی[:\s]*/, "").trim();
        if (val) projectInfo.push({ key: "هدف اصلی پروژه", value: val });
      } else if (c0.includes("دامنه پروژه") || fullText.includes("دامنه پروژه:")) {
        const val = c2 || c1 || fullText.replace(/.*دامنه پروژه[:\s]*/, "").trim();
        if (val) projectInfo.push({ key: "دامنه پروژه", value: val });
      } else if (c0.includes("محدوده جغرافیایی") || fullText.includes("محدوده جغرافیایی:")) {
        const val = c2 || c1 || fullText.replace(/.*محدوده جغرافیایی[:\s]*/, "").trim();
        if (val) projectInfo.push({ key: "محدوده جغرافیایی", value: val });
      } else if (c0.includes("ضرورت اجرا") || fullText.includes("ضرورت اجرا:")) {
        const val = c2 || c1 || fullText.replace(/.*ضرورت اجرا[:\s]*/, "").trim();
        if (val) projectInfo.push({ key: "ضرورت اجرا", value: val });
      } else if (c0.includes("شاخص کلان") || fullText.includes("شاخص کلان پروژه:")) {
        const val = c2 || c1 || fullText.replace(/.*شاخص کلان پروژه[:\s]*/, "").trim();
        if (val) projectInfo.push({ key: "شاخص کلان پروژه", value: val });
      } else if (c0.includes("تعداد فاز")) {
        const val = c2 || c1;
        if (val) projectInfo.push({ key: "تعداد فازها", value: val });
      }

      if (c0 === "فاز" || c1 === "فاز" || c0.startsWith("فاز ") || c1.startsWith("فاز ")) {
        const phaseTitle = c2 || cellToString(row?.[3]) || c1;
        if (phaseTitle && phaseTitle.length > 2 && !phaseTitle.includes("عنوان فاز")) {
          phaseCount++;
          projectInfo.push({ key: `فاز عملیاتی ${phaseCount}`, value: phaseTitle });
        }
      }
    }

    if (!projectInfo.some((p) => p.key.includes("نام پروژه"))) {
      projectInfo.unshift({ key: "نام پروژه", value: projectTitle });
    }

    // ۴. استخراج فعالیت‌ها از جدول تفصیلی
    if (activityHeaderRowIndex !== -1 && activityHeaders.length > 0) {
      const findColIdx = (patterns: string[]): number => {
        for (const p of patterns) {
          const idx = activityHeaders.findIndex((h) => h.includes(p));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const codeIdx = findColIdx([
        "کد WBS / WP",
        "کد ساختار شکست",
        "کد WBS",
        "شناسه WP",
        "WBS CODE",
        "کد WP",
        "کد",
      ]);
      const nameIdx = findColIdx([
        "شرح فعالیت / مشخصات",
        "شرح فعالیت/بسته کاری",
        "شرح فعالیت / ساختار شکست",
        "شرح فعالیت / ورک‌پکیج",
        "شرح فعالیت / ریزفعالیت",
        "شرح فعالیت",
        "نام فعالیت",
        "فعالیت",
      ]);
      const deliverableIdx = findColIdx([
        "خروجی / تحویل‌دادنی",
        "خروجی فعالیت",
        "خروجی مرتبط",
        "خروجی‌های فاز",
        "نتایج بسته‌های کاری",
        "نتایج بسته های کاری",
        "خروجی",
        "تحویل‌دادنی",
      ]);
      const kpiIdx = findColIdx([
        "شاخص عملکرد KPI",
        "شاخص کلیدی عملکرد (KPI)",
        "شاخص فعالیت",
        "شاخص‌های فاز",
        "شاخص فاز",
        "شاخص",
        "KPI",
      ]);
      const ownerIdx = findColIdx(["مسئول", "مسئول اجرا", "واحد متولی"]);
      const durationIdx = findColIdx([
        "مدت (روز)",
        "مدت / زمان / پیشرفت",
        "مدت درج‌شده",
        "مدت (روز کاری)",
        "مدت روز کاری",
        "مدت",
        "زمان",
      ]);
      const startIdx = findColIdx(["شروع (شمسی)", "تاریخ شروع", "شروع"]);
      const phaseIdx = findColIdx(["عنوان فاز", "نام فاز", "فاز", "شماره فاز"]);
      const noteIdx = findColIdx(["ملاحظات", "توضیحات", "توضیح"]);

      const seenKpis = new Set<string>();

      for (let r = activityHeaderRowIndex + 1; r < rawGrid.length; r++) {
        const row = rawGrid[r];
        if (!row || row.every((c: any) => c === "" || c === null || c === undefined)) continue;

        const name = nameIdx !== -1 ? cellToString(row[nameIdx]) : "";
        if (!name || name.includes("شرح فعالیت") || name.includes("جدول تفصیلی")) continue;

        let code = codeIdx !== -1 ? cellToString(row[codeIdx]) : "";
        if (!code || code === "-") {
          code = `1.${tasks.length + 1}`;
        }

        const deliverables = deliverableIdx !== -1 ? cellToString(row[deliverableIdx]) : "";
        const kpi = kpiIdx !== -1 ? cellToString(row[kpiIdx]) : "";
        let owner = ownerIdx !== -1 ? cellToString(row[ownerIdx]) : "";
        let duration = durationIdx !== -1 ? cellToString(row[durationIdx]) : "";
        const startDate = startIdx !== -1 ? cellToString(row[startIdx]) : "";
        const phase = phaseIdx !== -1 ? cellToString(row[phaseIdx]) : "";
        const note = noteIdx !== -1 ? cellToString(row[noteIdx]) : "";

        // جداسازی هوشمند مدت زمان از نام مسئول در صورت ادغام در یک سلول
        if (duration.includes("ستون") || duration.includes("مسئول") || !duration) {
          const durMatch = owner.match(/\(([^)]*(?:ساعت|روز|ماه|هفته)[^)]*)\)/);
          if (durMatch) {
            duration = durMatch[1].trim();
            owner = owner.replace(/\([^)]*(?:ساعت|روز|ماه|هفته)[^)]*\)/, "").trim();
          }
        }

        const cleanDigits = normalizeDigits(code);
        const dotParts = cleanDigits.split(/[\.-]/).filter(Boolean);
        const level = dotParts.length > 0 ? String(dotParts.length) : "2";

        tasks.push({
          wbs_code: code,
          level,
          name,
          deliverables,
          owner,
          start_date: startDate,
          duration,
          prerequisite: "",
          note,
          phase,
          kpi,
        });

        if (kpi && kpi !== "-" && kpi !== "_" && !seenKpis.has(kpi)) {
          seenKpis.add(kpi);
          kpis.push({
            name: kpi,
            type: "عملکردی",
            definition: `شاخص مرتبط با فعالیت: ${name}`,
            formula: "",
            unit: "",
            source: owner || "سیستم گزارش‌دهی",
            period: "دوره‌ای",
            threshold: "",
          });
        }
      }
    }
  }

  return { projectTitle, projectInfo, tasks, kpis };
}
