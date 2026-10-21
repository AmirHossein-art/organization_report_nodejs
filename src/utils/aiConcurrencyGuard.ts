/**
 * aiConcurrencyGuard.ts
 * کنترل همروندی و سهمیه‌بندی پردازش‌های هوش مصنوعی برای کاربری چندنفره معاونت‌ها (Delegated Multi-Seat Reporting)
 *
 * در ساختار سازمانی شهرداری، معمولاً اکانت هر معاونت توسط ۳ الی ۶ کارشناس مختلف به صورت هم‌زمان
 * جهت ثبت و ممیزی پروژه‌های مجزا استفاده می‌شود.
 * این ماژول:
 * ۱. قفل همروندی را از سطح تک‌کاربره به سطح موجودیت/پروژه (Entity-level lock) تفکیک می‌کند.
 * ۲. سقف همروندی اکانت معاونت را به ۵ پردازش موازی ارتقا می‌دهد تا همکاران یک معاونت مانع یکدیگر نشوند.
 * ۳. از کلیک تکراری روی یک گزارش یا پروژه واحد ممانعت به عمل می‌آورد (Duplicate In-Flight Prevention).
 */

import { Request, Response, NextFunction } from "express";

export const MAX_CONCURRENT_AI_PER_DEPUTY = 5;
export const MAX_CONCURRENT_AI_PER_MANAGER = 8;

export const activeUserAiCounts = new Map<number, number>();
export const activeAiEntityLocks = new Set<string>();

/**
 * استخراج شناسه یکتای موجودیت هدف برای جلوگیری از دابل‌کلیک روی یک آیتم واحد
 */
export function extractAiRequestEntityKey(req: Request | any): string {
  const userId = req.user?.id || 0;

  // ۱. ممیزی تک‌گزارش (analyze-single)
  const reportId = req.body?.report_id ?? req.params?.report_id ?? req.params?.id ?? req.query?.report_id;
  if (reportId !== undefined && reportId !== null && String(reportId).trim() !== "") {
    return `u:${userId}:rep:${String(reportId).trim()}`;
  }

  // ۲. تکامل یا عملیات روی پروژه (memory/evolve یا sync-activities)
  const projectId = req.params?.projectId ?? req.body?.project_id ?? req.body?.projectId ?? req.query?.projectId;
  if (projectId !== undefined && projectId !== null && String(projectId).trim() !== "") {
    return `u:${userId}:proj:${String(projectId).trim()}`;
  }

  // ۳. ارزیابی معاونت در دوره (analyze-deputy)
  const periodId = req.body?.period_id ?? req.params?.period_id ?? req.query?.period_id;
  const targetDeputy = req.body?.user_id ?? req.body?.deputy_name;
  if (periodId !== undefined && targetDeputy !== undefined) {
    return `u:${userId}:deputy:${String(targetDeputy).trim()}:p:${String(periodId).trim()}`;
  }

  // ۴. تحلیل استراتژیک کلان دوره (strategic-analysis)
  if (periodId !== undefined && periodId !== null && String(periodId).trim() !== "") {
    return `u:${userId}:strat:p:${String(periodId).trim()}`;
  }

  // ۵. حالت عمومی بر اساس مسیر درخواست
  const path = req.path || req.originalUrl || "unknown";
  return `u:${userId}:path:${path}`;
}

/**
 * میدلور هوشمند کنترل همروندی چندکاربره سازمانی
 */
export function userAiConcurrencyGuard(req: Request | any, res: Response | any, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) return next();

  const role = req.user?.role;
  const maxAllowed = (role === "manager" || role === "viewer")
    ? MAX_CONCURRENT_AI_PER_MANAGER
    : MAX_CONCURRENT_AI_PER_DEPUTY;

  const entityKey = extractAiRequestEntityKey(req);

  // ۱. بررسی قفل موجودیت (جلوگیری از کلیک‌های تکراری روی یک گزارش/پروژه واحد)
  if (activeAiEntityLocks.has(entityKey)) {
    return res.status(429).json({
      error: "یک پردازش هوش مصنوعی برای این گزارش یا پروژه در حال اجرا است؛ لطفاً تا پایان آن صبور باشید.",
    });
  }

  // ۲. بررسی سقف همروندی حساب کاربری (پشتیبانی از چند کارشناس هم‌زمان با یک اکانت)
  const currentCount = activeUserAiCounts.get(userId) || 0;
  if (currentCount >= maxAllowed) {
    return res.status(429).json({
      error: `سقف همروندی پردازش‌های هوش مصنوعی برای این حساب کاربری تکمیل است (حداکثر ${maxAllowed} پردازش هم‌زمان). لطفاً تا اتمام یکی از پردازش‌ها صبور باشید.`,
    });
  }

  // اعمال قفل موجودیت و افزایش شمارنده همروندی اکانت
  activeAiEntityLocks.add(entityKey);
  activeUserAiCounts.set(userId, currentCount + 1);

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeAiEntityLocks.delete(entityKey);
    const count = activeUserAiCounts.get(userId) || 1;
    if (count <= 1) {
      activeUserAiCounts.delete(userId);
    } else {
      activeUserAiCounts.set(userId, count - 1);
    }
  };

  res.on("finish", release);
  res.on("close", release);
  next();
}

/**
 * بازنشانی وضعیت همروندی (مخصوص تست‌ها)
 */
export function resetAiConcurrencyState(): void {
  activeUserAiCounts.clear();
  activeAiEntityLocks.clear();
}
