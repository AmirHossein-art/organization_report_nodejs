// dateUtils.ts

export const SHAMSI_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد",
  "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر",
  "دی", "بهمن", "اسفند"
];

export function isShamsiLeapYear(year: number): boolean {
  const r = year % 33;
  return r === 1 || r === 5 || r === 9 || r === 13 || r === 17 || r === 22 || r === 26 || r === 30;
}

export function getShamsiMonthDays(year: number, month: number): number {
  if (month >= 1 && month <= 6) return 31;
  if (month >= 7 && month <= 11) return 30;
  if (month === 12) {
    return isShamsiLeapYear(year) ? 30 : 29;
  }
  return 30;
}

export function gregorianToShamsi(dateStr: string): { year: number; month: number; day: number } | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const gy = parseInt(parts[0]);
  const gm = parseInt(parts[1]);
  const gd = parseInt(parts[2]);
  if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return null;

  const date = new Date(Date.UTC(gy, gm - 1, gd));
  if (isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'UTC'
  });

  const formattedParts = formatter.formatToParts(date);
  let year = 0, month = 0, day = 0;
  for (const part of formattedParts) {
    if (part.type === 'year') year = parseInt(part.value);
    if (part.type === 'month') month = parseInt(part.value);
    if (part.type === 'day') day = parseInt(part.value);
  }

  return { year, month, day };
}

export function shamsiToGregorian(jy: number, jm: number, jd: number): string {
  let j1 = jy - 979;
  let j2 = jm - 1;
  let j3 = jd - 1;

  let j_day_no = 365 * j1 + Math.floor(j1 / 33) * 8 + Math.floor(((j1 % 33) + 3) / 4);
  for (let i = 0; i < j2; ++i) {
    j_day_no += (i < 6) ? 31 : 30;
  }
  j_day_no += j3;

  let g_day_no = j_day_no + 79;

  let gy = 1600 + 400 * Math.floor(g_day_no / 146097); /* 146097 = 365*400 + 97 */
  g_day_no = g_day_no % 146097;

  let leap = true;
  if (g_day_no >= 36525) { /* 36525 = 365*100 + 25 - 1 */
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524); /* 36524 = 365*100 + 24 */
    g_day_no = g_day_no % 36524;

    if (g_day_no >= 365) {
      g_day_no++;
    } else {
      leap = false;
    }
  }

  gy += 4 * Math.floor(g_day_no / 1461); /* 1461 = 365*4 + 1 */
  g_day_no %= 1461;

  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }

  let i = 0;
  const sal_a = [0, 31, (leap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (i = 1; i <= 12; i++) {
    if (g_day_no < sal_a[i]) break;
    g_day_no -= sal_a[i];
  }
  let gd = g_day_no + 1;
  let gm = i;

  const pad = (num: number) => String(num).padStart(2, '0');
  return `${gy}-${pad(gm)}-${pad(gd)}`;
}

export function toPersianDigits(str: string | number): string {
  return String(str).replace(/[0-9]/g, (w) => ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'][parseInt(w)]);
}

export function toEnglishDigits(str: string): string {
  return str.replace(/[۰-۹]/g, (w) => String(['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'].indexOf(w)));
}

export function formatToShamsi(dateStr: string): string {
  if (!dateStr) return "";
  const shamsi = gregorianToShamsi(dateStr);
  if (!shamsi) return dateStr;
  
  const pad = (num: number) => String(num).padStart(2, '0');
  return toPersianDigits(`${shamsi.year}/${pad(shamsi.month)}/${pad(shamsi.day)}`);
}
