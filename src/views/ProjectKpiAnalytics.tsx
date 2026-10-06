// src/views/ProjectKpiAnalytics.tsx
import { useState, useEffect } from "react";
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Layers,
  Calculator,
  Building2,
  ChevronDown,
  ChevronUp,
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
import {
  Project,
  User,
  CompositeKpi,
  CompositeOperator,
  CompositeKpiValueDetail,
} from "../types";
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

const OPERATOR_CONFIG: Record<
  CompositeOperator,
  {
    label: string;
    symbol: string;
    desc: string;
    badgeClass: string;
  }
> = {
  sum: {
    label: "جمع مقادیر",
    symbol: "+",
    desc: "مجموع مقادیر تمامی شاخص‌ها",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  average: {
    label: "میانگین حسابی",
    symbol: "Avg",
    desc: "معدل شاخص‌های انتخاب‌شده",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  difference: {
    label: "تفریق مقادیر",
    symbol: "−",
    desc: "شاخص اول منهای سایر شاخص‌ها",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
  multiply: {
    label: "ضرب مقادیر",
    symbol: "×",
    desc: "حاصل‌ضرب مقادیر شاخص‌ها",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
  ratio_percentage: {
    label: "نسبت درصدی",
    symbol: "%",
    desc: "نسبت شاخص اول به دوم × ۱۰۰",
    badgeClass: "bg-indigo-50 text-indigo-800 border-indigo-200",
  },
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
  currentUser?: User | null;
}

interface Kpi {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  unit: string;
  input_type: "direct" | "percentage_change";
  baseline_value?: number | null;
  target_value?: number | null;
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

export default function ProjectKpiAnalytics({
  projects = [],
  currentUser,
}: ProjectKpiAnalyticsProps) {
  const isManager = currentUser?.role === "manager";
  const [analyticsScope, setAnalyticsScope] = useState<"project" | "composite">("project");

  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [kpis, setKpis] = useState<Kpi[]>([]);

  const [selectedKpiId, setSelectedKpiId] = useState<number>(0);
  const [typeFilter, setTypeFilter] = useState<"all" | "weekly" | "monthly">("all");

  const [values, setValues] = useState<KpiValue[]>([]);
  const [kpiMeta, setKpiMeta] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState("");

  // استیت‌های شاخص‌های ترکیبی
  const [compositeKpis, setCompositeKpis] = useState<CompositeKpi[]>([]);
  const [selectedCompositeId, setSelectedCompositeId] = useState<number>(0);
  const [compositeDetail, setCompositeDetail] = useState<any | null>(null);
  const [compositeLoading, setCompositeLoading] = useState<boolean>(false);
  const [compositeError, setCompositeError] = useState<string>("");
  const [expandedPeriodRowId, setExpandedPeriodRowId] = useState<number | null>(null);

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

  // واکشی لیست شاخص‌های ترکیبی
  const fetchCompositeList = async () => {
    try {
      const res = await fetch("/api/composite-kpis");
      if (res.ok) {
        const data = await res.json();
        setCompositeKpis(data);
        if (data.length > 0 && selectedCompositeId === 0) {
          setSelectedCompositeId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching composite KPIs:", err);
    }
  };

  useEffect(() => {
    if (analyticsScope === "composite" && isManager) {
      fetchCompositeList();
    }
  }, [analyticsScope, isManager]);

  // واکشی تاریخچه و جزئیات شاخص ترکیبی انتخابی
  useEffect(() => {
    if (analyticsScope !== "composite" || !selectedCompositeId) {
      setCompositeDetail(null);
      return;
    }
    setCompositeLoading(true);
    setCompositeError("");
    setExpandedPeriodRowId(null);
    fetch(`/api/composite-kpis/${selectedCompositeId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setCompositeDetail(data);
        } else {
          setCompositeError("خطا در دریافت جزئیات شاخص ترکیبی.");
        }
      })
      .catch(() => setCompositeError("ارتباط با سرور برقرار نشد."))
      .finally(() => setCompositeLoading(false));
  }, [selectedCompositeId, analyticsScope]);

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
    if (calc === null || !kpiMeta || kpiMeta.target_value === null || kpiMeta.target_value === undefined) return null;
    const target = kpiMeta.target_value;
    return kpiMeta.target_direction === "minimum"
      ? (calc >= target ? "achieved" : "not_achieved")
      : (calc <= target ? "achieved" : "not_achieved");
  };

  const latestStatus = computeAchieved(latest ? Number(latest.calculated_value) : null);

  // محاسبه مبنا و رشد نسبت به مبنا برای آخرین دوره اندازه‌گیری‌شده
  const baselineValue = kpiMeta?.baseline_value ?? (latest?.baseline_value ?? null);
  let growthLabel: string | null = null;
  let growthPositive: boolean | null = null;
  if (latest && baselineValue !== null && baselineValue !== undefined) {
    if (kpiMeta?.input_type === "direct") {
      const current = Number(latest.current_value ?? latest.calculated_value);
      const diff = current - Number(baselineValue);
      const sign = diff > 0 ? "+" : "";
      growthLabel = `${sign}${toPersianDigits(diff.toFixed(2))} ${kpiMeta?.unit || ""}`;
      growthPositive = diff >= 0;
    } else {
      const calc = Number(latest.calculated_value);
      const sign = calc > 0 ? "+" : "";
      growthLabel = `${sign}${toPersianDigits(calc.toFixed(1))}٪`;
      growthPositive = calc >= 0;
    }
  }

  // ===================== محاسبات تحلیلی شاخص ترکیبی =====================
  const compositeValues = compositeDetail?.values || [];
  const compositeChartData = compositeValues
    .filter((v: any) => v.calculated_value !== null)
    .map((v: any) => ({
      period_title: v.period?.title || "دوره",
      period_end: v.period?.period_end,
      value: v.calculated_value,
      status: v.status,
    }));

  const latestCompositeValueRecord = compositeValues.length > 0
    ? compositeValues[compositeValues.length - 1]
    : null;

  const latestCompositeNum = latestCompositeValueRecord?.calculated_value ?? null;

  const computeCompositeAchieved = (calc: number | null, comp: any): "achieved" | "not_achieved" | null => {
    if (calc === null || !comp || comp.target_value === null || comp.target_value === undefined) return null;
    const target = Number(comp.target_value);
    return comp.target_direction === "minimum"
      ? (calc >= target ? "achieved" : "not_achieved")
      : (calc <= target ? "achieved" : "not_achieved");
  };

  const compositeAchievementStatus = computeCompositeAchieved(latestCompositeNum, compositeDetail);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-700" />
            <span>تحلیل و پایش شاخص‌های عملکرد (KPI)</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            مشاهده روند تغییرات در طول دوره‌های گزارش‌دهی، وضعیت تحقق هدف و تفکیک شاخص‌های پروژه‌ای و کلان سازمانی.
          </p>
        </div>

        {/* سوئیچر تفکیک: شاخص‌های پروژه vs شاخص‌های ترکیبی مدیریتی */}
        {isManager && (
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setAnalyticsScope("project")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                analyticsScope === "project"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <span>شاخص‌های پروژه‌ها</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsScope("composite")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                analyticsScope === "composite"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>شاخص‌های ترکیبی مدیریتی</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 📊 بخش ۱: پایش شاخص‌های پروژه‌ای (Project Scope) */}
      {/* ========================================================================= */}
      {analyticsScope === "project" && (
        <>
          {/* فیلترها */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1">پروژه</label>
          <CustomSelect
            value={selectedProjectId}
            onChange={(val) => setSelectedProjectId(Number(val))}
            options={projects.filter((p) => p.is_active !== false).map((p) => ({ value: p.id, label: p.title }))}
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
          {/* کارت‌های خلاصه */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* کارت ۱: مقدار مبنای اولیه */}
            <div className="bg-white border border-amber-200/80 rounded-2xl p-4 shadow-2xs">
              <span className="text-amber-700 text-xs font-semibold block">مقدار مبنا (پایه)</span>
              <span className="text-2xl font-black text-amber-900 mt-1 block">
                {baselineValue !== null && baselineValue !== undefined
                  ? `${toPersianDigits(baselineValue)} ${kpiMeta?.unit || ""}`
                  : "تعریف نشده"}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                نقطه شروع سنجش پیشرفت
              </span>
            </div>

            {/* کارت ۲: آخرین مقدار */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs">
              <span className="text-slate-400 text-xs font-semibold block">آخرین مقدار اندازه‌گیری‌شده</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">
                {latest ? (
                  kpiMeta?.input_type === "percentage_change"
                    ? `${toPersianDigits(Number(latest.calculated_value).toFixed(1))}٪`
                    : `${toPersianDigits(Number(latest.calculated_value).toFixed(2))} ${kpiMeta?.unit || ""}`
                ) : "—"}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {latest?.period_title ? `دوره: ${latest.period_title}` : "ثبت در آخرین گزارش"}
              </span>
            </div>

            {/* کارت ۳: رشد نسبت به مبنا */}
            <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-2xs">
              <span className="text-emerald-700 text-xs font-semibold block">رشد نسبت به مبنا</span>
              <span className={`text-2xl font-black mt-1 block ${
                growthPositive === null ? "text-slate-400" : growthPositive ? "text-emerald-700" : "text-rose-600"
              }`}>
                {growthLabel || "—"}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {kpiMeta?.input_type === "direct" ? "افزایش مطلق نسبت به مبنا" : "رشد درصدی نسبت به مبنا"}
              </span>
            </div>

            {/* کارت ۴: مقدار هدف و تحقق */}
            <div className={`bg-white border rounded-2xl p-4 shadow-2xs ${
              latestStatus === "achieved" ? "border-emerald-200" : "border-indigo-100"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-indigo-700 text-xs font-semibold">مقدار هدف ({kpiMeta?.target_direction === "minimum" ? "حداقل" : "حداکثر"})</span>
                {latestStatus === "achieved" ? (
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" /> محقق شده
                  </span>
                ) : latestStatus === "not_achieved" ? (
                  <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                    <XCircle className="w-3.5 h-3.5" /> محقق نشده
                  </span>
                ) : null}
              </div>
              <span className="text-2xl font-black text-indigo-700 mt-1 block">
                {kpiMeta && kpiMeta.target_value !== null && kpiMeta.target_value !== undefined
                  ? `${toPersianDigits(kpiMeta.target_value)} ${kpiMeta.unit}`
                  : "تعیین‌نشده"}
              </span>
              <span className="text-[11px] text-slate-400 block mt-1">
                {latestStatus === null
                  ? (kpiMeta?.target_value == null ? "شاخص فاقد مقدار هدف است" : "اندازه‌گیری نشده")
                  : latestStatus === "achieved"
                  ? "هدف دوره پوشش داده شد"
                  : "نیاز به تلاش تا دستیابی به هدف"}
              </span>
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
                    {baselineValue !== null && baselineValue !== undefined && (
                      <ReferenceLine
                        y={Number(baselineValue)}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        label={{
                          value: `مبنا: ${toPersianDigits(baselineValue)}`,
                          position: "insideBottomRight",
                          fontSize: 11,
                          fill: "#d97706",
                        }}
                      />
                    )}
                    {kpiMeta?.target_value !== null && kpiMeta?.target_value !== undefined && (
                      <ReferenceLine
                        y={kpiMeta.target_value}
                        stroke="#6366f1"
                        strokeDasharray="5 4"
                        label={{ value: `هدف: ${toPersianDigits(kpiMeta.target_value)}`, position: "insideTopRight", fontSize: 11, fill: "#6366f1" }}
                      />
                    )}
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
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-2 flex-wrap">
              <span>نوع محاسبه: {kpiMeta ? INPUT_TYPE_LABELS[kpiMeta.input_type] : ""}</span>
              {kpiMeta?.input_type === "percentage_change" && <span>(مقدار محاسبه‌شده = درصد تغییر)</span>}
              {baselineValue !== null && baselineValue !== undefined && (
                <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-semibold">
                  مبنای پایه: {toPersianDigits(baselineValue)} {kpiMeta?.unit || ""}
                </span>
              )}
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
    </>
  )}

      {/* ========================================================================= */}
      {/* 🔗 بخش ۲: پایش شاخص‌های ترکیبی مدیریتی (Composite Scope) */}
      {/* ========================================================================= */}
      {analyticsScope === "composite" && isManager && (
        <>
          {/* فیلتر شاخص ترکیبی */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="w-full sm:w-96">
              <label className="block text-slate-700 text-sm font-medium mb-1">انتخاب شاخص ترکیبی</label>
              <CustomSelect
                value={selectedCompositeId}
                onChange={(val) => setSelectedCompositeId(Number(val))}
                options={[
                  { value: 0, label: "-- انتخاب شاخص ترکیبی --" },
                  ...compositeKpis.map((c) => ({
                    value: c.id,
                    label: `${c.name} (${OPERATOR_CONFIG[c.operator]?.label || c.operator})`,
                  })),
                ]}
              />
            </div>

            {compositeDetail && (
              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border flex items-center gap-1.5 ${
                    OPERATOR_CONFIG[compositeDetail.operator as CompositeOperator]?.badgeClass || "bg-slate-50"
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>{OPERATOR_CONFIG[compositeDetail.operator as CompositeOperator]?.label}</span>
                  <span className="font-black text-sm">
                    ({OPERATOR_CONFIG[compositeDetail.operator as CompositeOperator]?.symbol})
                  </span>
                </span>
                <span className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
                  {toPersianDigits(compositeDetail.items?.length || 0)} جزء سازنده
                </span>
              </div>
            )}
          </div>

          {compositeError && (
            <div className="bg-rose-50 text-rose-800 p-4 rounded-2xl border border-rose-200 flex gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{compositeError}</span>
            </div>
          )}

          {compositeLoading ? (
            <div className="text-center text-slate-400 flex items-center justify-center gap-2 bg-white rounded-2xl border border-slate-200 p-8">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span>در حال بارگذاری داده‌های شاخص ترکیبی...</span>
            </div>
          ) : !selectedCompositeId || !compositeDetail ? (
            <div className="text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8">
              لطفاً یک شاخص ترکیبی را از کادر بالا انتخاب کنید.
            </div>
          ) : (
            <>
              {/* کارت‌های خلاصه شاخص ترکیبی */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* کارت ۱: آخرین مقدار ترکیبی محاسبه‌شده */}
                <div className="bg-white border border-emerald-200/80 rounded-2xl p-4 shadow-2xs">
                  <span className="text-emerald-700 text-xs font-semibold block">آخرین عملکرد تجمیعی</span>
                  <span className="text-2xl font-black text-emerald-950 mt-1 block">
                    {latestCompositeNum !== null
                      ? `${toPersianDigits(latestCompositeNum)} ${compositeDetail.unit}`
                      : "—"}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {latestCompositeValueRecord?.period?.title
                      ? `دوره: ${latestCompositeValueRecord.period.title}`
                      : "بدون محاسبه دوره‌ای"}
                  </span>
                </div>

                {/* کارت ۲: هدف و تحقق */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 text-xs font-semibold">هدف کلان</span>
                    {compositeAchievementStatus === "achieved" ? (
                      <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" /> محقق شده
                      </span>
                    ) : compositeAchievementStatus === "not_achieved" ? (
                      <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                        <XCircle className="w-3.5 h-3.5" /> محقق نشده
                      </span>
                    ) : null}
                  </div>
                  <span className="text-2xl font-black text-indigo-700 mt-1 block">
                    {compositeDetail.target_value !== null && compositeDetail.target_value !== undefined
                      ? `${toPersianDigits(compositeDetail.target_value)} ${compositeDetail.unit}`
                      : "تعیین‌نشده"}
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {compositeAchievementStatus === null
                      ? compositeDetail.target_value == null ? "فاقد مقدار هدف" : "اندازه‌گیری نشده"
                      : compositeAchievementStatus === "achieved"
                      ? "هدف سازمان پوشش داده شد"
                      : "نیازمند پایش برای دستیابی"}
                  </span>
                </div>

                {/* کارت ۳: عملگر و ساختار */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-slate-600 text-xs font-semibold block">روش تلفیق ریاضی</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl font-black text-slate-800">
                      {OPERATOR_CONFIG[compositeDetail.operator as CompositeOperator]?.label}
                    </span>
                    <span className="w-8 h-8 rounded-xl bg-slate-100 font-black text-base text-emerald-700 flex items-center justify-center">
                      {OPERATOR_CONFIG[compositeDetail.operator as CompositeOperator]?.symbol}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block mt-1">
                    {OPERATOR_CONFIG[compositeDetail.operator as CompositeOperator]?.desc}
                  </span>
                </div>

                {/* کارت ۴: اجزای تشکیل‌دهنده */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                  <span className="text-slate-600 text-xs font-semibold block">اجزای متصل</span>
                  <span className="text-2xl font-black text-slate-800 mt-1 block">
                    {toPersianDigits(compositeDetail.items?.length || 0)} شاخص
                  </span>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    {compositeDetail.items?.map((it: any) => it.projectKpi?.name).join(" • ")}
                  </div>
                </div>
              </div>

              {/* نمودار روند سری زمانی شاخص ترکیبی */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-4">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-100 pb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  <span>روند زمانی شاخص ترکیبی «{compositeDetail.name}»</span>
                </h3>

                {compositeChartData.length === 0 ? (
                  <div className="text-center text-slate-400 py-12">
                    هیچ داده محاسبه‌شده‌ای برای این شاخص ترکیبی در دوره‌ها یافت نشد.
                  </div>
                ) : (
                  <div dir="ltr" className="w-full h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={compositeChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="period_title"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          tickFormatter={(val) => toPersianDigits(val)}
                        />
                        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                        <Tooltip
                          contentStyle={{ direction: "rtl", fontFamily: "inherit", fontSize: 12 }}
                          labelStyle={{ color: "#0f172a", fontWeight: "bold" }}
                          formatter={(value: any) => [
                            value !== null ? `${toPersianDigits(value)} ${compositeDetail.unit}` : "بدون مقدار",
                            "مقدار ترکیبی",
                          ]}
                        />
                        {compositeDetail.target_value !== null && compositeDetail.target_value !== undefined && (
                          <ReferenceLine
                            y={Number(compositeDetail.target_value)}
                            stroke="#6366f1"
                            strokeDasharray="5 4"
                            label={{
                              value: `هدف: ${toPersianDigits(compositeDetail.target_value)}`,
                              position: "insideTopRight",
                              fontSize: 11,
                              fill: "#6366f1",
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="مقدار ترکیبی"
                          stroke="#059669"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#059669" }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* جدول تفکیک سهم معاونت‌ها و پروژه‌ها در هر دوره */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-700" />
                      <span>تفکیک سهم معاونت‌ها و پروژه‌ها در هر دوره</span>
                    </h3>
                    <p className="text-slate-400 text-xs mt-0.5">
                      روی هر ردیف کلیک کنید تا ریزمقادیر خام گزارش‌شده توسط هر معاونت باز شود.
                    </p>
                  </div>
                  <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                    {toPersianDigits(compositeValues.length)} دوره
                  </span>
                </div>

                {compositeValues.length === 0 ? (
                  <div className="text-center text-slate-400 py-8">
                    هنوز مقداری برای دوره‌ها محاسبه نشده است.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-200 text-xs">
                    <div className="bg-slate-100/90 p-3 font-bold text-slate-700 grid grid-cols-12 gap-2 text-[11px]">
                      <span className="col-span-1 text-center">ردیف</span>
                      <span className="col-span-4">دوره گزارش‌دهی</span>
                      <span className="col-span-3 text-center">مقدار ترکیبی</span>
                      <span className="col-span-2 text-center">وضعیت داده</span>
                      <span className="col-span-2 text-center">جزئیات سهم</span>
                    </div>

                    {compositeValues.map((v: any, idx: number) => {
                      const isExpanded = expandedPeriodRowId === v.id;
                      const details = Array.isArray(v.details) ? (v.details as CompositeKpiValueDetail[]) : [];
                      return (
                        <div key={v.id} className="bg-white">
                          <div
                            onClick={() => setExpandedPeriodRowId(isExpanded ? null : v.id)}
                            className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                          >
                            <span className="col-span-1 text-center text-slate-500 font-semibold">
                              {toPersianDigits(idx + 1)}
                            </span>
                            <span className="col-span-4 font-bold text-slate-900">
                              {v.period?.title || "دوره"}
                            </span>
                            <span className="col-span-3 text-center font-extrabold text-emerald-800">
                              {v.calculated_value !== null
                                ? `${toPersianDigits(v.calculated_value)} ${compositeDetail.unit}`
                                : "—"}
                            </span>
                            <span className="col-span-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  v.status === "computed"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : v.status === "partial"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {v.status === "computed" ? "کامل" : v.status === "partial" ? "ناقص" : "عدم پایش"}
                              </span>
                            </span>
                            <span className="col-span-2 text-center text-emerald-700 font-bold flex items-center justify-center gap-1 text-[11px]">
                              <span>{isExpanded ? "بستن" : "مشاهده سهم"}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </span>
                          </div>

                          {isExpanded && (
                            <div className="bg-slate-50 p-4 border-t border-slate-100 space-y-2">
                              <span className="text-[11px] font-bold text-slate-600 block">
                                ریزمقادیر خام ثبت‌شده توسط معاونت‌ها در این دوره:
                              </span>
                              {details.length === 0 ? (
                                <p className="text-slate-400 text-xs">جزئیاتی ثبت نشده است.</p>
                              ) : (
                                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                  <table className="w-full text-right text-[11px]">
                                    <thead className="bg-slate-100 text-slate-700 font-bold">
                                      <tr>
                                        <th className="p-2">معاونت</th>
                                        <th className="p-2">پروژه</th>
                                        <th className="p-2">شاخص پایه</th>
                                        <th className="p-2 text-center">مقدار گزارش‌شده</th>
                                        <th className="p-2 text-center">وضعیت پایش</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {details.map((d: any, dIdx: number) => (
                                        <tr key={dIdx} className="hover:bg-slate-50">
                                          <td className="p-2 font-bold text-slate-800">{d.deputy_name || "—"}</td>
                                          <td className="p-2 text-slate-600">{d.project_title || "—"}</td>
                                          <td className="p-2 font-semibold text-slate-800">{d.kpi_name}</td>
                                          <td className="p-2 text-center font-bold text-emerald-800">
                                            {d.value !== null ? `${toPersianDigits(d.value)} ${d.unit || ""}` : "—"}
                                          </td>
                                          <td className="p-2 text-center">
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                                d.measured
                                                  ? "bg-emerald-50 text-emerald-700 font-bold"
                                                  : "bg-rose-50 text-rose-700"
                                              }`}
                                            >
                                              {d.measured ? "ثبت‌شده" : "عدم پایش"}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
