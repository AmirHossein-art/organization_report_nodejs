// scripts/test-deadline-logic.ts
import {
  getDeadlineState,
  getDefaultDeadline,
  getEffectiveDeadline,
  getEffectiveGraceDays,
  addTehranCalendarDays,
  parseTehranWallClock,
  getTehranParts,
  createTehranDate,
  DeadlineSettingLike,
  ReportPeriodLike,
} from "../src/deadline";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function runTests() {
  console.log("==========================================");
  console.log("Running Deadline & Grace Period Test Suite");
  console.log("==========================================\n");

  // Global Settings for Weekly
  // deadline_day: 3 (Tuesday in Persian week: 0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri)
  const weeklySetting: DeadlineSettingLike = {
    report_type: "weekly",
    deadline_day: 3, // Tuesday
    deadline_time: "14:00",
    grace_days: 1,
  };

  // Sample period ending on Sunday 2026-07-05 (1405-04-14)
  const baseWeeklyPeriod: ReportPeriodLike = {
    id: 1,
    title: "هفته دوم تیر ۱۴۰۵",
    report_type: "weekly",
    period_start: "2026-06-29T00:00:00.000Z",
    period_end: "2026-07-05T00:00:00.000Z",
    is_open: true,
  };

  // ----------------------------------------------------
  // Test A: Normal Weekly Deadline (Tuesday 14:00 + 1 day grace)
  // ----------------------------------------------------
  console.log("--- Test A: Normal weekly deadline (Tuesday 14:00, Grace = 1 day) ---");
  const stateA = getDeadlineState(baseWeeklyPeriod, weeklySetting);
  assert(stateA.deadlineAt !== null, "deadlineAt is computed");
  assert(stateA.graceUntil !== null, "graceUntil is computed");
  assert(stateA.graceDays === 1, "graceDays is 1");

  const partsDeadlineA = getTehranParts(stateA.deadlineAt!);
  assert(partsDeadlineA.year === 2026 && partsDeadlineA.month === 7 && partsDeadlineA.day === 7, "Main deadline date is 2026-07-07 (Tuesday)");
  assert(partsDeadlineA.hour === 14 && partsDeadlineA.minute === 0, "Main deadline time is 14:00 Tehran");

  const partsGraceA = getTehranParts(stateA.graceUntil!);
  assert(partsGraceA.year === 2026 && partsGraceA.month === 7 && partsGraceA.day === 8, "Grace cutoff date is 2026-07-08 (Wednesday)");
  assert(partsGraceA.hour === 14 && partsGraceA.minute === 0, "Grace cutoff time is 14:00 Tehran");

  // Tuesday 13:59 -> open / on time
  const tTue1359 = createTehranDate(2026, 7, 7, 13, 59, 0);
  assert(getDeadlineState(baseWeeklyPeriod, weeklySetting, tTue1359).phase === "open", "Tuesday 13:59 -> open");

  // Tuesday 14:00 -> open / on time
  const tTue1400 = createTehranDate(2026, 7, 7, 14, 0, 0);
  assert(getDeadlineState(baseWeeklyPeriod, weeklySetting, tTue1400).phase === "open", "Tuesday 14:00 -> open");

  // Tuesday 14:01 -> grace / late
  const tTue1401 = createTehranDate(2026, 7, 7, 14, 1, 0);
  assert(getDeadlineState(baseWeeklyPeriod, weeklySetting, tTue1401).phase === "grace", "Tuesday 14:01 -> grace");

  // Wednesday 13:59 -> grace / late
  const tWed1359 = createTehranDate(2026, 7, 8, 13, 59, 0);
  assert(getDeadlineState(baseWeeklyPeriod, weeklySetting, tWed1359).phase === "grace", "Wednesday 13:59 -> grace");

  // Wednesday 14:00 -> grace / late
  const tWed1400 = createTehranDate(2026, 7, 8, 14, 0, 0);
  assert(getDeadlineState(baseWeeklyPeriod, weeklySetting, tWed1400).phase === "grace", "Wednesday 14:00 -> grace");

  // Wednesday 14:01 -> closed
  const tWed1401 = createTehranDate(2026, 7, 8, 14, 1, 0);
  assert(getDeadlineState(baseWeeklyPeriod, weeklySetting, tWed1401).phase === "closed", "Wednesday 14:01 -> closed");

  // ----------------------------------------------------
  // Test B: No Grace (Grace = 0)
  // ----------------------------------------------------
  console.log("\n--- Test B: No grace (Grace = 0) ---");
  const noGraceSetting: DeadlineSettingLike = {
    ...weeklySetting,
    grace_days: 0,
  };
  const stateB = getDeadlineState(baseWeeklyPeriod, noGraceSetting);
  assert(stateB.graceDays === 0, "Effective grace days is 0");
  assert(stateB.deadlineAt?.getTime() === stateB.graceUntil?.getTime(), "graceUntil equals deadlineAt when grace = 0");

  assert(getDeadlineState(baseWeeklyPeriod, noGraceSetting, tTue1400).phase === "open", "Tuesday 14:00:00 is allowed (open)");
  assert(getDeadlineState(baseWeeklyPeriod, noGraceSetting, createTehranDate(2026, 7, 7, 14, 0, 1)).phase === "closed", "Tuesday 14:00:01 is closed");
  assert(getDeadlineState(baseWeeklyPeriod, noGraceSetting, tTue1401).phase === "closed", "Tuesday 14:01 is closed");

  // ----------------------------------------------------
  // Test C: Weekly Exception (deadline_override_at = Wednesday 14:00)
  // ----------------------------------------------------
  console.log("\n--- Test C: Weekly exception (Per-period deadline override) ---");
  const overriddenPeriod: ReportPeriodLike = {
    ...baseWeeklyPeriod,
    id: 2,
    deadline_override_at: parseTehranWallClock("2026-07-08", "14:00"), // Wednesday 14:00
  };
  const stateC = getDeadlineState(overriddenPeriod, weeklySetting);
  assert(stateC.isDeadlineOverridden === true, "isDeadlineOverridden is true");

  const partsDeadlineC = getTehranParts(stateC.deadlineAt!);
  assert(partsDeadlineC.year === 2026 && partsDeadlineC.month === 7 && partsDeadlineC.day === 8 && partsDeadlineC.hour === 14, "Overridden deadline is Wednesday 14:00");

  const partsGraceC = getTehranParts(stateC.graceUntil!);
  assert(partsGraceC.year === 2026 && partsGraceC.month === 7 && partsGraceC.day === 9 && partsGraceC.hour === 14, "Grace until is Thursday 14:00");

  // Other weekly period must remain unaffected
  const stateOther = getDeadlineState(baseWeeklyPeriod, weeklySetting);
  const partsOther = getTehranParts(stateOther.deadlineAt!);
  assert(partsOther.day === 7, "Other periods still have Tuesday deadline");

  // ----------------------------------------------------
  // Test D: Grace Override (grace_days_override = 2)
  // ----------------------------------------------------
  console.log("\n--- Test D: Grace override (grace_days_override = 2) ---");
  const graceOverriddenPeriod: ReportPeriodLike = {
    ...baseWeeklyPeriod,
    id: 3,
    grace_days_override: 2,
  };
  const stateD = getDeadlineState(graceOverriddenPeriod, weeklySetting);
  assert(stateD.isGraceOverridden === true, "isGraceOverridden is true");
  assert(stateD.graceDays === 2, "graceDays is 2");

  const partsGraceD = getTehranParts(stateD.graceUntil!);
  assert(partsGraceD.year === 2026 && partsGraceD.month === 7 && partsGraceD.day === 9 && partsGraceD.hour === 14, "Final cutoff is Thursday 14:00 (Tuesday + 2 days)");

  // ----------------------------------------------------
  // Test E: Explicit Zero Override (grace_days_override = 0 vs null)
  // ----------------------------------------------------
  console.log("\n--- Test E: Explicit zero override (grace_days_override = 0) ---");
  const zeroGraceOverridePeriod: ReportPeriodLike = {
    ...baseWeeklyPeriod,
    id: 4,
    grace_days_override: 0,
  };
  const settingWithGrace: DeadlineSettingLike = {
    ...weeklySetting,
    grace_days: 3,
  };
  const stateE = getDeadlineState(zeroGraceOverridePeriod, settingWithGrace);
  assert(stateE.isGraceOverridden === true, "isGraceOverridden is true for 0");
  assert(stateE.graceDays === 0, "graceDays is 0 despite global setting being 3");
  assert(getDeadlineState(zeroGraceOverridePeriod, settingWithGrace, createTehranDate(2026, 7, 7, 14, 0, 1)).phase === "closed", "Closed immediately after deadline");

  // Null grace_days_override should fallback to setting
  const nullGraceOverridePeriod: ReportPeriodLike = {
    ...baseWeeklyPeriod,
    id: 5,
    grace_days_override: null,
  };
  const stateNull = getDeadlineState(nullGraceOverridePeriod, settingWithGrace);
  assert(stateNull.isGraceOverridden === false, "isGraceOverridden is false for null");
  assert(stateNull.graceDays === 3, "graceDays falls back to global setting 3");

  // ----------------------------------------------------
  // Test F: Master Period Close (is_open = false)
  // ----------------------------------------------------
  console.log("\n--- Test F: Master killswitch (is_open = false) ---");
  const closedPeriod: ReportPeriodLike = {
    ...baseWeeklyPeriod,
    id: 6,
    is_open: false,
  };
  const stateF = getDeadlineState(closedPeriod, weeklySetting, tTue1359);
  assert(stateF.phase === "closed", "phase is closed when is_open = false, even before deadline");

  // ----------------------------------------------------
  // Test G: Boundary & Timezone Precision
  // ----------------------------------------------------
  console.log("\n--- Test G: Boundary & Timezone Precision ---");
  const parsedUtc = parseTehranWallClock("2026-07-07", "14:00");
  assert(parsedUtc.toISOString() === "2026-07-07T10:30:00.000Z", "parseTehranWallClock produces exact UTC 10:30 instant");

  const plusOneDay = addTehranCalendarDays(parsedUtc, 1);
  assert(plusOneDay.toISOString() === "2026-07-08T10:30:00.000Z", "addTehranCalendarDays preserves Tehran 14:00 wall-clock");

  // Month-end rollover in Tehran
  const monthEndUtc = parseTehranWallClock("2026-07-31", "18:00");
  const rollover = addTehranCalendarDays(monthEndUtc, 1);
  const rolloverParts = getTehranParts(rollover);
  assert(rolloverParts.year === 2026 && rolloverParts.month === 8 && rolloverParts.day === 1 && rolloverParts.hour === 18, "Rollover advances from July 31 to August 1 at 18:00 Tehran");

  // ----------------------------------------------------
  // Test H: Monthly Deadline (Global grace, override_at, grace_override, grace_override=0)
  // ----------------------------------------------------
  console.log("\n--- Test H: Monthly Deadline ---");
  const monthlySetting: DeadlineSettingLike = {
    report_type: "monthly",
    deadline_day: 30,
    deadline_time: "16:00",
    grace_days: 2,
  };

  // Period ending 2026-07-22
  const baseMonthlyPeriod: ReportPeriodLike = {
    id: 10,
    title: "تیر ۱۴۰۵",
    report_type: "monthly",
    period_start: "2026-06-22T00:00:00.000Z",
    period_end: "2026-07-22T00:00:00.000Z",
    is_open: true,
  };

  const stateH1 = getDeadlineState(baseMonthlyPeriod, monthlySetting);
  assert(stateH1.deadlineAt !== null, "Monthly deadline is calculated");
  const partsH1 = getTehranParts(stateH1.deadlineAt!);
  assert(partsH1.year === 2026 && partsH1.month === 7 && partsH1.day === 30 && partsH1.hour === 16, "Monthly deadline is 2026-07-30 16:00 Tehran (since deadline day 30 > end day 22)");

  const gracePartsH1 = getTehranParts(stateH1.graceUntil!);
  assert(gracePartsH1.year === 2026 && gracePartsH1.month === 8 && gracePartsH1.day === 1 && gracePartsH1.hour === 16, "Grace until is 2026-08-01 16:00 (July 30 + 2 calendar days)");

  // Monthly test where deadlineDay <= periodEnd day (advancing to next month)
  const monthlyEarlyDaySetting: DeadlineSettingLike = {
    ...monthlySetting,
    deadline_day: 5,
  };
  const stateH1NextMonth = getDeadlineState(baseMonthlyPeriod, monthlyEarlyDaySetting);
  const partsH1Next = getTehranParts(stateH1NextMonth.deadlineAt!);
  assert(partsH1Next.year === 2026 && partsH1Next.month === 8 && partsH1Next.day === 5, "Monthly deadline advances to 2026-08-05 when deadline day 5 <= end day 22");

  // Monthly with deadline_override_at
  const overriddenMonthly: ReportPeriodLike = {
    ...baseMonthlyPeriod,
    deadline_override_at: parseTehranWallClock("2026-09-05", "12:00"),
  };
  const stateH2 = getDeadlineState(overriddenMonthly, monthlySetting);
  const partsH2 = getTehranParts(stateH2.deadlineAt!);
  assert(partsH2.year === 2026 && partsH2.month === 9 && partsH2.day === 5 && partsH2.hour === 12, "Monthly deadline override works");
  const gracePartsH2 = getTehranParts(stateH2.graceUntil!);
  assert(gracePartsH2.day === 7 && gracePartsH2.hour === 12, "Monthly grace cutoff preserves 12:00 Tehran time");

  // Monthly with grace_days_override = 3
  const graceOverrideMonthly: ReportPeriodLike = {
    ...baseMonthlyPeriod,
    grace_days_override: 3,
  };
  const stateH3 = getDeadlineState(graceOverrideMonthly, monthlySetting);
  assert(stateH3.graceDays === 3, "Monthly grace days override is 3");
  const gracePartsH3 = getTehranParts(stateH3.graceUntil!);
  assert(gracePartsH3.year === 2026 && gracePartsH3.month === 8 && gracePartsH3.day === 2 && gracePartsH3.hour === 16, "Monthly cutoff is Aug 2 (July 30 + 3 calendar days)");

  // Monthly with grace_days_override = 0
  const zeroGraceMonthly: ReportPeriodLike = {
    ...baseMonthlyPeriod,
    grace_days_override: 0,
  };
  const stateH4 = getDeadlineState(zeroGraceMonthly, monthlySetting);
  assert(stateH4.graceDays === 0, "Monthly grace days override = 0 works");
  assert(stateH4.deadlineAt?.getTime() === stateH4.graceUntil?.getTime(), "Monthly cutoff equals deadline when grace_override = 0");

  console.log("\n==========================================");
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log("==========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
