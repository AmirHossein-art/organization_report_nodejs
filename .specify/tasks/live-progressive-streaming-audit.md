# Tasks: Live Progressive Streaming AI Audit & Minimalist Executive Cards

**Associated Spec**: `.specify/specs/live-progressive-streaming-audit.md`  
**Decisions Covered**: D51  

---

## ماتریس تسک‌ها و فازبندی گام‌به‌گام پیاده‌سازی

### فاز ۱: زیرساخت استریم سرور و پارسر تدریجی
- [x] `T1.1` پیاده‌سازی ابزار سبک `src/utils/partialJsonParser.ts` برای پارس امن رشته‌های ناقص JSON حین استریم.
- [x] `T1.2` تعمیم تابع `callAiWithFallback` در `server.ts` جهت پشتیبانی از پارامتر `onChunk` و فعال‌سازی `stream: true`.
- [x] `T1.3` پیاده‌سازی سازوکار SSE در اندپوینت `/api/reports/analyze-deputy` برای پشتیبانی هم‌زمان از استریم و ریکوئست‌های معمولی.

### فاز ۲: بازطراحی مینیمال و اتصال استریم به فرانت‌اند
- [x] `T2.1` بازنویسی متد `runAnalysis` در `ManagerDashboard.tsx` با استفاده از `fetch` و خواندن جریان با `ReadableStream / TextDecoder`.
- [x] `T2.2` به‌روزرسانی لحظه‌ای استیت `analysis` بر اساس چانک‌های دریافتی از طریق `parsePartialJson`.
- [x] `T2.3` اعمال استایلینگ مینیمال اداری (رنگ‌های خنثی، حذف سبز و زرد کهربایی پرزرق‌وبرق، کرسر تایپ زنده).
- [x] `T2.4` طراحی نوار باریک وضعیت استریم (`در حال بررسی پروژه X از Y...`) به جای لودینگ‌های شلوغ.

### فاز ۳: تست، اعتبارسنجی و ثبت سند معماری
- [x] `T3.1` نگارش آزمون اختصاصی خودکار در `tests/partial-json-parser.test.ts` برای بررسی تمام حالات ناقص JSON، آرایه‌ها و آبجکت‌ها.
- [x] `T3.2` اجرای چک تایپ‌اسکریپت (`./node_modules/.bin/tsc --noEmit`).
- [x] `T3.3` اجرای آزمون‌های خودکار پروژه و بیلد پروداکشن (`npm run build`).
- [x] `T3.4` ثبت سند تصمیم معماری D51 در `.specify/decision.log`.
