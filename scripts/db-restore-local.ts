import "dotenv/config";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

function findPgTool(toolName: string): string {
  const check = spawnSync(process.platform === "win32" ? "where" : "which", [toolName]);
  if (check.status === 0 && check.stdout) {
    const foundPath = check.stdout.toString().split(/\r?\n/)[0].trim();
    if (foundPath && fs.existsSync(foundPath)) return foundPath;
  }

  if (process.platform === "win32") {
    const pgBase = "C:\\Program Files\\PostgreSQL";
    if (fs.existsSync(pgBase)) {
      const versions = fs.readdirSync(pgBase).sort((a, b) => Number(b) - Number(a));
      for (const ver of versions) {
        const candidate = path.join(pgBase, ver, "bin", `${toolName}.exe`);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  throw new Error(`ابزار PostgreSQL یافت نشد: ${toolName}.`);
}

async function runRestore() {
  const backupsDir = path.join(process.cwd(), "backups");
  const latestFile = path.join(backupsDir, "latest.sql");
  const railwayFile = path.join(backupsDir, "railway_backup.sql");

  const fileToRestore = fs.existsSync(latestFile)
    ? latestFile
    : fs.existsSync(railwayFile)
    ? railwayFile
    : null;

  if (!fileToRestore) {
    console.error("❌ هیچ فایل پشتیبانی در پوشه backups یافت نشد. ابتدا دستور npm run db:backup را اجرا کنید.");
    process.exit(1);
  }

  // گرفتن آدرس دیتابیس محلی از آرگومان یا متغیر LOCAL_DATABASE_URL
  let targetUrl = process.argv[2] || process.env.LOCAL_DATABASE_URL;

  if (!targetUrl) {
    console.log("ℹ️ متغیر LOCAL_DATABASE_URL در .env یا ورودی خط فرمان یافت نشد.");
    console.log("استفاده از تنظیمات پیش‌فرض: postgresql://postgres:postgres@localhost:5432/organization_report_nodejs\n");
    targetUrl = "postgresql://postgres:postgres@localhost:5432/organization_report_nodejs";
  }

  const psqlPath = findPgTool("psql");
  console.log(`🔍 استفاده از ابزار psql: ${psqlPath}`);

  // استخراج نام دیتابیس و آدرس maintenance دیتابیس برای ایجاد در صورت نیاز
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (err) {
    console.error("❌ فرمت آدرس دیتابیس نامعتبر است:", targetUrl);
    process.exit(1);
  }

  const dbName = parsedUrl.pathname.replace(/^\//, "") || "organization_report_nodejs";
  const user = parsedUrl.username || "postgres";
  const password = parsedUrl.password || "";
  const host = parsedUrl.hostname || "localhost";
  const port = parsedUrl.port || "5432";

  console.log(`🎯 هدف بازگردانی: دیتابیس «${dbName}» روی ${host}:${port} با کاربر «${user}»`);

  const envVars = { ...process.env, PGPASSWORD: password };

  // ۱. ایجاد دیتابیس در صورت عدم وجود (اتصال به دیتابیس پیش‌فرض postgres)
  try {
    const maintenanceUrl = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/postgres`;
    const checkDbCmd = `"${psqlPath}" --dbname="${maintenanceUrl}" -tc "SELECT 1 FROM pg_database WHERE datname = '${dbName}';"`;
    const exists = execSync(checkDbCmd, { env: envVars, stdio: ["pipe", "pipe", "ignore"] })
      .toString()
      .trim();

    if (exists !== "1") {
      console.log(`🔨 در حال ایجاد دیتابیس محلی «${dbName}»...`);
      execSync(`"${psqlPath}" --dbname="${maintenanceUrl}" -c "CREATE DATABASE \\"${dbName}\\";"`, {
        env: envVars,
        stdio: "inherit",
      });
      console.log(`✅ دیتابیس «${dbName}» با موفقیت ایجاد شد.`);
    } else {
      console.log(`ℹ️ دیتابیس «${dbName}» از قبل وجود دارد.`);
    }
  } catch (err: any) {
    console.warn("⚠️ هشدار در بررسی یا ایجاد خودکار دیتابیس (ممکن است از قبل وجود داشته باشد یا نیاز به مجوز باشد):", err.message || err);
  }

  // ۲. بازگردانی داده‌ها به دیتابیس محلی
  console.log(`📥 در حال انتقال داده‌های فایل ${path.basename(fileToRestore)} به دیتابیس محلی...`);

  try {
    execSync(`"${psqlPath}" --dbname="${targetUrl}" -f "${fileToRestore}"`, {
      env: envVars,
      stdio: "inherit",
    });

    console.log(`\n🎉 بازگردانی با موفقیت انجام شد! دیتابیس محلی شما با تمامی داده‌های Railway همگام شد.`);
    console.log(`\n💡 برای استفاده از این دیتابیس محلی، کافیست در فایل .env خط زیر را قرار دهید:`);
    console.log(`DATABASE_URL="${targetUrl}"\n`);
  } catch (err: any) {
    console.error(`\n❌ خطا در بازگردانی داده‌ها:`, err.message || err);
    console.error(`راهنمایی: اگر رمز عبور PostgreSQL محلی متفاوت است، می‌توانید آن را به این صورت اجرا کنید:`);
    console.error(`npm run db:restore-local -- "postgresql://postgres:YOUR_PASSWORD@localhost:5432/${dbName}"`);
    process.exit(1);
  }
}

runRestore();
