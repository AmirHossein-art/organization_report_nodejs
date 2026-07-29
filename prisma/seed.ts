import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("متغیر محیطی DATABASE_URL تنظیم نشده است.");
}

if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
  throw new Error(
    "اجرای Seed در محیط production متوقف شد. در صورت اطمینان، ALLOW_DESTRUCTIVE_SEED=true را تنظیم کنید.",
  );
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = "123456";
const SALT_ROUNDS = 10;

function utcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

async function main(): Promise<void> {
  console.log("🌱 شروع Seed دیتابیس...");

  // هش رمز خارج از Transaction محاسبه می‌شود تا زمان Transaction کوتاه بماند.
  const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  const passwordChangedAt = new Date();

  await prisma.$transaction(
    async (tx) => {
      console.log("🧹 در حال پاک‌سازی داده‌های قبلی...");

      // ترتیب حذف از جدول‌های فرزند به والد است.
      await tx.reportFile.deleteMany();
      await tx.nextAction.deleteMany();
      await tx.report.deleteMany();
      await tx.userProject.deleteMany();
      await tx.deadlineSetting.deleteMany();
      await tx.reportPeriod.deleteMany();
      await tx.project.deleteMany();
      await tx.user.deleteMany();

      console.log("✅ پاک‌سازی انجام شد.");

      console.log("⏰ در حال ایجاد تنظیمات ددلاین...");
      await tx.deadlineSetting.createMany({
        data: [
          {
            report_type: "weekly",
            deadline_day: 3,
            deadline_time: "14:00",
          },
          {
            report_type: "monthly",
            deadline_day: 30,
            deadline_time: "16:00",
          },
        ],
      });

      console.log("📅 در حال ایجاد دوره‌های گزارش‌دهی...");
      const period1 = await tx.reportPeriod.create({
        data: {
          title: "هفته اول تیر ۱۴۰۵",
          report_type: "weekly",
          period_start: utcDate("2026-06-22"),
          period_end: utcDate("2026-06-28"),
          is_open: false,
        },
      });

      const period2 = await tx.reportPeriod.create({
        data: {
          title: "هفته دوم تیر ۱۴۰۵",
          report_type: "weekly",
          period_start: utcDate("2026-06-29"),
          period_end: utcDate("2026-07-05"),
          is_open: false,
        },
      });

      await tx.reportPeriod.create({
        data: {
          title: "هفته سوم تیر ۱۴۰۵",
          report_type: "weekly",
          period_start: utcDate("2026-07-06"),
          period_end: utcDate("2026-07-12"),
          is_open: true,
        },
      });

      await tx.reportPeriod.create({
        data: {
          title: "تیر ۱۴۰۵",
          report_type: "monthly",
          period_start: utcDate("2026-06-22"),
          period_end: utcDate("2026-07-22"),
          is_open: true,
        },
      });

      console.log("🚦 در حال ایجاد پروژه‌ها...");
      const project1 = await tx.project.create({
        data: {
          title: "سامانه یکپارچه نظارت تصویری و پلاک‌خوان",
          description:
            "توسعه و هماهنگ‌سازی سرورهای پردازش تصویر دوربین‌های کنترل ترافیک و ثبت تخلف سرعت بزرگراه‌ها.",
          code: "PRJ-TFC-101",
          is_active: true,
        },
      });

      const project2 = await tx.project.create({
        data: {
          title: "پورتال جامع پرداخت طرح ترافیک و عوارض",
          description:
            "پورتال شهروندی جهت رزرو روزانه مجوز ورود به محدوده طرح ترافیک و پرداخت آنلاین عوارض شهرداری.",
          code: "PRJ-TFC-102",
          is_active: true,
        },
      });

      const project3 = await tx.project.create({
        data: {
          title: "داشبورد تحلیلی داده‌های تردد شهری (مترو و اتوبوس)",
          description:
            "تجمیع آمار مسافران مترو و خطوط اتوبوس تندرو (BRT) برای پایش تراکم مسافری و تحلیل زمان اوج سفرها.",
          code: "PRJ-TFC-103",
          is_active: true,
        },
      });

      console.log("👥 در حال ایجاد کاربران...");
      await tx.user.create({
        data: {
          username: "manager",
          full_name: "علی بزرگی",
          job_title: "مدیر سامانه گزارش‌دهی",
          role: "manager",
          password: defaultPasswordHash,
          is_active: true,
          must_change_password: false,
          password_changed_at: passwordChangedAt,
        },
      });

      const userAhmadi = await tx.user.create({
        data: {
          username: "ahmadi",
          full_name: "علیرضا احمدی",
          job_title: "توسعه‌دهنده ارشد سیستم‌های کنترل ترافیک",
          role: "user",
          password: defaultPasswordHash,
          is_active: true,
          must_change_password: false,
          password_changed_at: passwordChangedAt,
        },
      });

      const userRezai = await tx.user.create({
        data: {
          username: "rezai",
          full_name: "مریم رضایی",
          job_title: "طراح رابط کاربری سامانه‌های هوشمند شهری",
          role: "user",
          password: defaultPasswordHash,
          is_active: true,
          must_change_password: false,
          password_changed_at: passwordChangedAt,
        },
      });

      const userKarimi = await tx.user.create({
        data: {
          username: "karimi",
          full_name: "محمد کریمی",
          job_title: "کارشناس تست و تضمین کیفیت نرم‌افزار پلاک‌خوان",
          role: "user",
          password: defaultPasswordHash,
          is_active: true,
          must_change_password: true,
          password_changed_at: null,
        },
      });

      const userSaeedi = await tx.user.create({
        data: {
          username: "saeedi",
          full_name: "آرش سعیدی",
          job_title: "کارشناس برنامه‌ریزی حمل‌ونقل عمومی",
          role: "user",
          password: defaultPasswordHash,
          is_active: true,
          must_change_password: true,
          password_changed_at: null,
        },
      });

      console.log("🔗 در حال تخصیص پروژه‌ها به کاربران...");
      await tx.userProject.createMany({
        data: [
          { user_id: userAhmadi.id, project_id: project1.id },
          { user_id: userAhmadi.id, project_id: project2.id },
          { user_id: userRezai.id, project_id: project2.id },
          { user_id: userRezai.id, project_id: project3.id },
          { user_id: userKarimi.id, project_id: project1.id },
          { user_id: userSaeedi.id, project_id: project3.id },
        ],
      });

      console.log("📝 در حال ایجاد گزارش‌های نمونه...");

      // گزارش ۱: پروژه ۱ + دوره ۲
      await tx.report.create({
        data: {
          user_id: userAhmadi.id,
          user_full_name: userAhmadi.full_name,
          user_username: userAhmadi.username,
          project_id: project1.id,
          project_title: project1.title,
          report_type: "weekly",
          period_id: period2.id,
          period_title: period2.title,
          period_start: period2.period_start,
          period_end: period2.period_end,
          activities_done:
            "بهینه‌سازی ماژول OCR برای افزایش دقت تشخیص پلاک در نور کم اتوبان همت. رفع مشکلات تأخیر ارتباط استریم دوربین‌های سرعت‌سنج صدر با مرکز کنترل ترافیک.",
          results_achieved:
            "دقت ماژول در تشخیص پلاک‌های تاریک از ۸۲٪ به ۹۲٪ ارتقا یافت و تأخیر انتقال داده به ۱۸۰ میلی‌ثانیه کاهش یافت.",
          kpi_text:
            "- افزایش ۱۰ درصدی دقت OCR شبانه\n- رفع اشکال ارتباطی ۱۲ گیت اتوبان صدر",
          status: "submitted",
          submitted_at: new Date("2026-07-07T08:15:00.000Z"),
          nextActions: {
            create: [
              {
                action_text:
                  "پیاده‌سازی ماژول خودکار اعلام خطای ارتباطی دوربین‌های غیرفعال اتوبان‌های شرق تهران.",
                target_date: utcDate("2026-07-12"),
                target_date_raw: null,
              },
              {
                action_text:
                  "تهیه گزارش مقایسه دقت تشخیص پلاک پیش و پس از بهینه‌سازی الگوریتم.",
                target_date: utcDate("2026-07-14"),
                target_date_raw: null,
              },
            ],
          },
        },
      });

      // گزارش ۲: پروژه ۲ + دوره ۲
      await tx.report.create({
        data: {
          user_id: userRezai.id,
          user_full_name: userRezai.full_name,
          user_username: userRezai.username,
          project_id: project2.id,
          project_title: project2.title,
          report_type: "weekly",
          period_id: period2.id,
          period_title: period2.title,
          period_start: period2.period_start,
          period_end: period2.period_end,
          activities_done:
            "طراحی مجدد صفحات خرید مجوز روزانه و استعلام عوارض در فیگما. بازطراحی بخش راهنما و پرسش‌های متداول برای بهبود تجربه کاربری.",
          results_achieved:
            "دیزاین سیستم جدید به تأیید مدیریت رسید و فایل‌های خروجی برای پیاده‌سازی به تیم فرانت‌اند تحویل داده شد.",
          kpi_text:
            "- تحویل کامل فایل‌های دیزاین سیستم در فیگما\n- تکمیل طراحی ۸ صفحه کلیدی",
          status: "submitted",
          submitted_at: new Date("2026-07-07T09:30:00.000Z"),
          nextActions: {
            create: [
              {
                action_text:
                  "طراحی ماکاپ‌های نسخه تبلت و موبایل سامانه ثبت عوارض هوشمند.",
                target_date: utcDate("2026-07-15"),
                target_date_raw: null,
              },
            ],
          },
        },
      });

      // گزارش ۳: پروژه ۱ + دوره ۱؛ این ترکیب با گزارش ۱ تکراری نیست.
      await tx.report.create({
        data: {
          user_id: userKarimi.id,
          user_full_name: userKarimi.full_name,
          user_username: userKarimi.username,
          project_id: project1.id,
          project_title: project1.title,
          report_type: "weekly",
          period_id: period1.id,
          period_title: period1.title,
          period_start: period1.period_start,
          period_end: period1.period_end,
          activities_done:
            "اجرای سناریوهای تست خودکار و دستی روی نسخه ۳.۴ هسته پلاک‌خوان و بررسی پردازش تصاویر تحت بار ترافیکی سنگین ساعات اوج صبحگاهی.",
          results_achieved:
            "سه باگ بحرانی در بخش هماهنگ‌سازی زمان تصویر تخلف با سرور ناجا شناسایی و مستندسازی شد.",
          kpi_text:
            "- اجرای کامل ۱۵ سناریوی تست کارکردی\n- ثبت ۳ گزارش خطا در سامانه پیگیری خطا",
          status: "late",
          submitted_at: new Date("2026-07-01T09:20:00.000Z"),
          nextActions: {
            create: [
              {
                action_text:
                  "اجرای تست‌های رگرسیون روی نسخه اصلاح‌شده پس از انتشار بسته به‌روزرسانی تیم فنی.",
                target_date: utcDate("2026-07-05"),
                target_date_raw: null,
              },
            ],
          },
        },
      });
    },
    {
      maxWait: 10_000,
      timeout: 30_000,
    },
  );

  console.log("✅ Seed با موفقیت انجام شد.");
  console.log(`🔐 رمز عبور اولیه همه کاربران: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error("❌ خطا در اجرای Seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });