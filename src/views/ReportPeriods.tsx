// src/views/ReportPeriods.tsx
import { useState } from "react";
import { Plus, Trash2, Edit2, RefreshCw, Clock, Calendar, CheckCircle, AlertCircle, ShieldAlert } from "lucide-react";
import { ReportPeriod } from "../types";
import { CustomSelect, ShamsiDatePicker } from "../components";
import { formatToShamsi, gregorianToShamsi, toPersianDigits } from "../dateUtils";
import { getTehranParts, parseTehranWallClock } from "../deadline";

interface ReportPeriodsProps {
  periods: ReportPeriod[];
  onRefresh: () => void;
}

/**
 * Formats a UTC ISO timestamp to a readable Persian Shamsi date & time in Asia/Tehran timezone.
 */
function formatTehranPersianDateTime(isoStr: string | null | undefined): string {
  if (!isoStr) return "تعیین‌نشده";
  try {
    const parts = getTehranParts(isoStr);
    const shamsi = gregorianToShamsi(`${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`);
    if (!shamsi) return isoStr;
    const pad = (n: number) => String(n).padStart(2, "0");
    return toPersianDigits(`${shamsi.year}/${pad(shamsi.month)}/${pad(shamsi.day)} - ساعت ${pad(parts.hour)}:${pad(parts.minute)}`);
  } catch {
    return isoStr;
  }
}

export default function ReportPeriods({ periods = [], onRefresh }: ReportPeriodsProps) {
  // New Period Form State
  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodType, setNewPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  // New Period Override State
  const [newUseOverride, setNewUseOverride] = useState(false);
  const [newOverrideDate, setNewOverrideDate] = useState("");
  const [newOverrideTime, setNewOverrideTime] = useState("14:00");
  const [newGraceMode, setNewGraceMode] = useState<"default" | "custom">("default");
  const [newGraceDays, setNewGraceDays] = useState<number>(0);

  // Edit Period Modal State
  const [editingPeriod, setEditingPeriod] = useState<ReportPeriod | null>(null);
  const [editPeriodTitle, setEditPeriodTitle] = useState("");
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");

  // Edit Period Override State
  const [editUseOverride, setEditUseOverride] = useState(false);
  const [editOverrideDate, setEditOverrideDate] = useState("");
  const [editOverrideTime, setEditOverrideTime] = useState("14:00");
  const [editGraceMode, setEditGraceMode] = useState<"default" | "custom">("default");
  const [editGraceDays, setEditGraceDays] = useState<number>(0);

  // Loading State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populates the edit modal with period data
  const handleOpenEdit = (pe: ReportPeriod) => {
    setEditingPeriod(pe);
    setEditPeriodTitle(pe.title);
    setEditPeriodStart(pe.period_start);
    setEditPeriodEnd(pe.period_end);

    if (pe.deadline_override_at) {
      try {
        const parts = getTehranParts(pe.deadline_override_at);
        const pad = (n: number) => String(n).padStart(2, "0");
        setEditUseOverride(true);
        setEditOverrideDate(`${parts.year}-${pad(parts.month)}-${pad(parts.day)}`);
        setEditOverrideTime(`${pad(parts.hour)}:${pad(parts.minute)}`);
      } catch {
        setEditUseOverride(false);
        setEditOverrideDate("");
        setEditOverrideTime("14:00");
      }
    } else {
      setEditUseOverride(false);
      setEditOverrideDate("");
      setEditOverrideTime("14:00");
    }

    if (pe.grace_days_override !== null && pe.grace_days_override !== undefined) {
      setEditGraceMode("custom");
      setEditGraceDays(pe.grace_days_override);
    } else {
      setEditGraceMode("default");
      setEditGraceDays(0);
    }
  };

  // Create Period Handler
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    let deadlineOverrideIso: string | null = null;
    if (newUseOverride) {
      if (!newOverrideDate) {
        alert("لطفاً تاریخ ددلاین اختصاصی را مشخص کنید.");
        return;
      }
      try {
        deadlineOverrideIso = parseTehranWallClock(newOverrideDate, newOverrideTime || "14:00").toISOString();
      } catch (err: any) {
        alert(err.message || "تاریخ یا ساعت ددلاین اختصاصی نامعتبر است.");
        return;
      }
    }

    const graceOverrideValue = newGraceMode === "custom" ? newGraceDays : null;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/report-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPeriodTitle,
          report_type: newPeriodType,
          period_start: newPeriodStart,
          period_end: newPeriodEnd,
          deadline_override_at: deadlineOverrideIso,
          grace_days_override: graceOverrideValue,
        }),
      });
      if (res.ok) {
        setNewPeriodTitle("");
        setNewPeriodStart("");
        setNewPeriodEnd("");
        setNewUseOverride(false);
        setNewOverrideDate("");
        setNewOverrideTime("14:00");
        setNewGraceMode("default");
        setNewGraceDays(0);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در ثبت بازه جدید.");
      }
    } catch (err) {
      console.error(err);
      alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle master is_open status
  const handleToggleOpen = async (pe: ReportPeriod) => {
    try {
      await fetch(`/api/report-periods/${pe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open: !pe.is_open }),
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Period Handler
  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف این بازه اطمینان دارید؟")) return;
    try {
      const res = await fetch(`/api/report-periods/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "امکان حذف این بازه وجود ندارد.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Period Handler
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod || isSubmitting) return;

    let deadlineOverrideIso: string | null = null;
    if (editUseOverride) {
      if (!editOverrideDate) {
        alert("لطفاً تاریخ ددلاین اختصاصی را مشخص کنید.");
        return;
      }
      try {
        deadlineOverrideIso = parseTehranWallClock(editOverrideDate, editOverrideTime || "14:00").toISOString();
      } catch (err: any) {
        alert(err.message || "تاریخ یا ساعت ددلاین اختصاصی نامعتبر است.");
        return;
      }
    }

    const graceOverrideValue = editGraceMode === "custom" ? editGraceDays : null;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/report-periods/${editingPeriod.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editPeriodTitle,
          period_start: editPeriodStart,
          period_end: editPeriodEnd,
          deadline_override_at: deadlineOverrideIso,
          grace_days_override: graceOverrideValue,
        }),
      });
      if (res.ok) {
        setEditingPeriod(null);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در ویرایش بازه.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">🗓️ مدیریت دوره‌های گزارش‌دهی و ددلاین‌ها</h1>
        <p className="text-slate-500 text-xs mt-1">
          تعریف چرخه‌های پایش هفتگی و ماهانه، اعمال استثنائات زمانی اختصاصی برای هر دوره و کنترل مسدودسازی دریافت گزارش‌ها.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* فرم ثبت بازه */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 h-fit space-y-4 shadow-2xs">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">ایجاد بازه پایش جدید</h3>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <input
              type="text"
              required
              value={newPeriodTitle}
              onChange={(e) => setNewPeriodTitle(e.target.value)}
              placeholder="مثال: هفته دوم مرداد ۱۴۰۵"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
            />

            <CustomSelect
              value={newPeriodType}
              onChange={(v) => setNewPeriodType(v as "weekly" | "monthly")}
              options={[
                { value: "weekly", label: "گزارش هفتگی" },
                { value: "monthly", label: "گزارش ماهانه" }
              ]}
            />

            <div>
              <label className="text-slate-500 block mb-1 font-medium">تاریخ شروع بازه</label>
              <ShamsiDatePicker value={newPeriodStart} onChange={setNewPeriodStart} />
            </div>

            <div>
              <label className="text-slate-500 block mb-1 font-medium">تاریخ پایان بازه</label>
              <ShamsiDatePicker value={newPeriodEnd} onChange={setNewPeriodEnd} />
            </div>

            {/* بخش تنظیمات اختصاصی ددلاین دوره */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                  <span>⏱️</span>
                  <span>تنظیمات اختصاصی ددلاین این دوره</span>
                </span>
              </div>

              {/* گزینه فعال‌سازی ددلاین اختصاصی */}
              <div className="space-y-2 pt-1 border-t border-slate-200/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newUseOverride}
                    onChange={(e) => setNewUseOverride(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-700 font-medium text-[11px]">
                    استفاده از ددلاین اختصاصی برای این دوره
                  </span>
                </label>

                {newUseOverride && (
                  <div className="space-y-2 pr-5 pt-1 animate-fade-in">
                    <div>
                      <label className="text-slate-500 block mb-1 text-[10px]">تاریخ دقیق ددلاین اصلی</label>
                      <ShamsiDatePicker value={newOverrideDate} onChange={setNewOverrideDate} />
                    </div>
                    <div>
                      <label className="text-slate-500 block mb-1 text-[10px]">ساعت دقیق ددلاین</label>
                      <input
                        type="time"
                        value={newOverrideTime}
                        onChange={(e) => setNewOverrideTime(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-left font-mono text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* گزینه مهلت اضافه اختصاصی */}
              <div className="space-y-2 pt-2 border-t border-slate-200/60">
                <label className="block text-slate-700 font-medium text-[11px]">مهلت اضافه اختصاصی</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="new_grace_mode"
                      value="default"
                      checked={newGraceMode === "default"}
                      onChange={() => setNewGraceMode("default")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] text-slate-600">مهلت پیش‌فرض</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="new_grace_mode"
                      value="custom"
                      checked={newGraceMode === "custom"}
                      onChange={() => setNewGraceMode("custom")}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-[11px] text-slate-600">تعیین روزهای اختصاصی</span>
                  </label>
                </div>

                {newGraceMode === "custom" && (
                  <div className="pt-1 pr-5 animate-fade-in flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={newGraceDays}
                      onChange={(e) => setNewGraceDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                      className="w-20 bg-white border border-slate-200 rounded-xl px-2 py-1 text-left font-mono text-xs"
                      placeholder="0"
                    />
                    <span className="text-slate-500 text-[11px]">روز (۰ = بدون مهلت اضافه)</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ایجاد دوره...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>ایجاد دوره گزارش</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* لیست بازه‌ها با نمایش ددلاین مؤثر */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {periods.length === 0 ? (
              <div className="p-8 text-center text-slate-400">هیچ بازه‌ای تعریف نشده است.</div>
            ) : (
              periods.map((pe) => (
                <div key={pe.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 text-sm">{pe.title}</h4>

                      {/* برچسب فاز زمانی ددلاین */}
                      {pe.is_open ? (
                        pe.deadline_phase === "open" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" />
                            <span>پذیرش به‌موقع</span>
                          </span>
                        ) : pe.deadline_phase === "grace" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertCircle className="w-3 h-3" />
                            <span>مهلت اضافه (تأخیری)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <Clock className="w-3 h-3" />
                            <span>ددلاین منقضی شده</span>
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                          <ShieldAlert className="w-3 h-3" />
                          <span>بسته شده توسط مدیر</span>
                        </span>
                      )}

                      {pe.is_deadline_overridden && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          ددلاین اختصاصی
                        </span>
                      )}

                      {pe.is_grace_overridden && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          مهلت اضافه اختصاصی
                        </span>
                      )}
                    </div>

                    <p className="text-slate-500 text-[11px]">
                      نوع چرخه: <strong className="text-slate-700">{pe.report_type === "weekly" ? "هفتگی" : "ماهانه"}</strong> | بازه تقویمی: {formatToShamsi(pe.period_start)} تا {formatToShamsi(pe.period_end)}
                    </p>

                    {/* اطلاعات ددلاین مؤثر و مهلت اضافه */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/80 border border-slate-200/70 rounded-xl p-2.5 text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px]">ددلاین اصلی مؤثر:</span>
                        <strong className="text-slate-800">
                          {formatTehranPersianDateTime(pe.deadline_at)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">پایان مهلت اضافه (بسته‌شدن نهایی):</span>
                        <strong className="text-slate-800">
                          {formatTehranPersianDateTime(pe.grace_until)}
                        </strong>
                        <span className="text-slate-400 text-[10px] mr-1">
                          ({toPersianDigits(pe.effective_grace_days ?? 0)} روز اضافه)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    <button
                      onClick={() => handleToggleOpen(pe)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[11px] cursor-pointer ${pe.is_open
                          ? "text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100"
                          : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100"
                        }`}
                    >
                      {pe.is_open ? "بستن بازه" : "باز کردن مجدد"}
                    </button>

                    <button
                      onClick={() => handleOpenEdit(pe)}
                      className="text-blue-600 bg-blue-50 p-2 rounded-xl hover:bg-blue-100 cursor-pointer"
                      title="ویرایش"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => handleDelete(pe.id)}
                      className="text-rose-600 bg-rose-50 p-2 rounded-xl hover:bg-rose-100 cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* مودال ویرایش بازه */}
      {editingPeriod && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>ویرایش بازه گزارش‌دهی و تنظیمات ددلاین</span>
            </h3>

            <form onSubmit={handleUpdate} className="space-y-3.5">
              <div>
                <label className="text-slate-500 mb-1 block font-medium">عنوان دوره</label>
                <input
                  type="text"
                  required
                  value={editPeriodTitle}
                  onChange={(e) => setEditPeriodTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl font-sans text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-slate-500 mb-1 block font-medium">شروع دوره</label>
                <ShamsiDatePicker value={editPeriodStart} onChange={setEditPeriodStart} />
              </div>

              <div>
                <label className="text-slate-500 mb-1 block font-medium">پایان دوره</label>
                <ShamsiDatePicker value={editPeriodEnd} onChange={setEditPeriodEnd} />
              </div>

              {/* تنظیمات اختصاصی ددلاین در ویرایش */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                  <span>⏱️</span>
                  <span>تنظیمات اختصاصی ددلاین این دوره</span>
                </div>

                {/* ددلاین اختصاصی */}
                <div className="space-y-2 pt-1 border-t border-slate-200/60">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editUseOverride}
                      onChange={(e) => setEditUseOverride(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700 font-medium text-[11px]">
                      استفاده از ددلاین اختصاصی برای این دوره
                    </span>
                  </label>

                  {editUseOverride && (
                    <div className="space-y-2 pr-5 pt-1 animate-fade-in">
                      <div>
                        <label className="text-slate-500 block mb-1 text-[10px]">تاریخ دقیق ددلاین اصلی</label>
                        <ShamsiDatePicker value={editOverrideDate} onChange={setEditOverrideDate} />
                      </div>
                      <div>
                        <label className="text-slate-500 block mb-1 text-[10px]">ساعت دقیق ددلاین</label>
                        <input
                          type="time"
                          value={editOverrideTime}
                          onChange={(e) => setEditOverrideTime(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-left font-mono text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* مهلت اضافه اختصاصی */}
                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  <label className="block text-slate-700 font-medium text-[11px]">مهلت اضافه اختصاصی</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="edit_grace_mode"
                        value="default"
                        checked={editGraceMode === "default"}
                        onChange={() => setEditGraceMode("default")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] text-slate-600">مهلت پیش‌فرض</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="edit_grace_mode"
                        value="custom"
                        checked={editGraceMode === "custom"}
                        onChange={() => setEditGraceMode("custom")}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-[11px] text-slate-600">تعیین روزهای اختصاصی</span>
                    </label>
                  </div>

                  {editGraceMode === "custom" && (
                    <div className="pt-1 pr-5 animate-fade-in flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={editGraceDays}
                        onChange={(e) => setEditGraceDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-20 bg-white border border-slate-200 rounded-xl px-2 py-1 text-left font-mono text-xs"
                        placeholder="0"
                      />
                      <span className="text-slate-500 text-[11px]">روز (۰ = بدون مهلت اضافه)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl hover:bg-slate-800 disabled:bg-slate-400 transition-all font-semibold cursor-pointer flex items-center justify-center gap-1"
                >
                  {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : "ذخیره تغییرات"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPeriod(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}