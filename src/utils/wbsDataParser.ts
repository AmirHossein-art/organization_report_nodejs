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

/** تبدیل امن سلول اکسل به رشته متن */
function cellToString(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** اولین کلید موجود و غیرخالی را از ردیف برمی‌گرداند */
function pick(row: Record<string, any>, keys: string[]): string {
  for (const k of keys) {
    const raw = row[k];
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      return cellToString(raw);
    }
  }
  return "";
}

/**
 * خواندن ساختاریافته فایل اکسل WBS برای نمایش در UI:
 *  - شیت «پروژه»: شناسنامه (جفت کلید/مقدار)
 *  - شیت «فازهای پروژه»: ردیف‌های ساختار شکست
 *  - شیت «شاخص ها»: KPIها
 */
export function parseWbsWorkbook(filePath: string): ParsedWbsData {
  if (!fs.existsSync(filePath)) {
    throw new Error(`فایل اکسل WBS در مسیر یافت نشد: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);

  // ---------- ۱) شیت پروژه (شناسنامه) ----------
  const sheetProjectName =
    workbook.SheetNames.find((s) => s.includes("پروژه")) || workbook.SheetNames[0];
  const projectInfo: WbsProjectInfoRow[] = [];
  let projectTitle = "پروژه";

  if (sheetProjectName && workbook.Sheets[sheetProjectName]) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetProjectName], {
      header: 1,
      defval: "",
    }) as any[][];

    for (const row of rows) {
      const key = cellToString(row?.[0]);
      if (!key) continue;
      const value = cellToString(row?.[1]);
      projectInfo.push({ key, value });
      if (key.includes("نام پروژه") && value) {
        projectTitle = value;
      }
    }
  }
  if (projectTitle === "پروژه" && projectInfo.length > 0 && projectInfo[0].value) {
    projectTitle = projectInfo[0].value;
  }

  // ---------- ۲) شیت فازهای پروژه (WBS) ----------
  const tasks: WbsTask[] = [];
  const sheetWbsName =
    workbook.SheetNames.find((s) => s.includes("فاز")) || workbook.SheetNames[1];

  if (sheetWbsName && workbook.Sheets[sheetWbsName]) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetWbsName], {
      defval: "",
    }) as Record<string, any>[];

    for (const row of rows) {
      const name = pick(row, ["نام فعالیت", "فعالیت", "عنوان فعالیت"]);
      if (!name) continue; // ردیف‌های بدون نام فعالیت نمایش داده نمی‌شوند

      tasks.push({
        wbs_code: pick(row, ["WBS CODE", "WBS Code", "wbs code", "کد"]) || "-",
        level: pick(row, ["سطح"]) || "-",
        name,
        deliverables: pick(row, ["نتایج بسته های کاری", "نتایج بسته‌های کاری", "نتایج"]),
        owner: pick(row, ["مسئول", "مسئول اجرا"]),
        start_date: pick(row, ["تارخ شروع", "تاریخ شروع"]),
        duration: pick(row, ["مدت (روز کاری)", "مدت روز کاری", "مدت"]),
        prerequisite: pick(row, ["پیش نیاز", "پیش‌نیاز"]),
        note: pick(row, ["توضیح", "توضیحات"]),
      });
    }
  }

  // ---------- ۳) شیت شاخص‌ها (KPI) ----------
  const kpis: WbsKpi[] = [];
  const sheetKpiName =
    workbook.SheetNames.find((s) => s.includes("شاخص")) || workbook.SheetNames[2];

  if (sheetKpiName && workbook.Sheets[sheetKpiName]) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetKpiName], {
      defval: "",
    }) as Record<string, any>[];

    for (const row of rows) {
      const name = pick(row, ["نام شاخص", "شاخص"]);
      if (!name) continue;

      kpis.push({
        name,
        type: pick(row, ["نوع شاخص"]),
        definition: pick(row, ["تعریف دقیق", "تعریف"]),
        formula: pick(row, ["فرمول محاسبه", "فرمول"]),
        unit: pick(row, ["واحد"]),
        source: pick(row, ["منبع داده", "منبع"]),
        period: pick(row, ["دوره گزارش", "دوره"]),
        threshold: pick(row, ["حد آستانه", "آستانه"]),
      });
    }
  }

  return { projectTitle, projectInfo, tasks, kpis };
}
