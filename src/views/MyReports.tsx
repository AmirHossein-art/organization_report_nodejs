// src/views/MyReports.tsx
import { useState } from "react";
import { Search, FileText, Paperclip, Clock, X, Plus, Trash2, CheckCircle2, RefreshCw } from "lucide-react";
import { Project, Report, NextAction } from "../types";
import { CustomSelect, ShamsiDatePicker } from ".././components";

interface MyReportsProps {
  projects: Project[];
  allReports: Report[];
  user: any;
  onRefresh: () => void;
}

export default function MyReports({ projects, allReports, user, onRefresh }: MyReportsProps) {
  const [mySearch, setMySearch] = useState("");
  const [myProjFilter, setMyProjFilter] = useState("all");
  const [myTypeFilter, setMyTypeFilter] = useState("all");
  const [myStatusFilter, setMyStatusFilter] = useState("all");

  // استیت‌های مودال ویرایش
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editActivities, setEditActivities] = useState("");
  const [editResults, setEditResults] = useState("");
  const [editKpiText, setEditKpiText] = useState("");
  const [editNextActions, setEditNextActions] = useState<{ action_text: string; target_date: string }[]>([]);
  const [editNewFiles, setEditNewFiles] = useState<FileList | null>(null);
  const [deletedFileIds, setDeletedFileIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpenEdit = (rep: Report) => {
    setEditingReport(rep);
    setEditActivities(rep.activities_done);
    setEditResults(rep.results_achieved || "");
    setEditKpiText(rep.kpi_text || "");
    setDeletedFileIds([]);
    setEditNewFiles(null);
    
    // لود اقدامات آتی ساختاریافته (اگر رابطه از سمت بک‌اند آرایه باشد)
   // لود اقدامات آتی ساختاریافته روزانه در مودال ویرایش
    if (rep.nextActions && Array.isArray(rep.nextActions)) {
      // اینجا (a) تبدیل شد به (a: NextAction) تا تایپ‌اسکریپت ارور ندهد
      setEditNextActions(rep.nextActions.map((a: NextAction) => ({ 
        action_text: a.action_text, 
        target_date: a.target_date.split("T")[0] 
      })));
    } else {
      setEditNextActions([{ action_text: "", target_date: "" }]);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    setLoading(true);

    const formData = new FormData();
    formData.append("activities_done", editActivities);
    formData.append("results_achieved", editResults);
    formData.append("kpi_text", editKpiText);
    formData.append("next_actions", JSON.stringify(editNextActions));
    formData.append("deleted_file_ids", JSON.stringify(deletedFileIds));

    if (editNewFiles) {
      for (let i = 0; i < editNewFiles.length; i++) formData.append("files", editNewFiles[i]);
    }

    try {
      const res = await fetch(`/api/reports/${editingReport.id}`, { method: "PUT", body: formData });
      if (res.ok) {
        setEditingReport(null);
        onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const myFilteredReports = allReports.filter((r) => {
    if (r.user_id !== user.id) return false;
    if (myProjFilter !== "all" && r.project_id.toString() !== myProjFilter) return false;
    if (myTypeFilter !== "all" && r.report_type !== myTypeFilter) return false;
    if (myStatusFilter !== "all" && r.status !== myStatusFilter) return false;
    if (mySearch.trim() && !r.activities_done.toLowerCase().includes(mySearch.toLowerCase()) && !r.project_title.toLowerCase().includes(mySearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">📄 گزارش‌های ثبت‌شده من</h1>
        <p className="text-slate-500 text-xs mt-1">آرشیو جامع تمام گزارش‌های عملکردی شما در سامانه.</p>
      </div>

      {/* بخش فیلترها */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/60 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">جستجو در متن</label>
          <div className="relative">
            <input type="text" value={mySearch} onChange={(e) => setMySearch(e.target.value)} placeholder="جستجو در فعالیت‌ها..." className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-3 pl-8 py-1.5 text-xs focus:outline-none" />
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">پروژه</label>
          <CustomSelect value={myProjFilter} onChange={setMyProjFilter} options={[{ value: "all", label: "همه پروژه‌ها" }, ...projects.map(p => ({ value: p.id.toString(), label: p.title }))]} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">نوع گزارش</label>
          <CustomSelect value={myTypeFilter} onChange={setMyTypeFilter} options={[{ value: "all", label: "همه انواع" }, { value: "weekly", label: "هفتگی" }, { value: "monthly", label: "ماهانه" }]} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">وضعیت ددلاین</label>
          <CustomSelect value={myStatusFilter} onChange={setMyStatusFilter} options={[{ value: "all", label: "همه وضعیت‌ها" }, { value: "submitted", label: "ثبت‌شده منظم" }, { value: "late", label: "تأخیری" }]} />
        </div>
      </div>

      {/* لیست گزارش‌ها */}
      <div className="space-y-4">
        {myFilteredReports.map((rep) => (
          <div key={rep.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">{rep.project_title}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{rep.report_type === "weekly" ? "هفتگی" : "ماهانه"} | {rep.period_title}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rep.status === "late" ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-green-50 text-green-600 border border-green-100"}`}>
                {rep.status === "late" ? "تأخیری" : "ثبت‌شده منظم"}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
              <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100"><h5 className="font-bold text-slate-400 mb-1">فعالیت‌ها</h5><p className="whitespace-pre-wrap">{rep.activities_done}</p></div>
              <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-100"><h5 className="font-bold text-slate-400 mb-1">نتایج حاصل‌شده</h5><p className="whitespace-pre-wrap">{rep.results_achieved || "ثبت نشده"}</p></div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button onClick={() => handleOpenEdit(rep)} className="text-xs bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 rounded-xl">
                ویرایش و به‌روزرسانی報告
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* مودال ویرایش گزارش */}
      {editingReport && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-xl border border-slate-200">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center rounded-t-3xl">
              <h3 className="font-bold text-sm">ویرایش گزارش - {editingReport.project_title}</h3>
              <button onClick={() => setEditingReport(null)} className="text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">فعالیت‌های انجام‌شده *</label>
                <textarea required value={editActivities} onChange={(e) => setEditActivities(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none" />
              </div>
              <div>
                <label className="block text-slate-700 font-bold mb-1">نتایج حاصل‌شده</label>
                <textarea value={editResults} onChange={(e) => setEditResults(e.target.value)} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:outline-none" />
              </div>

              {/* ویرایش اقدامات آتی ساختاریافته روزانه */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">🔮 برنامه و اقدامات آتی</span>
                  <button type="button" onClick={() => setEditNextActions([...editNextActions, { action_text: "", target_date: "" }])} className="text-blue-600 font-bold flex items-center gap-0.5">
                    <Plus className="w-3 h-3" /> افزودن
                  </button>
                </div>
                {editNextActions.map((item, idx) => (
                  <div key={idx} className="flex gap-2 bg-white p-2 rounded-lg border border-slate-200 items-center">
                    <input type="text" required value={item.action_text} onChange={(e) => { const cp = [...editNextActions]; cp[idx].action_text = e.target.value; setEditNextActions(cp); }} placeholder="شرح اقدام..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1" />
                    <div className="w-36"><ShamsiDatePicker value={item.target_date} onChange={(d) => { const cp = [...editNextActions]; cp[idx].target_date = d; setEditNextActions(cp); }} placeholder="تاریخ هدف" /></div>
                    {editNextActions.length > 1 && <button type="button" onClick={() => setEditNextActions(editNextActions.filter((_, i) => i !== idx))} className="text-red-500"><X className="w-4 h-4" /></button>}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditingReport(null)} className="bg-slate-100 px-4 py-2 rounded-xl">انصراف</button>
                <button type="submit" disabled={loading} className="bg-slate-900 text-white px-5 py-2 rounded-xl flex items-center gap-1">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>بروزرسانی نهایی</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}