import "dotenv/config";
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

function findPgTool(toolName: string): string {
  // 1. Check if tool exists in PATH
  const check = spawnSync(process.platform === "win32" ? "where" : "which", [toolName]);
  if (check.status === 0 && check.stdout) {
    const foundPath = check.stdout.toString().split(/\r?\n/)[0].trim();
    if (foundPath && fs.existsSync(foundPath)) return foundPath;
  }

  // 2. Check standard Windows PostgreSQL install paths
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

  throw new Error(`ابزار PostgreSQL یافت نشد: ${toolName}. لطفاً PostgreSQL را نصب کرده یا مسیر آن را به PATH اضافه کنید.`);
}

async function runBackup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ متغیر DATABASE_URL در فایل .env تعریف نشده است.");
    process.exit(1);
  }

  const pgDumpPath = findPgTool("pg_dump");
  console.log(`🔍 استفاده از ابزار pg_dump: ${pgDumpPath}`);

  const backupsDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const backupFile = path.join(backupsDir, `backup_${timestamp}.sql`);
  const latestFile = path.join(backupsDir, "latest.sql");
  const railwayFile = path.join(backupsDir, "railway_backup.sql");

  console.log(`📦 در حال تهیه نسخه پشتیبان از دیتابیس...`);

  try {
    execSync(
      `"${pgDumpPath}" --dbname="${dbUrl}" -f "${backupFile}" --no-owner --no-acl --clean --if-exists`,
      { stdio: "inherit" }
    );

    // رونوشت به latest.sql و railway_backup.sql
    fs.copyFileSync(backupFile, latestFile);
    fs.copyFileSync(backupFile, railwayFile);

    const stats = fs.statSync(backupFile);
    const sizeKb = (stats.size / 1024).toFixed(1);

    console.log(`\n✅ پشتیبان‌گیری با موفقیت انجام شد!`);
    console.log(`📁 فایل ذخیره‌شده: ${backupFile} (${sizeKb} KB)`);
    console.log(`🔗 فایل آخرین نسخه: ${latestFile}`);
  } catch (err: any) {
    console.error(`\n❌ خطا در پشتیبان‌گیری:`, err.message || err);
    process.exit(1);
  }
}

runBackup();
