import "dotenv/config"; // ۱. اول از همه متغیرهای محیطی لود شوند
import express from "express";
import path from "path";
import fs from "fs";
import cors from "cors";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

// ایمپورت‌های جدید برای پریزما ۷ و پایگاه داده
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json());

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

// JSON file storage for DB state
const DB_FILE = path.join(process.cwd(), "db_store.json");

interface DBState {
  users: any[];
  projects: any[];
  reportPeriods: any[];
  userProjects: any[];
  reports: any[];
  deadlineSettings: any[];
  reportFiles: any[];
}

const defaultState: DBState = {
  users: [
    {
      id: 1,
      username: "manager",
      full_name: "سهراب رحمانی (مدیر سامانه)",
      role: "manager",
      is_active: true,
      must_change_password: false,
      password_changed_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      username: "ahmadi",
      full_name: "علیرضا احمدی (توسعه‌دهنده ارشد)",
      role: "user",
      is_active: true,
      must_change_password: false,
      password_changed_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      username: "rezai",
      full_name: "مریم رضایی (طراح رابط کاربری)",
      role: "user",
      is_active: true,
      must_change_password: false,
      password_changed_at: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      username: "karimi",
      full_name: "محمد کریمی (تست و تضمین کیفیت)",
      role: "user",
      is_active: true,
      must_change_password: true,
      password_changed_at: null,
      created_at: new Date().toISOString(),
    },
  ],
  projects: [
    {
      id: 1,
      title: "پورتال سازمانی خدمات دیجیتال",
      description: "طراحی و توسعه پورتال متمرکز خدمات الکترونیک برای پرسنل و ارباب رجوع.",
      code: "PRJ-ORG-101",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: "اپلیکیشن موبایل همکاران",
      description: "توسعه نسخه اندروید و iOS برای دسترسی به خدمات رفاهی و اداری.",
      code: "PRJ-MOB-102",
      is_active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      title: "سامانه یکپارچه‌سازی داده‌ها",
      description: "اتصال پایگاه‌های داده جزیره‌ای سازمان به مخزن داده مرکزی.",
      code: "PRJ-INT-103",
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ],
  reportPeriods: [
    {
      id: 1,
      title: "هفته اول تیر ۱۴۰۵",
      report_type: "weekly",
      period_start: "2026-06-22",
      period_end: "2026-06-28",
      is_open: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      title: "هفته دوم تیر ۱۴۰۵",
      report_type: "weekly",
      period_start: "2026-06-29",
      period_end: "2026-07-05",
      is_open: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      title: "هفته سوم تیر ۱۴۰۵",
      report_type: "weekly",
      period_start: "2026-07-06",
      period_end: "2026-07-12",
      is_open: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      title: "خرداد ۱۴۰۵",
      report_type: "monthly",
      period_start: "2026-05-22",
      period_end: "2026-06-21",
      is_open: false,
      created_at: new Date().toISOString(),
    },
    {
      id: 5,
      title: "تیر ۱۴۰۵",
      report_type: "monthly",
      period_start: "2026-06-22",
      period_end: "2026-07-22",
      is_open: true,
      created_at: new Date().toISOString(),
    },
  ],
  userProjects: [
    { id: 1, user_id: 2, project_id: 1, created_at: new Date().toISOString() }, // ahmadi -> Portal
    { id: 2, user_id: 2, project_id: 3, created_at: new Date().toISOString() }, // ahmadi -> Sync
    { id: 3, user_id: 3, project_id: 1, created_at: new Date().toISOString() }, // rezai -> Portal
    { id: 4, user_id: 3, project_id: 2, created_at: new Date().toISOString() }, // rezai -> Mobile
    { id: 5, user_id: 4, project_id: 2, created_at: new Date().toISOString() }, // karimi -> Mobile
  ],
  deadlineSettings: [
    { id: 1, report_type: "weekly", deadline_day: 5, deadline_time: "14:00" }, // Thursday (Farsi: پنج‌شنبه)
    { id: 2, report_type: "monthly", deadline_day: 30, deadline_time: "16:00" }, // 30th of month
  ],
  reports: [
    {
      id: 1,
      user_id: 2,
      user_full_name: "علیرضا احمدی (توسعه‌دهنده ارشد)",
      user_username: "ahmadi",
      project_id: 1,
      project_title: "پورتال سازمانی خدمات دیجیتال",
      report_type: "weekly",
      period_id: 2,
      period_title: "هفته دوم تیر ۱۴۰۵",
      period_start: "2026-06-29",
      period_end: "2026-07-05",
      activities_done: "طراحی و توسعه ماژول ورود دو مرحله‌ای کاربران (2FA). اتصال متد ارسال پیامک تایید هویت به پرووایدر مخابراتی ارائه‌دهنده سرویس پیامکی. پیاده‌سازی ریت‌لیمیت برای جلوگیری از حملات Brute force.",
      results_achieved: "امنیت بخش ورود کاربران به میزان چشمگیری افزایش یافت و تست‌های نفوذ با موفقیت به پایان رسیدند.",
      next_actions: "پیاده‌سازی مکانیزم لاگ‌اوت خودکار در صورت غیرفعال بودن کاربر به مدت ۱۵ دقیقه.",
      kpi_text: "- پیاده‌سازی و تست کامل ۵ سناریو امنیتی ورود.\n- زمان پاسخ‌دهی به درخواست ورود زیر ۴۰۰ میلی‌ثانیه.",
      status: "submitted",
      submitted_at: "2026-07-04T11:20:00.000Z",
      files: [],
    },
    {
      id: 2,
      user_id: 3,
      user_full_name: "مریم رضایی (طراح رابط کاربری)",
      user_username: "rezai",
      project_id: 1,
      project_title: "پورتال سازمانی خدمات دیجیتال",
      report_type: "weekly",
      period_id: 2,
      period_title: "هفته دوم تیر ۱۴۰۵",
      period_start: "2026-06-29",
      period_end: "2026-07-05",
      activities_done: "طراحی و نمونه‌سازی نمای دسکتاپ و موبایل برای پنل کاربری پرسنل در نرم‌افزار فیگما. برگزاری جلسه هماهنگی با مدیر محصول برای دریافت بازخوردهای نهایی و رفع ابهامات طراحی.",
      results_achieved: "تاییدیه نهایی ۸۰٪ از نماهای طراحی شده از مدیر محصول گرفته شد و به تیم فرانت‌اند تحویل گردید.",
      next_actions: "شروع طراحی المان‌های بخش داشبورد مالی و گزارشات حقوق و دستمزد پرسنل.",
      kpi_text: "- تحویل کامل فایلهای دیزاین سیستم در فیگما.\n- طراحی ۱۰ ماکاپ با کیفیت بالا.",
      status: "submitted",
      submitted_at: "2026-07-05T09:15:00.000Z",
      files: [],
    },
    {
      id: 3,
      user_id: 4,
      user_full_name: "محمد کریمی (تست و تضمین کیفیت)",
      user_username: "karimi",
      project_id: 2,
      project_title: "اپلیکیشن موبایل همکاران",
      report_type: "weekly",
      period_id: 2,
      period_title: "هفته دوم تیر ۱۴۰۵",
      period_start: "2026-06-29",
      period_end: "2026-07-05",
      activities_done: "اجرای سناریوهای تست دستی بر روی نسخه بتا ۳.۲ اپلیکیشن موبایل. تمرکز بر تست بخش رزرو غذا و ثبت درخواست مرخصی هفتگی.",
      results_achieved: "کشف ۴ باگ بحرانی در بخش هماهنگ‌سازی زمان مرخصی با سرور اداری و ارجاع آن‌ها به تیم فنی.",
      next_actions: "طراحی تست‌های رگرسیون برای بررسی مجدد باگ‌های برطرف شده پس از ریلیز پچ جدید.",
      kpi_text: "- اجرای کامل ۱۲ تست سناریو برای رزرو غذا.\n- گزارش و مستندسازی کامل باگ‌ها در سیستم جیرا.",
      status: "late",
      submitted_at: "2026-07-06T15:30:00.000Z", // submitted late (deadline was probably July 5th/6th)
      files: [],
    },
  ],
  reportFiles: [],
};

// Load or initialize DB state
let state: DBState = { ...defaultState };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      state = JSON.parse(data);
    } else {
      saveDB();
    }
  } catch (err) {
    console.error("Error reading db_store.json:", err);
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing db_store.json:", err);
  }
}

loadDB();

// API Helper for getting next ID
const nextId = (collection: any[]) =>
  collection.length > 0 ? Math.max(...collection.map((item) => item.id)) + 1 : 1;

// -----------------------------
// API ENDPOINTS
// -----------------------------

// Serve uploaded files
app.use("/uploads", express.static(uploadDir));

// --- Auth Endpoints ---
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // ۱. پیدا کردن کاربر در دیتابیس بر اساس نام کاربری منحصربه‌فرد
    const user = await prisma.user.findUnique({
      where: { username: username }
    });

    // ۲. بررسی وجود کاربر و فعال بودن حساب کاربری او
    if (!user || !user.is_active) {
      return res.status(401).json({ 
        error: "نام کاربری یا رمز عبور اشتباه است، یا حساب کاربری غیرفعال می‌باشد." 
      });
    }

    // ۳. بررسی صحت رمز عبور (در حال حاضر به صورت متن ساده مقایسه می‌شود)
    if (password !== user.password) {
      return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است." });
    }

    // ۴. ارسال مشخصات کاربر به فرانت‌اِند برای ایجاد نشست فعال
    res.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        must_change_password: user.must_change_password,
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "خطا در برقراری ارتباط با سرور احراز هویت" });
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

    // ۲. بروزرسانی رمز عبور، تغییر وضعیت اجبار تغییر پسورد و ثبت تاریخ تغییر
    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        password: newPassword,
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

    // ۲. ساخت کاربر جدید در دیتابیس PostgreSQL
    const newUser = await prisma.user.create({
      data: {
        username,
        full_name,
        role: role || "user", // در پریزما به حروف کوچک/بزرگ Enum دقت کن
        // رمز عبور پیش‌فرض ۱۲۳۴۵۶ در نظر گرفته می‌شود
        password: password || "123456", 
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
    const { full_name, role, is_active } = req.body;

    // ۱. بررسی اینکه آیا اصلاً کاربری با این شناسه وجود دارد؟
    const existingUser = await prisma.user.findUnique({
      where: { id: id }
    });

    if (!existingUser) {
      return res.status(404).json({ error: "کاربر مورد نظر یافت نشد." });
    }

    // ۲. آپدیت اطلاعات در جدول User دیتابیس
    const updatedUser = await prisma.user.update({
      where: { id: id },
      data: {
        // اگر مقدار جدید فرستاده شده بود، آن را ذخیره کن؛ در غیر این صورت مقدار قبلی را نگه دار
        full_name: full_name !== undefined ? full_name : existingUser.full_name,
        role: role !== undefined ? role : existingUser.role,
        is_active: is_active !== undefined ? is_active : existingUser.is_active,
      }
    });

    // ۳. فرستادن اطلاعات کاربرِ آپدیت‌شده به فرانت‌اِند
    res.json(updatedUser);

  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "خطا در ویرایش اطلاعات کاربر در دیتابیس" });
  }
});

app.post("/api/users/:id/reset-password", (req, res) => {
  const id = parseInt(req.params.id);
  const { temporary_password } = req.body;
  const userIndex = state.users.findIndex((u) => u.id === id);

  if (userIndex === -1) {
    return res.status(404).json({ error: "کاربر پیدا نشد." });
  }

  state.users[userIndex].password = temporary_password || "123456";
  state.users[userIndex].must_change_password = true;
  saveDB();

  res.json({ success: true, message: "رمز عبور با موفقیت بازنشانی شد." });
});

// --- Project Management ---
app.get("/api/projects", async (_req, res) => {
  try {
    // رفتن به دیتابیس و خواندن تمام رکوردهای جدول Project
    const projects = await prisma.project.findMany({
      orderBy: { id: "asc" }
    });
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "خطا در دریافت اطلاعات پروژه‌ها از دیتابیس" });
  }
});


app.post("/api/projects", (req, res) => {
  const { title, description, code } = req.body;

  if (state.projects.some((p) => p.code === code)) {
    return res.status(400).json({ error: "کد پروژه تکراری است." });
  }

  const newProject = {
    id: nextId(state.projects),
    title,
    description: description || "",
    code,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  state.projects.push(newProject);
  saveDB();
  res.json(newProject);
});

app.put("/api/projects/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, is_active } = req.body;
  const projectIndex = state.projects.findIndex((p) => p.id === id);

  if (projectIndex === -1) {
    return res.status(404).json({ error: "پروژه پیدا نشد." });
  }

  state.projects[projectIndex] = {
    ...state.projects[projectIndex],
    title: title !== undefined ? title : state.projects[projectIndex].title,
    description: description !== undefined ? description : state.projects[projectIndex].description,
    is_active: is_active !== undefined ? is_active : state.projects[projectIndex].is_active,
  };

  saveDB();
  res.json(state.projects[projectIndex]);
});

// --- Report Period Management ---
app.get("/api/report-periods", (req, res) => {
  res.json(state.reportPeriods);
});

app.post("/api/report-periods", (req, res) => {
  const { title, report_type, period_start, period_end } = req.body;

  const newPeriod = {
    id: nextId(state.reportPeriods),
    title,
    report_type,
    period_start,
    period_end,
    is_open: true,
    created_at: new Date().toISOString(),
  };

  state.reportPeriods.push(newPeriod);
  saveDB();
  res.json(newPeriod);
});

app.put("/api/report-periods/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { is_open, title, period_start, period_end } = req.body;
  const index = state.reportPeriods.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "بازه گزارش پیدا نشد." });
  }

  state.reportPeriods[index] = {
    ...state.reportPeriods[index],
    is_open: is_open !== undefined ? is_open : state.reportPeriods[index].is_open,
    title: title !== undefined ? title : state.reportPeriods[index].title,
    period_start: period_start !== undefined ? period_start : state.reportPeriods[index].period_start,
    period_end: period_end !== undefined ? period_end : state.reportPeriods[index].period_end,
  };

  saveDB();
  res.json(state.reportPeriods[index]);
});

// --- User Project Assignments ---
app.get("/api/user-projects", (req, res) => {
  res.json(state.userProjects);
});

app.post("/api/user-projects/sync", (req, res) => {
  const { user_id, project_ids } = req.body; // project_ids is an array of IDs

  // Remove existing allocations for this user
  state.userProjects = state.userProjects.filter((up) => up.user_id !== user_id);

  // Add new allocations
  if (Array.isArray(project_ids)) {
    project_ids.forEach((projId) => {
      state.userProjects.push({
        id: nextId(state.userProjects),
        user_id,
        project_id: projId,
        created_at: new Date().toISOString(),
      });
    });
  }

  saveDB();
  res.json({ success: true, message: "پروژه‌های تخصیص‌یافته به کاربر همگام‌سازی شدند." });
});

// --- Deadline Settings ---
app.get("/api/deadline-settings", (req, res) => {
  res.json(state.deadlineSettings);
});

app.put("/api/deadline-settings/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const { deadline_day, deadline_time } = req.body;
  const index = state.deadlineSettings.findIndex((ds) => ds.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "تنظیمات ددلاین پیدا نشد." });
  }

  state.deadlineSettings[index] = {
    ...state.deadlineSettings[index],
    deadline_day: deadline_day !== undefined ? parseInt(deadline_day) : state.deadlineSettings[index].deadline_day,
    deadline_time: deadline_time !== undefined ? deadline_time : state.deadlineSettings[index].deadline_time,
  };

  saveDB();
  res.json(state.deadlineSettings[index]);
});

// --- Reports ---
app.get("/api/reports", (req, res) => {
  res.json(state.reports);
});

app.post("/api/reports", upload.array("files"), (req, res) => {
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

  const user = state.users.find((u) => u.id === parseInt(user_id));
  const project = state.projects.find((p) => p.id === parseInt(project_id));
  const period = state.reportPeriods.find((p) => p.id === parseInt(period_id));

  if (!user || !project || !period) {
    return res.status(400).json({ error: "اطلاعات فرستاده شده کاربر، پروژه یا بازه نامعتبر است." });
  }

  // Calculate status (submitted or late) based on deadline settings
  const deadline = state.deadlineSettings.find((ds) => ds.report_type === report_type);
  let status: "submitted" | "late" = "submitted";

  if (deadline) {
    try {
      const now = new Date();
      // For simplicity, let's say if the submission time is after the period end date + 2 days, it's late.
      const periodEnd = new Date(period.period_end);
      const gracePeriod = new Date(periodEnd.getTime() + 2 * 24 * 60 * 60 * 1000); // 2 days after period ends
      if (now > gracePeriod) {
        status = "late";
      }
    } catch (_) {}
  }

  const reportId = nextId(state.reports);

  // Process uploaded files if any
  const reportFilesList: any[] = [];
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach((file: Express.Multer.File, index) => {
      const fileId = nextId(state.reportFiles) + index;
      const rFile = {
        id: fileId,
        report_id: reportId,
        filename: file.filename,
        original_filename: file.originalname,
        file_size: file.size,
        created_at: new Date().toISOString(),
      };
      state.reportFiles.push(rFile);
      reportFilesList.push(rFile);
    });
  }

  const newReport = {
    id: reportId,
    user_id: user.id,
    user_full_name: user.full_name,
    user_username: user.username,
    project_id: project.id,
    project_title: project.title,
    report_type,
    period_id: period.id,
    period_title: period.title,
    period_start: period.period_start,
    period_end: period.period_end,
    activities_done,
    results_achieved,
    next_actions,
    kpi_text,
    status,
    submitted_at: new Date().toISOString(),
    files: reportFilesList,
  };

  state.reports.push(newReport);
  saveDB();
  res.json(newReport);
});

app.put("/api/reports/:id", upload.array("files"), (req, res) => {
  const id = parseInt(req.params.id);
  const { activities_done, results_achieved, next_actions, kpi_text } = req.body;
  const index = state.reports.findIndex((r) => r.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "گزارش پیدا نشد." });
  }

  // Handle file deletion from req.body.deleted_file_ids if any
  if (req.body.deleted_file_ids) {
    const deletedIds = JSON.parse(req.body.deleted_file_ids).map((fid: any) => parseInt(fid));
    state.reportFiles = state.reportFiles.filter((rf) => {
      if (deletedIds.includes(rf.id)) {
        try {
          const filePath = path.join(uploadDir, rf.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (_) {}
        return false;
      }
      return true;
    });
    state.reports[index].files = state.reports[index].files.filter((f: any) => !deletedIds.includes(f.id));
  }

  // Handle newly uploaded files
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach((file: Express.Multer.File, fileIdx) => {
      const fileId = nextId(state.reportFiles) + fileIdx;
      const rFile = {
        id: fileId,
        report_id: id,
        filename: file.filename,
        original_filename: file.originalname,
        file_size: file.size,
        created_at: new Date().toISOString(),
      };
      state.reportFiles.push(rFile);
      state.reports[index].files.push(rFile);
    });
  }

  state.reports[index] = {
    ...state.reports[index],
    activities_done: activities_done !== undefined ? activities_done : state.reports[index].activities_done,
    results_achieved: results_achieved !== undefined ? results_achieved : state.reports[index].results_achieved,
    next_actions: next_actions !== undefined ? next_actions : state.reports[index].next_actions,
    kpi_text: kpi_text !== undefined ? kpi_text : state.reports[index].kpi_text,
  };

  saveDB();
  res.json(state.reports[index]);
});

// Delete a report file directly
app.delete("/api/report-files/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const fileIndex = state.reportFiles.findIndex((rf) => rf.id === id);

  if (fileIndex !== -1) {
    const file = state.reportFiles[fileIndex];
    try {
      const filePath = path.join(uploadDir, file.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error("Error deleting file:", err);
    }

    // Remove from reportFiles list
    state.reportFiles.splice(fileIndex, 1);

    // Remove from report object
    state.reports.forEach((rep) => {
      rep.files = rep.files.filter((f: any) => f.id !== id);
    });

    saveDB();
    return res.json({ success: true });
  }

  res.status(404).json({ error: "فایل پیدا نشد." });
});

// --- AI Service Endpoint (Gemini-3.5-flash) ---
app.post("/api/reports/analyze", async (req, res) => {
  const { period_title, reports } = req.body;

  if (!reports || !Array.isArray(reports) || reports.length === 0) {
    return res.status(400).json({ error: "داده‌های گزارش برای تحلیل کافی نیست." });
  }

  const reportsText = reports
    .map((r, index) => {
      return `--- گزارش ${index + 1} ---
نویسنده: ${r.user_full_name}
پروژه: ${r.project_title}
فعالیت‌ها: ${r.activities_done}
نتایج: ${r.results_achieved}
اقدامات آتی: ${r.next_actions}
شاخص‌ها: ${r.kpi_text}
`;
    })
    .join("\n");

  const systemPrompt = `شما یک دستیار هوشمند مدیریت پروژه هستید.
وظیفه شما این است که گزارش‌های ارائه‌شده توسط پرسنل را مطالعه کرده و یک خلاصه مدیریتی ۲ پاراگرافی ارائه دهید.
در پاراگراف اول: وضعیت کلی پیشرفت پروژه‌ها را خلاصه کنید.
در پاراگراف دوم: ریسک‌ها، تأخیرها یا مشکلاتی که در گزارش‌ها می‌بینید را برجسته کنید.
پاسخ باید کاملاً به زبان فارسی رسمی و اداری باشد.`;

  const userPrompt = `گزارش‌های بازه ${period_title}:\n${reportsText}`;

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "کلید API مربوط به Gemini تنظیم نشده است. لطفاً آن را در بخش تنظیمات وارد کنید.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });

    const analysisText = response.text || "تحلیلی بازگردانده نشد.";
    res.json({ analysis: analysisText });
  } catch (err: any) {
    console.error("Gemini analysis error:", err);
    res.status(500).json({ error: `خطا در تحلیل هوش مصنوعی: ${err.message || err}` });
  }
});

// --- Manager Dashboard Status Summary Helper ---
app.get("/api/dashboard/summary", (req, res) => {
  const periodId = parseInt(req.query.period_id as string);
  const projectId = req.query.project_id ? parseInt(req.query.project_id as string) : null;
  const userId = req.query.user_id ? parseInt(req.query.user_id as string) : null;

  const period = state.reportPeriods.find((p) => p.id === periodId);
  if (!period) {
    return res.status(404).json({ error: "بازه مورد نظر یافت نشد." });
  }

  // Expected reports: All users assigned to active projects
  // Find which users should submit a report for which assigned projects.
  // We can construct a list of expected pairs: (user, project)
  let expectedPairs: any[] = [];
  
  // Get active users who are 'user' role
  const activeStaff = state.users.filter((u) => u.is_active && u.role === "user");

  activeStaff.forEach((staff) => {
    // Get assigned project IDs for this user
    const assignments = state.userProjects.filter((up) => up.user_id === staff.id);
    assignments.forEach((assignment) => {
      const proj = state.projects.find((p) => p.id === assignment.project_id && p.is_active);
      if (proj) {
        // If filters apply
        if (projectId && proj.id !== projectId) return;
        if (userId && staff.id !== userId) return;

        expectedPairs.push({
          user: staff,
          project: proj,
        });
      }
    });
  });

  const rows = expectedPairs.map((pair) => {
    // Look for matching report
    const matchingReport = state.reports.find(
      (r) =>
        r.user_id === pair.user.id &&
        r.project_id === pair.project.id &&
        r.period_id === periodId
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
      report: matchingReport || null,
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
    period,
    summary,
    rows,
  });
});

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
