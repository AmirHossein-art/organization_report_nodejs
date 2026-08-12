// src/views/ProjectKpiAnalytics.tsx
import { useState, useEffect } from "react";
import {
  Target,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Project } from "../types";
import { CustomSelect } from "../components";

// 🌐 تبدیل اعداد به فارسی
export const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return "";
  const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return n.toString().replace(/\d/g, (x) => farsiDigits[parseInt(x)]);
};

const INPUT_TYPE_LABELS: Record<string, string> = {
  direct: "مقدار مستقیم",
  percentage_change: "درصد تغییر نسبت به مبنا",
};

// تبدیل تاریخ میلادی (YYYY-MM-DD) به فرمت فارسی جلالی
const formatPersianDate = (value: string | null | undefined): string => {
  if (!value) return "بدون تاریخ";
  const date = new Date(value + "T00:00:00");
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date);
};

interface ProjectKpiAnalyticsProps {
  projects: Project[];
}

interface Kpi {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  unit: string;
  input_type: "direct" | "percentage_change";
  target_value: number;
  target_direction: "minimum" | "maximum";
  report_type: "weekly" | "monthly" | null;
  is_active: boolean;
  sort_order: number;
  project?: { id: number; title: string };
}

interface KpiValue {
  id: number;
  report_id: number;
  current_value: number | null;
  baseline_value: number | null;
  calculated_value: number | null;
  not_measured: boolean;
  missing_reason: string | null;
  period_end: string | null;
  period_title: string | null;
  report_type: string | null;
  user_full_name: string | null;
}

export default function ProjectKpiAnalytics({ projects = [] }: ProjectKpiAnalyticsProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [kpis, setKpis] = useState<Kpi[]>([]);

  const [selectedKpiId, setSelectedKpiId] = useState<number>(0);
  const [typeFilter, setTypeFilter] = useState<"all" | "weekly" | "monthly">("all");

  const [values, setValues] = useState<KpiValue[]>([]);
  const [kpiMeta, setKpiMeta] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState("");

  // واکشی شاخص‌های فعالِ پروژه‌ها
  useEffect(() => {
    if (projects.length > 0 && selectedProjectId === 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    setSelectedKpiId(0);
    setKpiMeta(null);
    setValues([]);
    if (!selectedProjectId) {
      setKpis([]);
      return;
    }
    fetch(`/api/projects/${selectedProjectId}/kpis`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Kpi[]) => setKpis(Array.isArray(data) ? data : []))
      .catch(() => setKpis([]));
  }, [selectedProjectId]);

  // واکشی مقادیر یک شاخص جهت نمودار
  useEffect(() => {
    if (!selectedKpiId) {
      setValues([]);
      setKpiMeta(null);
      return;
    }
    setLoading(true);
    setErrorMsg("");
    fetch(`/api/project-kpis/${selectedKpiId}/values`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setKpiMeta(data.kpi);
          setValues(Array.isArray(data.values) ? data.values : []);
        } else {
          setErrorMsg("خطا در دریافت مقادیر شاخص.");
        }
      })
      .catch(() => setErrorMsg("ارتباط با سرور برقرار نشد."))
      .finally(() => setLoading(false));
  }, [selectedKpiId]);

  // اعمال فیلتر نوع گزارش (هفتگی/ماهانه)
  const filteredValues = values.filter((v) => {
    if (typeFilter === "all") return true;
    return v.report_type === typeFilter;
  });

  // داده‌های نمودار — فقط موارد اندازه‌گیری‌شده، مرتب بر اساس پایان دوره
  const chartData = filteredValues
    .filter((v) => !v.not_measured && v.calculated_value !== null && v.period_end)
    .sort((a, b) => (a.period_end! < b.period_end! ? -1 : 1))
    .map((v) => ({
      period_end: v.period_end,
      period_title: v.period_title,
      value: Number(v.calculated_value),
    }));

  const measured = filteredValues.filter((v) => !v.not_measured && v.calculated_value !== null);
  const notMeasured = filteredValues.filter((v) => v.not_measured);

  // جدیدترین مقدار اندازه‌گیری‌شده
  const latest = measured.length > 0
    ? measured.slice().sort((a, b) => (a.period_end! < b.period_end! ? 1 : -1))[0]
    : null;

  // منطق تحقق هدف
  const computeAchieved = (calc: number | null): "achieved" | "not_achieved" | null => {
    if (calc === null || !kpiMeta) return null;
    const target = kpiMeta.target_value;
    return kpiMeta.target_direction === "minimum"
      ? (calc >= target ? "achieved" : "not_achieved")
      : (calc <= target ? "achieved" : "not_achieved");
  };

  const latestStatus = computeAchieved(latest ? Number(latest.calculated_value) : null);

  if (projects.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-700" />
            <span>تحلیل و روند شاخص‌های عملکرد</span>
          </h1>
        </div>
        <div className="bg-amber-50 text-amber-800 p-6 rounded-2xl border border-amber-200 flex gap-4">
          <AlertCircle className="w-6 h-6 flex-shrink-0 text-amber-600" />
          <div>
            <h4 className="font-bold">هیچ پروژه‌ای تعریف نشده است</h4>
            <p className="text-sm">برای مشاهده نمودار روند ابتدا پروژه ایجاد کنید.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-emerald-700" />
          <span>تحلیل و روند شاخص‌های عملکرد (KPI)</span>
        </h1>
        <p className="text-slate-500 text-xs mt-1">
          انتخاب پروژه و شاخص، مشاهده روند تغییرات در طول دوره‌های گزارش‌دهی و وضعیت تحقق هدف.
        </p>
      </div>

      {/* فیلترها */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1">پروژه</label>
          <CustomSelect
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(Number(val))}
            options={projects.map((p) => ({ value: p.id, label: p.title }))}
          />
        </div>
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1">شاخص</label>
          <CustomSelect
            value={selectedKpiId}
            onChange={(val) => setSelectedKpiId(Number(val))}
            options={[
              { value: 0, label: "-- انتخاب شاخص --" },
              ...kpis.map((k) => ({ value: k.id, label: k.name })),
            ]}
          />
        </div>
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1">فیلتر نوع گزارش</label>
          <CustomSelect
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as "all" | "weekly" | "monthly")}
            options={[
              { value: "all", label: "همه" },
              { value: "weekly", label: "هفتگی" },
              { value: "monthly", label: "ماهانه" },
            ]}
          />
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 text-rose-800 p-4 rounded-2xl border border-rose-200 flex gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200 p-8">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          <span>در حال بارگذاری داده‌ها...</span>
        </div>
      ) : !selectedKpiId ? (
        <div className="text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8">
          لطفاً یک شاخص را انتخاب کنید تا روند آن نمایش داده شود.
        </div>
      ) : (
        <>
          {/* کارت‌های خلاصه */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <span className="text-slate-400 text-xs font-semibold block">آخرین مقدار اندازه‌گیری‌شده</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {latest ? (
                  kpiMeta?.input_type === "percentage_change"
                    ? `${toPersianDigits(Number(latest.calculated_value).toFixed(1))}٪`
                    : `${toPersianDigits(Number(latest.calculated_value).toFixed(2))} ${kpiMeta?.unit || ""}`
                ) : "—"}
              </span>
            </div>
            <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-2xs">
              <span className="text-indigo-700 text-xs font-semibold block">مقدار هدف</span>
              <span className="text-2xl font-black text-indigo-700 mt-1 block">
                {kpiMeta ? `${toPersianDigits(kpiMeta.target_value)} ${kpiMeta.unit}` : "—"}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                جهت: {kpiMeta?.target_direction === "minimum" ? "حداقل" : "حداکثر"}
              </span>
            </div>
            <div className={`bg-white border rounded-2xl p-4 shadow-2xs ${
              latestStatus === "achieved" ? "border-emerald-100" : "border-rose-100"
            }`}>
              <span className="text-xs font-semibold block text-slate-400">وضعیت تحقق هدف</span>
              {latestStatus === null ? (
                <span className="text-2xl font-black text-slate-400 mt-1 block">اندازه‌گیری نشده</span>
              ) : latestStatus === "achieved" ? (
                <span className="text-lg font-black text-emerald-700 mt-2 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> محقق شده
                </span>
              ) : (
                <span className="text-lg font-black text-rose-600 mt-2 flex items-center gap-2">
                  <XCircle className="w-5 h-5" /> محقق نشده
                </span>
              )}
            </div>
          </div>

          {/* نمودار روند */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <TrendingUp className="w-4 h-4 text-emerald-700" />
              <span>روند شاخص «{kpiMeta?.name}» بر اساس پایان دوره</span>
            </h3>

            {chartData.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                هیچ مقدار اندازه‌گیری‌شده‌ای برای این شاخص و فیلتر انتخابی ثبت نشده است.
              </div>
            ) : (
              <div dir="ltr" className="w-full h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="period_end"
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      tickFormatter={(label) => formatPersianDate(label)}
                      reversed
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                    <Tooltip
                      contentStyle={{ direction: "rtl", fontFamily: "inherit", fontSize: 12 }}
                      labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
                      formatter={(value: any) => [
                        kpiMeta?.input_type === "percentage_change"
                          ? `${toPersianDigits(Number(value).toFixed(1))}٪`
                          : `${toPersianDigits(Number(value).toFixed(2))} ${kpiMeta?.unit || ""}`,
                        "مقدار"
                      ]}
                      labelFormatter={(label) => `پایان دوره: ${formatPersianDate(label)}`}
                    />
                    <Legend />
                    <ReferenceLine
                      y={kpiMeta?.target_value}
                      stroke="#6366f1"
                      strokeDasharray="5 4"
                      label={{ value: `هدف: ${toPersianDigits(kpiMeta?.target_value)}`, position: "insideTopRight", fontSize: 11, fill: "#6366f1" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="مقدار شاخص"
                      stroke="#059669"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: "#059669" }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              نوع محاسبه: {kpiMeta ? INPUT_TYPE_LABELS[kpiMeta.input_type] : ""}
              {kpiMeta?.input_type === "percentage_change" ? " (مقدار محاسبه‌شده = درصد تغییر)" : ""}
            </p>
          </div>

          {/* گزارش‌هایی که شاخص اندازه‌گیری نشده است */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6">
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>گزارش‌هایی که شاخص اندازه‌گیری نشده است</span>
              <span className="bg-rose-100 text-rose-700 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                {toPersianDigits(notMeasured.length)}
              </span>
            </h3>

            {notMeasured.length === 0 ? (
              <div className="text-center text-slate-400 py-6">موردی ثبت نشده است.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notMeasured.map((v) => (
                  <div key={v.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="text-slate-800 font-medium text-xs">{v.period_title || v.period_end}</p>
                      <p className="text-[11px] text-slate-500">گزارش‌دهنده: {v.user_full_name || "—"}</p>
                    </div>
                    <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-1 max-w-md">
                      {v.missing_reason || "دلیل ثبت نشده است."}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
