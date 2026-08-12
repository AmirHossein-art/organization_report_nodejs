import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { OpenAI } from "openai";
import { parseExcelWBS } from "./src/utils/wbsParser";

import bcrypt from "bcrypt";
const SALT_ROUNDS = 10;

import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const JWT_SECRET = process.env.JWT_SECRET || "SUPER_SECRET_KEY_FOR_TRAFFIC_ORG_2026";

// ایمپورت‌های جدید برای پریزما ۷ و پایگاه داده
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const PORT = 3000;
const app = express();


app.use(cors());
app.use(express.json());
app.use(cookieParser());

// ۲. ساخت استخر اتصالات (Connection Pool) برای PostgreSQL
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// ۳. تعریف آداپتور برای اتصال پریزما به درایور پایگاه داده
const adapter = new PrismaPg(pool);

// ۴. ساخت کلاینت پریزما با آداپتور مربوطه
const prisma = new PrismaClient({ adapter });

// Set up file storage for report attachments
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// 🟢 ساخت پوشه wbs_files و تنظیمات ذخیره‌سازی فایل اکسل
const wbsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "wbs_files");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // ذخیره فایل با نام یکتا برای جلوگیری از اوررایت شدن
    const ext = path.extname(file.originalname);
    const uniqueName = `wbs_project_${Date.now()}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadWBS = multer({
  storage: wbsStorage,
  fileFilter: (req, file, cb) => {
    // فقط اجازه آپلود فایل‌های اکسل داده می‌شود
    if (file.originalname.match(/\.(xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error("فقط فایل‌های اکسل (xlsx, xls) مجاز هستند."));
    }
  },
});

// -----------------------------

type NextActionInput = {
  action_text: string;
  target_date: string;
};

class NextActionsValidationError extends Error {}
class KpiValidationError extends Error {}

const KPI_INPUT_TYPES = ["direct", "percentage_change"];

function parseKpiValues(rawKpiValues: unknown): any[] {
  if (rawKpiValues === undefined || rawKpiValues === null || rawKpiValues === "") {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = typeof rawKpiValues === "string" ? JSON.parse(rawKpiValues) : rawKpiValues;
  } catch {
    throw new KpiValidationError("ساختار JSON مقادیر شاخص معتبر نیست.");
  }
  if (!Array.isArray(parsed)) {
    throw new KpiValidationError("مقادیر شاخص باید آرایه JSON باشد.");
  }
  return parsed;
}

// اعتبارسنجی و محاسبه سمت سرور مقادیر شاخص گزارش.
// کلاینت اعتماد نمی‌شود: شاخص‌ها از روی پروژه و نوع گزارش مجدداً خوانده می‌شوند.
async function validateAndBuildKpiValues(
  rawKpiValues: unknown,
  projectId: number,
  reportType: "weekly" | "monthly"
): Promise<any[]> {
  const submitted = parseKpiValues(rawKpiValues);

  // شاخص‌های فعالِ کاربردی برای این پروژه و نوع گزارش (منبع حقیقت)
  const applicableKpis = await prisma.projectKpi.findMany({
    where: {
      project_id: projectId,
      is_active: true,
      OR: [{ report_type: null }, { report_type: reportType }],
    },
  });

  // پروژه‌های بدون شاخص → هیچ مقداری لازم نیست
  if (applicableKpis.length === 0) return [];

  if (submitted.length === 0) {
    throw new KpiValidationError("مقادیر تمامی شاخص‌های فعال باید وارد شوند.");
  }

  // ۵. عدم تکرار شناسه شاخص
  const seenIds = new Set<number>();
  for (const v of submitted) {
    const id = Number(v?.project_kpi_id);
    if (seenIds.has(id)) {
      throw new KpiValidationError("شناسه شاخص تکراری ارسال شده است.");
    }
    seenIds.add(id);
  }

  // ۱. هر شاخص فعالِ کاربردی دقیقاً یک رکورد ارسالی داشته باشد
  for (const kpi of applicableKpis) {
    const rec = submitted.find((v) => Number(v?.project_kpi_id) === kpi.id);
    if (!rec) {
      throw new KpiValidationError(`مقدار شاخص «${kpi.name}» وارد نشده است.`);
    }
  }

  const built: any[] = [];

  for (const v of submitted) {
    const kpiId = Number(v.project_kpi_id);
    const kpi = applicableKpis.find((k) => k.id === kpiId);

    // ۲، ۳، ۴. شاخص باید متعلق به پروژه، فعال و کاربردی برای نوع گزارش باشد
    if (!kpi) {
      throw new KpiValidationError("شناسه شاخص نامعتبر، تکراری یا غیرفعال است.");
    }

    const notMeasured = Boolean(v.not_measured);
    const missingReason = typeof v.missing_reason === "string" ? v.missing_reason.trim() : "";

    if (notMeasured) {
      // ۹. دلیل اندازه‌گیری‌نشدن الزامی
      if (!missingReason) {
        throw new KpiValidationError(`دلیل عدم اندازه‌گیری شاخص «${kpi.name}» الزامی است.`);
      }
      // ۱۰. شاخص اندازه‌گیری‌نشده مقدار محاسبه‌شده ندارد
      built.push({
        project_kpi_id: kpiId,
        current_value: null,
        baseline_value: null,
        calculated_value: null,
        not_measured: true,
        missing_reason: missingReason,
      });
      continue;
    }

    const toNumberOrNull = (x: any): number | null => {
      if (x === "" || x === null || x === undefined) return null;
      const n = Number(x);
      return isNaN(n) ? null : n;
    };

    if (kpi.input_type === "direct") {
      // ۶. شاخص مستقیم: current_value معتبر لازم است
      const current = toNumberOrNull(v.current_value);
      if (current === null) {
        throw new KpiValidationError(`مقدار این دوره شاخص «${kpi.name}» باید عددی معتبر باشد.`);
      }
      built.push({
        project_kpi_id: kpiId,
        current_value: current,
        baseline_value: null,
        calculated_value: current,
        not_measured: false,
        missing_reason: null,
      });
    } else {
      // ۷. شاخص درصد تغییر: baseline و current معتبر لازم‌اند
      const baseline = toNumberOrNull(v.baseline_value);
      const current = toNumberOrNull(v.current_value);
      if (baseline === null) {
        throw new KpiValidationError(`مقدار مبنای شاخص «${kpi.name}» باید عددی معتبر باشد.`);
      }
      if (current === null) {
        throw new KpiValidationError(`مقدار دوره جاری شاخص «${kpi.name}» باید عددی معتبر باشد.`);
      }
      // ۸. مبنا نمی‌تواند صفر باشد
      if (baseline === 0) {
        throw new KpiValidationError(`مقدار مبنای شاخص «${kpi.name}» نمی‌تواند صفر باشد.`);
      }
      const calculated = ((current - baseline) / baseline) * 100;
      built.push({
        project_kpi_id: kpiId,
        current_value: current,
        baseline_value: baseline,
        calculated_value: calculated,
        not_measured: false,
        missing_reason: null,
      });
    }
  }

  return built;
}

function parseNextActions(rawNextActions: unknown): { action_text: string; target_date: Date }[] {
  if (rawNextActions === undefined || rawNextActions === null || rawNextActions === "") {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = typeof rawNextActions === "string" ? JSON.parse(rawNextActions) : rawNextActions;
  } catch {
    throw new NextActionsValidationError("ساختار JSON اقدامات آتی معتبر نیست.");
  }

  if (!Array.isArray(parsed)) {
    throw new NextActionsValidationError("ساختار اقدامات آتی باید آرایه JSON باشد.");
  }

  return parsed.map((item: NextActionInput, index: number) => {
    const actionText = typeof item?.action_text === "string" ? item.action_text.trim() : "";
    const targetDate = typeof item?.target_date === "string" ? item.target_date : "";

    if (!actionText || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      throw new NextActionsValidationError(`اقدام آتی شماره ${index + 1} شرح یا تاریخ معتبر ندارد.`);
    }

    const date = new Date(`${targetDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new NextActionsValidationError(`تاریخ اقدام آتی شماره ${index + 1} معتبر نیست.`);
    }

    return {
      action_text: actionText,
      target_date: date,
    };
  });
}

function serializeReport(report: any) {
  return {
    ...report,

    period_start: report.period_start.toISOString().split("T")[0],
    period_end: report.period_end.toISOString().split("T")[0],
    submitted_at: report.submitted_at.toISOString(),

    imported_at: report.imported_at
      ? report.imported_at.toISOString()
      : null,

    nextActions: Array.isArray(report.nextActions)
      ? report.nextActions.map((action: any) => ({
          ...action,

          target_date: action.target_date
            ? action.target_date.toISOString().split("T")[0]
            : null,

          target_date_raw: action.target_date_raw ?? null,

          completed_at: action.completed_at
            ? action.completed_at.toISOString()
            : null,
        }))
      : [],

    kpiValues: Array.isArray(report.kpiValues)
      ? report.kpiValues.map((v: any) => ({
          id: v.id,
          project_kpi_id: v.project_kpi_id,
          current_value: v.current_value,
          baseline_value: v.baseline_value,
          calculated_value: v.calculated_value,
          not_measured: v.not_measured,
          missing_reason: v.missing_reason,
          created_at: v.created_at ? v.created_at.toISOString() : null,
        }))
      : [],
  };
}

// 🔮 تابع محاسباتی ددلاین هوشمند بر اساس تنظیمات مدیریتی دیتابیس
function getDeadlineDate(periodEnd: Date, deadlineDay: number, deadlineTime: string, reportType: "weekly" | "monthly"): Date {
  const deadlineDate = new Date(periodEnd);
  
  if (reportType === "weekly") {
    // در جاوااسکریپت: 0 = یکشنبه، 1 = دوشنبه، ...، 6 = شنبه
    // حرکت رو به جلو از فردای پایان دوره برای پیدا کردن روز ددلاین مشخص شده
    deadlineDate.setDate(deadlineDate.getDate() + 1);
    while (deadlineDate.getDay() !== deadlineDay) {
      deadlineDate.setDate(deadlineDate.getDate() + 1);
    }
  } else {
    // گزارش ماهانه: deadlineDay عدد روز از ماه است (مثلاً 5 برای پنجم ماه بعد)
    // اگر عدد روز ددلاین کوچک‌تر یا مساوی روز پایان دوره باشد، یعنی مربوط به ماه بعد است
    if (deadlineDay <= periodEnd.getDate()) {
      deadlineDate.setMonth(deadlineDate.getMonth() + 1);
    }
    deadlineDate.setDate(deadlineDay);
  }

  // اعمال فرمت ساعت و دقیقه "HH:MM" تنظیم شده توسط مدیر
  const [hours, minutes] = deadlineTime.split(":").map(Number);
  deadlineDate.setHours(hours || 0, minutes || 0, 0, 0);
  
  return deadlineDate;
}

function formatNextActionsForPrompt(nextActions: any[] | undefined): string {
  if (!Array.isArray(nextActions) || nextActions.length === 0) {
    return "ثبت نشده";
  }

  return nextActions
    .map((action) => {
      const targetDate = action.target_date instanceof Date
        ? action.target_date.toISOString().split("T")[0]
        : String(action.target_date || "").split("T")[0];
      return `- ${action.action_text} (تاریخ هدف: ${targetDate})`;
    })
    .join("\n");
}

// Helper: format structured KPI values for AI prompts
function formatKpiValuesForPrompt(kpiValues: any[] | undefined): string {
  if (!Array.isArray(kpiValues) || kpiValues.length === 0) {
    return "بدون شاخص ساختاریافته";
  }

  return kpiValues
    .map((kv, idx) => {
      const measured = !kv.not_measured && kv.calculated_value !== null;
      const inputTypeLabel = kv.input_type === "direct" ? "مقدار مستقیم" : "درصد تغییر";
      const directionLabel = kv.target_direction === "minimum" ? "حداقل" : "حداکثر";

      if (!measured) {
        return `${idx + 1}. ${kv.name || "شاخص"} — اندازه‌گیری نشده (${kv.missing_reason || "دلیل مشخص نشده"})`;
      }

      if (kv.input_type === "direct") {
        return `${idx + 1}. ${kv.name || "شاخص"} (${inputTypeLabel}) — ${kv.unit || ""}: ${kv.current_value} (هدف: ${directionLabel} ${kv.target_value})`;
      } else {
        return `${idx + 1}. ${kv.name || "شاخص"} (${inputTypeLabel}) — مبنا: ${kv.baseline_value}، جاری: ${kv.current_value}، محاسبه‌شده: ${kv.calculated_value}٪ (هدف: ${directionLabel} ${kv.target_value}٪)`;
      }
    })
    .join("\n");
}

// Serve uploaded files
app.use("/uploads", express.static(uploadDir));

// =================================================================
// 🔮 سیستم مرکزی فراخوانی هوش مصنوعی (مجهز به Fallback و ترجمه خطای فارسی)
// =================================================================
async function callAiWithFallback(systemPrompt: string, userPrompt: string) {
  // لیست پروایدرهای فعال بر اساس فایل .env
  const providers = [
    {
      id: "sambanova",
      name: "SambaNova (Llama 3.3 70B)",
      baseURL: process.env.AI_BASE_URL_1 || process.env.AI_BASE_URL || "https://api.sambanova.ai/v1",
      apiKey: process.env.AI_API_KEY_1 || process.env.AI_API_KEY,
      model: process.env.AI_MODEL_1 || process.env.AI_MODEL_NAME || "Meta-Llama-3.3-70B-Instruct",
    },
    {
      id: "cerebras",
      name: "Cerebras (Llama 3.3 70B)",
      baseURL: process.env.AI_BASE_URL_2 || "https://api.cerebras.ai/v1",
      apiKey: process.env.AI_API_KEY_2,
      model: process.env.AI_MODEL_2 || "llama-3.3-70b",
    },
    {
      id: "gemini",
      name: "Google AI Studio (gemini-1.5-flash)",
      baseURL: process.env.AI_BASE_URL_3 || "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: process.env.AI_API_KEY_3,
      model: process.env.AI_MODEL_3 || "gemini-1.5-flash",
    },
  ].filter((p) => p.apiKey && p.apiKey.trim() !== "");

  if (providers.length === 0) {
    throw new Error("هیچ کلید API فعال برای هوش مصنوعی در فایل .env یافت نشد. لطفاً تنظیمات .env را بررسی کنید.");
  }

  // 🧹 پاک‌سازی متون HTML (مثل صفحات مسدودی Cloudflare) و تبدیل به ارور تک‌خطی
  const formatPersianError = (err: any, providerName: string) => {
    const status = err?.status || err?.statusCode;
    let msg = err?.message || String(err || "");

    if (typeof msg === "string" && (msg.includes("<!DOCTYPE") || msg.includes("<html") || msg.includes("Cloudflare"))) {
      return `تامین‌کننده «${providerName}»: درخواست توسط فایروال یا محدودیت شبکه/آی‌پی مسدود شد (خطای 403 Cloudflare).`;
    }

    if (status === 429 || msg.includes("429") || msg.includes("Rate limit")) {
      return `تامین‌کننده «${providerName}»: سقف تعداد درخواست مجاز در دقیقه یا روز به پایان رسیده است.`;
    }
    if (status === 401 || msg.includes("401") || msg.includes("Unauthorized")) {
      return `تامین‌کننده «${providerName}»: کلید API وارد شده نامعتبر است.`;
    }
    
    return `تامین‌کننده «${providerName}»: ${msg.substring(0, 120)}`;
  };

  const parseJsonFromText = (rawText: string) => {
    let cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    return JSON.parse(cleaned);
  };

  const providerErrorLogs: string[] = [];

  for (const provider of providers) {
    try {
      console.log(`🤖 در حال درخواست پردازش از: ${provider.name}...`);

      const client = new OpenAI({
        apiKey: provider.apiKey,
        baseURL: provider.baseURL,
        defaultHeaders: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0",
        },
      });

      const completion = await client.chat.completions.create({
        model: provider.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.0,
      });

      const rawContent = completion.choices[0]?.message?.content || "";
      const parsed = parseJsonFromText(rawContent);
      const analysisData = parsed.analysis ? parsed.analysis : parsed;

      return {
        analysis: analysisData,
        model_used: provider.name,
      };

    } catch (err: any) {
      const persianErr = formatPersianError(err, provider.name);
      console.warn(`⚠️ ${persianErr} -> در حال سوئیچ به تامین‌کننده بعدی...`);
      providerErrorLogs.push(persianErr);
    }
  }

  throw new Error(`تمامی تامین‌کنندگان هوش مصنوعی ناموفق بودند:\n` + providerErrorLogs.join("\n"));
}

// =================================================================
// 1️⃣ اندپوینت تحلیل کلی و کلان دوره
// =================================================================
app.post("/api/reports/analyze", async (req, res) => {
  try {
    const { period_title, reports } = req.body;

    const submittedReports = Array.isArray(reports) 
      ? reports.filter((r: any) => r.activities_done && r.activities_done.trim() !== "") 
      : [];

    if (submittedReports.length === 0) {
      return res.status(400).json({ error: "هیچ گزارش ثبت‌شده‌ای برای تحلیل در این دوره یافت نشد." });
    }

    const reportsText = submittedReports
      .map((r, index) => {
        const kpiSection = (r.kpiValues && r.kpiValues.length > 0)
          ? `شاخص‌های ساختاریافته:\n${formatKpiValuesForPrompt(r.kpiValues)}`
          : `شاخص‌ها (متن آزاد): ${r.kpi_text || "ثبت نشده"}`;
        return `--- گزارش ${index + 1} ---
نویسنده: ${r.user_full_name}
پروژه: ${r.project_title}
فعالیت‌ها: ${r.activities_done}
نتایج: ${r.results_achieved || "ثبت نشده"}
اقدامات آتی: ${formatNextActionsForPrompt(r.nextActions)}
${kpiSection}`;
      })
      .join("\n\n");

    const systemPrompt = `شما یک دستیار هوشمند و ارشد مدیریت استراتژیک در سازمان حمل‌ونقل و ترافیک هستید.
وظیفه شما تحلیل دقیق گزارش‌های عملکرد پرسنل و ارائه خروجی کاملاً ساختاریافته به فرمت JSON است.

پاسخ شما باید حتماً و فقط یک جی‌سون معتبر با کلید ریشه "analysis" باشد. نمونه ساختار مورد انتظار:
{
  "analysis": {
    "health_score": 85,
    "overall_status": "پایدار",
    "executive_summary": "متن خلاصه مدیریتی در دو پاراگراف...",
    "key_achievements": ["دستاورد ۱", "دستاورد ۲"],
    "risks_and_delays": [
      { "project_title": "عنوان پروژه", "risk_level": "high", "description": "شرح دقیق موانع" }
    ],
    "actionable_recommendations": ["پیشنهاد ۱", "پیشنهاد ۲"]
  }
}
نکته بسیار مهم: هیچ متن اضافی، مقدمه، مؤخره یا علامت‌های اضافی قبل و بعد از JSON ننویسید.`;

    const userPrompt = `گزارش‌های عملکرد بازه "${period_title}":\n\n${reportsText}`;

    const result = await callAiWithFallback(systemPrompt, userPrompt);
    res.json(result);

  } catch (err: any) {
    console.error("AI Global Analysis Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


// =================================================================
// 2️⃣ اندپوینت ممیزی اختصاصی تک‌گزارش (بر اساس WBS اکسل)
// =================================================================
app.post("/api/reports/analyze-single", async (req, res) => {
  try {
    const { report_id } = req.body;

    if (!report_id) {
      return res.status(400).json({ error: "شناسه گزارش (report_id) ارسال نشده است." });
    }

    const currentReport = await prisma.report.findUnique({
      where: { id: Number(report_id) },
      include: {
        user: true,
        project: true,
        nextActions: true,
        kpiValues: true,
      },
    });

    if (!currentReport) {
      return res.status(404).json({ error: "گزارش مورد نظر یافت نشد." });
    }

    const previousReports = await prisma.report.findMany({
      where: {
        user_id: currentReport.user_id,
        project_id: currentReport.project_id,
        id: { lt: currentReport.id },
      },
      orderBy: { submitted_at: "desc" },
      take: 3,
      include: { nextActions: true },
    });

    const formatPreviousKpi = (r: any) => {
      if (r.kpiValues && r.kpiValues.length > 0) {
        return formatKpiValuesForPrompt(r.kpiValues);
      }
      return r.kpi_text || "ثبت نشده";
    };

    const previousReportsText = previousReports.length > 0
      ? previousReports.map((r, i) => `--- گزارش سابقه ${i + 1} ---
فعالیت‌ها: ${r.activities_done}
نتایج: ${r.results_achieved || "ثبت نشده"}
شاخص‌ها:\n${formatPreviousKpi(r)}`).join("\n\n")
      : "هیچ گزارش قبلی برای این کاربر ثبت نشده است (اولین گزارش کاربر).";

    const projectWbsFileName = (currentReport.project as any)?.wbs_file_name;
    let wbsContextText = "سند WBS اکسل برای این پروژه بارگذاری نشده است.";

    if (projectWbsFileName) {
      const excelFilePath = path.join(process.cwd(), "wbs_files", projectWbsFileName);
      try {
        if (fs.existsSync(excelFilePath)) {
          const parsed = parseExcelWBS(excelFilePath);
          wbsContextText = parsed.formattedPromptText;
        }
      } catch (e: any) {
        console.warn("خطا در خواندن فایل اکسل WBS:", e.message);
      }
    }

    const systemPrompt = `شما یک ارزیاب و ممیز ارشد مدیریت استراتژیک، کنترل پروژه و ترافیک شهری هستید.
وظیفه شما ارزیابی دقیق "یک گزارش عملکرد" در برابر "سند استراتژیک و WBS مرجع پروژه" و "سابقه گزارش‌های قبلی کاربر" است.

پاسخ شما باید حتماً و فقط یک جی‌سون (JSON) معتبر با کلید ریشه "analysis" باشد. ساختار مورد انتظار:

{
  "analysis": {
    "executive_summary": "خلاصه مدیریتی پروژه با محوریت مهم‌ترین اقدامات انجام‌شده در این گزارش...",
    "kpis_evaluation": [
      {
        "kpi_name": "نام شاخص ذکر شده",
        "previous_value": "مقدار سابقه قبلی یا 'ثبت نشده در سابقه'",
        "current_value": "مقدار فعلی یا 'فاقد شاخص'",
        "has_kpi": true
      }
    ],
    "recommendations": [
      "پیشنهاد و اقدام کارآمد ۱ با توجه به داده‌های ورودی...",
      "پیشنهاد ۲..."
    ],
    "future_actions_with_deadlines": [
      {
        "action": "شرح اقدام آتی",
        "deadline": "تاریخ هدف (مثلاً ۱۴۰۵/۰۵/۱۰) یا 'تعیین‌نشده'"
      }
    ],
    "repetitiveness_assessment": {
      "similarity_percentage": 15,
      "is_duplicate_risk": false,
      "analysis_details": "توضیح کوتاه در مورد اینکه آیا گزارش کپی‌برداری از گزارش‌های قبلی است یا خیر."
    },
    "strategic_alignment": {
      "is_aligned": true,
      "value_creation": "عالی / متوسط / ضعیف",
      "wbs_matching_task": "کد یا نام بسته کاری WBS مرتبط",
      "alignment_analysis": "بررسی تطابق استراتژیک فعالیت با هدف پروژه و خلق فایده آن."
    }
  }
}
نکته مهم: خروجی باید فقط JSON معتبر به زبان فارسی باشد بدون هیچ عبارت اضافه یا Markdown.`;

    const currentKpiSection = (currentReport.kpiValues && currentReport.kpiValues.length > 0)
      ? `شاخص‌های ساختاریافته:\n${formatKpiValuesForPrompt(currentReport.kpiValues)}`
      : `شاخص‌ها (متن آزاد): ${currentReport.kpi_text || "ثبت نشده"}`;

    const userPrompt = `
🏢 **سند مرجع WBS و اهداف استراتژیک پروژه:**
${wbsContextText}

---
📜 **سابقه گزارش‌های قبلی همین کارشناس (جهت بررسی شباهت و کپی‌برداری):**
${previousReportsText}

---
📝 **گزارش عملکرد جاری (جهت ممیزی و ارزیابی):**
نویسنده: ${currentReport.user_full_name || (currentReport.user as any)?.name}
پروژه: ${currentReport.project_title || (currentReport.project as any)?.title}
فعالیت‌های انجام‌شده: ${currentReport.activities_done}
نتایج حاصله: ${currentReport.results_achieved || "ثبت نشده"}
${currentKpiSection}
اقدامات آتی: ${currentReport.nextActions?.map((a: any) => `${a.action_text || a.title} (ددلاین: ${a.target_date || "ندارد"})`).join(", ") || "ثبت نشده"}
`;

    const result = await callAiWithFallback(systemPrompt, userPrompt);
    res.json(result);

  } catch (err: any) {
    console.error("Single Report Audit Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🟢 اندپوینت ورود کاربران به سیستم
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "لطفاً نام کاربری و رمز عبور را وارد کنید." });
    }

    // نرمال‌سازی رمز عبور: تبدیل ارقام فارسی/عربی به انگلیسی
    // (مثلاً ورودی «۱۲۳۴۵۶» معادل «123456» در نظر گرفته شود)
    const normalizedPassword = toEnglishDigits(password || "");

    // ۱. پیدا کردن کاربر در دیتابیس
    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: "نام کاربری یا رمز عبور نادرست است." });
    }

    // ۲. مقایسه رمز عبور وارد شده با هش bcrypt
    const isPasswordValid = await bcrypt.compare(normalizedPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "نام کاربری یا رمز عبور نادرست است." });
    }

    // ۳. ساخت توکن JWT
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    // ۴. ست کردن توکن در کوکی مرورگر
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    // ۵. بازگرداندن اطلاعات کاربر
    res.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        must_change_password: user.must_change_password,
      },
    });
  } catch (err: any) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "خطا در برقراری ارتباط با سرور یا دیتابیس." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  // پاک کردن کوکی توکن از روی مرورگر کاربر
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.json({ success: true, message: "با موفقیت از سیستم خارج شدید." });
});

// Middleware: احراز هویت و استخراج کاربر از کوکی
async function authenticate(req: any, res: any, next: any) {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ error: "عدم دسترسی، لطفا ابتدا وارد شوید." });
    }
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.is_active) {
      return res.status(401).json({ error: "حساب کاربری یافت نشد یا غیرفعال است." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "توکن نامعتبر یا منقضی شده است." });
  }
}

// Middleware: فقط مدیران
function requireManager(req: any, res: any, next: any) {
  if (req.user?.role !== "manager") {
    return res.status(403).json({ error: "دسترسی فقط برای مدیران مجاز است." });
  }
  next();
}

app.get("/api/auth/me", async (req, res) => {
  try {
    // خواندن توکن از کوکی‌های ریکوئست
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: "عدم دسترسی، لطفا ابتدا وارد شوید." });
    }

    // تایید و رمزگشایی توکن JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string; role: string };

    // پیدا کردن اطلاعات تازه کاربر از دیتابیس
    const user = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: "حساب کاربری یافت نشد یا غیرفعال است." });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        must_change_password: user.must_change_password,
      },
    });
  } catch (err) {
    res.status(401).json({ error: "توکن نامعتبر یا منقضی شده است." });
  }
});

// --- User Management ---
app.get("/api/users", async (_req, res) => {
  try {
    // رفتن به دیتابیس و خواندن تمام رکوردهای جدول User
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" }
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "خطا در دریافت اطلاعات کاربران از دیتابیس" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { username, full_name, role, job_title, password, must_change_password } = req.body;

    // ۱. بررسی تکراری نبودن نام کاربری در دیتابیس
    const existingUser = await prisma.user.findUnique({
      where: { username: username }
    });

    if (existingUser) {
      return res.status(400).json({ error: "نام کاربری تکراری است." });
    }

    // ۲. هش کردن رمز عبور اولیه و ساخت کاربر جدید در دیتابیس PostgreSQL
    const rawPassword = password || "123456";
    const hashedPassword = await bcrypt.hash(rawPassword, SALT_ROUNDS);

    const newUser = await prisma.user.create({
      data: {
        username,
        full_name,
        role: role || "user", // در پریزما به حروف کوچک/بزرگ Enum دقت کن
        job_title: job_title ? job_title.trim() : null,
        password: hashedPassword,
        is_active: true,
        must_change_password: must_change_password !== undefined ? must_change_password : true,
      },
    });

    // ۳. بازگرداندن اطلاعات کاربر ساخته شده به فرانت‌اند
    res.status(201).json(newUser);

  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "خطا در ثبت کاربر جدید در دیتابیس" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { full_name, username, role,job_title, is_active } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: "کاربر مورد نظر یافت نشد." });
    }

    if (username !== undefined && username !== existingUser.username) {
      const dupeUser = await prisma.user.findUnique({
        where: { username }
      });
      if (dupeUser) {
        return res.status(400).json({ error: "نام کاربری تکراری است." });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        full_name: full_name !== undefined ? full_name : undefined,
        username: username !== undefined ? username : undefined,
        role: role !== undefined ? role : undefined,
        job_title: job_title !== undefined ? job_title: undefined,
        is_active: is_active !== undefined ? is_active : undefined,
      }
    });

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "خطا در ویرایش اطلاعات کاربر در دیتابیس" });
  }
});

app.post("/api/users/:id/reset-password", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { temporary_password } = req.body;
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ error: "کاربر پیدا نشد." });
    }

    const rawResetPassword = temporary_password || "123456";
    const hashedResetPassword = await bcrypt.hash(rawResetPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedResetPassword,
        must_change_password: true
      }
    });

    res.json({ success: true, message: "رمز عبور با موفقیت بازنشانی شد." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "خطا در بازنشانی رمز عبور در دیتابیس" });
  }
});

// --- Project Management ---
app.get("/api/projects", async (_req, res) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { id: "asc" }
    });
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "خطا در دریافت اطلاعات پروژه‌ها از دیتابیس" });
  }
});

app.post("/api/projects", uploadWBS.single("wbs_file"), async (req, res) => {
  try {
    const { title, description, code } = req.body;
    const file = req.file;

   // ۱. بررسی تکراری بودن کد پروژه
    const existingCode = await prisma.project.findUnique({ 
      where: { code: code.trim() } 
    });
    if (existingCode) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path); // پاک کردن فایل آپلود شده
      return res.status(400).json({ error: "کد پروژه تکراری است." });
    }

    // ۲. 🟢 بررسی تکراری بودن نام فایل اکسل در تمامی پروژه‌های سامانه
    if (file) {
      const duplicateFileProject = await prisma.project.findFirst({
        where: { wbs_file_name: file.originalname }
      });

      if (duplicateFileProject) {
        // حذف فایل آپلود شده موقت از پوشه uploads جهت جلوگیری از پر شدن حافظه
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        return res.status(400).json({ 
          error: `فایلی با نام «${file.originalname}» قبلاً برای پروژه «${duplicateFileProject.title}» بارگذاری شده است. لطفاً نام فایل را تغییر دهید.` 
        });
      }
    }

    // ۳. ایجاد پروژه در دیتابیس
    const newProject = await prisma.project.create({
      data: {
        code: code.trim(),
        title: title.trim(),
        description: description ? description.trim() : null,
        wbs_file_name: file ? file.originalname : null,
      },
    });

    res.json(newProject);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "خطا در ساخت پروژه در دیتابیس" });
  }
});

app.put("/api/projects/:id", upload.single("wbs_file"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, code, description, remove_wbs_file } = req.body;
    const file = req.file;

    // ۱. بررسی وجود پروژه
    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ error: "پروژه مورد نظر یافت نشد." });
    }

    // ۲. بررسی تکراری نبودن کد پروژه
    if (code && code.trim() !== existingProject.code) {
      const dupeCode = await prisma.project.findUnique({
        where: { code: code.trim() },
      });
      if (dupeCode) {
        if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({ error: "کد پروژه تکراری است." });
      }
    }

    let updatedWbsFileName: string | null = existingProject.wbs_file_name;

    // بررسی اینکه آیا درخواست حذف فایل صادر شده است یا خیر
    const isRemoveRequested = 
      remove_wbs_file === "true" || 
      remove_wbs_file === true || 
      String(remove_wbs_file) === "true";

    // حالت الف: فایل جدید بارگذاری شده است
    if (file) {
      // چک تکراری نبودن نام فایل جدید در سایر پروژه‌ها
      const duplicateFileProject = await prisma.project.findFirst({
        where: {
          wbs_file_name: file.originalname,
          id: { not: id },
        },
      });

      if (duplicateFileProject) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(400).json({
          error: `فایلی با نام «${file.originalname}» قبلاً برای پروژه «${duplicateFileProject.title}» ثبت شده است.`,
        });
      }

      // حذف فایل فیزیکی قبلی از پوشه uploads
      if (existingProject.wbs_file_name) {
        const oldFilePath = path.join(process.cwd(), "uploads", existingProject.wbs_file_name);
        if (fs.existsSync(oldFilePath)) {
          try { fs.unlinkSync(oldFilePath); } catch (e) { console.error("Error deleting old file:", e); }
        }
      }

      updatedWbsFileName = file.originalname;
    } 
    // حالت ب: فایل جدیدی نیست و درخواست حذف فایل فعلی داده شده است
    else if (isRemoveRequested) {
      if (existingProject.wbs_file_name) {
        const oldFilePath = path.join(process.cwd(), "uploads", existingProject.wbs_file_name);
        if (fs.existsSync(oldFilePath)) {
          try { fs.unlinkSync(oldFilePath); } catch (e) { console.error("Error deleting file from disk:", e); }
        }
      }
      updatedWbsFileName = null; // 🟢 صریحاً null ست می‌شود تا در دیتابیس پاک گردد
    }

    // ۳. به‌روزرسانی پروژه در دیتابیس
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        code: code !== undefined ? code.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        wbs_file_name: updatedWbsFileName, // اعمال تغییر (نام جدید یا null یا مقدار قبلی)
      },
    });

    res.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "خطا در ویرایش اطلاعات پروژه در دیتابیس" });
  }
});

// --- Report Period Management ---
app.get("/api/report-periods", async (req, res) => {
  try {
    const periods = await prisma.reportPeriod.findMany({
      orderBy: { id: "asc" }
    });
    res.json(periods.map(p => ({
      ...p,
      period_start: p.period_start.toISOString().split("T")[0],
      period_end: p.period_end.toISOString().split("T")[0]
    })));
  } catch (error) {
    console.error("Error fetching periods:", error);
    res.status(500).json({ error: "خطا در دریافت بازه‌های گزارش‌دهی" });
  }
});

app.post("/api/report-periods", async (req, res) => {
  try {
    const { title, report_type, period_start, period_end } = req.body;

    const newPeriod = await prisma.reportPeriod.create({
      data: {
        title,
        report_type,
        period_start: new Date(period_start),
        period_end: new Date(period_end),
        is_open: true
      }
    });

    res.json({
      ...newPeriod,
      period_start: newPeriod.period_start.toISOString().split("T")[0],
      period_end: newPeriod.period_end.toISOString().split("T")[0]
    });
  } catch (error) {
    console.error("Error creating period:", error);
    res.status(500).json({ error: "خطا در ثبت بازه جدید در دیتابیس" });
  }
});

app.put("/api/report-periods/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { is_open, title, period_start, period_end } = req.body;

    const existing = await prisma.reportPeriod.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "بازه گزارش پیدا نشد." });
    }

    const updated = await prisma.reportPeriod.update({
      where: { id },
      data: {
        is_open: is_open !== undefined ? is_open : undefined,
        title: title !== undefined ? title : undefined,
        period_start: period_start !== undefined ? new Date(period_start) : undefined,
        period_end: period_end !== undefined ? new Date(period_end) : undefined
      }
    });

    res.json({
      ...updated,
      period_start: updated.period_start.toISOString().split("T")[0],
      period_end: updated.period_end.toISOString().split("T")[0]
    });
  } catch (error) {
    console.error("Error updating period:", error);
    res.status(500).json({ error: "خطا در ویرایش بازه گزارش در دیتابیس" });
  }
});

// DELETE a report period and all its reports cascades
app.delete("/api/report-periods/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Find all reports in this period
    const reports = await prisma.report.findMany({ where: { period_id: id } });
    const reportIds = reports.map((r) => r.id);

    // Delete physical uploads
    await cleanPhysicalFilesForReports(reportIds);

    // Delete period from PostgreSQL (Prisma onDelete: Cascade deletes reports)
    await prisma.reportPeriod.delete({ where: { id } });

    res.json({ success: true, message: "بازه گزارش‌دهی و تمامی داده‌های مربوطه با موفقیت حذف شدند." });
  } catch (error) {
    console.error("Error deleting period:", error);
    res.status(500).json({ error: "خطا در حذف بازه گزارش‌دهی از دیتابیس" });
  }
});

// --- Project KPI Management (شاخص‌های عملکرد پروژه) ---
const KPI_TARGET_DIRECTIONS = ["minimum", "maximum"];
const REPORT_TYPES = ["weekly", "monthly"];

// لیست تمام شاخص‌ها (همراه با نام پروژه) — برای تحلیل‌های مدیریتی
app.get("/api/project-kpis", authenticate, requireManager, async (_req, res) => {
  try {
    const kpis = await prisma.projectKpi.findMany({
      include: {
        project: { select: { id: true, title: true } },
      },
      orderBy: [{ project_id: "asc" }, { sort_order: "asc" }],
    });
    res.json(kpis);
  } catch (error) {
    console.error("Error fetching KPIs:", error);
    res.status(500).json({ error: "خطا در دریافت شاخص‌های پروژه" });
  }
});

// لیست شاخص‌های یک پروژه.
// بدون پارامتر: تمام شاخص‌ها (فعال/غیرفعال) — صفحه مدیریت.
// با ?report_type=weekly|monthly: فقط شاخص‌های فعالِ کاربردی برای آن نوع — فرم ثبت گزارش.
app.get("/api/projects/:projectId/kpis", async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { report_type } = req.query;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: "شناسه پروژه نامعتبر است." });
    }

    const where: any = { project_id: projectId };
    if (report_type) {
      where.is_active = true;
      where.OR = [{ report_type: null }, { report_type: String(report_type) }];
    }

    const kpis = await prisma.projectKpi.findMany({
      where,
      orderBy: { sort_order: "asc" },
    });
    res.json(kpis);
  } catch (error) {
    console.error("Error fetching project KPIs:", error);
    res.status(500).json({ error: "خطا در دریافت شاخص‌های پروژه" });
  }
});

// ایجاد شاخص جدید برای یک پروژه
app.post("/api/project-kpis", authenticate, requireManager, async (req, res) => {
  try {
    const {
      project_id,
      name,
      description,
      unit,
      input_type,
      target_value,
      target_direction,
      report_type,
      is_active,
      sort_order,
    } = req.body;

    const projectId = Number(project_id);
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: "شناسه پروژه نامعتبر است." });
    }
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(400).json({ error: "پروژه انتخاب‌شده یافت نشد." });
    }

    const kpiName = typeof name === "string" ? name.trim() : "";
    if (!kpiName) {
      return res.status(400).json({ error: "نام شاخص نمی‌تواند خالی باشد." });
    }

    const kpiUnit = typeof unit === "string" ? unit.trim() : "";
    if (!kpiUnit) {
      return res.status(400).json({ error: "واحد سنجش نمی‌تواند خالی باشد." });
    }

    if (!KPI_INPUT_TYPES.includes(input_type)) {
      return res.status(400).json({ error: "نوع محاسبه شاخص نامعتبر است." });
    }

    if (target_value === undefined || target_value === null || target_value === "" || isNaN(Number(target_value))) {
      return res.status(400).json({ error: "مقدار هدف باید عددی معتبر باشد." });
    }

    if (!KPI_TARGET_DIRECTIONS.includes(target_direction)) {
      return res.status(400).json({ error: "جهت هدف شاخص نامعتبر است." });
    }

    let reportType: "weekly" | "monthly" | null = null;
    if (report_type !== undefined && report_type !== null && report_type !== "") {
      if (!REPORT_TYPES.includes(report_type)) {
        return res.status(400).json({ error: "نوع دوره گزارش‌دهی نامعتبر است." });
      }
      reportType = report_type;
    }

    const sortOrder = sort_order !== undefined && sort_order !== null && sort_order !== ""
      ? Number(sort_order)
      : 0;
    if (isNaN(sortOrder)) {
      return res.status(400).json({ error: "ترتیب نمایش باید عددی باشد." });
    }

    const newKpi = await prisma.projectKpi.create({
      data: {
        project_id: projectId,
        name: kpiName,
        description: description ? String(description).trim() || null : null,
        unit: kpiUnit,
        input_type,
        target_value: Number(target_value),
        target_direction,
        report_type: reportType,
        is_active: is_active === undefined ? true : Boolean(is_active),
        sort_order: sortOrder,
      },
    });

    res.status(201).json(newKpi);
  } catch (error) {
    console.error("Error creating KPI:", error);
    res.status(500).json({ error: "خطا در ثبت شاخص جدید در دیتابیس" });
  }
});

// ویرایش شاخص (شامل فعال/غیرفعال و ترتیب نمایش)
app.patch("/api/project-kpis/:id", authenticate, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      name,
      description,
      unit,
      input_type,
      target_value,
      target_direction,
      report_type,
      is_active,
      sort_order,
    } = req.body;

    const existing = await prisma.projectKpi.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "شاخص مورد نظر یافت نشد." });
    }

    const data: any = {};

    if (name !== undefined) {
      const kpiName = String(name).trim();
      if (!kpiName) return res.status(400).json({ error: "نام شاخص نمی‌تواند خالی باشد." });
      data.name = kpiName;
    }
    if (description !== undefined) {
      data.description = String(description).trim() || null;
    }
    if (unit !== undefined) {
      const kpiUnit = String(unit).trim();
      if (!kpiUnit) return res.status(400).json({ error: "واحد سنجش نمی‌تواند خالی باشد." });
      data.unit = kpiUnit;
    }
    if (input_type !== undefined) {
      if (!KPI_INPUT_TYPES.includes(input_type)) {
        return res.status(400).json({ error: "نوع محاسبه شاخص نامعتبر است." });
      }
      data.input_type = input_type;
    }
    if (target_value !== undefined) {
      if (target_value === null || target_value === "" || isNaN(Number(target_value))) {
        return res.status(400).json({ error: "مقدار هدف باید عددی معتبر باشد." });
      }
      data.target_value = Number(target_value);
    }
    if (target_direction !== undefined) {
      if (!KPI_TARGET_DIRECTIONS.includes(target_direction)) {
        return res.status(400).json({ error: "جهت هدف شاخص نامعتبر است." });
      }
      data.target_direction = target_direction;
    }
    if (report_type !== undefined) {
      if (report_type === null || report_type === "") {
        data.report_type = null;
      } else if (REPORT_TYPES.includes(report_type)) {
        data.report_type = report_type;
      } else {
        return res.status(400).json({ error: "نوع دوره گزارش‌دهی نامعتبر است." });
      }
    }
    if (is_active !== undefined) data.is_active = Boolean(is_active);
    if (sort_order !== undefined) {
      const so = Number(sort_order);
      if (isNaN(so)) return res.status(400).json({ error: "ترتیب نمایش باید عددی باشد." });
      data.sort_order = so;
    }

    const updated = await prisma.projectKpi.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error("Error updating KPI:", error);
    res.status(500).json({ error: "خطا در ویرایش شاخص در دیتابیس" });
  }
});

// حذف شاخص — فقط در صورتی که هیچ مقدار ثبت‌شده‌ای در گزارش‌ها نداشته باشد.
// شاخص‌های دارای تاریخچه باید غیرفعال شوند نه حذف.
app.delete("/api/project-kpis/:id", authenticate, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await prisma.projectKpi.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "شاخص مورد نظر یافت نشد." });
    }

    const valuesCount = await prisma.reportKpiValue.count({ where: { project_kpi_id: id } });
    if (valuesCount > 0) {
      return res.status(400).json({
        error: "این شاخص دارای مقادیر ثبت‌شده در گزارش‌هاست و قابل حذف نیست. لطفاً آن را غیرفعال کنید.",
      });
    }

    await prisma.projectKpi.delete({ where: { id } });
    res.json({ success: true, message: "شاخص با موفقیت حذف شد." });
  } catch (error) {
    console.error("Error deleting KPI:", error);
    res.status(500).json({ error: "خطا در حذف شاخص از دیتابیس" });
  }
});

// دریافت مقادیر ثبت‌شده یک شاخص برای نمودار روند (مرتب‌شده بر اساس پایان دوره)
app.get("/api/project-kpis/:id/values", authenticate, requireManager, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const kpi = await prisma.projectKpi.findUnique({ where: { id } });
    if (!kpi) {
      return res.status(404).json({ error: "شاخص یافت نشد." });
    }

    const values = await prisma.reportKpiValue.findMany({
      where: { project_kpi_id: id },
      include: {
        report: {
          select: {
            id: true,
            period_end: true,
            period_title: true,
            report_type: true,
            user_full_name: true,
            project_title: true,
          },
        },
      },
      orderBy: { report: { period_end: "asc" } },
    });

    const formatted = values.map((v: any) => ({
      id: v.id,
      report_id: v.report_id,
      current_value: v.current_value,
      baseline_value: v.baseline_value,
      calculated_value: v.calculated_value,
      not_measured: v.not_measured,
      missing_reason: v.missing_reason,
      period_end: v.report?.period_end ? v.report.period_end.toISOString().split("T")[0] : null,
      period_title: v.report?.period_title || null,
      report_type: v.report?.report_type || null,
      user_full_name: v.report?.user_full_name || null,
    }));

    res.json({ kpi, values: formatted });
  } catch (error) {
    console.error("Error fetching KPI values:", error);
    res.status(500).json({ error: "خطا در دریافت مقادیر شاخص" });
  }
});

// --- User Project Assignments ---
// ۱. دریافت تمامی تخصیص‌های فعلی دیتابیس
// ۱. دریافت تمامی تخصیص‌های فعلی دیتابیس
app.get("/api/user-projects", async (req, res) => {
  try {
    const allocations = await prisma.userProject.findMany();
    // خروجی شامل: [{ id: 1, user_id: 2, project_id: 5 }, ...]
    res.json(allocations);
  } catch (error) {
    console.error("Error fetching user projects:", error);
    res.status(500).json({ error: "خطا در دریافت تخصیص‌های پروژه." });
  }
});

// ۲. ذخیره و به‌روزرسانی لیست پروژه‌های یک کاربر
app.post("/api/users/:user_id/projects", async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);
    const { projectIds } = req.body; // آرایه‌ای از ID پروژه‌ها [1, 2, 5]

    if (isNaN(user_id)) {
      return res.status(400).json({ error: "شناسه کاربر نامعتبر است." });
    }

    // ۱. حذف تمامی تخصیص‌های قبلی این کاربر
    await prisma.userProject.deleteMany({
      where: { user_id }
    });

    // ۲. یکتا کردن پروژه ها با Set برای جلوگیری از اختصاص تکراری یک پروژه به یک فرد
    if (Array.isArray(projectIds) && projectIds.length > 0) {
      const uniqueProjectIds = Array.from(new Set(projectIds.map(Number)));

      for (const project_id of uniqueProjectIds) {
        await prisma.userProject.create({
          data: {
            user_id,
            project_id
          }
        });
      }
    }

    res.json({ success: true, message: "تخصیص پروژه‌ها با موفقیت بروزرسانی شد." });
  } catch (error) {
    console.error("Error updating user projects:", error);
    res.status(500).json({ error: "خطا در ذخیره‌سازی تخصیص پروژه‌ها در دیتابیس." });
  }
});

// --- Deadline Settings ---
app.get("/api/deadline-settings", async (req, res) => {
  try {
    const settings = await prisma.deadlineSetting.findMany({
      orderBy: { id: "asc" }
    });
    res.json(settings);
  } catch (error) {
    console.error("Error fetching deadline settings:", error);
    res.status(500).json({ error: "خطا در دریافت تنظیمات ددلاین" });
  }
});

app.put("/api/deadline-settings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { deadline_day, deadline_time } = req.body;

    const existing = await prisma.deadlineSetting.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "تنظیمات ددلاین پیدا نشد." });
    }

    const updated = await prisma.deadlineSetting.update({
      where: { id },
      data: {
        deadline_day: deadline_day !== undefined ? parseInt(deadline_day) : undefined,
        deadline_time: deadline_time !== undefined ? deadline_time : undefined
      }
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating deadline settings:", error);
    res.status(500).json({ error: "خطا در ویرایش تنظیمات ددلاین در دیتابیس" });
  }
});

// --- Reports ---
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      include: { files: true, nextActions: true, kpiValues: true },
      orderBy: { id: "desc" }
    });
    res.json(reports.map(serializeReport));
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "خطا در دریافت گزارش‌ها از دیتابیس" });
  }
});

app.post("/api/reports", upload.array("files"), async (req, res) => {
  try {
    const {
      user_id,
      project_id,
      report_type,
      period_id,
      activities_done,
      results_achieved,
      next_actions,
      kpi_text,
      kpi_values,
    } = req.body;
    const parsedNextActions = parseNextActions(next_actions);

    const user = await prisma.user.findUnique({ where: { id: parseInt(user_id) } });
    const project = await prisma.project.findUnique({ where: { id: parseInt(project_id) } });
    const period = await prisma.reportPeriod.findUnique({ where: { id: parseInt(period_id) } });

    if (!user || !project || !period) {
      return res.status(400).json({ error: "اطلاعات فرستاده شده کاربر، پروژه یا بازه نامعتبر است." });
    }

    const existingReport = await prisma.report.findFirst({
      where: {
        user_id: user.id,
        project_id: project.id,
        period_id: period.id
      }
    });

    if (existingReport) {
      return res.status(400).json({ error: "شما قبلاً برای این پروژه در این دوره گزارش ثبت کرده‌اید." });
    }

    // Calculate status (submitted or late) based on deadline settings
    const deadline = await prisma.deadlineSetting.findFirst({
      where: { report_type: report_type as any }
    });
    let status: "submitted" | "late" = "submitted";

    if (deadline) {
      try {
        const now = new Date();
        // محاسبه ددلاین واقعی با تابع جدید
        const deadlineDate = getDeadlineDate(
          new Date(period.period_end),
          deadline.deadline_day,
          deadline.deadline_time,
          report_type as "weekly" | "monthly"
        );
        
        // اگر زمان فعلی از ددلاین گذشته باشد، گزارش تأخیری ثبت می‌شود
        if (now > deadlineDate) {
          status = "late";
        }
      } catch (err) {
        console.error("Error calculating dynamic deadline for POST:", err);
      }
    }

    const uploadedFiles = req.files && Array.isArray(req.files) ? req.files : [];

    // اعتبارسنجی و محاسبه سمت سرور مقادیر شاخص‌های ساختاریافته
    const validatedKpiValues = await validateAndBuildKpiValues(
      kpi_values,
      project.id,
      report_type as "weekly" | "monthly"
    );

    const newReport = await prisma.report.create({
      data: {
        user_id: user.id,
        user_full_name: user.full_name,
        user_username: user.username,
        project_id: project.id,
        project_title: project.title,
        report_type: report_type as any,
        period_id: period.id,
        period_title: period.title,
        period_start: period.period_start,
        period_end: period.period_end,
        activities_done,
        results_achieved,
        kpi_text,
        status: status as any,
        nextActions: parsedNextActions.length
          ? {
              create: parsedNextActions,
            }
          : undefined,
        kpiValues: validatedKpiValues.length
          ? {
              create: validatedKpiValues,
            }
          : undefined,
        files: uploadedFiles.length
          ? {
              create: uploadedFiles.map((file) => ({
                filename: file.filename,
                original_filename: file.originalname,
                file_size: file.size,
              })),
            }
          : undefined,
      },
      include: { files: true, nextActions: true, kpiValues: true }
    });

    res.json(serializeReport(newReport));
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(error instanceof NextActionsValidationError || error instanceof KpiValidationError ? 400 : 500).json({
      error: error instanceof NextActionsValidationError || error instanceof KpiValidationError
        ? error.message
        : "خطا در ثبت گزارش در دیتابیس",
    });
  }
});

app.put("/api/reports/:id", upload.array("files"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { activities_done, results_achieved, next_actions, kpi_text, kpi_values } = req.body;
    const shouldUpdateNextActions = next_actions !== undefined;
    const parsedNextActions = shouldUpdateNextActions ? parseNextActions(next_actions) : [];

    const existingReport = await prisma.report.findUnique({ where: { id } });
    if (!existingReport) {
      return res.status(404).json({ error: "گزارش پیدا نشد." });
    }

    const period = await prisma.reportPeriod.findUnique({ where: { id: existingReport.period_id } });
    if (period) {
      const deadline = await prisma.deadlineSetting.findFirst({
        where: { report_type: existingReport.report_type as any }
      });
      
      if (deadline) {
        const now = new Date();
        // محاسبه ددلاین واقعی بر اساس نوع گزارش ثبت‌شده
        const deadlineDate = getDeadlineDate(
          new Date(period.period_end),
          deadline.deadline_day,
          deadline.deadline_time,
          existingReport.report_type as "weekly" | "monthly"
        );
        
        if (now > deadlineDate) {
          return res.status(400).json({ error: "مهلت ویرایش این گزارش به پایان رسیده است." });
        }
      }
    }

    // Handle file deletion from req.body.deleted_file_ids if any
    if (req.body.deleted_file_ids) {
      const deletedIds = JSON.parse(req.body.deleted_file_ids).map((fid: any) => parseInt(fid));
      const filesToDelete = await prisma.reportFile.findMany({
        where: { id: { in: deletedIds }, report_id: id }
      });
      for (const rf of filesToDelete) {
        try {
          const filePath = path.join(uploadDir, rf.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) {}
      }
    }

    const deletedFileIds = req.body.deleted_file_ids
      ? JSON.parse(req.body.deleted_file_ids).map((fid: any) => parseInt(fid))
      : [];
    const uploadedFiles = req.files && Array.isArray(req.files) ? req.files : [];

    const validatedKpiValues = kpi_values !== undefined
      ? await validateAndBuildKpiValues(kpi_values, existingReport.project_id, existingReport.report_type)
      : null;

    const updated = await prisma.$transaction(async (tx) => {
      if (deletedFileIds.length) {
        await tx.reportFile.deleteMany({
          where: { id: { in: deletedFileIds }, report_id: id }
        });
      }

      if (uploadedFiles.length) {
        await tx.reportFile.createMany({
          data: uploadedFiles.map((file) => ({
            report_id: id,
            filename: file.filename,
            original_filename: file.originalname,
            file_size: file.size,
          }))
        });
      }

      if (shouldUpdateNextActions) {
        await tx.nextAction.deleteMany({ where: { report_id: id } });
        if (parsedNextActions.length) {
          await tx.nextAction.createMany({
            data: parsedNextActions.map((action) => ({
              report_id: id,
              ...action,
            }))
          });
        }
      }

      if (validatedKpiValues !== null) {
        await tx.reportKpiValue.deleteMany({ where: { report_id: id } });
        if (validatedKpiValues.length > 0) {
          await tx.reportKpiValue.createMany({
            data: validatedKpiValues.map((v) => ({ ...v, report_id: id }))
          });
        }
      }

      return tx.report.update({
        where: { id },
        data: {
          activities_done: activities_done !== undefined ? activities_done : undefined,
          results_achieved: results_achieved !== undefined ? results_achieved : undefined,
          kpi_text: kpi_text !== undefined ? kpi_text : undefined,
        },
        include: { files: true, nextActions: true, kpiValues: true }
      });
    });

    res.json(serializeReport(updated));
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(error instanceof NextActionsValidationError ? 400 : 500).json({
      error: error instanceof NextActionsValidationError ? error.message : "خطا در ویرایش گزارش در دیتابیس",
    });
  }
});

// Delete a report file directly
app.delete("/api/report-files/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const file = await prisma.reportFile.findUnique({ where: { id } });

    if (!file) {
      return res.status(404).json({ error: "فایل پیدا نشد." });
    }

    try {
      const filePath = path.join(uploadDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting file physical file:", err);
    }

    await prisma.reportFile.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting report file:", error);
    res.status(500).json({ error: "خطا در حذف فایل گزارش در دیتابیس" });
  }
});


// --- Manager Dashboard Status Summary Helper ---
app.get("/api/dashboard/summary", async (req, res) => {
  try {
    const periodId = parseInt(req.query.period_id as string);
    const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : null;
    const user_id = req.query.user_id ? parseInt(req.query.user_id as string) : null;

    const period = await prisma.reportPeriod.findUnique({ where: { id: periodId } });
    if (!period) {
      return res.status(404).json({ error: "بازه مورد نظر یافت نشد." });
    }

    // Get active users who are 'user' role
    const activeStaff = await prisma.user.findMany({
      where: { is_active: true, role: "user" }
    });

    const staffIds = activeStaff.map(s => s.id);
    
    // Find assigned project IDs for active users on active projects
    const userProjects = await prisma.userProject.findMany({
      where: {
        user_id: { in: staffIds },
        project: { is_active: true }
      },
      include: {
        user: true,
        project: true
      }
    });

    let expectedPairs: any[] = [];
    for (const up of userProjects) {
      if (projectId && up.project_id !== projectId) continue;
      if (user_id && up.user_id !== user_id) continue;

      expectedPairs.push({
        user: up.user,
        project: up.project
      });
    }

    // Fetch reports for this period
    const reports = await prisma.report.findMany({
      where: { period_id: periodId },
      include: { files: true }
    });

    const rows = expectedPairs.map((pair) => {
      const matchingReport = reports.find(
        (r) => r.user_id === pair.user.id && r.project_id === pair.project.id
      );

      let status_key: "submitted" | "late" | "missing" = "missing";
      let status_label = "ثبت‌نشده";

      if (matchingReport) {
        status_key = matchingReport.status;
        status_label = matchingReport.status === "late" ? "تأخیری" : "ثبت‌شده";
      }

      return {
        user_id: pair.user.id,
        user_full_name: pair.user.full_name,
        user_username: pair.user.username,
        project_id: pair.project.id,
        project_title: pair.project.title,
        status_key,
        status_label,
        report: matchingReport ? {
          ...matchingReport,
          period_start: matchingReport.period_start.toISOString().split("T")[0],
          period_end: matchingReport.period_end.toISOString().split("T")[0],
          submitted_at: matchingReport.submitted_at.toISOString()
        } : null,
      };
    });

    // Calculate summary counts
    const summary = {
      total_expected: rows.length,
      submitted_count: rows.filter((r) => r.status_key === "submitted").length,
      late_count: rows.filter((r) => r.status_key === "late").length,
      missing_count: rows.filter((r) => r.status_key === "missing").length,
    };

    res.json({
      period: {
        ...period,
        period_start: period.period_start.toISOString().split("T")[0],
        period_end: period.period_end.toISOString().split("T")[0]
      },
      summary,
      rows,
    });
  } catch (error) {
    console.error("Error generating dashboard summary:", error);
    res.status(500).json({ error: "خطا در دریافت خلاصه داشبورد از دیتابیس" });
  }
});

// Helper function to clean physical file uploads from disk for a list of reports
async function cleanPhysicalFilesForReports(reportIds: number[]) {
  if (reportIds.length === 0) return;
  try {
    const files = await prisma.reportFile.findMany({
      where: { report_id: { in: reportIds } }
    });
    for (const rf of files) {
      try {
        const filePath = path.join(uploadDir, rf.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.error("Error deleting physical file:", rf.filename, err);
      }
    }
  } catch (error) {
    console.error("Error cleaning files for reports:", error);
  }
}

// DELETE a user and all their associated reports, allocations, and files cascades
app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Find all reports by this user
    const reports = await prisma.report.findMany({ where: { user_id: id } });
    const reportIds = reports.map((r) => r.id);

    // Delete physical uploads
    await cleanPhysicalFilesForReports(reportIds);

    // Delete user from PostgreSQL (Prisma onDelete: Cascade deletes allocations and reports)
    await prisma.user.delete({ where: { id } });

    res.json({ success: true, message: "کاربر و تمامی داده‌های مربوطه با موفقیت حذف شدند." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "خطا در حذف کاربر از دیتابیس" });
  }
});

// DELETE a project and all its associated reports and allocations cascades
app.delete("/api/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Find all reports for this project
    const reports = await prisma.report.findMany({ where: { project_id: id } });
    const reportIds = reports.map((r) => r.id);

    // Delete physical uploads
    await cleanPhysicalFilesForReports(reportIds);

    // Delete project from PostgreSQL (Prisma onDelete: Cascade deletes allocations and reports)
    await prisma.project.delete({ where: { id } });

    res.json({ success: true, message: "پروژه و تمامی داده‌های مربوطه با موفقیت حذف شدند." });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "خطا در حذف پروژه از دیتابیس" });
  }
});

// تابع کمکی تبدیل اعداد فارسی/عربی به انگلیسی و حذف فاصله‌های اضافی
const toEnglishDigits = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .trim();
};

// 1️⃣ دریافت لیست تمامی اقدامات آتی همراه با اطلاعات پروژه و کاربر از طریق Report
app.get("/api/next-actions", async (req, res) => {
  try {
    const { project_id } = req.query;

    const actions = await prisma.nextAction.findMany({
      where: project_id ? {
        report: { project_id: Number(project_id) }
      } : {},
      include: {
        report: {
          include: {
            project: { select: { id: true, title: true } },
            user: { select: { id: true, full_name: true, job_title: true } },
          }
        }
      },
      orderBy: { target_date: "asc" },
    });

    // مپ کردن داده‌ها جهت ارسال ساختار تمیز به فرانت‌اند
    const formattedActions = actions.map((a) => ({
      id: a.id,
      action_text: a.action_text,
      target_date: a.target_date,
      is_completed: a.is_completed,
      completed_at: a.completed_at,
      project: a.report?.project,
      user: a.report?.user,
    }));

    res.json(formattedActions);
  } catch (error) {
    console.error("Error fetching next actions:", error);
    res.status(500).json({ error: "خطا در دریافت لیست اقدامات آتی." });
  }
});

// 2️⃣ تغییر وضعیت تحویل اقدام (Mark as Completed / Uncompleted)
app.patch("/api/next-actions/:id/toggle", async (req, res) => {
  try {
    const actionId = Number(req.params.id);
    const { is_completed } = req.body;

    const action = await prisma.nextAction.findUnique({ where: { id: actionId } });
    if (!action) {
      return res.status(404).json({ error: "اقدام مورد نظر یافت نشد." });
    }

    const updatedAction = await prisma.nextAction.update({
      where: { id: actionId },
      data: {
        is_completed: Boolean(is_completed),
        completed_at: is_completed ? new Date() : null,
      },
    });

    res.json({ success: true, action: updatedAction });
  } catch (error) {
    console.error("Error toggling action status:", error);
    res.status(500).json({ error: "خطا در تغییر وضعیت اقدام." });
  }
});

// 🔒 تنها اندپوینت معتبر تغییر اجباری رمز عبور موقت توسط کاربر
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { user_id, userId, newPassword } = req.body;
    const targetId = Number(user_id || userId);

    if (!targetId || isNaN(targetId)) {
      return res.status(400).json({ error: "شناسه کاربر ارسال نشده یا نامعتبر است." });
    }

    // ۱. نرم‌افزارسازی کلمه عبور ارسالی (تبدیل کیبورد فارسی به انگلیسی)
    const normalizedPassword = toEnglishDigits(newPassword || "");

    if (!normalizedPassword || normalizedPassword.length < 6) {
      return res.status(400).json({ error: "رمز عبور جدید باید حداقل ۶ کاراکتر باشد." });
    }

    // ۲. بررسی وجود کاربر در دیتابیس
    const existingUser = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!existingUser) {
      return res.status(404).json({ error: "کاربر مورد نظر در سیستم یافت نشد." });
    }

    // ۳. بررسی عدم تکراری بودن رمز عبور جدید با رمز فعلی
    let isSamePassword = false;
    if (
      existingUser.password.startsWith("$2a$") || 
      existingUser.password.startsWith("$2b$") || 
      existingUser.password.startsWith("$2y$")
    ) {
      isSamePassword = await bcrypt.compare(normalizedPassword, existingUser.password);
    } else {
      isSamePassword = (normalizedPassword === existingUser.password);
    }

    if (isSamePassword) {
      return res.status(400).json({ 
        error: "رمز عبور جدید نمی‌تواند مشابه رمز عبور موقت فعلی باشد. لطفاً رمز جدیدی وارد نمایید." 
      });
    }

    // ۴. هش کردن رمز عبور جدید
    const hashedPassword = await bcrypt.hash(normalizedPassword, 10);

    // ۵. به‌روزرسانی رمز عبور در دیتابیس
    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: {
        password: hashedPassword,
        must_change_password: false,
      },
    });

    res.json({ 
      success: true, 
      message: "رمز عبور شما با موفقیت به روزرسانی شد.",
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        full_name: updatedUser.full_name,
        role: updatedUser.role,
        job_title: updatedUser.job_title,
        must_change_password: false
      }
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "خطا در ذخیره‌سازی رمز عبور جدید در دیتابیس." });
  }
});

// -----------------------------
// manager and ahmadi users password fix for security
// -----------------------------

// 👇 این تابع موقت را دقیقاً قبل از startServer اضافه کن 👇
//async function fixExistingUsers() {
  //try {
    // کلمه عبور دلخواه (مثلاً همان 123456 پیش‌فرض) را هش می‌کنیم
//    const hashedPassword = await bcrypt.hash("123456", 10);
    
    // بروزرسانی کاربر manager
//    await prisma.user.updateMany({
//      where: { username: "manager" },
//      data: { password: hashedPassword }
//    });
    
    // بروزرسانی کاربر ahmadi
//    await prisma.user.updateMany({
//      where: { username: "ahmadi" },
//      data: { password: hashedPassword }
//    });
//    
//    console.log("🟢 [امنیت] رمز عبور کاربران manager و ahmadi با موفقیت به صورت هش‌شده بروزرسانی شد.");
//  } catch (err) {
//    console.error("🔴 خطا در بروزرسانی امنیتی کاربران قدیمی:", err);
//  }
//}

// صدا زدن تابع برای یک‌بار اجرا در زمان بوت شدن سرور
//fixExistingUsers();
// 👆 ==================================================== 👆

// -----------------------------
// VITE OR STATIC FRONTEND SERVING
// -----------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
