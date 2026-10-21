/**
 * tests/multi-seat-concurrency.test.ts
 * تست همروندی چندکاربره سازمانی (Delegated Multi-Seat Reporting)
 *
 * راستی‌آزمایی:
 * ۱. استخراج کلید موجودیت برای سناریوهای مختلف (تک‌گزارش، تکامل پروژه، ارزیابی معاونت، تحلیل استراتژیک)
 * ۲. اجازه اجرای هم‌زمان ممیزی هوش مصنوعی برای کارشناسان مختلف یک معاونت روی پروژه‌ها/گزارش‌های مجزا
 * ۳. جلوگیری از دابل‌کلیک یا اجرای همپوشان روی یک گزارش واحد
 * ۴. اعمال سقف همروندی اکانت معاونت (۵ پردازش موازی)
 * ۵. سقف بالاتر برای مدیران و ناظران (۸ پردازش موازی)
 * ۶. آزادسازی تمیز قفل‌ها در رویدادهای finish و close
 */

import { EventEmitter } from "events";
import {
  extractAiRequestEntityKey,
  userAiConcurrencyGuard,
  resetAiConcurrencyState,
  activeUserAiCounts,
  activeAiEntityLocks,
  MAX_CONCURRENT_AI_PER_DEPUTY,
  MAX_CONCURRENT_AI_PER_MANAGER,
} from "../src/utils/aiConcurrencyGuard";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`✔ PASS: ${message}`);
  } else {
    failed++;
    console.error(`✖ FAIL: ${message}`);
  }
}

function mockResponse() {
  const ee = new EventEmitter() as any;
  ee.statusCode = 200;
  ee.jsonPayload = null;
  ee.status = function (code: number) {
    this.statusCode = code;
    return this;
  };
  ee.json = function (data: any) {
    this.jsonPayload = data;
    return this;
  };
  return ee;
}

function runGuard(req: any, res: any): { nextCalled: boolean } {
  let nextCalled = false;
  userAiConcurrencyGuard(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled };
}

async function runTests() {
  console.log("=== آزمون همروندی چندکاربره سازمانی هوش مصنوعی (Delegated Multi-Seat Reporting) ===");

  // بخش ۱: استخراج کلید موجودیت
  resetAiConcurrencyState();

  const keyReport = extractAiRequestEntityKey({
    user: { id: 4 },
    body: { report_id: 101 },
  });
  assert(keyReport === "u:4:rep:101", "استخراج کلید تک‌گزارش (u:4:rep:101)");

  const keyProject = extractAiRequestEntityKey({
    user: { id: 4 },
    params: { projectId: "15" },
  });
  assert(keyProject === "u:4:proj:15", "استخراج کلید پروژه (u:4:proj:15)");

  const keyDeputy = extractAiRequestEntityKey({
    user: { id: 2 },
    body: { period_id: 3, user_id: 7 },
  });
  assert(keyDeputy === "u:2:deputy:7:p:3", "استخراج کلید ارزیابی معاونت (u:2:deputy:7:p:3)");

  const keyStrategic = extractAiRequestEntityKey({
    user: { id: 2 },
    body: { period_id: 3 },
  });
  assert(keyStrategic === "u:2:strat:p:3", "استخراج کلید تحلیل کلان دوره (u:2:strat:p:3)");

  // بخش ۲: اجرای موازی کارشناسان مختلف یک معاونت (اکانت مشترک user_id: 4)
  resetAiConcurrencyState();

  const res1 = mockResponse();
  const req1 = { user: { id: 4, role: "user" }, body: { report_id: 101 } };
  const g1 = runGuard(req1, res1);
  assert(g1.nextCalled, "کارشناس اول: شروع ممیزی گزارش ۱۰۱ با موفقیت");
  assert(activeUserAiCounts.get(4) === 1, "شمارنده اکانت معاونت به ۱ افزایش یافت");

  const res2 = mockResponse();
  const req2 = { user: { id: 4, role: "user" }, body: { report_id: 102 } };
  const g2 = runGuard(req2, res2);
  assert(g2.nextCalled, "کارشناس دوم (همان اکانت): شروع هم‌زمان ممیزی گزارش ۱۰۲ بدون تداخل");
  assert(activeUserAiCounts.get(4) === 2, "شمارنده اکانت معاونت به ۲ افزایش یافت");

  // بخش ۳: ممانعت از دابل‌کلیک یا اجرای همپوشان روی یک گزارش واحد
  const resDouble = mockResponse();
  const reqDouble = { user: { id: 4, role: "user" }, body: { report_id: 101 } };
  const gDouble = runGuard(reqDouble, resDouble);
  assert(!gDouble.nextCalled, "دابل‌کلیک روی گزارش ۱۰۱ بلاک شد");
  assert(resDouble.statusCode === 429, "کد پاسخ دابل‌کلیک ۴۲۹ است");
  assert(
    resDouble.jsonPayload?.error?.includes("برای این گزارش یا پروژه در حال اجرا است"),
    "پیام خطای دابل‌کلیک فارسی و دقیق است"
  );

  // بخش ۴: آزمون سقف همروندی اکانت معاونت (MAX_CONCURRENT_AI_PER_DEPUTY = 5)
  const res3 = mockResponse();
  const g3 = runGuard({ user: { id: 4, role: "user" }, body: { report_id: 103 } }, res3);
  assert(g3.nextCalled, "کارشناس سوم (گزارش ۱۰۳) مجاز است");

  const res4 = mockResponse();
  const g4 = runGuard({ user: { id: 4, role: "user" }, body: { report_id: 104 } }, res4);
  assert(g4.nextCalled, "کارشناس چهارم (گزارش ۱۰۴) مجاز است");

  const res5 = mockResponse();
  const g5 = runGuard({ user: { id: 4, role: "user" }, body: { report_id: 105 } }, res5);
  assert(g5.nextCalled, "کارشناس پنجم (گزارش ۱۰۵) مجاز است (سقف ۵ همروندی)");

  assert(activeUserAiCounts.get(4) === 5, "اکانت معاونت به حداکثر سقف مجاز (۵) رسید");

  // درخواست ششم باید بلاک شود
  const res6 = mockResponse();
  const g6 = runGuard({ user: { id: 4, role: "user" }, body: { report_id: 106 } }, res6);
  assert(!g6.nextCalled, "درخواست ششم فراتر از سقف ۵ بلاک شد");
  assert(res6.statusCode === 429, "کد خطای درخواست ششم ۴۲۹ است");
  assert(
    res6.jsonPayload?.error?.includes("سقف همروندی پردازش‌های هوش مصنوعی برای این حساب کاربری تکمیل است"),
    "پیام سقف همروندی دقیق است"
  );

  // بخش ۵: اتمام کارشناس اول و آزادسازی قفل
  res1.emit("finish");
  assert(activeUserAiCounts.get(4) === 4, "پس از اتمام گزارش ۱۰۱، شمارنده به ۴ کاهش یافت");
  assert(!activeAiEntityLocks.has("u:4:rep:101"), "قفل گزارش ۱۰۱ آزاد شد");

  // حال درخواست ششم مجاز می‌شود
  const res6Retry = mockResponse();
  const g6Retry = runGuard({ user: { id: 4, role: "user" }, body: { report_id: 106 } }, res6Retry);
  assert(g6Retry.nextCalled, "پس از آزاد شدن یک ظرفیت، گزارش ۱۰۶ با موفقیت اجرا شد");

  // آزادسازی با رویداد close (قطعی سوکت کاربر)
  res2.emit("close");
  assert(activeUserAiCounts.get(4) === 4, "با قطعی سوکت گزارش ۱۰۲، شمارنده به درستی کاهش یافت");
  assert(!activeAiEntityLocks.has("u:4:rep:102"), "قفل گزارش ۱۰۲ در رویداد close آزاد شد");

  // بخش ۶: سقف همروندی مدیران (MAX_CONCURRENT_AI_PER_MANAGER = 8)
  resetAiConcurrencyState();
  const managerReqs = [];
  for (let i = 1; i <= 8; i++) {
    const resM = mockResponse();
    const gM = runGuard({ user: { id: 1, role: "manager" }, body: { report_id: 200 + i } }, resM);
    assert(gM.nextCalled, `مدیر: اجرای هم‌زمان پردازش ${i} مجاز است`);
    managerReqs.push(resM);
  }
  assert(activeUserAiCounts.get(1) === 8, "شمارنده همروندی مدیر به ۸ رسید");

  const resM9 = mockResponse();
  const gM9 = runGuard({ user: { id: 1, role: "manager" }, body: { report_id: 209 } }, resM9);
  assert(!gM9.nextCalled, "درخواست نهم مدیر فراتر از سقف ۸ بلاک شد");
  assert(resM9.statusCode === 429, "پاسخ ۴۲۹ برای بیش از ۸ پردازش هم‌زمان مدیر");

  // تمیزکاری نهایی
  resetAiConcurrencyState();
  assert(activeUserAiCounts.size === 0 && activeAiEntityLocks.size === 0, "وضعیت همروندی کاملاً پاکسازی شد");

  console.log(`\nنتایج: ${passed} آزمون با موفقیت پاس شد، ${failed} شکست.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
