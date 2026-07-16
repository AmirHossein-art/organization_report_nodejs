import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🧹 در حال پاکسازی داده‌های قبلی دیتابیس...");
  await prisma.reportFile.deleteMany();
  await prisma.report.deleteMany();
  await prisma.userProject.deleteMany();
  await prisma.user.deleteMany();
  await prisma.project.deleteMany();
  await prisma.reportPeriod.deleteMany();
  await prisma.deadlineSetting.deleteMany();
  console.log("✅ پاکسازی با موفقیت انجام شد.");

  console.log("🌱 در حال ایجاد تنظیمات ددلاین اولیه...");
  await prisma.deadlineSetting.createMany({
    data: [
      { id: 1, report_type: "weekly", deadline_day: 5, deadline_time: "14:00" }, // Thursday (پنج‌شنبه ساعت ۱۴)
      { id: 2, report_type: "monthly", deadline_day: 30, deadline_time: "16:00" } // سی‌ام هر ماه ساعت ۱۶
    ]
  });

  console.log("🌱 در حال ایجاد دوره‌های گزارش‌دهی...");
  const period1 = await prisma.reportPeriod.create({
    data: {
      id: 1,
      title: "هفته اول تیر ۱۴۰۵",
      report_type: "weekly",
      period_start: new Date("2026-06-22"),
      period_end: new Date("2026-06-28"),
      is_open: false
    }
  });

  const period2 = await prisma.reportPeriod.create({
    data: {
      id: 2,
      title: "هفته دوم تیر ۱۴۰۵",
      report_type: "weekly",
      period_start: new Date("2026-06-29"),
      period_end: new Date("2026-07-05"),
      is_open: false
    }
  });

  const period3 = await prisma.reportPeriod.create({
    data: {
      id: 3,
      title: "هفته سوم تیر ۱۴۰۵",
      report_type: "weekly",
      period_start: new Date("2026-07-06"),
      period_end: new Date("2026-07-12"),
      is_open: true
    }
  });

  const period4 = await prisma.reportPeriod.create({
    data: {
      id: 4,
      title: "تیر ۱۴۰۵",
      report_type: "monthly",
      period_start: new Date("2026-06-22"),
      period_end: new Date("2026-07-22"),
      is_open: true
    }
  });

  console.log("🌱 در حال ایجاد پروژه‌های ترافیکی...");
  const project1 = await prisma.project.create({
    data: {
      id: 1,
      title: "سامانه یکپارچه نظارت تصویری و پلاک‌خوان",
      description: "توسعه و هماهنگ‌سازی سرورهای پردازش تصویر دوربین‌های کنترل ترافیک و ثبت تخلف سرعت بزرگراه‌ها.",
      code: "PRJ-TFC-101",
      is_active: true
    }
  });

  const project2 = await prisma.project.create({
    data: {
      id: 2,
      title: "پورتال جامع پرداخت طرح ترافیک و عوارض",
      description: "پورتال شهروندی جهت رزرو روزانه مجوز ورود به محدوده طرح ترافیک و پرداخت آنلاین عوارض شهرداری.",
      code: "PRJ-TFC-102",
      is_active: true
    }
  });

  const project3 = await prisma.project.create({
    data: {
      id: 3,
      title: "داشبورد تحلیلی داده‌های تردد شهری (مترو و اتوبوس)",
      description: "تجمیع آمار مسافرین مترو و خطوط اتوبوس تندرو (BRT) جهت پایش تراکم مسافری و تحلیل زمان اوج سفرها.",
      code: "PRJ-TFC-103",
      is_active: true
    }
  });

  console.log("🌱 در حال ایجاد کاربران پرسنل و مدیریت...");
  const manager = await prisma.user.create({
    data: {
      id: 1,
      username: "manager",
      full_name: "علی بزرگی (عالی‌جناب)",
      role: "manager",
      password: "123456",
      is_active: true,
      must_change_password: false
    }
  });

  const userAhmadi = await prisma.user.create({
    data: {
      id: 2,
      username: "ahmadi",
      full_name: "علیرضا احمدی (توسعه‌دهنده ارشد سیستم‌های کنترل ترافیک)",
      role: "user",
      password: "123456",
      is_active: true,
      must_change_password: false
    }
  });

  const userRezai = await prisma.user.create({
    data: {
      id: 3,
      username: "rezai",
      full_name: "مریم رضایی (طراح رابط کاربری سامانه‌های هوشمند شهری)",
      role: "user",
      password: "123456",
      is_active: true,
      must_change_password: false
    }
  });

  const userKarimi = await prisma.user.create({
    data: {
      id: 4,
      username: "karimi",
      full_name: "محمد کریمی (کارشناس تست و تضمین کیفیت نرم‌افزار پلاک‌خوان)",
      role: "user",
      password: "123456",
      is_active: true,
      must_change_password: true
    }
  });

  const userSaeedi = await prisma.user.create({
    data: {
      id: 5,
      username: "saeedi",
      full_name: "آرش سعیدی (کارشناس برنامه‌ریزی حمل‌ونقل عمومی)",
      role: "user",
      password: "123456",
      is_active: true,
      must_change_password: true
    }
  });

  console.log("🌱 در حال تخصیص پروژه‌ها به نیروها...");
  await prisma.userProject.createMany({
    data: [
      { id: 1, user_id: userAhmadi.id, project_id: project1.id }, // ahmadi -> پلاک‌خوان
      { id: 2, user_id: userAhmadi.id, project_id: project2.id }, // ahmadi -> پورتال عوارض
      { id: 3, user_id: userRezai.id, project_id: project2.id },  // rezai -> پورتال عوارض
      { id: 4, user_id: userRezai.id, project_id: project3.id },  // rezai -> داشبورد تردد
      { id: 5, user_id: userKarimi.id, project_id: project1.id }, // karimi -> پلاک‌خوان
      { id: 6, user_id: userSaeedi.id, project_id: project3.id }  // saeedi -> داشبورد تردد
    ]
  });

  console.log("🌱 در حال ایجاد نمونه گزارش‌های ترافیکی...");
  
  // گزارش ۱: احمدی - پروژه پلاک‌خوان - هفته دوم تیر ۱۴۰۵ (ثبت شده به موقع)
  await prisma.report.create({
    data: {
      id: 1,
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
      activities_done: "بهینه‌سازی ماژول OCR جهت بالا بردن دقت تشخیص پلاک در نور کم اتوبان همت. رفع مشکلات تاخیر ارتباط استریم دوربین‌های سرعت‌سنج صدر به مرکز کنترل ترافیک.",
      results_achieved: "دقت ماژول در تشخیص پلاک‌های تاریک از ۸۲٪ به ۹۲٪ ارتقا یافت و تاخیر انتقال داده به ۱۸۰ میلی‌ثانیه کاهش یافت.",
      next_actions: "پیاده‌سازی ماژول خودکار اعلام خطای ارتباطی دوربین‌های غیرفعال اتوبان‌های شرق تهران.",
      kpi_text: "- افزایش ۱۰ درصدی دقت OCR شبانه\n- رفع اشکال ارتباطی ۱۲ گیت اتوبان صدر",
      status: "submitted",
      submitted_at: new Date("2026-07-04T10:15:00.000Z")
    }
  });

  // گزارش ۲: رضایی - پروژه پورتال عوارض - هفته دوم تیر ۱۴۰۵ (ثبت شده به موقع)
  await prisma.report.create({
    data: {
      id: 2,
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
      activities_done: "طراحی مجدد صفحات خرید مجوز روزانه و استعلام عوارض در برنامه فیگما. بازطراحی بخش راهنما و سوالات متداول کاربران برای بهبود تجربه کاربری (UX).",
      results_achieved: "تاییدیه دیزاین سیستم جدید از مدیریت گرفته شد و فایلهای خروجی جهت کدنویسی تحویل تیم فرانت‌اند شد.",
      next_actions: "طراحی ماکاپ‌های نسخه تبلت و موبایل سامانه ثبت عوارض هوشمند.",
      kpi_text: "- تحویل کامل فایلهای دیزاین سیستم در فیگما\n- اتمام اتود ۸ صفحه کلیدی",
      status: "submitted",
      submitted_at: new Date("2026-07-05T14:30:00.000Z")
    }
  });

  // گزارش ۳: کریمی - پروژه پلاک‌خوان - هفته دوم تیر ۱۴۰۵ (ثبت شده با تاخیر)
  await prisma.report.create({
    data: {
      id: 3,
      user_id: userKarimi.id,
      user_full_name: userKarimi.full_name,
      user_username: userKarimi.username,
      project_id: project1.id,
      project_title: project1.title,
      report_type: "weekly",
      period_id: period2.id,
      period_title: period2.title,
      period_start: period2.period_start,
      period_end: period2.period_end,
      activities_done: "اجرای سناریوهای تست خودکار و دستی بر روی نسخه ۳.۴ هسته پلاک‌خوان. بررسی وضعیت پردازش تصاویر تحت بار ترافیکی سنگین ساعات اوج صبحگاهی.",
      results_achieved: "کشف و مستندسازی ۳ باگ بحرانی در بخش هماهنگ‌سازی ساعت عکس تخلف با سرور ناجا.",
      next_actions: "اجرای تست‌های رگرسیون بر روی نسخه اصلاح شده پس از انتشار پچ جدید توسط تیم فنی.",
      kpi_text: "- انجام کامل ۱۵ سناریو تست کارکردی\n- ثبت ۳ گزارش خطا در جیرا",
      status: "late",
      submitted_at: new Date("2026-07-08T09:20:00.000Z") // ددلاین ۵ جولای بود
    }
  });

  console.log("📊 دیتابیس با داده‌های ترافیکی نمونه با موفقیت سید شد.");
}

main()
  .catch((e) => {
    console.error("خطا در اجرای Seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });