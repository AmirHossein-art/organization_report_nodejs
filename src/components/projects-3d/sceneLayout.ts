export type Position3D = [number, number, number];

/**
 * پروژه اول نزدیک مرکز قرار می‌گیرد و پروژه‌های بعدی
 * روی یک مارپیچ فضایی توزیع می‌شوند.
 */
export function getProjectPosition(index: number): Position3D {
  if (index === 0) {
    return [0, 0, 0];
  }

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angle = index * goldenAngle;

  const radius = 8 + Math.sqrt(index) * 5;

  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;

  // اختلاف ارتفاع کنترل‌شده برای ایجاد عمق
  const y =
    ((index % 5) - 2) * 2.4 +
    Math.sin(index * 1.3) * 1.2;

  return [x, y, z];
}

/**
 * اندازه سیاره براساس تعداد گزارش‌ها و اقدامات آتی.
 * رشد اندازه محدود است تا پروژه‌های پرتعداد کل فضا را اشغال نکنند.
 */
export function getProjectPlanetRadius(
  reportsCount: number,
  actionsCount: number,
): number {
  const actionGrowth =
    Math.log2(actionsCount + 1) * 0.22;

  const reportGrowth =
    Math.min(reportsCount, 6) * 0.08;

  return Math.min(
    2.8,
    1.45 + actionGrowth + reportGrowth,
  );
}