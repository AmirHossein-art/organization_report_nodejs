import test from "node:test";
import assert from "node:assert/strict";
import { formatProjectMemoryForPrompt } from "../src/services/projectMemory";

test("Unified AI: formatProjectMemoryForPrompt renders living dossier with DNA, bottlenecks, and reliability notes", () => {
  const dummyMemory: any = {
    id: 101,
    project_id: 25,
    dna_summary: "رگولاتوری و ساماندهی شرکت‌های فعال در حمل‌ونقل پاک",
    chronic_bottlenecks: "عدم هماهنگی بین‌بخشی با سازمان فاوا و طولانی شدن فرآیند تأییدات",
    reliability_notes: "نرخ وفای به عهد در ددلاین‌ها: ۷۵٪ (۳ از ۴ اقدام به موقع تکمیل شده)",
    lessons_learned: "برگزاری جلسات هفتگی هماهنگی با فاوا ریسک تأخیر را نصف می‌کند",
    version: 4,
  };

  const output = formatProjectMemoryForPrompt(dummyMemory);
  assert.ok(output.includes("Living Project Dossier"));
  assert.ok(output.includes("نسخه ۴"));
  assert.ok(output.includes("رگولاتوری"));
  assert.ok(output.includes("سازمان فاوا"));
  assert.ok(output.includes("۷۵٪"));
  assert.ok(output.includes("برگزاری جلسات هفتگی"));
});

test("Unified AI: atomic activities formatting with WBS links and scope creep flags", () => {
  // شبیه‌سازی تابع فرمت‌بندی فعالیت‌های اتمیک
  function formatAtomicActivities(activities: any[] | undefined): string {
    if (!Array.isArray(activities) || activities.length === 0) return "";
    return activities
      .map((act) => {
        let statusTag = "تطبیق‌یافته";
        if (act.status === "auto_confirmed") statusTag = "تطبیق خودکار WBS";
        else if (act.status === "confirmed" || act.status === "overridden") statusTag = "تأییدشده توسط مدیر";
        else if (act.status === "unmapped") statusTag = "⚠️ انحراف از محدوده WBS (خارج از ساختار شکست)";
        else if (act.status === "needs_review") statusTag = "نیازمند بازبینی تطبیق";

        const wbsRef = act.wbsNode?.code
          ? ` ➔ بسته کاری WBS [${act.wbsNode.code}: ${act.wbsNode.title}]`
          : " ➔ خارج از محدوده ساختار WBS";

        return `  • فعالیت ${act.line_number}: ${act.activity_text}${wbsRef} (${statusTag})`;
      })
      .join("\n");
  }

  const dummyActivities = [
    {
      line_number: 1,
      activity_text: "تنظیم پیش‌نویس بخشنامه رگولاتوری ناوگان برقی",
      status: "auto_confirmed",
      wbsNode: { code: "1.2", title: "تدوین چارچوب ضوابط و مقررات" },
    },
    {
      line_number: 2,
      activity_text: "خرید پذیرایی و اقلام اداری برای رویداد",
      status: "unmapped",
      wbsNode: null,
    },
    {
      line_number: 3,
      activity_text: "ارسال سند بازنگری‌شده به فاوا",
      status: "confirmed",
      wbsNode: { code: "1.3", title: "هماهنگی و اخذ تاییدات بین‌سازمانی" },
    },
  ];

  const formatted = formatAtomicActivities(dummyActivities);

  // فعالیت ۱ باید تایید خودکار و بسته کاری را نشان دهد
  assert.ok(formatted.includes("1.2: تدوین چارچوب ضوابط"));
  assert.ok(formatted.includes("تطبیق خودکار WBS"));

  // فعالیت ۲ باید پرچم انحراف از محدوده WBS داشته باشد
  assert.ok(formatted.includes("⚠️ انحراف از محدوده WBS"));
  assert.ok(formatted.includes("خارج از محدوده ساختار WBS"));

  // فعالیت ۳ باید تایید مدیر و بسته 1.3 را داشته باشد
  assert.ok(formatted.includes("1.3: هماهنگی و اخذ تاییدات"));
  assert.ok(formatted.includes("تأییدشده توسط مدیر"));
});

test("Unified AI: KPI 3-state evaluation logic prevents jargon and distinguishes empty vs unmeasured states", () => {
  function determineKpiEvaluationState(activeProjectKpis: any[], reportKpiValues: any[], kpiText?: string | null) {
    const hasReportedValues = reportKpiValues && reportKpiValues.some((kv: any) => !kv.not_measured && kv.current_value !== null && kv.current_value !== undefined);
    const hasKpiText = Boolean(kpiText && kpiText.trim());

    if (activeProjectKpis.length === 0 && !hasReportedValues && !hasKpiText) {
      return { state: "no_kpis", label: "وضعیت شاخص: ۱. کلاً شاخص عملکردی برای این پروژه در سامانه تعریف نشده است." };
    } else if (hasReportedValues) {
      return { state: "kpis_reported", label: "وضعیت شاخص: ۳. دارای شاخص عملکردی با مقادیر ثبت‌شده در این گزارش" };
    } else if (activeProjectKpis.length > 0) {
      return { state: "kpis_unreported", label: `وضعیت شاخص: ۲. پروژه دارای ${activeProjectKpis.length} شاخص عملکردی در سامانه است ولی در این گزارش مقداری برای آن‌ها ثبت نشده است` };
    } else if (hasKpiText) {
      return { state: "kpis_reported", label: "وضعیت شاخص: ۳. دارای شاخص عملکردی (متن آزاد)" };
    }
    return { state: "no_kpis", label: "فاقد شاخص عملکردی" };
  }

  // حالت ۱: کلاً شاخص ندارد
  const case1 = determineKpiEvaluationState([], []);
  assert.equal(case1.state, "no_kpis");
  assert.ok(case1.label.includes("کلاً شاخص عملکردی برای این پروژه در سامانه تعریف نشده است"));
  assert.ok(!case1.label.includes("مصوب"));

  // حالت ۲: شاخص دارد ولی در گزارش مقداری ثبت نشده
  const case2 = determineKpiEvaluationState([{ id: 1, name: "تعداد ناوگان" }], []);
  assert.equal(case2.state, "kpis_unreported");
  assert.ok(case2.label.includes("مقداری برای آن‌ها ثبت نشده است"));
  assert.ok(!case2.label.includes("مصوب"));

  // حالت ۳: شاخص دارد و مقدار گزارش شده
  const case3 = determineKpiEvaluationState(
    [{ id: 1, name: "تعداد ناوگان" }],
    [{ kpi_id: 1, current_value: 120, not_measured: false }]
  );
  assert.equal(case3.state, "kpis_reported");
  assert.ok(case3.label.includes("دارای شاخص عملکردی با مقادیر ثبت‌شده"));
  assert.ok(!case3.label.includes("مصوب"));
});
