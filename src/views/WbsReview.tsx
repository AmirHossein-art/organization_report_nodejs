// src/views/WbsReview.tsx
import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";

interface WbsRow {
  id: number;
  project_id: number;
  file_name: string;
  created_at: string;
  user?: { full_name: string; username: string };
  project?: { title: string; code: string };
}

export default function WbsReview() {
  const [rows, setRows] = useState<WbsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/wbs-submissions");
        if (res.ok) setRows(await res.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">ساختارهای شکست دریافتی (WBS)</h2>
        <p className="text-sm text-slate-500 mt-1">فایل‌های ارسالی معاونان پروژه‌ها — قابل دانلود.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">هنوز ساختار شکستی ثبت نشده است.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-right font-medium">پروژه</th>
                <th className="px-4 py-3 text-right font-medium">ارسال‌کننده</th>
                <th className="px-4 py-3 text-right font-medium">فایل</th>
                <th className="px-4 py-3 text-right font-medium">تاریخ ثبت</th>
                <th className="px-4 py-3 text-right font-medium">دانلود</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.project?.title || r.project_id}</td>
                  <td className="px-4 py-3 text-slate-600">{r.user?.full_name || r.user?.username || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-emerald-600" />{r.file_name}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(r.created_at).toLocaleDateString("fa-IR")}</td>
                  <td className="px-4 py-3">
                    <a
                      href={`/api/wbs-submissions/${r.id}/download`}
                      className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
                    >
                      <Download className="w-4 h-4" /> دانلود
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}