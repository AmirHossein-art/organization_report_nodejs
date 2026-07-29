import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, ReportStatus, ReportType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

interface ProjectCatalogItem {
  code: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
  aliases?: string[];
}

interface NextActionInput {
  actionText: string;
  targetDateJalali?: string | null;
  targetDateGregorian?: string | null;
  targetDateRaw?: string | null;
  reviewNote?: string | null;
}

interface LegacyReportInput {
  projectCode: string;
  reporterUsername?: string | null;
  sourcePage: number;
  status?: "submitted" | "late";
  submittedAtJalali?: string | null;
  submittedAtGregorian?: string | null;
  activitiesDone: string[] | string;
  resultsAchieved?: string[] | string;
  kpiText?: string[] | string;
  nextActions?: NextActionInput[];
  importKey?: string;
  reviewNotes?: string[];
}

interface LegacyReportFile {
  schemaVersion: number;
  source: {
    fileName: string;
    coverDateJalali?: string | null;
  };
  period: {
    title: string;
    reportType: "weekly" | "monthly";
    periodStartJalali?: string | null;
    periodEndJalali?: string | null;
    periodStartGregorian?: string | null;
    periodEndGregorian?: string | null;
    isOpen?: boolean;
  };
  defaults?: {
    status?: "submitted" | "late";
    submittedAtJalali?: string | null;
    submittedAtGregorian?: string | null;
  };
  reports: LegacyReportInput[];
}

interface ParsedArgs {
  commit: boolean;
  replaceExisting: boolean;
  syncAssignments: boolean;
  dataDir: string;
  file?: string;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL تنظیم نشده است.");
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const readValue = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };

  return {
    commit: args.includes("--commit"),
    replaceExisting: args.includes("--replace-existing"),
    syncAssignments: args.includes("--sync-assignments"),
    dataDir: path.resolve(readValue("--data-dir") ?? "prisma/legacy-data"),
    file: readValue("--file"),
  };
}

function normalizeDigits(value: string): string {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  return value
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[／٫]/g, "/")
    .trim();
}

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let adjustedYear = jy + 1595;
  let days =
    -355668 +
    365 * adjustedYear +
    Math.floor(adjustedYear / 33) * 8 +
    Math.floor(((adjustedYear % 33) + 3) / 4) +
    jd;

  days += jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186;

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;

  if (days > 36524) {
    days -= 1;
    gy += 100 * Math.floor(days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }

  gy += 4 * Math.floor(days / 1461);
  days %= 1461;

  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;

  while (gm <= 12 && gd > monthDays[gm]) {
    gd -= monthDays[gm];
    gm += 1;
  }

  return [gy, gm, gd];
}

function parseJalaliDate(value: string, hourUtc = 0): Date {
  const normalized = normalizeDigits(value);
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) {
    throw new Error(`تاریخ جلالی نامعتبر است: ${value}`);
  }

  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);

  if (jm < 1 || jm > 12 || jd < 1 || jd > 31 || (jm > 6 && jd > 30)) {
    throw new Error(`تاریخ جلالی خارج از محدوده است: ${value}`);
  }

  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  return new Date(Date.UTC(gy, gm - 1, gd, hourUtc, 0, 0, 0));
}

function parseGregorianDate(value: string, hourUtc = 0): Date {
  const normalized = normalizeDigits(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`تاریخ میلادی نامعتبر است: ${value}`);
  }
  const date = new Date(`${normalized}T${String(hourUtc).padStart(2, "0")}:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`تاریخ میلادی نامعتبر است: ${value}`);
  }
  return date;
}

function resolveDate(
  jalali?: string | null,
  gregorian?: string | null,
  hourUtc = 0,
): Date | null {
  if (gregorian) return parseGregorianDate(gregorian, hourUtc);
  if (jalali) return parseJalaliDate(jalali, hourUtc);
  return null;
}

function formatText(value: string[] | string | undefined): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return value
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => `• ${item}`)
    .join("\n");
}

function loadJson<T>(filePath: string): T {
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(text) as T;
}

function validateProjectCatalog(items: ProjectCatalogItem[]): void {
  const codes = new Set<string>();
  for (const item of items) {
    if (!item.code?.trim() || !item.title?.trim()) {
      throw new Error("هر پروژه در projects.json باید code و title داشته باشد.");
    }
    if (codes.has(item.code)) {
      throw new Error(`کد پروژه تکراری در projects.json: ${item.code}`);
    }
    codes.add(item.code);
  }
}

function validateReportFile(file: LegacyReportFile, filePath: string): void {
  if (file.schemaVersion !== 1) {
    throw new Error(`${filePath}: schemaVersion باید 1 باشد.`);
  }
  if (!file.source?.fileName || !file.period?.title || !Array.isArray(file.reports)) {
    throw new Error(`${filePath}: ساختار فایل گزارش ناقص است.`);
  }
  if (!file.period.periodStartJalali && !file.period.periodStartGregorian) {
    throw new Error(`${filePath}: تاریخ شروع دوره ثبت نشده است.`);
  }
  if (!file.period.periodEndJalali && !file.period.periodEndGregorian) {
    throw new Error(`${filePath}: تاریخ پایان دوره ثبت نشده است.`);
  }

  const projectCodes = new Set<string>();
  for (const report of file.reports) {
    if (!report.projectCode || !Number.isInteger(report.sourcePage) || report.sourcePage < 1) {
      throw new Error(`${filePath}: projectCode یا sourcePage یکی از گزارش‌ها نامعتبر است.`);
    }
    if (projectCodes.has(report.projectCode)) {
      throw new Error(
        `${filePath}: پروژه ${report.projectCode} در یک فایل/دوره بیش از یک بار آمده است.`,
      );
    }
    projectCodes.add(report.projectCode);
    if (!Array.isArray(report.nextActions ?? [])) {
      throw new Error(`${filePath}: nextActions پروژه ${report.projectCode} باید آرایه باشد.`);
    }
  }
}

function getReportFiles(args: ParsedArgs): string[] {
  if (args.file) {
    return [path.resolve(args.file)];
  }

  const reportsDir = path.join(args.dataDir, "reports");
  if (!fs.existsSync(reportsDir)) {
    throw new Error(`پوشه گزارش‌ها پیدا نشد: ${reportsDir}`);
  }

  return fs
    .readdirSync(reportsDir)
    .filter((name) => name.toLowerCase().endsWith(".json"))
    .sort()
    .map((name) => path.join(reportsDir, name));
}

async function main(): Promise<void> {
  const args = parseArgs();
  const mode = args.commit ? "COMMIT" : "DRY RUN";
  console.log(`\n=== Legacy reports import: ${mode} ===`);
  console.log(`Data directory: ${args.dataDir}`);

  const projectsPath = path.join(args.dataDir, "projects.json");
  const reportersPath = path.join(args.dataDir, "project-reporters.json");
  const projectCatalog = loadJson<ProjectCatalogItem[]>(projectsPath);
  const projectReporters = loadJson<Record<string, string | null>>(reportersPath);
  validateProjectCatalog(projectCatalog);

  const catalogByCode = new Map(projectCatalog.map((item) => [item.code, item]));
  const reportFiles = getReportFiles(args);

  const loadedFiles = reportFiles.map((filePath) => {
    const data = loadJson<LegacyReportFile>(filePath);
    validateReportFile(data, filePath);
    return { filePath, data };
  });

  const requiredProjectCodes = new Set<string>();
  const requiredUsernames = new Set<string>();
  const validationErrors: string[] = [];
  const warnings: string[] = [];

  for (const { filePath, data } of loadedFiles) {
    for (const report of data.reports) {
      requiredProjectCodes.add(report.projectCode);
      const username = report.reporterUsername?.trim() || projectReporters[report.projectCode]?.trim();
      if (!username || username === "TODO_USERNAME") {
        validationErrors.push(
          `${path.basename(filePath)} / ${report.projectCode}: نام کاربری مسئول مشخص نشده است.`,
        );
      } else {
        requiredUsernames.add(username);
      }
      if (!catalogByCode.has(report.projectCode)) {
        validationErrors.push(
          `${path.basename(filePath)}: پروژه ${report.projectCode} در projects.json تعریف نشده است.`,
        );
      }
      if (formatText(report.activitiesDone) === "") {
        warnings.push(
          `${path.basename(filePath)} / ${report.projectCode}: بخش اقدامات خالی است.`,
        );
      }
    }
  }

  const users = await prisma.user.findMany({
    where: { username: { in: [...requiredUsernames] } },
    select: { id: true, username: true, full_name: true },
  });
  const usersByUsername = new Map(users.map((user) => [user.username, user]));

  for (const username of requiredUsernames) {
    if (!usersByUsername.has(username)) {
      validationErrors.push(`کاربر با username=${username} در دیتابیس وجود ندارد.`);
    }
  }

  const existingProjects = await prisma.project.findMany({
    where: { code: { in: [...requiredProjectCodes] } },
    select: { id: true, code: true, title: true },
  });
  const existingProjectsByCode = new Map(existingProjects.map((project) => [project.code, project]));
  const projectsToCreate = [...requiredProjectCodes].filter(
    (code) => !existingProjectsByCode.has(code),
  );

  if (warnings.length) {
    console.log("\nWarnings:");
    warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  if (validationErrors.length) {
    console.error("\nValidation failed:");
    validationErrors.forEach((error) => console.error(`  - ${error}`));
    throw new Error("ورود متوقف شد؛ خطاهای بالا را اصلاح کنید.");
  }

  console.log(`\nFiles: ${loadedFiles.length}`);
  console.log(`Reports: ${loadedFiles.reduce((sum, item) => sum + item.data.reports.length, 0)}`);
  console.log(`Projects to create: ${projectsToCreate.length}`);
  console.log(`Users resolved: ${usersByUsername.size}`);
  console.log(`Sync assignments: ${args.syncAssignments ? "yes" : "no"}`);
  console.log(`Replace existing: ${args.replaceExisting ? "yes" : "no"}`);

  let createdReports = 0;
  let replacedReports = 0;
  let skippedReports = 0;
  let createdPeriods = 0;
  let createdProjects = 0;
  let syncedAssignments = 0;

  for (const { filePath, data } of loadedFiles) {
    const periodStart = resolveDate(
      data.period.periodStartJalali,
      data.period.periodStartGregorian,
    );
    const periodEnd = resolveDate(data.period.periodEndJalali, data.period.periodEndGregorian);
    if (!periodStart || !periodEnd) {
      throw new Error(`${filePath}: تاریخ دوره قابل تبدیل نیست.`);
    }

    const reportType = data.period.reportType as ReportType;
    const defaultStatus = (data.defaults?.status ?? "submitted") as ReportStatus;
    const defaultSubmittedAt =
      resolveDate(
        data.defaults?.submittedAtJalali ?? data.source.coverDateJalali,
        data.defaults?.submittedAtGregorian,
        9,
      ) ?? periodEnd;

    console.log(`\n${path.basename(filePath)} (${data.reports.length} reports)`);

    if (!args.commit) {
      const existingPeriod = await prisma.reportPeriod.findFirst({
        where: {
          report_type: reportType,
          period_start: periodStart,
          period_end: periodEnd,
        },
        select: { id: true },
      });
      if (!existingPeriod) createdPeriods += 1;

      for (const reportInput of data.reports) {
        const project = existingProjectsByCode.get(reportInput.projectCode);
        if (!project || !existingPeriod) {
          createdReports += 1;
          continue;
        }
        const importKey =
          reportInput.importKey ??
          `legacy:${normalizeDigits(data.period.periodEndJalali ?? data.period.periodEndGregorian ?? "unknown").replaceAll("/", "-")}:${reportInput.projectCode}`;
        const existing = await prisma.report.findUnique({
          where: {
            one_report_per_project_period: {
              project_id: project.id,
              period_id: existingPeriod.id,
            },
          },
          select: { id: true, import_key: true },
        });
        if (!existing) createdReports += 1;
        else if (args.replaceExisting) replacedReports += 1;
        else if (existing.import_key === importKey) skippedReports += 1;
        else {
          throw new Error(
            `${path.basename(filePath)} / ${reportInput.projectCode}: برای این پروژه و دوره یک گزارش دیگر با import_key=${existing.import_key ?? "NULL"} وجود دارد. برای جایگزینی آگاهانه از --replace-existing استفاده کنید.`,
          );
        }
      }
      continue;
    }

    await prisma.$transaction(
      async (tx) => {
        for (const projectCode of new Set(data.reports.map((report) => report.projectCode))) {
          const catalogItem = catalogByCode.get(projectCode)!;
          const existingProject = await tx.project.findUnique({ where: { code: projectCode } });
          if (!existingProject) {
            await tx.project.create({
              data: {
                code: catalogItem.code,
                title: catalogItem.title,
                description: catalogItem.description ?? null,
                is_active: catalogItem.isActive ?? true,
              },
            });
            createdProjects += 1;
          }
        }

        let period = await tx.reportPeriod.findFirst({
          where: {
            report_type: reportType,
            period_start: periodStart,
            period_end: periodEnd,
          },
        });

        if (!period) {
          period = await tx.reportPeriod.create({
            data: {
              title: data.period.title,
              report_type: reportType,
              period_start: periodStart,
              period_end: periodEnd,
              is_open: data.period.isOpen ?? false,
            },
          });
          createdPeriods += 1;
        }

        for (const reportInput of data.reports) {
          const username =
            reportInput.reporterUsername?.trim() || projectReporters[reportInput.projectCode]!.trim();
          const user = await tx.user.findUnique({ where: { username } });
          const project = await tx.project.findUnique({
            where: { code: reportInput.projectCode },
          });
          if (!user || !project) {
            throw new Error(
              `${path.basename(filePath)} / ${reportInput.projectCode}: کاربر یا پروژه پیدا نشد.`,
            );
          }

          const submittedAt =
            resolveDate(
              reportInput.submittedAtJalali,
              reportInput.submittedAtGregorian,
              9,
            ) ?? defaultSubmittedAt;
          const status = (reportInput.status ?? defaultStatus) as ReportStatus;
          const importKey =
            reportInput.importKey ??
            `legacy:${normalizeDigits(data.period.periodEndJalali ?? data.period.periodEndGregorian ?? "unknown").replaceAll("/", "-")}:${reportInput.projectCode}`;

          const nextActions = (reportInput.nextActions ?? []).map((action) => ({
            action_text: action.actionText.trim(),
            target_date: resolveDate(action.targetDateJalali, action.targetDateGregorian),
            target_date_raw: action.targetDateRaw?.trim() || null,
          }));

          const existing = await tx.report.findUnique({
            where: {
              one_report_per_project_period: {
                project_id: project.id,
                period_id: period.id,
              },
            },
          });

          const reportData = {
            user_id: user.id,
            user_full_name: user.full_name,
            user_username: user.username,
            project_id: project.id,
            project_title: project.title,
            report_type: reportType,
            period_id: period.id,
            period_title: period.title,
            period_start: period.period_start,
            period_end: period.period_end,
            activities_done: formatText(reportInput.activitiesDone),
            results_achieved: formatText(reportInput.resultsAchieved),
            kpi_text: formatText(reportInput.kpiText),
            status,
            submitted_at: submittedAt,
            source_file_name: data.source.fileName,
            source_page: reportInput.sourcePage,
            import_key: importKey,
            is_legacy_import: true,
            imported_at: new Date(),
          };

          if (existing) {
            if (!args.replaceExisting) {
              if (existing.import_key === importKey) {
                skippedReports += 1;
                console.log(`  SKIP ${reportInput.projectCode}: same import already exists`);
                continue;
              }
              throw new Error(
                `${path.basename(filePath)} / ${reportInput.projectCode}: برای این پروژه و دوره یک گزارش دیگر با import_key=${existing.import_key ?? "NULL"} وجود دارد. برای جایگزینی آگاهانه از --replace-existing استفاده کنید.`,
              );
            }

            await tx.report.update({
              where: { id: existing.id },
              data: {
                ...reportData,
                nextActions: {
                  deleteMany: {},
                  create: nextActions,
                },
              },
            });
            replacedReports += 1;
          } else {
            await tx.report.create({
              data: {
                ...reportData,
                nextActions: { create: nextActions },
              },
            });
            createdReports += 1;
          }

          if (args.syncAssignments) {
            await tx.userProject.upsert({
              where: {
                user_id_project_id: {
                  user_id: user.id,
                  project_id: project.id,
                },
              },
              create: { user_id: user.id, project_id: project.id },
              update: {},
            });
            syncedAssignments += 1;
          }
        }
      },
      { maxWait: 20_000, timeout: 120_000 },
    );
  }

  if (!args.commit) {
    createdProjects = projectsToCreate.length;
  }

  console.log("\n=== Summary ===");
  console.log(`Mode: ${mode}`);
  console.log(`Projects to create/created: ${createdProjects}`);
  console.log(`Periods to create/created: ${createdPeriods}`);
  console.log(`Reports to create/created: ${createdReports}`);
  console.log(`Reports to replace/replaced: ${replacedReports}`);
  console.log(`Reports skipped: ${skippedReports}`);
  console.log(`Assignments synced: ${syncedAssignments}`);

  if (!args.commit) {
    console.log("\nNo database changes were made. Add --commit after reviewing this output.");
  }
}

main()
  .catch((error: unknown) => {
    console.error("\nImport failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
