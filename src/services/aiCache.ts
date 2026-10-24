import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export interface CachedAiResponse {
  data: { analysis: any; model_used: string };
  expiresAt: number;
  createdAt: string;
}

// حافظه موقت لایه اول (L1 In-Memory Cache) برای دسترسی بلادرنگ زیر میلی‌ثانیه
export const aiMemoryCache = new Map<string, CachedAiResponse>();

// مدت زمان پیش‌فرض نگهداری کش (۷ روز)
export const DEFAULT_AI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * تولید کلید یکتای پایدار بر اساس محتوای پرامپت‌ها
 */
export function generateAiCacheKey(systemPrompt: string, userPrompt: string): string {
  return crypto
    .createHash("sha256")
    .update(`${systemPrompt}:::${userPrompt}`)
    .digest("hex");
}

/**
 * دریافت پاسخ کش‌شده: ابتدا از L1 Memory و در صورت عدم وجود از L2 PostgreSQL
 */
export async function getCachedAiResponse(
  prisma: PrismaClient,
  cacheKey: string,
  ttlMs = DEFAULT_AI_CACHE_TTL_MS
): Promise<CachedAiResponse | null> {
  const now = Date.now();

  // ۱. بررسی حافظه موقت (L1)
  const memoryEntry = aiMemoryCache.get(cacheKey);
  if (memoryEntry) {
    if (memoryEntry.expiresAt > now) {
      return memoryEntry;
    }
    aiMemoryCache.delete(cacheKey);
  }

  // ۲. بررسی دیتابیس PostgreSQL (L2 Durable Cache)
  try {
    const dbEntry = await prisma.aiAnalysisCache.findUnique({
      where: { cache_key: cacheKey },
    });

    if (dbEntry) {
      const updatedAtMs = new Date(dbEntry.updated_at).getTime();
      const expiresAt = updatedAtMs + ttlMs;

      if (expiresAt > now) {
        const cached: CachedAiResponse = {
          data: dbEntry.data as any,
          expiresAt,
          createdAt: dbEntry.updated_at.toISOString(),
        };
        // بازنشانی در L1 برای تسریع مراجعات بعدی
        aiMemoryCache.set(cacheKey, cached);
        return cached;
      } else {
        // حذف رکورد منقضی‌شده از دیتابیس
        prisma.aiAnalysisCache.delete({ where: { cache_key: cacheKey } }).catch(() => {});
      }
    }
  } catch (error) {
    console.warn("⚠️ خطا در خواندن کش هوش مصنوعی از دیتابیس:", error instanceof Error ? error.message : error);
  }

  return null;
}

/**
 * ذخیره پاسخ هوش مصنوعی در هر دو لایه L1 و L2
 */
export async function setCachedAiResponse(
  prisma: PrismaClient,
  cacheKey: string,
  result: { analysis: any; model_used: string },
  ttlMs = DEFAULT_AI_CACHE_TTL_MS
): Promise<void> {
  const now = Date.now();
  const cached: CachedAiResponse = {
    data: result,
    expiresAt: now + ttlMs,
    createdAt: new Date().toISOString(),
  };

  // ۱. ذخیره در حافظه موقت (L1)
  aiMemoryCache.set(cacheKey, cached);

  // ۲. ذخیره پایدار در دیتابیس (L2)
  try {
    await prisma.aiAnalysisCache.upsert({
      where: { cache_key: cacheKey },
      create: {
        cache_key: cacheKey,
        data: result as any,
      },
      update: {
        data: result as any,
        updated_at: new Date(),
      },
    });
  } catch (error) {
    console.warn("⚠️ خطا در ذخیره پایدار کش هوش مصنوعی در دیتابیس:", error instanceof Error ? error.message : error);
  }
}

/**
 * به‌روزرسانی داده‌های تحلیل پالایش‌شده در کش
 */
export async function updateCachedAiResponse(
  prisma: PrismaClient,
  cacheKey: string,
  result: any,
  ttlMs = DEFAULT_AI_CACHE_TTL_MS
): Promise<void> {
  const existing = aiMemoryCache.get(cacheKey);
  const now = Date.now();
  const cached: CachedAiResponse = {
    data: result,
    expiresAt: existing ? existing.expiresAt : now + ttlMs,
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
  };

  aiMemoryCache.set(cacheKey, cached);

  try {
    await prisma.aiAnalysisCache.upsert({
      where: { cache_key: cacheKey },
      create: {
        cache_key: cacheKey,
        data: result as any,
      },
      update: {
        data: result as any,
        updated_at: new Date(),
      },
    });
  } catch (error) {
    console.warn("⚠️ خطا در به‌روزرسانی کش هوش مصنوعی در دیتابیس:", error instanceof Error ? error.message : error);
  }
}

/**
 * ابطال کش مشخص (درخواست Refresh اجباری کاربر)
 */
export async function invalidateAiCache(
  prisma: PrismaClient,
  cacheKey: string
): Promise<void> {
  aiMemoryCache.delete(cacheKey);
  try {
    await prisma.aiAnalysisCache.deleteMany({
      where: { cache_key: cacheKey },
    });
  } catch (error) {
    console.warn("⚠️ خطا در حذف کش هوش مصنوعی از دیتابیس:", error instanceof Error ? error.message : error);
  }
}

/**
 * ابطال هوشمند کش‌های تحلیلی مرتبط با یک دوره گزارش‌دهی خاص هنگام ثبت یا ویرایش گزارش
 */
export async function invalidatePeriodAiCache(prisma: PrismaClient, periodId: number): Promise<void> {
  const pStr1 = `period:${periodId}`;
  const pStr2 = `p:${periodId}`;
  for (const key of Array.from(aiMemoryCache.keys())) {
    if (key.includes(pStr1) || key.includes(pStr2)) {
      aiMemoryCache.delete(key);
    }
  }
  try {
    await prisma.aiAnalysisCache.deleteMany({
      where: {
        OR: [
          { cache_key: { contains: pStr1 } },
          { cache_key: { contains: pStr2 } },
        ],
      },
    });
  } catch (error) {
    console.warn("⚠️ خطا در پاکسازی کش دوره از دیتابیس:", error instanceof Error ? error.message : error);
  }
}

/**
 * پاکسازی کامل کل کش هوش مصنوعی
 */
export async function clearAllAiCache(prisma: PrismaClient): Promise<void> {
  aiMemoryCache.clear();
  try {
    await prisma.aiAnalysisCache.deleteMany({});
  } catch (error) {
    console.warn("⚠️ خطا در پاکسازی کامل کش هوش مصنوعی:", error instanceof Error ? error.message : error);
  }
}

/**
 * دریافت آمار وضعیت کش (تعداد در رم و تعداد در دیتابیس)
 */
export async function getAiCacheStats(prisma: PrismaClient): Promise<{ memoryEntries: number; dbEntries: number }> {
  let dbEntries = 0;
  try {
    dbEntries = await prisma.aiAnalysisCache.count();
  } catch (_) {}
  return {
    memoryEntries: aiMemoryCache.size,
    dbEntries,
  };
}
