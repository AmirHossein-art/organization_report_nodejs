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
    nextActions: Array.isArray(report.nextActions)
      ? report.nextActions.map((action: any) => ({
          ...action,
          target_date: action.target_date.toISOString().split("T")[0],
        }))
      : report.nextActions,
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
        return `--- گزارش ${index + 1} ---
نویسنده: ${r.user_full_name}
پروژه: ${r.project_title}
فعالیت‌ها: ${r.activities_done}
نتایج: ${r.results_achieved || "ثبت نشده"}
اقدامات آتی: ${formatNextActionsForPrompt(r.nextActions)}
شاخص‌ها (KPIs): ${r.kpi_text || "ثبت نشده"}`;
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

    const previousReportsText = previousReports.length > 0
      ? previousReports.map((r, i) => `--- گزارش سابقه ${i + 1} ---
فعالیت‌ها: ${r.activities_done}
نتایج: ${r.results_achieved || "ثبت نشده"}
شاخص‌ها: ${r.kpi_text || "ثبت نشده"}`).join("\n\n")
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
شاخص‌های کلیدی (KPIs): ${currentReport.kpi_text || "ثبت نشده"}
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

    // ۱. پیدا کردن کاربر در دیتابیس
    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: "نام کاربری یا رمز عبور نادرست است." });
    }

    // ۲. مقایسه رمز عبور وارد شده با هش bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
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

app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { userId, newPassword } = req.body;

    // ۱. بررسی وجود کاربر با شناسه ارسال شده
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!user) {
      return res.status(404).json({ error: "کاربر مورد نظر یافت نشد." });
    }

    // ۲. هش کردن رمز عبور جدید و بروزرسانی آن در دیتابیس
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        password: hashedNewPassword,
        must_change_password: false, // دیگر نیازی به تغییر رمز اجباری در ورودهای بعدی نیست
        password_changed_at: new Date(), // ذخیره تاریخ دقیق تغییر رمز به زمان فعلی دیتابیس
      }
    });

    res.json({ success: true, message: "رمز عبور با موفقیت تغییر یافت." });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "خطا در ذخیره‌سازی رمز عبور جدید در دیتابیس" });
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
    const { username, full_name, role, password, must_change_password } = req.body;

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
    const { full_name, username, role, is_active } = req.body;

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
    const wbsFileName = req.file ? req.file.filename : null;

    const existing = await prisma.project.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ error: "کد پروژه تکراری است." });
    }

    const newProject = await prisma.project.create({
      data: {
        title,
        description: description || "",
        code,
        is_active: true,
        wbs_file_name: wbsFileName,
      }
    });

    res.json(newProject);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "خطا در ساخت پروژه در دیتابیس" });
  }
});

app.put("/api/projects/:id", uploadWBS.single("wbs_file"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { title, description, code, is_active } = req.body;
    const wbsFileName = req.file ? req.file.filename : undefined;

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "پروژه پیدا نشد." });
    }

    if (code !== undefined && code !== existing.code) {
      const dupeProj = await prisma.project.findUnique({ where: { code } });
      if (dupeProj) {
        return res.status(400).json({ error: "کد پروژه تکراری است." });
      }
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        description: description !== undefined ? description : undefined,
        code: code !== undefined ? code : undefined,
        is_active: is_active !== undefined ? is_active : undefined,
        wbs_file_name: wbsFileName !== undefined ? wbsFileName : undefined, // 👈 ذخیره فایل جدید در صورت آپلود
      }
    });

    res.json(updated);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "خطا در ویرایش پروژه در دیتابیس" });
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

// --- User Project Assignments ---
app.get("/api/user-projects", async (req, res) => {
  try {
    const allocations = await prisma.userProject.findMany({
      orderBy: { id: "asc" }
    });
    res.json(allocations);
  } catch (error) {
    console.error("Error fetching user projects:", error);
    res.status(500).json({ error: "خطا در دریافت تخصیص‌های پروژه‌ها" });
  }
});

app.post("/api/user-projects/sync", async (req, res) => {
  try {
    const { user_id, project_ids } = req.body;

    await prisma.$transaction([
      prisma.userProject.deleteMany({ where: { user_id: parseInt(user_id) } }),
      ...(Array.isArray(project_ids) ? project_ids.map(projId =>
        prisma.userProject.create({
          data: {
            user_id: parseInt(user_id),
            project_id: parseInt(projId)
          }
        })
      ) : [])
    ]);

    res.json({ success: true, message: "پروژه‌های تخصیص‌یافته به کاربر همگام‌سازی شدند." });
  } catch (error) {
    console.error("Error syncing user projects:", error);
    res.status(500).json({ error: "خطا در بروزرسانی تخصیص پروژه‌ها در دیتابیس" });
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
      include: { files: true, nextActions: true },
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
      include: { files: true, nextActions: true }
    });

    res.json(serializeReport(newReport));
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(error instanceof NextActionsValidationError ? 400 : 500).json({
      error: error instanceof NextActionsValidationError ? error.message : "خطا در ثبت گزارش در دیتابیس",
    });
  }
});

app.put("/api/reports/:id", upload.array("files"), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { activities_done, results_achieved, next_actions, kpi_text } = req.body;
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

      return tx.report.update({
        where: { id },
        data: {
          activities_done: activities_done !== undefined ? activities_done : undefined,
          results_achieved: results_achieved !== undefined ? results_achieved : undefined,
          kpi_text: kpi_text !== undefined ? kpi_text : undefined,
        },
        include: { files: true, nextActions: true }
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
    const userId = req.query.user_id ? parseInt(req.query.user_id as string) : null;

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
      if (userId && up.user_id !== userId) continue;

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
