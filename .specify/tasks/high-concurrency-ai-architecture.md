# Tasks: High-Concurrency & Multi-User Scalable AI Architecture

**Associated Spec**: `.specify/specs/high-concurrency-ai-architecture.md`  
**Decisions Covered**: D43  

---

## ماتریس تسک‌ها و فازبندی پیاده‌سازی گام‌به‌گام

### فاز ۱: پایداری استخر دیتابیس، چک سلامت و گاردهای سراسری سرور (فوری و حیاتی)
- [x] `T1.1` ارتقای استخر اتصال PostgreSQL در `server.ts` (`max: 25`، `connectionTimeoutMillis: 8000`، `idleTimeoutMillis: 30000`).
- [x] `T1.2` ایزوله‌سازی اندپوینت `/api/health` با تایم‌اوت سختگیرانه ۲.۵ ثانیه‌ای (`Promise.race`) برای جلوگیری از کشته شدن کانتینر توسط Railway.
- [x] `T1.3` قرنطینه کردن کوئری انکودینگ نام فایل‌ها (`convert_from`) در `ensureDatabaseSchema` در بلوک `try/catch` مجزا برای جلوگیری از توقف سرور.
- [x] `T1.4` انتقال کارهای پاکسازی دوره‌ای دیتابیس به بعد از استارت کامل وب‌سرور (جلوگیری از رقابت برای اتصالات در استارتاپ).
- [x] `T1.5` افزودن گاردهای سراسری `uncaughtException` و `unhandledRejection` در `server.ts`.

### فاز ۲: مهار کلاینت‌های هوش مصنوعی و رفع طوفان پولینگ فرانت‌اند
- [x] `T2.1` افزودن `timeout: 35000` و `maxRetries: 1` به کلاینت OpenAI در `callAiWithFallback` (جلوگیری از معلق ماندن ۱۰ دقیقه‌ای پروسس).
- [x] `T2.2` افزودن `timeout: 8000` به متد کشف مدل‌ها (`discoverCandidateModels`).
- [x] `T2.3` بهینه‌سازی پولینگ در `StrategicNetworkExplorer.tsx`: لغو لود تکراری کل گراف در هر ۳ ثانیه، و واکشی منحصراً در زمان تکمیل (`status === 'completed'`).

### فاز ۳: سهمیه‌بندی و کنترل هم‌زمانی بر اساس User ID (اصل سوم)
- [x] `T3.1` بازنویسی میدلور `aiLimiter` در `server.ts` جهت نرخ‌بندی بر اساس `user_${req.user.id}` بجای IP اشتراکی سازمان.
- [x] `T3.2` پیاده‌سازی قفل هم‌زمانی تک‌کاربره (Single In-Flight Job per User) تا هر کاربر فقط یک کار هوش مصنوعی همزمان داشته باشد.
- [x] `T3.3` تفکیک سهمیه نقشی: سهمیه بالاتر برای مدیران و ناظر (`manager / viewer`) و سهمیه استاندارد برای کاربران عادی (`user`).

### فاز ۴: تست جامع و ثبت تصمیم معماری D43
- [x] `T4.1` اجرای تست‌های رگرسیون خودکار پروژه و صحت‌سنجی تایپ‌ها (`npx tsc --noEmit`).
- [x] `T4.2` اجرای بیلد پروداکشن (`npm run build`).
- [x] `T4.3` ثبت مستند معماری D43 در `.specify/decision.log`.
