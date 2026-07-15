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
  console.log("🌱 در حال ساخت کاربران اولیه در دیتابیس...");

  // ۱. ساخت علی بزرگی (عالی‌جناب)
  const manager = await prisma.user.upsert({
    where: { username: "manager" }, // اگر کاربری با این نام کاربری از قبل بود
    update: {},                    // هیچ کاری نکن
    create: {                      // اگر نبود، این را بساز
      username: "manager",
      full_name: "علی بزرگی (عالی‌جناب)",
      role: "manager",
      password: "123456",          // رمز عبور پیش‌فرض
      is_active: true,
      must_change_password: false, // مدیر نیاز به تغییر اجباری پسورد در ورود اول ندارد
    },
  });
  console.log(`✅ کاربر ساخته شد: ${manager.full_name}`);

  // ۲. ساخت یک کاربر نمونه (کارمند) برای تست‌های بعدی
  const employee = await prisma.user.upsert({
    where: { username: "Arash Saeedi" },
    update: {},
    create: {
      username: "Arash Saeedi",
      full_name: "آرش سعیدی (معاونت برنامه‌ریزی و سرمایه‌انسانی)",
      role: "user",
      password: "123456",
      is_active: true,
      must_change_password: true, // این کاربر در اولین ورود باید پسوردش را عوض کند
    },
  });
  console.log(`✅ کاربر ساخته شد: ${employee.full_name}`);
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