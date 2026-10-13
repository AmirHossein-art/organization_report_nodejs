import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import {
  generateAiCacheKey,
  getCachedAiResponse,
  setCachedAiResponse,
  updateCachedAiResponse,
  invalidateAiCache,
  clearAllAiCache,
  getAiCacheStats,
  aiMemoryCache,
} from "../src/services/aiCache";

test("generateAiCacheKey produces deterministic SHA-256 hash", () => {
  const k1 = generateAiCacheKey("sys prompt", "user prompt");
  const k2 = generateAiCacheKey("sys prompt", "user prompt");
  const k3 = generateAiCacheKey("sys prompt", "different user");

  assert.equal(typeof k1, "string");
  assert.equal(k1.length, 64);
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test("in-memory cache operations: get, set, update, invalidate, and clear", async () => {
  aiMemoryCache.clear();
  const mockPrisma: any = {
    aiAnalysisCache: {
      findUnique: async () => null,
      upsert: async () => ({}),
      delete: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
      count: async () => 0,
    },
  };

  const testKey = "test-key-memory";
  const testData = { analysis: { executive_summary: "خلاصه تستی" }, model_used: "Gemini 2.5 Flash" };

  // 1. Initially null
  assert.equal(await getCachedAiResponse(mockPrisma, testKey), null);

  // 2. Set cache
  await setCachedAiResponse(mockPrisma, testKey, testData);
  const cached = await getCachedAiResponse(mockPrisma, testKey);
  assert.ok(cached);
  assert.deepEqual(cached?.data, testData);

  // 3. Update cache
  const updatedData = { analysis: { executive_summary: "خلاصه به‌روزشده" }, model_used: "Gemini 2.5 Flash" };
  await updateCachedAiResponse(mockPrisma, testKey, updatedData);
  const cachedAfterUpdate = await getCachedAiResponse(mockPrisma, testKey);
  assert.equal(cachedAfterUpdate?.data.analysis.executive_summary, "خلاصه به‌روزشده");

  // 4. Invalidate specific key
  await invalidateAiCache(mockPrisma, testKey);
  assert.equal(await getCachedAiResponse(mockPrisma, testKey), null);

  // 5. Test expiration with short TTL
  const shortKey = "short-ttl-key";
  await setCachedAiResponse(mockPrisma, shortKey, testData, 10); // 10ms TTL
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(await getCachedAiResponse(mockPrisma, shortKey, 10), null);
});

const snapshot = process.env.WBS_TEST_SNAPSHOT;
test(
  "PostgreSQL durable cache: survives memory eviction and hydrates correctly",
  { skip: !snapshot },
  async () => {
    const root = path.resolve(snapshot!);
    const env = dotenv.parse(fs.readFileSync(path.join(root, "test.env")));
    const url = new URL(env.DATABASE_URL);
    assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
    const pool = new pg.Pool({ connectionString: url.toString() });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

    try {
      const cacheKey = `durable-test-${Date.now()}`;
      const payload = {
        analysis: { summary: "تحلیل ماندگار در پستگرس", kpis: ["شاخص ۱"] },
        model_used: "Llama-3.3-70B",
      };

      // 1. Save to cache
      await setCachedAiResponse(prisma, cacheKey, payload);

      // Verify in DB
      const dbRecord = await prisma.aiAnalysisCache.findUnique({
        where: { cache_key: cacheKey },
      });
      assert.ok(dbRecord, "Record must exist in PostgreSQL AiAnalysisCache table");
      assert.deepEqual((dbRecord.data as any).analysis, payload.analysis);

      // 2. Simulate complete memory loss (server reboot / crash)
      aiMemoryCache.clear();
      assert.equal(aiMemoryCache.has(cacheKey), false);

      // 3. Retrieve from DB hydration
      const restored = await getCachedAiResponse(prisma, cacheKey);
      assert.ok(restored, "Must recover from PostgreSQL when memory cache is empty");
      assert.deepEqual(restored.data, payload);
      assert.equal(aiMemoryCache.has(cacheKey), true, "Must re-populate memory cache on read");

      // 4. Stats
      const stats = await getAiCacheStats(prisma);
      assert.ok(stats.dbEntries >= 1);
      assert.ok(stats.memoryEntries >= 1);

      // 5. Clean up
      await invalidateAiCache(prisma, cacheKey);
      const afterDelete = await prisma.aiAnalysisCache.findUnique({
        where: { cache_key: cacheKey },
      });
      assert.equal(afterDelete, null);
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  }
);
