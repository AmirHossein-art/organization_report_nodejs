// src/deadline.ts
// Centralized, timezone-strict deadline and grace period calculation engine for Asia/Tehran

export type ReportType = "weekly" | "monthly";
export type DeadlinePhase = "open" | "grace" | "closed";

export interface DeadlineSettingLike {
  id?: number;
  report_type: ReportType | string;
  deadline_day: number; // For weekly: 0=Saturday, 1=Sunday, ..., 6=Friday. For monthly: day of month (1-31)
  deadline_time: string; // HH:MM
  grace_days?: number; // Configurable grace days >= 0
}

export interface ReportPeriodLike {
  id?: number;
  title?: string;
  report_type: ReportType | string;
  period_start: Date | string;
  period_end: Date | string;
  is_open?: boolean;
  deadline_override_at?: Date | string | null;
  grace_days_override?: number | null;
}

export interface DeadlineState {
  deadlineAt: Date | null;
  graceUntil: Date | null;
  graceDays: number;
  isDeadlineOverridden: boolean;
  isGraceOverridden: boolean;
  phase: DeadlinePhase;
}

const TEHRAN_TIMEZONE = "Asia/Tehran";
const TEHRAN_OFFSET_STR = "+03:30";

/**
 * Ensures a 2-digit zero-padded string
 */
function pad(num: number): string {
  return String(num).padStart(2, "0");
}

/**
 * Extracts wall-clock date and time components in Asia/Tehran from a UTC Date object or ISO string.
 */
export function getTehranParts(dateInput: Date | string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  persianWeekday: number; // 0=Saturday, 1=Sunday, 2=Monday, 3=Tuesday, 4=Wednesday, 5=Thursday, 6=Friday
  jsWeekday: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
} {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date provided to getTehranParts: ${dateInput}`);
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;
  let second = 0;

  for (const part of parts) {
    if (part.type === "year") year = parseInt(part.value, 10);
    else if (part.type === "month") month = parseInt(part.value, 10);
    else if (part.type === "day") day = parseInt(part.value, 10);
    else if (part.type === "hour") hour = parseInt(part.value, 10);
    else if (part.type === "minute") minute = parseInt(part.value, 10);
    else if (part.type === "second") second = parseInt(part.value, 10);
  }

  // Calculate day of week for the Tehran calendar date (year-month-day)
  const utcCal = new Date(Date.UTC(year, month - 1, day));
  const jsWeekday = utcCal.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const persianWeekday = (jsWeekday + 1) % 7; // 0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    persianWeekday,
    jsWeekday,
  };
}

/**
 * Creates a UTC Date instant from explicit Asia/Tehran wall-clock components.
 */
export function createTehranDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): Date {
  const isoStr = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}${TEHRAN_OFFSET_STR}`;
  const dt = new Date(isoStr);
  if (isNaN(dt.getTime())) {
    throw new Error(`Failed to create valid Tehran date for: ${isoStr}`);
  }
  return dt;
}

/**
 * Parses user/admin input date and time strings into a UTC Date instant,
 * interpreting them as wall-clock time in Asia/Tehran.
 *
 * Supports:
 * - dateStr: "YYYY-MM-DD" or "YYYY/MM/DD"
 * - timeStr: "HH:MM" or "HH:MM:SS"
 */
export function parseTehranWallClock(dateStr: string, timeStr: string = "00:00"): Date {
  const cleanDate = dateStr.trim().replace(/\//g, "-");
  const dateParts = cleanDate.split("-").map((p) => parseInt(p, 10));
  if (dateParts.length !== 3 || dateParts.some((n) => isNaN(n))) {
    throw new Error(`Invalid date string: ${dateStr}. Expected YYYY-MM-DD`);
  }

  const cleanTime = timeStr.trim();
  const timeParts = cleanTime.split(":").map((p) => parseInt(p, 10));
  const hour = timeParts[0] ?? 0;
  const minute = timeParts[1] ?? 0;
  const second = timeParts[2] ?? 0;

  return createTehranDate(dateParts[0], dateParts[1], dateParts[2], hour, minute, second);
}

/**
 * Adds calendar days in Asia/Tehran to a date instant, strictly preserving the local wall-clock time.
 */
export function addTehranCalendarDays(date: Date, days: number): Date {
  if (days === 0) return new Date(date.getTime());

  const parts = getTehranParts(date);
  const nextCal = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  const nextYear = nextCal.getUTCFullYear();
  const nextMonth = nextCal.getUTCMonth() + 1;
  const nextDay = nextCal.getUTCDate();

  return createTehranDate(nextYear, nextMonth, nextDay, parts.hour, parts.minute, parts.second);
}

/**
 * Calculates the default deadline UTC Date for a reporting period based on global settings.
 */
export function getDefaultDeadline(
  periodEnd: Date | string,
  deadlineDay: number,
  deadlineTime: string,
  reportType: "weekly" | "monthly" | string
): Date {
  const endParts = getTehranParts(periodEnd);
  const [hours, minutes] = deadlineTime.split(":").map((n) => parseInt(n, 10) || 0);

  if (reportType === "weekly") {
    // Start from the calendar day following the period end in Tehran
    let curCal = new Date(Date.UTC(endParts.year, endParts.month - 1, endParts.day + 1));
    let curJsDay = curCal.getUTCDay();
    let curPersianDay = (curJsDay + 1) % 7;

    while (curPersianDay !== deadlineDay) {
      curCal = new Date(Date.UTC(curCal.getUTCFullYear(), curCal.getUTCMonth(), curCal.getUTCDate() + 1));
      curJsDay = curCal.getUTCDay();
      curPersianDay = (curJsDay + 1) % 7;
    }

    return createTehranDate(
      curCal.getUTCFullYear(),
      curCal.getUTCMonth() + 1,
      curCal.getUTCDate(),
      hours,
      minutes,
      0
    );
  } else {
    // Monthly calculation
    let targetYear = endParts.year;
    let targetMonth = endParts.month;

    if (deadlineDay <= endParts.day) {
      targetMonth += 1;
      if (targetMonth > 12) {
        targetMonth = 1;
        targetYear += 1;
      }
    }

    // Determine days in target month
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const targetDay = Math.min(deadlineDay, daysInTargetMonth);

    return createTehranDate(targetYear, targetMonth, targetDay, hours, minutes, 0);
  }
}

/**
 * Returns the effective main deadline date for a period (considering period-specific override).
 */
export function getEffectiveDeadline(
  period: ReportPeriodLike,
  setting?: DeadlineSettingLike | null
): Date | null {
  if (period.deadline_override_at) {
    const overrideDt = new Date(period.deadline_override_at);
    if (!isNaN(overrideDt.getTime())) {
      return overrideDt;
    }
  }

  if (setting && setting.deadline_day !== undefined && setting.deadline_time) {
    return getDefaultDeadline(
      period.period_end,
      setting.deadline_day,
      setting.deadline_time,
      period.report_type
    );
  }

  return null;
}

/**
 * Returns the effective grace days for a period (considering period-specific override).
 * Note: grace_days_override = 0 is an explicit override (no grace period), whereas null/undefined falls back to setting.
 */
export function getEffectiveGraceDays(
  period: ReportPeriodLike,
  setting?: DeadlineSettingLike | null
): number {
  if (period.grace_days_override !== null && period.grace_days_override !== undefined) {
    const parsed = Number(period.grace_days_override);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  if (setting && setting.grace_days !== null && setting.grace_days !== undefined) {
    const parsed = Number(setting.grace_days);
    return isNaN(parsed) ? 0 : Math.max(0, parsed);
  }

  return 0;
}

/**
 * Calculates the complete deadline state for a reporting period.
 */
export function getDeadlineState(
  period: ReportPeriodLike,
  setting?: DeadlineSettingLike | null,
  now: Date = new Date()
): DeadlineState {
  const deadlineAt = getEffectiveDeadline(period, setting);
  const graceDays = getEffectiveGraceDays(period, setting);
  const graceUntil = deadlineAt ? addTehranCalendarDays(deadlineAt, graceDays) : null;

  const isDeadlineOverridden = Boolean(
    period.deadline_override_at && !isNaN(new Date(period.deadline_override_at).getTime())
  );
  const isGraceOverridden = period.grace_days_override !== null && period.grace_days_override !== undefined;

  let phase: DeadlinePhase = "open";

  if (period.is_open === false) {
    phase = "closed";
  } else if (!deadlineAt || !graceUntil) {
    phase = "open";
  } else {
    const nowMs = now.getTime();
    const deadlineMs = deadlineAt.getTime();
    const graceMs = graceUntil.getTime();

    if (nowMs <= deadlineMs) {
      phase = "open";
    } else if (nowMs <= graceMs) {
      phase = "grace";
    } else {
      phase = "closed";
    }
  }

  return {
    deadlineAt,
    graceUntil,
    graceDays,
    isDeadlineOverridden,
    isGraceOverridden,
    phase,
  };
}
