import XLSX from "xlsx";
import fs from "fs";

export interface ParsedWBSResult {
  projectTitle: string;
  formattedPromptText: string;
}

/**
 * خواندن فایل اکسل WBS و استخراج اطلاعات ۳ شیت اصلی
 */
export function parseExcelWBS(filePath: string): ParsedWBSResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(`فایل اکسل WBS در مسیر یافت نشد: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);

  // ۱. خواندن شیت اول: پروژه (اطلاعات شناسنامه)
  const sheetProjectName = workbook.SheetNames.find((s) => s.includes("پروژه")) || workbook.SheetNames[0];
  const sheetProject = workbook.Sheets[sheetProjectName];
  const projectRawData = XLSX.utils.sheet_to_json(sheetProject, { header: 1 }) as any[][];
  
  let projectTitle = "پروژه عمومی";
  let projectInfoText = "";

  if (projectRawData && projectRawData.length > 0) {
    // خواندن عنوان پروژه از هدر ستون دوم یا سطر اول
    projectTitle = projectRawData[0]?.[1] || projectRawData[0]?.[0] || "پروژه";
    projectInfoText = projectRawData
      .filter((row) => row && row[0])
      .map((row) => `• ${row[0]}: ${row[1] || "مشخص نشده"}`)
      .join("\n");
  }

  // ۲. خواندن شیت دوم: فازهای پروژه (WBS)
  const sheetWBSName = workbook.SheetNames.find((s) => s.includes("فاز")) || workbook.SheetNames[1];
  let wbsText = "فازهای WBS ثبت نشده است.";
  if (sheetWBSName && workbook.Sheets[sheetWBSName]) {
    const wbsRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetWBSName]) as any[];
    wbsText = wbsRows
      .filter((r) => r["نام فعالیت"])
      .map((r) => {
        const wbsCode = r["WBS CODE"] || r["کد"] || "-";
        const taskName = r["نام فعالیت"];
        const assignee = r["مسئول"] || "نامشخص";
        const result = r["نتایج بسته های کاری"] || "ندارد";
        return `• [کد ${wbsCode}] ${taskName} (مسئول: ${assignee} | خروجی انتظاری: ${result})`;
      })
      .join("\n");
  }

  // ۳. خواندن شیت سوم: شاخص‌ها (KPIs)
  const sheetKpiName = workbook.SheetNames.find((s) => s.includes("شاخص")) || workbook.SheetNames[2];
  let kpisText = "شاخص‌های مصوب ثبت نشده است.";
  if (sheetKpiName && workbook.Sheets[sheetKpiName]) {
    const kpiRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetKpiName]) as any[];
    kpisText = kpiRows
      .filter((r) => r["نام شاخص"])
      .map((r) => {
        const name = r["نام شاخص"];
        const threshold = r["حد آستانه"] || "تعریف نشده";
        const unit = r["واحد"] || "";
        return `• شاخص: "${name}" (حد آستانه: ${threshold} ${unit})`;
      })
      .join("\n");
  }

  const formattedPromptText = `
📌 **شناسنامه و اهداف استراتژیک پروژه ("${projectTitle}"):**
${projectInfoText}

📋 **ساختار شکست کار و بسته‌های کاری مرجع (WBS):**
${wbsText}

📊 **شاخص‌های کلیدی عملکرد مصوب (KPIs):**
${kpisText}
`;

  return { projectTitle, formattedPromptText };
}