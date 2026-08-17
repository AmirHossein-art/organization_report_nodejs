import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import multer from "multer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import { OpenAI } from "openai";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { config } from "./src/config/env";
import { parseExcelWBS } from "./src/utils/wbsParser";

const SALT_ROUNDS = 10;
const app = express();

// ۱. تنظیم پروکسی برای استقرار در ریل‌وی و زیرساخت‌های کلود
app.set("trust proxy", 1);
app.disable("x-powered-by");

// ۲. هدرهای امنیتی پایه با Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // برای اجرای بدون مشکل Vite SPA و Three.js
    crossOriginEmbedderPolicy: false,
  })
);

// ۳. پیکربندی ایمن CORS بر اساس محیط اجرایی
if (config.ALLOWED_ORIGINS.length > 0) {
  // در صورت تعیین لیست صریح مبداها (چه پروداکشن و چه دولوپمنت)، فقط مبداهای مجاز پذیرفته می‌شوند
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || config.ALLOWED_ORIGINS.includes(requestOrigin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS origin not allowed"), false);
      },
      credentials: true,
    })
  );
} else if (config.NODE_ENV !== "production") {
  // در محیط توسعه محلی با لیست خالی، دسترسی برای تسهیل توسعه محلی فعال است
  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
}
// در محیط پروداکشن با لیست خالی ALLOWED_ORIGINS، میدلور CORS اضافه نمی‌شود (Same-Origin استاندارد مرورگر)

app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());

// ۴. اتصال به دیتابیس PostgreSQL از طریق Prisma 7
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ۵. تنظیمات ذخیره‌سازی فایل‌ها در مسیر ایمن STORAGE_ROOT
const uploadDir = config.UPLOAD_DIR;
const wbsDir = config.WBS_DIR;

// اعتبارسنجی و جلوگیری از Path Traversal در دسترسی به فایل‌ها
function safeResolvePath(baseDirectory: string, userFilename: string | null | undefined): string | null {
  if (!userFilename || typeof userFilename !== "string") return null;
  const sanitized = path.basename(userFilename);
  if (!sanitized || sanitized === "." || sanitized === "..") return null;
  const resolved = path.resolve(baseDirectory, sanitized);
  if (!resolved.startsWith(path.resolve(baseDirectory))) {
    return null;
  }
  return resolved;
}

// تنظیمات Multer برای فایل‌های ضمیمه گزارش‌ها
const ALLOWED_ATTACHMENT_EXTS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".png", ".jpg", ".jpeg", ".zip", ".rar", ".csv", ".txt"
];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // حداکثر ۱۰ فایل در هر درخواست
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_ATTACHMENT_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("فرمت فایل ارسالی مجاز نیست."));
    }
  },
});

// تنظیمات Multer برای فایل‌های ساختار WBS اکسل
const wbsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, wbsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `wbs_project_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

const uploadWBS = multer({
  storage: wbsStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xlsx" || ext === ".xls") {
      cb(null, true);
    } else {
      cb(new Error("فقط فایل‌های اکسل (xlsx, xls) برای WBS مجاز هستند."));
    }
  },
});

// ۶. محدودکننده‌های نرخ درخواست (Rate Limiters)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ۱۵ دقیقه دیگر مجدداً تلاش کنید." },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "سقف تعداد درخواست‌های هوش مصنوعی در دقیقه پر شده است. لطفاً کمی بعد تلاش فرمایید." },
});

// ۷. توابع کمکی اعتبارسنجی و تبدیل
const toEnglishDigits = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d).toString())
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
    .trim();
};

function parseBooleanField(val: any): boolean | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    if (lower === "true" || lower === "1") return true;
    if (lower === "false" || lower === "0") return false;
  }
  return undefined;
}

function sanitizeUser(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    role: user.role,
    job_title: user.job_title || null,
    is_active: Boolean(user.is_active),
    must_change_password: Boolean(user.must_change_password),
    password_changed_at: user.password_changed_at ? user.password_changed_at.toISOString() : null,
    created_at: user.created_at ? user.created_at.toISOString() : null,
  };
}

// تمیزکاری خودکار وضعیت اقداماتی که در گزارش تیک نخورده بودند
prisma.nextAction.updateMany({
  where: { claimed_report_id: null, claimed_completed: true },
  data: { claimed_completed: false }
}).catch((e) => console.error("Error auto-sanitizing unlinked actions:", e));

// -----------------------------
// Middlewares: احراز هویت و کنترل دسترسی
// -----------------------------
async function authenticate(req: any, res: any, next: any) {
  try {
    let token = req.cookies?.token;
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      return res.status(401).json({ error: "عدم دسترسی، لطفاً ابتدا وارد شوید." });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as { id: number; username: string; role: string };
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

function requireManager(req: any, res: any, next: any) {
  if (req.user?.role !== "manager") {
    return res.status(403).json({ error: "دسترسی فقط برای مدیران مجاز است." });
  }
  next();
}

// -----------------------------
// Validation Helpers for KPIs & Next Actions
// -----------------------------
class NextActionsValidationError extends Error {}
class KpiValidationError extends Error {}

const KPI_INPUT_TYPES = ["direct", "percentage_change"];
const KPI_TARGET_DIRECTIONS = ["minimum", "maximum"];
const REPORT_TYPES = ["weekly", "monthly"];

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

async function validateAndBuildKpiValues(
  rawKpiValues: unknown,
  projectId: number,
  reportType: "weekly" | "monthly"
): Promise<any[]> {
  const submitted = parseKpiValues(rawKpiValues);

  const applicableKpis = await prisma.projectKpi.findMany({
    where: {
      project_id: projectId,
      is_active: true,
      OR: [{ report_type: null }, { report_type: reportType }],
    },
  });

  if (applicableKpis.length === 0) return [];

  if (submitted.length === 0) {
    throw new KpiValidationError("مقادیر تمامی شاخص‌های فعال باید وارد شوند.");
  }

  const seenIds = new Set<number>();
  for (const v of submitted) {
    const id = Number(v?.project_kpi_id);
    if (seenIds.has(id)) {
      throw new KpiValidationError("شناسه شاخص تکراری ارسال شده است.");
    }
    seenIds.add(id);
  }

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

    if (!kpi) {
      throw new KpiValidationError("شناسه شاخص نامعتبر، تکراری یا غیرفعال است.");
    }

    const notMeasured = Boolean(v.not_measured);
    const missingReason = typeof v.missing_reason === "string" ? v.missing_reason.trim() : "";

    if (notMeasured) {
      if (!missingReason) {
        throw new KpiValidationError(`دلیل عدم اندازه‌گیری شاخص «${kpi.name}» الزامی است.`);
      }
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
      const baseline = toNumberOrNull(v.baseline_value);
      const current = toNumberOrNull(v.current_value);
      if (baseline === null) {
        throw new KpiValidationError(`مقدار مبنای شاخص «${kpi.name}» باید عددی معتبر باشد.`);
      }
      if (current === null) {
        throw new KpiValidationError(`مقدار دوره جاری شاخص «${kpi.name}» باید عددی معتبر باشد.`);
      }
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

function parseAchievedActionIds(raw: unknown): number[] {
  if (raw === undefined || raw === null || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.map((x) => Number(x)).filter((id) => !isNaN(id) && id > 0);
}

function parseNextActions(
  rawNextActions: unknown,
  projectId?: number,
  userId?: number,
  role: "user" | "manager" = "user"
): { action_text: string; target_date: Date; project_id?: number; user_id?: number; created_by_role?: "user" | "manager" }[] {
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

  return parsed.map((item: any, index: number) => {
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
      project_id: projectId || undefined,
      user_id: userId || undefined,
      created_by_role: role,
    };
  });
}

function serializeAction(action: any) {
  const hasClaimedReport = action.claimed_report_id !== null && action.claimed_report_id !== undefined;
  return {
    ...action,
    claimed_completed: hasClaimedReport ? Boolean(action.claimed_completed) : false,
    target_date: action.target_date
      ? action.target_date.toISOString().split("T")[0]
      : null,
    target_date_raw: action.target_date_raw ?? null,
    claimed_at: action.claimed_at
      ? action.claimed_at.toISOString()
      : null,
    completed_at: action.completed_at
      ? action.completed_at.toISOString()
      : null,
    verified_at: action.verified_at
      ? action.verified_at.toISOString()
      : null,
  };
}

function serializeReport(report: any) {
  return {
    ...report,
    user: report.user ? sanitizeUser(report.user) : undefined,
    user_job_title: report.user?.job_title || null,
    deputy_name: report.user?.job_title || report.user_full_name,

    period_start: report.period_start.toISOString().split("T")[0],
    period_end: report.period_end.toISOString().split("T")[0],
    submitted_at: report.submitted_at.toISOString(),

    imported_at: report.imported_at
      ? report.imported_at.toISOString()
      : null,

    nextActions: Array.isArray(report.nextActions)
      ? report.nextActions.map(serializeAction)
      : [],

    achievedActions: Array.isArray(report.achievedActions)
      ? report.achievedActions.map(serializeAction)
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

function getDeadlineDate(periodEnd: Date, deadlineDay: number, deadlineTime: string, reportType: "weekly" | "monthly"): Date {
  const deadlineDate = new Date(periodEnd);
  
  if (reportType === "weekly") {
    deadlineDate.setDate(deadlineDate.getDate() + 1);
    while (deadlineDate.getDay() !== deadlineDay) {
      deadlineDate.setDate(deadlineDate.getDate() + 1);
    }
  } else {
    if (deadlineDay <= periodEnd.getDate()) {
      deadlineDate.setMonth(deadlineDate.getMonth() + 1);
    }
    deadlineDate.setDate(deadlineDay);
  }

  const [hours, minutes] = deadlineTime.split(":").map(Number);
  deadlineDate.setHours(hours || 0, minutes || 0, 0, 0);
  
  return deadlineDate;
}

// استراتژی بازیابی فایل WBS با پشتیبانی از داده‌های قدیمی (Legacy Safe Lookup)
function resolveProjectWbsFilePath(project: { wbs_storage_filename?: string | null; wbs_file_name?: string | null }): string | null {
  if (project.wbs_storage_filename) {
    const primaryPath = safeResolvePath(wbsDir, project.wbs_storage_filename);
    if (primaryPath && fs.existsSync(primaryPath)) return primaryPath;
  }

  if (project.wbs_file_name) {
    const wbsLookupPath = safeResolvePath(wbsDir, project.wbs_file_name);
    if (wbsLookupPath && fs.existsSync(wbsLookupPath)) return wbsLookupPath;

    const legacyUploadPath = safeResolvePath(uploadDir, project.wbs_file_name);
    if (legacyUploadPath && fs.existsSync(legacyUploadPath)) return legacyUploadPath;
  }

  return null;
}

// -----------------------------
// 1. Health Check Endpoint
// -----------------------------
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error" });
  }
});

// -----------------------------
// 2. Authentication & Profile Endpoints
// -----------------------------
app.post("/api/auth/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "لطفاً نام کاربری و رمز عبور را وارد کنید." });
    }

    const normalizedPassword = toEnglishDigits(password || "");

    const user = await prisma.user.findUnique({
      where: { username: username.trim() },
    });

    if (!user || !user.is_active) {
      return res.status(401).json({ error: "نام کاربری یا رمز عبور نادرست است." });
    }

    const isPasswordValid = await bcrypt.compare(normalizedPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "نام کاربری یا رمز عبور نادرست است." });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "خطا در برقراری ارتباط با سرور یا دیتابیس." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json({ success: true, message: "با موفقیت از سیستم خارج شدید." });
});

app.get("/api/auth/me", authenticate, (req: any, res) => {
  res.json({
    user: sanitizeUser(req.user),
  });
});

app.post("/api/auth/change-password", authenticate, authLimiter, async (req: any, res) => {
  try {
    const { current_password, currentPassword, new_password, newPassword } = req.body;
    const rawCurrent = current_password || currentPassword || "";
    const rawNew = new_password || newPassword || "";

    const normalizedCurrent = toEnglishDigits(rawCurrent);
    const normalizedNew = toEnglishDigits(rawNew);

    if (!normalizedCurrent) {
      return res.status(400).json({ error: "وارد کردن رمز عبور فعلی الزامی است." });
    }

    if (!normalizedNew || normalizedNew.length < 10) {
      return res.status(400).json({ error: "رمز عبور جدید باید حداقل ۱۰ کاراکتر باشد." });
    }

    // اعتبارسنجی اجباری رمز عبور فعلی کاربر با هش دیتابیس
    const isCurrentValid = await bcrypt.compare(normalizedCurrent, req.user.password);
    if (!isCurrentValid) {
      return res.status(400).json({ error: "رمز عبور فعلی وارد شده نادرست است." });
    }

    const isSamePassword = await bcrypt.compare(normalizedNew, req.user.password);
    if (isSamePassword) {
      return res.status(400).json({
        error: "رمز عبور جدید نمی‌تواند مشابه رمز عبور قبلی باشد. لطفاً رمز جدیدی وارد نمایید."
      });
    }

    const hashedPassword = await bcrypt.hash(normalizedNew, SALT_ROUNDS);

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        password: hashedPassword,
        must_change_password: false,
        password_changed_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: "رمز عبور شما با موفقیت به‌روزرسانی شد.",
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "خطا در ذخیره‌سازی رمز عبور جدید در دیتابیس." });
  }
});

// -----------------------------
// 3. User Administration (Manager Only)
// -----------------------------
app.get("/api/users", authenticate, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: "asc" }
    });
    res.json(users.map(sanitizeUser));
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "خطا در دریافت اطلاعات کاربران از دیتابیس" });
  }
});

app.post("/api/users", authenticate, requireManager, async (req, res) => {
  try {
    const { username, full_name, role, job_title, password, must_change_password } = req.body;

    const trimmedUsername = typeof username === "string" ? username.trim() : "";
    const trimmedFullName = typeof full_name === "string" ? full_name.trim() : "";
    const normalizedPassword = toEnglishDigits(password || "");

    if (!trimmedUsername || !trimmedFullName) {
      return res.status(400).json({ error: "نام کاربری و نام کامل الزامی هستند." });
    }

    if (!normalizedPassword || normalizedPassword.length < 10) {
      return res.status(400).json({ error: "رمز عبور اولیه باید حداقل ۱۰ کاراکتر باشد." });
    }

    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername }
    });

    if (existingUser) {
      return res.status(400).json({ error: "نام کاربری تکراری است." });
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);

    const newUser = await prisma.user.create({
      data: {
        username: trimmedUsername,
        full_name: trimmedFullName,
        role: role === "manager" ? "manager" : "user",
        job_title: job_title ? String(job_title).trim() : null,
        password: hashedPassword,
        is_active: true,
        must_change_password: must_change_password !== undefined ? Boolean(must_change_password) : true,
      },
    });

    res.status(201).json(sanitizeUser(newUser));
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "خطا در ثبت کاربر جدید در دیتابیس" });
  }
});

app.put("/api/users/:id", authenticate, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { full_name, username, role, job_title, is_active } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: "کاربر مورد نظر یافت نشد." });
    }

    if (username !== undefined && username.trim() !== existingUser.username) {
      const dupeUser = await prisma.user.findUnique({
        where: { username: username.trim() }
      });
      if (dupeUser) {
        return res.status(400).json({ error: "نام کاربری تکراری است." });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        full_name: full_name !== undefined ? String(full_name).trim() : undefined,
        username: username !== undefined ? String(username).trim() : undefined,
        role: role !== undefined ? (role === "manager" ? "manager" : "user") : undefined,
        job_title: job_title !== undefined ? (job_title ? String(job_title).trim() : null) : undefined,
        is_active: is_active !== undefined ? Boolean(is_active) : undefined,
      }
    });

    res.json(sanitizeUser(updatedUser));
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "خطا در ویرایش اطلاعات کاربر در دیتابیس" });
  }
});

app.post("/api/users/:id/reset-password", authenticate, requireManager, authLimiter, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { temporary_password, temporaryPassword } = req.body;
    const rawResetPassword = temporary_password || temporaryPassword || "";
    const normalizedResetPassword = toEnglishDigits(rawResetPassword);

    if (!normalizedResetPassword || normalizedResetPassword.length < 10) {
      return res.status(400).json({ error: "رمز عبور جدید موقت باید حداقل ۱۰ کاراکتر باشد." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "کاربر پیدا نشد." });
    }

    const hashedResetPassword = await bcrypt.hash(normalizedResetPassword, SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: {
        password: hashedResetPassword,
        must_change_password: true,
        password_changed_at: null,
      }
    });

    res.json({ success: true, message: "رمز عبور با موفقیت بازنشانی شد." });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "خطا در بازنشانی رمز عبور در دیتابیس" });
  }
});

app.delete("/api/users/:id", authenticate, requireManager, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);

    if (id === req.user.id) {
      return res.status(400).json({ error: "امکان حذف یا غیرفعال‌سازی حساب کاربری خودتان وجود ندارد." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "کاربر پیدا نشد." });
    }

    // غیرفعال‌سازی نرم (Soft-Deactivation) بدون حذف فیزیکی جهت حفظ سوابق و اسناد سازمانی
    await prisma.user.update({
      where: { id },
      data: { is_active: false }
    });

    res.json({ success: true, message: "حساب کاربری پرسنل با حفظ سوابق سازمانی غیرفعال شد." });
  } catch (error) {
    console.error("Error deactivating user:", error);
    res.status(500).json({ error: "خطا در غیرفعال‌سازی کاربر در دیتابیس" });
  }
});

// -----------------------------
// 4. Project Management Endpoints
// -----------------------------
app.get("/api/projects", authenticate, async (req: any, res) => {
  try {
    const where = req.user.role === "manager" ? {} : { is_active: true };
    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ order_index: "asc" }, { id: "asc" }],
    });
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "خطا در دریافت اطلاعات پروژه‌ها از دیتابیس" });
  }
});

app.patch("/api/projects/reorder", authenticate, requireManager, async (req, res) => {
  try {
    const { ordered_ids } = req.body;
    if (Array.isArray(ordered_ids)) {
      await prisma.$transaction(
        ordered_ids.map((id: number, idx: number) =>
          prisma.project.update({
            where: { id: Number(id) },
            data: { order_index: idx + 1 },
          })
        )
      );
    }
    const projects = await prisma.project.findMany({
      orderBy: [{ order_index: "asc" }, { id: "asc" }],
    });
    res.json({ success: true, projects });
  } catch (error) {
    console.error("Error reordering projects:", error);
    res.status(500).json({ error: "خطا در تغییر ترتیب پروژه‌ها" });
  }
});

app.patch("/api/projects/:id/order", authenticate, requireManager, async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const { order_index } = req.body;
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { order_index: Number(order_index) || 0 },
    });
    res.json({ success: true, project: updated });
  } catch (error) {
    console.error("Error updating project order:", error);
    res.status(500).json({ error: "خطا در ثبت رتبه پروژه" });
  }
});

app.post("/api/projects", authenticate, requireManager, uploadWBS.single("wbs_file"), async (req, res) => {
  const file = req.file;
  try {
    const { title, description, code } = req.body;

    if (!code || !title) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "کد و عنوان پروژه الزامی هستند." });
    }

    const existingCode = await prisma.project.findUnique({
      where: { code: code.trim() }
    });
    if (existingCode) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: "کد پروژه تکراری است." });
    }

    const newProject = await prisma.project.create({
      data: {
        code: code.trim(),
        title: title.trim(),
        description: description ? description.trim() : null,
        wbs_file_name: file ? file.originalname : null,
        wbs_storage_filename: file ? file.filename : null,
      },
    });

    res.status(201).json(newProject);
  } catch (error) {
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
    console.error("Error creating project:", error);
    res.status(500).json({ error: "خطا در ساخت پروژه در دیتابیس" });
  }
});

app.put("/api/projects/:id", authenticate, requireManager, uploadWBS.single("wbs_file"), async (req, res) => {
  const file = req.file;
  try {
    const id = parseInt(req.params.id);
    const { title, code, description, remove_wbs_file, is_active } = req.body;

    const existingProject = await prisma.project.findUnique({
      where: { id },
    });

    if (!existingProject) {
      if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(404).json({ error: "پروژه مورد نظر یافت نشد." });
    }

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
    let updatedWbsStorageFilename: string | null = existingProject.wbs_storage_filename;
    let oldPhysicalPathToDelete: string | null = null;

    const isRemoveRequested =
      remove_wbs_file === "true" ||
      remove_wbs_file === true ||
      String(remove_wbs_file) === "true";

    if (file) {
      oldPhysicalPathToDelete = resolveProjectWbsFilePath(existingProject);
      updatedWbsFileName = file.originalname;
      updatedWbsStorageFilename = file.filename;
    } else if (isRemoveRequested) {
      oldPhysicalPathToDelete = resolveProjectWbsFilePath(existingProject);
      updatedWbsFileName = null;
      updatedWbsStorageFilename = null;
    }

    const parsedIsActive = parseBooleanField(is_active);

    // به‌روزرسانی در دیتابیس قبل از حذف فایل فیزیکی قبلی
    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : undefined,
        code: code !== undefined ? code.trim() : undefined,
        description: description !== undefined ? description.trim() : undefined,
        is_active: parsedIsActive !== undefined ? parsedIsActive : undefined,
        wbs_file_name: updatedWbsFileName,
        wbs_storage_filename: updatedWbsStorageFilename,
      },
    });

    // پس از موفقیت در دیتابیس، فایل قدیمی پاک می‌شود
    if (oldPhysicalPathToDelete && fs.existsSync(oldPhysicalPathToDelete)) {
      try { fs.unlinkSync(oldPhysicalPathToDelete); } catch (_) {}
    }

    res.json(updatedProject);
  } catch (error) {
    // در صورت بروز خطا در دیتابیس، فایل جدید آپلود شده پاک می‌شود
    if (file && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (_) {}
    }
    console.error("Error updating project:", error);
    res.status(500).json({ error: "خطا در ویرایش اطلاعات پروژه در دیتابیس" });
  }
});

app.delete("/api/projects/:id", authenticate, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existingProject = await prisma.project.findUnique({ where: { id } });

    if (!existingProject) {
      return res.status(404).json({ error: "پروژه پیدا نشد." });
    }

    // غیرفعال‌سازی نرم پروژه بدون حذف فیزیکی جهت حفظ کلیه سوابق گزارش‌ها و اسناد تاریخی
    await prisma.project.update({
      where: { id },
      data: { is_active: false }
    });

    res.json({ success: true, message: "پروژه با موفقیت غیرفعال شد و تمامی سوابق گزارش‌های آن محفوظ ماند." });
  } catch (error) {
    console.error("Error deactivating project:", error);
    res.status(500).json({ error: "خطا در غیرفعال‌سازی پروژه در دیتابیس" });
  }
});

// دانلود احرازهویت‌شده فایل WBS پروژه با اعتبارسنجی سطح دسترسی و وضعیت پروژه
app.get("/api/projects/:id/wbs-file", authenticate, async (req: any, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const project = await prisma.project.findUnique({ where: { id: projectId } });

    if (!project || (!project.wbs_file_name && !project.wbs_storage_filename)) {
      return res.status(404).json({ error: "فایل WBS برای این پروژه یافت نشد." });
    }

    // پرسنل عادی تنها مجاز به دانلود فایل WBS پروژه‌های فعال تخصیص‌یافته به خود هستند
    if (req.user.role !== "manager") {
      if (!project.is_active) {
        return res.status(403).json({ error: "این پروژه غیرفعال است." });
      }
      const allocation = await prisma.userProject.findUnique({
        where: { user_id_project_id: { user_id: req.user.id, project_id: projectId } }
      });
      if (!allocation) {
        return res.status(403).json({ error: "شما به این پروژه تخصیص داده نشده‌اید." });
      }
    }

    const filePath = resolveProjectWbsFilePath(project);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "فایل فیزیکی WBS در حافظه سرور یافت نشد." });
    }

    res.download(filePath, project.wbs_file_name || "wbs_file.xlsx");
  } catch (error) {
    console.error("Error downloading WBS file:", error);
    res.status(500).json({ error: "خطا در دریافت فایل WBS." });
  }
});

// -----------------------------
// 5. Report Period Management
// -----------------------------
app.get(["/api/report-periods", "/api/periods"], authenticate, async (_req, res) => {
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

app.post("/api/report-periods", authenticate, requireManager, async (req, res) => {
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

    res.status(201).json({
      ...newPeriod,
      period_start: newPeriod.period_start.toISOString().split("T")[0],
      period_end: newPeriod.period_end.toISOString().split("T")[0]
    });
  } catch (error) {
    console.error("Error creating period:", error);
    res.status(500).json({ error: "خطا در ثبت بازه جدید در دیتابیس" });
  }
});

app.put("/api/report-periods/:id", authenticate, requireManager, async (req, res) => {
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
        is_open: is_open !== undefined ? Boolean(is_open) : undefined,
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

// بازه‌های دارای گزارش به هیچ عنوان حذف نمی‌شوند تا سوابق گزارش‌ها حفظ گردد
app.delete("/api/report-periods/:id", authenticate, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const reportCount = await prisma.report.count({ where: { period_id: id } });

    if (reportCount > 0) {
      return res.status(409).json({
        error: `این بازه گزارش‌دهی دارای ${reportCount} گزارش ثبت‌شده است و امکان حذف آن وجود ندارد. لطفاً در صورت نیاز بازه را ببندید (is_open = false).`
      });
    }

    await prisma.reportPeriod.delete({ where: { id } });
    res.json({ success: true, message: "بازه گزارش‌دهی خالی با موفقیت حذف شد." });
  } catch (error) {
    console.error("Error deleting period:", error);
    res.status(500).json({ error: "خطا در حذف بازه گزارش‌دهی از دیتابیس" });
  }
});

// -----------------------------
// 6. Project KPI Management
// -----------------------------
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

app.get("/api/projects/:projectId/kpis", authenticate, async (req: any, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const { report_type } = req.query;

    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({ error: "شناسه پروژه نامعتبر است." });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return res.status(404).json({ error: "پروژه یافت نشد." });
    }

    if (req.user.role !== "manager") {
      if (!project.is_active) {
        return res.status(403).json({ error: "این پروژه غیرفعال است." });
      }
      const allocation = await prisma.userProject.findUnique({
        where: { user_id_project_id: { user_id: req.user.id, project_id: projectId } }
      });
      if (!allocation) {
        return res.status(403).json({ error: "شما به این پروژه تخصیص داده نشده‌اید." });
      }
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

app.post("/api/project-kpis", authenticate, requireManager, async (req, res) => {
  try {
    const {
      project_id, name, description, unit, input_type,
      target_value, target_direction, report_type, is_active, sort_order,
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
    if (!kpiName) return res.status(400).json({ error: "نام شاخص نمی‌تواند خالی باشد." });

    const kpiUnit = typeof unit === "string" ? unit.trim() : "";
    if (!kpiUnit) return res.status(400).json({ error: "واحد سنجش نمی‌تواند خالی باشد." });

    if (!KPI_INPUT_TYPES.includes(input_type)) {
      return res.status(400).json({ error: "نوع محاسبه شاخص نامعتبر است." });
    }

    if (target_value === undefined || target_value === null || target_value === "" || isNaN(Number(target_value))) {
      return res.status(400).json({ error: "مقدار هدف باید عددی معتبر باشد." });
    }

    if (!KPI_TARGET_DIRECTIONS.includes(target_direction)) {
      return res.status(400).json({ error: "جهت هدف شاخص نامعتبر است." });
    }

    let reportTypeVal: "weekly" | "monthly" | null = null;
    if (report_type !== undefined && report_type !== null && report_type !== "") {
      if (!REPORT_TYPES.includes(report_type)) {
        return res.status(400).json({ error: "نوع دوره گزارش‌دهی نامعتبر است." });
      }
      reportTypeVal = report_type;
    }

    let sortOrderVal = 0;
    if (sort_order !== undefined && sort_order !== null && sort_order !== "") {
      const parsedSortOrder = Number(sort_order);
      if (isNaN(parsedSortOrder)) {
        return res.status(400).json({ error: "ترتیب نمایش شاخص باید عدد معتبر باشد." });
      }
      sortOrderVal = parsedSortOrder;
    }

    const parsedIsActive = parseBooleanField(is_active);

    const newKpi = await prisma.projectKpi.create({
      data: {
        project_id: projectId,
        name: kpiName,
        description: description ? String(description).trim() || null : null,
        unit: kpiUnit,
        input_type,
        target_value: Number(target_value),
        target_direction,
        report_type: reportTypeVal,
        is_active: parsedIsActive !== undefined ? parsedIsActive : true,
        sort_order: sortOrderVal,
      },
    });

    res.status(201).json(newKpi);
  } catch (error) {
    console.error("Error creating KPI:", error);
    res.status(500).json({ error: "خطا در ثبت شاخص جدید در دیتابیس" });
  }
});

app.patch("/api/project-kpis/:id", authenticate, requireManager, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      name, description, unit, input_type,
      target_value, target_direction, report_type, is_active, sort_order,
    } = req.body;

    const existing = await prisma.projectKpi.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: "شاخص مورد نظر یافت نشد." });
    }

    const data: any = {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: "نام شاخص نمی‌تواند خالی باشد." });
      data.name = trimmed;
    }
    if (description !== undefined) {
      data.description = String(description).trim() || null;
    }
    if (unit !== undefined) {
      const trimmed = String(unit).trim();
      if (!trimmed) return res.status(400).json({ error: "واحد سنجش نمی‌تواند خالی باشد." });
      data.unit = trimmed;
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
      } else if (!REPORT_TYPES.includes(report_type)) {
        return res.status(400).json({ error: "نوع دوره گزارش‌دهی نامعتبر است." });
      } else {
        data.report_type = report_type;
      }
    }
    if (is_active !== undefined) {
      const parsed = parseBooleanField(is_active);
      if (parsed !== undefined) data.is_active = parsed;
    }
    if (sort_order !== undefined) {
      if (sort_order === null || sort_order === "") {
        data.sort_order = 0;
      } else {
        const parsedSortOrder = Number(sort_order);
        if (isNaN(parsedSortOrder)) {
          return res.status(400).json({ error: "ترتیب نمایش شاخص باید عدد معتبر باشد." });
        }
        data.sort_order = parsedSortOrder;
      }
    }

    const updated = await prisma.projectKpi.update({ where: { id }, data });
    res.json(updated);
  } catch (error) {
    console.error("Error updating KPI:", error);
    res.status(500).json({ error: "خطا در ویرایش شاخص در دیتابیس" });
  }
});

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

// -----------------------------
// 7. User Project Allocations
// -----------------------------
app.get("/api/user-projects", authenticate, async (req: any, res) => {
  try {
    const where = req.user.role === "manager" ? {} : { user_id: req.user.id };
    const allocations = await prisma.userProject.findMany({ where });
    res.json(allocations);
  } catch (error) {
    console.error("Error fetching user projects:", error);
    res.status(500).json({ error: "خطا در دریافت تخصیص‌های پروژه." });
  }
});

app.post("/api/users/:user_id/projects", authenticate, requireManager, async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);
    const { projectIds } = req.body;

    if (isNaN(user_id)) {
      return res.status(400).json({ error: "شناسه کاربر نامعتبر است." });
    }

    await prisma.userProject.deleteMany({
      where: { user_id }
    });

    if (Array.isArray(projectIds) && projectIds.length > 0) {
      const uniqueProjectIds = Array.from(new Set(projectIds.map(Number)));
      for (const project_id of uniqueProjectIds) {
        await prisma.userProject.create({
          data: { user_id, project_id }
        });
      }
    }

    res.json({ success: true, message: "تخصیص پروژه‌ها با موفقیت بروزرسانی شد." });
  } catch (error) {
    console.error("Error updating user projects:", error);
    res.status(500).json({ error: "خطا در ذخیره‌سازی تخصیص پروژه‌ها در دیتابیس." });
  }
});

// -----------------------------
// 8. Deadline Settings
// -----------------------------
app.get("/api/deadline-settings", authenticate, async (_req, res) => {
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

app.put("/api/deadline-settings/:id", authenticate, requireManager, async (req, res) => {
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

// -----------------------------
// 9. Report Submissions & Management
// -----------------------------
app.get("/api/reports", authenticate, async (req: any, res) => {
  try {
    // پرسنل عادی تنها گزارش‌های ارسالی خود را دریافت می‌کنند (جلوگیری از BOLA / IDOR)
    const where = req.user.role === "manager" ? {} : { user_id: req.user.id };

    const reports = await prisma.report.findMany({
      where,
      include: {
        user: true,
        files: true,
        nextActions: true,
        achievedActions: true,
        kpiValues: true
      },
      orderBy: { id: "desc" }
    });

    res.json(reports.map(serializeReport));
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "خطا در دریافت گزارش‌ها از دیتابیس" });
  }
});

app.post("/api/reports", authenticate, upload.array("files", 10), async (req: any, res) => {
  const uploadedFiles = req.files && Array.isArray(req.files) ? req.files : [];
  try {
    const {
      project_id,
      report_type,
      period_id,
      activities_done,
      results_achieved,
      achieved_action_ids,
      next_actions,
      kpi_text,
      kpi_values,
    } = req.body;

    const projectIdNum = parseInt(project_id);
    const periodIdNum = parseInt(period_id);

    const project = await prisma.project.findUnique({ where: { id: projectIdNum } });
    const period = await prisma.reportPeriod.findUnique({ where: { id: periodIdNum } });

    if (!project || !period) {
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
      }
      return res.status(400).json({ error: "اطلاعات پروژه یا بازه گزارش‌دهی نامعتبر است." });
    }

    // اعتبارسنجی نوع گزارش با نوع بازه
    if (report_type !== period.report_type) {
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
      }
      return res.status(400).json({ error: "نوع گزارش ارسالی با نوع بازه گزارش‌دهی مطابقت ندارد." });
    }

    // اعتبارسنجی برای پرسنل عادی
    if (req.user.role !== "manager") {
      if (!project.is_active) {
        if (uploadedFiles.length > 0) {
          uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
        }
        return res.status(400).json({ error: "این پروژه غیرفعال است و امکان ثبت گزارش برای آن وجود ندارد." });
      }

      if (!period.is_open) {
        if (uploadedFiles.length > 0) {
          uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
        }
        return res.status(400).json({ error: "این بازه گزارش‌دهی بسته شده است و امکان ثبت گزارش وجود ندارد." });
      }

      const allocation = await prisma.userProject.findUnique({
        where: { user_id_project_id: { user_id: req.user.id, project_id: projectIdNum } }
      });
      if (!allocation) {
        if (uploadedFiles.length > 0) {
          uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
        }
        return res.status(403).json({ error: "شما به این پروژه تخصیص داده نشده‌اید." });
      }
    }

    const targetUserId = req.user.role === "manager" && req.body.user_id
      ? Number(req.body.user_id)
      : req.user.id;

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
      }
      return res.status(400).json({ error: "کاربر مورد نظر یافت نشد." });
    }

    const existingReport = await prisma.report.findFirst({
      where: {
        user_id: user.id,
        project_id: project.id,
        period_id: period.id
      }
    });

    if (existingReport) {
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
      }
      return res.status(400).json({ error: "شما قبلاً برای این پروژه در این دوره گزارش ثبت کرده‌اید." });
    }

    const parsedAchievedActionIds = parseAchievedActionIds(achieved_action_ids);
    const parsedNextActions = parseNextActions(
      next_actions,
      project.id,
      user.id,
      req.user.role === "manager" ? "manager" : "user"
    );

    const deadline = await prisma.deadlineSetting.findFirst({
      where: { report_type: report_type as any }
    });
    let status: "submitted" | "late" = "submitted";

    if (deadline) {
      try {
        const now = new Date();
        const deadlineDate = getDeadlineDate(
          new Date(period.period_end),
          deadline.deadline_day,
          deadline.deadline_time,
          report_type as "weekly" | "monthly"
        );
        if (now > deadlineDate) {
          status = "late";
        }
      } catch (err) {
        console.error("Error calculating dynamic deadline for POST:", err);
      }
    }

    const validatedKpiValues = await validateAndBuildKpiValues(
      kpi_values,
      project.id,
      report_type as "weekly" | "monthly"
    );

    let finalResultsAchieved = typeof results_achieved === "string" ? results_achieved.trim() : "";
    if (parsedAchievedActionIds.length > 0) {
      const claimedActions = await prisma.nextAction.findMany({
        where: { id: { in: parsedAchievedActionIds } },
      });
      const bulletList = claimedActions.map((a) => `• ${a.action_text}`).join("\n");
      if (!finalResultsAchieved) {
        finalResultsAchieved = bulletList;
      } else if (!finalResultsAchieved.includes("•")) {
        finalResultsAchieved = `${bulletList}\n\nتوضیحات تکمیلی: ${finalResultsAchieved}`;
      }
    }

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
        results_achieved: finalResultsAchieved,
        kpi_text,
        status: status as any,
        nextActions: parsedNextActions.length
          ? { create: parsedNextActions }
          : undefined,
        kpiValues: validatedKpiValues.length
          ? { create: validatedKpiValues }
          : undefined,
        files: uploadedFiles.length
          ? {
              create: uploadedFiles.map((file: any) => ({
                filename: file.filename,
                original_filename: file.originalname,
                file_size: file.size,
              })),
            }
          : undefined,
      },
      include: { files: true, nextActions: true, achievedActions: true, kpiValues: true }
    });

    if (parsedAchievedActionIds.length > 0) {
      await prisma.nextAction.updateMany({
        where: { id: { in: parsedAchievedActionIds } },
        data: {
          claimed_completed: true,
          claimed_at: new Date(),
          claimed_report_id: newReport.id,
        }
      });
    }

    res.status(201).json(serializeReport(newReport));
  } catch (error) {
    if (uploadedFiles.length > 0) {
      uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
    }
    console.error("Error creating report:", error);
    res.status(error instanceof NextActionsValidationError || error instanceof KpiValidationError ? 400 : 500).json({
      error: error instanceof NextActionsValidationError || error instanceof KpiValidationError
        ? error.message
        : "خطا در ثبت گزارش در دیتابیس",
    });
  }
});

app.put("/api/reports/:id", authenticate, upload.array("files", 10), async (req: any, res) => {
  const uploadedFiles = req.files && Array.isArray(req.files) ? req.files : [];
  try {
    const id = parseInt(req.params.id);
    const { activities_done, results_achieved, achieved_action_ids, next_actions, kpi_text, kpi_values } = req.body;

    const existingReport = await prisma.report.findUnique({ where: { id } });
    if (!existingReport) {
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
      }
      return res.status(404).json({ error: "گزارش پیدا نشد." });
    }

    // کنترل BOLA: کاربر عادی تنها مجاز به ویرایش گزارش خودش است
    if (req.user.role !== "manager" && existingReport.user_id !== req.user.id) {
      if (uploadedFiles.length > 0) {
        uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
      }
      return res.status(403).json({ error: "شما مجاز به ویرایش این گزارش نیستید." });
    }

    const shouldUpdateAchievedActions = achieved_action_ids !== undefined;
    const parsedAchievedActionIds = shouldUpdateAchievedActions ? parseAchievedActionIds(achieved_action_ids) : [];
    const shouldUpdateNextActions = next_actions !== undefined;

    const parsedNextActions = shouldUpdateNextActions
      ? parseNextActions(
          next_actions,
          existingReport.project_id,
          existingReport.user_id,
          req.user.role === "manager" ? "manager" : "user"
        )
      : [];

    const period = await prisma.reportPeriod.findUnique({ where: { id: existingReport.period_id } });
    if (period && req.user.role !== "manager") {
      const deadline = await prisma.deadlineSetting.findFirst({
        where: { report_type: existingReport.report_type as any }
      });
      if (deadline) {
        const now = new Date();
        const deadlineDate = getDeadlineDate(
          new Date(period.period_end),
          deadline.deadline_day,
          deadline.deadline_time,
          existingReport.report_type as "weekly" | "monthly"
        );
        if (now > deadlineDate) {
          if (uploadedFiles.length > 0) {
            uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
          }
          return res.status(400).json({ error: "مهلت ویرایش این گزارش به پایان رسیده است." });
        }
      }
    }

    let deletedFileIds: number[] = [];
    let physicalFilesToDeleteAfterDb: string[] = [];

    if (req.body.deleted_file_ids) {
      try {
        deletedFileIds = JSON.parse(req.body.deleted_file_ids).map((fid: any) => parseInt(fid));
        const filesToDelete = await prisma.reportFile.findMany({
          where: { id: { in: deletedFileIds }, report_id: id }
        });
        physicalFilesToDeleteAfterDb = filesToDelete
          .map((rf) => safeResolvePath(uploadDir, rf.filename))
          .filter((p): p is string => p !== null);
      } catch (_) {}
    }

    const validatedKpiValues = kpi_values !== undefined
      ? await validateAndBuildKpiValues(kpi_values, existingReport.project_id, existingReport.report_type)
      : null;

    let finalResultsAchieved = results_achieved !== undefined ? (typeof results_achieved === "string" ? results_achieved.trim() : "") : undefined;
    if (shouldUpdateAchievedActions && parsedAchievedActionIds.length > 0) {
      const claimedActions = await prisma.nextAction.findMany({
        where: { id: { in: parsedAchievedActionIds } },
      });
      const bulletList = claimedActions.map((a) => `• ${a.action_text}`).join("\n");
      if (!finalResultsAchieved) {
        finalResultsAchieved = bulletList;
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (deletedFileIds.length) {
        await tx.reportFile.deleteMany({
          where: { id: { in: deletedFileIds }, report_id: id }
        });
      }

      if (uploadedFiles.length) {
        await tx.reportFile.createMany({
          data: uploadedFiles.map((file: any) => ({
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

      if (shouldUpdateAchievedActions) {
        await tx.nextAction.updateMany({
          where: { claimed_report_id: id },
          data: {
            claimed_completed: false,
            claimed_at: null,
            claimed_report_id: null,
          }
        });
        if (parsedAchievedActionIds.length > 0) {
          await tx.nextAction.updateMany({
            where: { id: { in: parsedAchievedActionIds } },
            data: {
              claimed_completed: true,
              claimed_at: new Date(),
              claimed_report_id: id,
            }
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
          results_achieved: finalResultsAchieved !== undefined ? finalResultsAchieved : undefined,
          kpi_text: kpi_text !== undefined ? kpi_text : undefined,
        },
        include: { files: true, nextActions: true, achievedActions: true, kpiValues: true }
      });
    });

    // حذف فایل‌های فیزیکی پس از اتمام موفقیت‌آمیز تراکنش دیتابیس
    for (const fp of physicalFilesToDeleteAfterDb) {
      if (fs.existsSync(fp)) {
        try { fs.unlinkSync(fp); } catch (_) {}
      }
    }

    res.json(serializeReport(updated));
  } catch (error) {
    if (uploadedFiles.length > 0) {
      uploadedFiles.forEach((f: any) => { if (fs.existsSync(f.path)) try { fs.unlinkSync(f.path); } catch (_) {} });
    }
    console.error("Error updating report:", error);
    res.status(error instanceof NextActionsValidationError ? 400 : 500).json({
      error: error instanceof NextActionsValidationError ? error.message : "خطا در ویرایش گزارش در دیتابیس",
    });
  }
});

// دانلود ایمن و احرازهویت‌شده فایل ضمیمه گزارش
app.get("/api/report-files/:id/download", authenticate, async (req: any, res) => {
  try {
    const fileId = parseInt(req.params.id);
    const file = await prisma.reportFile.findUnique({
      where: { id: fileId },
      include: { report: true }
    });

    if (!file) {
      return res.status(404).json({ error: "فایل مورد نظر یافت نشد." });
    }

    // اعتبارسنجی مالکیت گزارش: پرسنل عادی فقط ضمیمه‌های گزارش‌های خود را دانلود کنند
    if (req.user.role !== "manager" && file.report.user_id !== req.user.id) {
      return res.status(403).json({ error: "شما مجاز به دانلود فایل‌های این گزارش نیستید." });
    }

    const filePath = safeResolvePath(uploadDir, file.filename);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "فایل فیزیکی در سرور یافت نشد." });
    }

    res.download(filePath, file.original_filename);
  } catch (error) {
    console.error("Error downloading report file:", error);
    res.status(500).json({ error: "خطا در دریافت فایل ضمیمه." });
  }
});

app.delete("/api/report-files/:id", authenticate, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const file = await prisma.reportFile.findUnique({
      where: { id },
      include: { report: true }
    });

    if (!file) {
      return res.status(404).json({ error: "فایل پیدا نشد." });
    }

    if (req.user.role !== "manager" && file.report.user_id !== req.user.id) {
      return res.status(403).json({ error: "شما مجاز به حذف این فایل نیستید." });
    }

    const filePath = safeResolvePath(uploadDir, file.filename);

    // حذف رکورد از دیتابیس قبل از فایل فیزیکی
    await prisma.reportFile.delete({ where: { id } });

    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (_) {}
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting report file:", error);
    res.status(500).json({ error: "خطا در حذف فایل گزارش در دیتابیس" });
  }
});

// -----------------------------
// 10. Manager Dashboard Summary
// -----------------------------
app.get("/api/dashboard/summary", authenticate, requireManager, async (req, res) => {
  try {
    const periodId = parseInt(req.query.period_id as string);
    const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : null;
    const user_id = req.query.user_id ? parseInt(req.query.user_id as string) : null;
    const deputyName = req.query.deputy_name ? (req.query.deputy_name as string).trim() : null;

    const period = await prisma.reportPeriod.findUnique({ where: { id: periodId } });
    if (!period) {
      return res.status(404).json({ error: "بازه مورد نظر یافت نشد." });
    }

    const activeStaff = await prisma.user.findMany({
      where: { is_active: true, role: "user" }
    });
    const staffIds = activeStaff.map((s) => s.id);

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

    const expectedPairs: any[] = [];
    for (const up of userProjects) {
      if (projectId && up.project_id !== projectId) continue;
      if (user_id && up.user_id !== user_id) continue;
      if (deputyName && up.user.job_title?.trim() !== deputyName) continue;

      expectedPairs.push({
        user: sanitizeUser(up.user),
        project: up.project
      });
    }

    const reports = await prisma.report.findMany({
      where: { period_id: periodId },
      include: { user: true, files: true }
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
        user_job_title: pair.user.job_title,
        deputy_name: pair.user.job_title || pair.user.full_name,
        project_id: pair.project.id,
        project_title: pair.project.title,
        status_key,
        status_label,
        report: matchingReport ? {
          ...matchingReport,
          user: sanitizeUser(matchingReport.user),
          user_job_title: pair.user.job_title,
          deputy_name: pair.user.job_title || pair.user.full_name,
          period_start: matchingReport.period_start.toISOString().split("T")[0],
          period_end: matchingReport.period_end.toISOString().split("T")[0],
          submitted_at: matchingReport.submitted_at.toISOString()
        } : null,
      };
    });

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

// -----------------------------
// 11. Next Actions Endpoints
// -----------------------------
app.get("/api/next-actions", authenticate, async (req: any, res) => {
  try {
    const { project_id, user_id, pending_for_report, status, report_id } = req.query;
    const andConditions: any[] = [];

    if (project_id) {
      const pid = Number(project_id);
      andConditions.push({
        OR: [
          { project_id: pid },
          { report: { project_id: pid } }
        ]
      });
    }

    if (req.user.role === "manager") {
      if (user_id) {
        const uid = Number(user_id);
        andConditions.push({
          OR: [
            { user_id: uid },
            { user_id: null },
            { report: { user_id: uid } }
          ]
        });
      }
    } else {
      // پرسنل عادی تنها اقدامات پروژه‌های تخصیص‌یافته به خود یا اقدامات ایجادشده/منتسب به خود را دریافت می‌کنند
      const userAssignments = await prisma.userProject.findMany({
        where: { user_id: req.user.id, project: { is_active: true } },
        select: { project_id: true }
      });
      const assignedProjectIds = userAssignments.map((a) => a.project_id);

      andConditions.push({
        OR: [
          { user_id: req.user.id },
          { project_id: { in: assignedProjectIds } },
          { report: { user_id: req.user.id } }
        ]
      });
    }

    if (pending_for_report === "true") {
      const repId = report_id ? Number(report_id) : null;
      const pendingOr: any[] = [
        { is_completed: false, claimed_completed: false }
      ];
      if (repId) {
        pendingOr.push({ claimed_report_id: repId });
      }
      andConditions.push({ OR: pendingOr });
    } else if (status === "pending") {
      andConditions.push({ is_completed: false, claimed_completed: false });
    } else if (status === "claimed") {
      andConditions.push({ claimed_completed: true, is_completed: false });
    } else if (status === "completed") {
      andConditions.push({ is_completed: true });
    }

    const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

    const actions = await prisma.nextAction.findMany({
      where: whereClause,
      include: {
        project: { select: { id: true, title: true } },
        user: { select: { id: true, full_name: true, job_title: true } },
        report: {
          include: {
            project: { select: { id: true, title: true } },
            user: { select: { id: true, full_name: true, job_title: true } },
          }
        },
        claimedReport: {
          select: {
            id: true,
            period_title: true,
            user_full_name: true,
            submitted_at: true
          }
        }
      },
      orderBy: { target_date: "asc" },
    });

    const formattedActions = actions.map((a) => ({
      id: a.id,
      report_id: a.report_id,
      project_id: a.project_id || a.report?.project_id,
      user_id: a.user_id || a.report?.user_id,
      created_by_role: a.created_by_role,
      action_text: a.action_text,
      target_date: a.target_date ? a.target_date.toISOString().split("T")[0] : null,
      target_date_raw: a.target_date_raw,
      claimed_completed: a.claimed_completed,
      claimed_at: a.claimed_at ? a.claimed_at.toISOString() : null,
      claimed_report_id: a.claimed_report_id,
      claimed_report: a.claimedReport ? {
        id: a.claimedReport.id,
        period_title: a.claimedReport.period_title,
        user_full_name: a.claimedReport.user_full_name,
        submitted_at: a.claimedReport.submitted_at.toISOString(),
      } : null,
      is_completed: a.is_completed,
      completed_at: a.completed_at ? a.completed_at.toISOString() : null,
      verified_at: a.verified_at ? a.verified_at.toISOString() : null,
      project: a.project || a.report?.project,
      user: a.user || a.report?.user,
    }));

    res.json(formattedActions);
  } catch (error) {
    console.error("Error fetching next actions:", error);
    res.status(500).json({ error: "خطا در دریافت لیست اقدامات آتی." });
  }
});

app.post("/api/next-actions", authenticate, async (req: any, res) => {
  try {
    const { project_id, user_id, action_text, target_date } = req.body;
    const trimmedText = typeof action_text === "string" ? action_text.trim() : "";

    if (!trimmedText) {
      return res.status(400).json({ error: "شرح اقدام یا ابلاغیه الزامی است." });
    }
    if (!target_date || !/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
      return res.status(400).json({ error: "تاریخ سررسید ددلاین الزامی و باید با فرمت YYYY-MM-DD باشد." });
    }
    if (!project_id) {
      return res.status(400).json({ error: "انتخاب پروژه الزامی است." });
    }

    const projectIdNum = Number(project_id);
    const targetProject = await prisma.project.findUnique({ where: { id: projectIdNum } });

    if (!targetProject) {
      return res.status(400).json({ error: "پروژه مورد نظر یافت نشد." });
    }

    if (req.user.role !== "manager") {
      if (!targetProject.is_active) {
        return res.status(400).json({ error: "امکان ثبت اقدام برای پروژه غیرفعال وجود ندارد." });
      }
      const isAssigned = await prisma.userProject.findUnique({
        where: { user_id_project_id: { user_id: req.user.id, project_id: projectIdNum } }
      });
      if (!isAssigned) {
        return res.status(403).json({ error: "شما به این پروژه تخصیص داده نشده‌اید." });
      }
    }

    const targetDateObj = new Date(`${target_date}T00:00:00.000Z`);
    if (isNaN(targetDateObj.getTime())) {
      return res.status(400).json({ error: "تاریخ سررسید وارد شده نامعتبر است." });
    }

    // استخراج نقش ایجادکننده بر اساس هویت احرازشده در نشست (جلوگیری از جعل نقش مدیریتی توسط پرسنل)
    const createdByRole = req.user.role === "manager" ? "manager" : "user";
    const assignedUserId = req.user.role === "manager"
      ? (user_id ? Number(user_id) : null)
      : req.user.id;

    const newAction = await prisma.nextAction.create({
      data: {
        project_id: projectIdNum,
        user_id: assignedUserId,
        action_text: trimmedText,
        target_date: targetDateObj,
        created_by_role: createdByRole,
        is_completed: false,
        claimed_completed: false,
      },
      include: {
        project: { select: { id: true, title: true } },
        user: { select: { id: true, full_name: true, job_title: true } },
      }
    });

    res.status(201).json({
      id: newAction.id,
      report_id: newAction.report_id,
      project_id: newAction.project_id,
      user_id: newAction.user_id,
      created_by_role: newAction.created_by_role,
      action_text: newAction.action_text,
      target_date: newAction.target_date ? newAction.target_date.toISOString().split("T")[0] : null,
      target_date_raw: newAction.target_date_raw,
      claimed_completed: newAction.claimed_completed,
      claimed_at: newAction.claimed_at ? newAction.claimed_at.toISOString() : null,
      claimed_report_id: newAction.claimed_report_id,
      is_completed: newAction.is_completed,
      completed_at: newAction.completed_at ? newAction.completed_at.toISOString() : null,
      verified_at: newAction.verified_at ? newAction.verified_at.toISOString() : null,
      project: newAction.project,
      user: newAction.user,
    });
  } catch (error) {
    console.error("Error creating next action:", error);
    res.status(500).json({ error: "خطا در ثبت اقدام جدید در دیتابیس." });
  }
});

app.patch("/api/next-actions/:id/toggle", authenticate, requireManager, async (req, res) => {
  try {
    const actionId = Number(req.params.id);
    const { is_completed, reset_claim } = req.body;

    const action = await prisma.nextAction.findUnique({ where: { id: actionId } });
    if (!action) {
      return res.status(404).json({ error: "اقدام مورد نظر یافت نشد." });
    }

    const willBeCompleted = Boolean(is_completed);
    const now = new Date();
    const shouldResetClaim = Boolean(reset_claim);

    const updatedAction = await prisma.nextAction.update({
      where: { id: actionId },
      data: {
        is_completed: willBeCompleted,
        completed_at: willBeCompleted ? now : null,
        verified_at: willBeCompleted ? now : null,
        claimed_completed: shouldResetClaim
          ? false
          : action.claimed_report_id !== null
          ? true
          : false,
        claimed_report_id: shouldResetClaim ? null : action.claimed_report_id,
        claimed_at: shouldResetClaim ? null : action.claimed_at,
      },
    });

    res.json({ success: true, action: updatedAction });
  } catch (error) {
    console.error("Error toggling action status:", error);
    res.status(500).json({ error: "خطا در تغییر وضعیت اقدام." });
  }
});

app.delete("/api/next-actions/:id", authenticate, requireManager, async (req, res) => {
  try {
    const actionId = Number(req.params.id);
    await prisma.nextAction.delete({ where: { id: actionId } });
    res.json({ success: true, message: "اقدام با موفقیت حذف شد." });
  } catch (error) {
    console.error("Error deleting next action:", error);
    res.status(500).json({ error: "خطا در حذف اقدام." });
  }
});

// -----------------------------
// 12. AI Strategy & Audit Endpoints
// -----------------------------
async function callAiWithFallback(systemPrompt: string, userPrompt: string) {
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

  const formatPersianError = (err: any, providerName: string) => {
    const status = err?.status || err?.statusCode;
    const msg = err?.message || String(err || "");

    if (typeof msg === "string" && (msg.includes("<!DOCTYPE") || msg.includes("<html") || msg.includes("Cloudflare"))) {
      return `تامین‌کننده «${providerName}»: درخواست توسط فایروال یا محدودیت شبکه/آی‌پی مسدود شد.`;
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
    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    }
    return JSON.parse(cleaned);
  };

  const providerErrorLogs: string[] = [];

  for (const provider of providers) {
    try {
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

function formatNextActionsForPrompt(nextActions: any[] | undefined): string {
  if (!Array.isArray(nextActions) || nextActions.length === 0) return "ثبت نشده";
  return nextActions
    .map((action) => {
      const targetDate = action.target_date instanceof Date
        ? action.target_date.toISOString().split("T")[0]
        : String(action.target_date || "").split("T")[0];
      return `- ${action.action_text} (تاریخ هدف: ${targetDate})`;
    })
    .join("\n");
}

function formatKpiValuesForPrompt(kpiValues: any[] | undefined): string {
  if (!Array.isArray(kpiValues) || kpiValues.length === 0) return "بدون شاخص ساختاریافته";
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

// اندپوینت تحلیل استراتژیک کلان دوره (مدیریتی)
app.post(["/api/reports/analyze", "/api/ai/strategic-analysis"], authenticate, requireManager, aiLimiter, async (req, res) => {
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
نکته: هیچ متن اضافی قبل و بعد از JSON ننویسید.`;

    const userPrompt = `گزارش‌های عملکرد بازه "${period_title}":\n\n${reportsText}`;
    const result = await callAiWithFallback(systemPrompt, userPrompt);
    res.json(result);
  } catch (err: any) {
    console.error("AI Global Analysis Error:", err);
    const clientError = config.NODE_ENV === "production"
      ? "خطایی در پردازش تحلیل کلان هوش مصنوعی رخ داد."
      : (err.message || "خطا در پردازش هوش مصنوعی.");
    res.status(500).json({ error: clientError });
  }
});

// اندپوینت ممیزی اختصاصی تک‌گزارش (بر اساس WBS اکسل)
app.post("/api/reports/analyze-single", authenticate, aiLimiter, async (req: any, res) => {
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

    // کنترل BOLA: کاربر عادی فقط می‌تواند گزارش خودش را ممیزی کند
    if (req.user.role !== "manager" && currentReport.user_id !== req.user.id) {
      return res.status(403).json({ error: "شما مجاز به ممیزی این گزارش نیستید." });
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

    let wbsContextText = "سند WBS اکسل برای این پروژه بارگذاری نشده است.";
    const wbsFilePath = resolveProjectWbsFilePath(currentReport.project);
    if (wbsFilePath) {
      try {
        const parsed = parseExcelWBS(wbsFilePath);
        wbsContextText = parsed.formattedPromptText;
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
      "پیشنهاد و اقدام کارآمد ۱...",
      "پیشنهاد ۲..."
    ],
    "future_actions_with_deadlines": [
      {
        "action": "شرح اقدام آتی",
        "deadline": "تاریخ هدف یا 'تعیین‌نشده'"
      }
    ],
    "repetitiveness_assessment": {
      "similarity_percentage": 15,
      "is_duplicate_risk": false,
      "analysis_details": "توضیح کوتاه در مورد شباهت گزارش با سوابق."
    },
    "strategic_alignment": {
      "is_aligned": true,
      "value_creation": "عالی / متوسط / ضعیف",
      "wbs_matching_task": "کد یا نام بسته کاری WBS مرتبط",
      "alignment_analysis": "بررسی تطابق استراتژیک فعالیت با هدف پروژه."
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
نویسنده: ${currentReport.user_full_name}
پروژه: ${currentReport.project_title}
فعالیت‌های انجام‌شده: ${currentReport.activities_done}
نتایج حاصله: ${currentReport.results_achieved || "ثبت نشده"}
${currentKpiSection}
اقدامات آتی: ${currentReport.nextActions?.map((a: any) => `${a.action_text} (ددلاین: ${a.target_date || "ندارد"})`).join(", ") || "ثبت نشده"}
`;

    const result = await callAiWithFallback(systemPrompt, userPrompt);
    res.json(result);
  } catch (err: any) {
    console.error("Single Report Audit Error:", err);
    const clientError = config.NODE_ENV === "production"
      ? "خطایی در ممیزی گزارش با هوش مصنوعی رخ داد."
      : (err.message || "خطا در پردازش هوش مصنوعی.");
    res.status(500).json({ error: clientError });
  }
});

// -----------------------------
// 13. Frontend Serving & Global Error Handler
// -----------------------------
async function startServer() {
  if (config.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // مدیریت خطاهای سراسری Express
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled Application Error:", err);
    const statusCode = err.status || err.statusCode || 500;
    const message = config.NODE_ENV === "production"
      ? "خطایی در پردازش درخواست رخ داد."
      : (err.message || "خطای ناشناخته سرور.");
    res.status(statusCode).json({ error: message });
  });

  const server = app.listen(config.PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${config.PORT} [${config.NODE_ENV}]`);
  });

  // خاموش شدن ایمن سرور (Graceful Shutdown)
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
        await pool.end();
        console.log("Database connections closed cleanly. Process exited.");
        process.exit(0);
      } catch (err) {
        console.error("Error during graceful shutdown:", err);
        process.exit(1);
      }
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
