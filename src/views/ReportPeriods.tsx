// src/views/ReportPeriods.tsx
import { useState } from "react";
import { Plus, Calendar, Trash2, Edit2, X, CheckCircle2 } from "lucide-react";
import { ReportPeriod } from "../types";
import { CustomSelect, ShamsiDatePicker } from ".././components";
import { formatToShamsi } from "../dateUtils";

interface ReportPeriodsProps {
  periods: ReportPeriod[];
  onRefresh: () => void;
}

export default function ReportPeriods({ periods, onRefresh }: ReportPeriodsProps) {
  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodType, setNewPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const [editingPeriod, setEditingPeriod] = useState<ReportPeriod | null>(null);
  const [editPeriodTitle, setEditPeriodTitle] = useState("");
  const [editPeriodStart, setEditPeriodStart] = useState("");
  const [editPeriodEnd, setEditPeriodEnd] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/report-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newPeriodTitle, report_type: newPeriodType, period_start: newPeriodStart, period_end: newPeriodEnd }),
      });
      if (res.ok) {
        setNewPeriodTitle("");
        setNewPeriodStart("");
        setNewPeriodEnd("");
        onRefresh();
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleOpen = async (pe: ReportPeriod) => {
    try {
      await fetch(`/api/report-periods/${pe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open: !pe.is_open }),
      });
      onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف این بازه اطمینان دارید؟ تمامی گزارش‌های داخل آن کلا پاک خواهند شد.")) return;
    try {
      const res = await fetch(`/api/report-periods/${id}`, { method: "DELETE" });
      if (res.ok) onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPeriod) return;
    try {
      const res = await fetch(`/api/report-periods/${editingPeriod.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editPeriodTitle, period_start: editPeriodStart, period_end: editPeriodEnd }),
      });
      if (res.ok) {
        setEditingPeriod(null);
        onRefresh();
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">🗓️ مدیریت دوره‌های گزارش‌دهی</h1>
        <p className="text-slate-500 text-xs mt-1">تعریف چرخه‌های پایش هفتگی و ماهانه و کنترل مسدودسازی دریافت فایل‌ها.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* فرم ثبت بازه */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 h-fit space-y-4 shadow-2xs">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">ایجاد بازه پایش جدید</h3>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <input type="text" required value={newPeriodTitle} onChange={(e) => setNewPeriodTitle(e.target.value)} placeholder="مثال: هفته دوم مرداد ۱۴۰۵" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
            <CustomSelect value={newPeriodType} onChange={(v) => setNewPeriodType(v)} options={[{ value: "weekly", label: "گزارش هفتگی" }, { value: "monthly", label: "گزارش ماهانه" }]} />
            <div><label className="text-slate-400 block mb-1">تاریخ شروع بازه</label><ShamsiDatePicker value={newPeriodStart} onChange={setNewPeriodStart} /></div>
            <div><label className="text-slate-400 block mb-1">تاریخ پایان بازه</label><ShamsiDatePicker value={newPeriodEnd} onChange={setNewPeriodEnd} /></div>
            <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-xl font-medium flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> ایجاد دوره گزارش</button>
          </form>
        </div>

        {/* لیست بازه‌ها */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {periods.map((pe) => (
              <div key={pe.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{pe.title}</h4>
                  <p className="text-slate-400 mt-1">نوع چرخه: {pe.report_type === "weekly" ? "هفتگی" : "ماهانه"} | بازه: {formatToShamsi(pe.period_start)} تا {formatToShamsi(pe.period_end)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleOpen(pe)} className={`px-2.5 py-1 rounded-xl font-bold transition-all ${pe.is_open ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-green-600 bg-green-50 hover:bg-green-100"}`}>{pe.is_open ? "بستن بازه" : "باز کردن مجدد"}</button>
                  <button onClick={() => { setEditingPeriod(pe); setEditPeriodTitle(pe.title); setEditPeriodStart(pe.period_start); setEditPeriodEnd(pe.period_end); }} className="text-blue-600 bg-blue-50 p-1.5 rounded-xl hover:bg-blue-100"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(pe.id)} className="text-red-600 bg-red-50 p-1.5 rounded-xl hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* مودال ویرایش بازه */}
      {editingPeriod && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">ویرایش بازه گزارش‌دهی</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <input type="text" required value={editPeriodTitle} onChange={(e) => setEditPeriodTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none" />
              <div><label className="text-slate-400 mb-0.5 block">شروع دوره</label><ShamsiDatePicker value={editPeriodStart} onChange={setEditPeriodStart} /></div>
              <div><label className="text-slate-400 mb-0.5 block">پایان دوره</label><ShamsiDatePicker value={editPeriodEnd} onChange={setEditPeriodEnd} /></div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-slate-900 text-white py-2 rounded-xl hover:bg-slate-800 transition-all font-semibold">ذخیره تغییرات</button>
                <button type="button" onClick={() => setEditingPeriod(null)} className="flex-1 bg-slate-100 py-2 rounded-xl font-semibold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}