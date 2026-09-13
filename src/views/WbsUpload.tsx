// src/views/WbsUpload.tsx
import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, Loader2 } from "lucide-react";
import { Project } from "../types";

interface WbsUploadProps {
  projects: Project[];
}

export default function WbsUpload({ projects }: WbsUploadProps) {
  const [projectId, setProjectId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (!projectId) {
      setErrorMsg("لطفاً ابتدا پروژه را انتخاب کنید.");
      return;
    }
    if (!file) {
      setErrorMsg("لطفاً فایل اکسل ساختار شکست را انتخاب کنید.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("wbs_file", file);

      const res = await fetch(`/api/projects/${projectId}/wbs-submissions`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "خطا در آپلود فایل.");
      }

      setSuccessMsg("ساختار شکست پروژه با موفقیت ثبت شد و برای مدیر ارسال گردید.");
      setFile(null);
      setProjectId("");
    } catch (err: any) {
      setErrorMsg(err.message || "خطای ناشناخته‌ای رخ داد.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">بارگذاری ساختار شکست پروژه (WBS)</h2>
        <p className="text-sm text-slate-500 mt-1">
          فایل اکسل ساختار شکست پروژه را انتخاب و برای مدیر ارسال کنید.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 max-w-2xl">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">پروژه</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="">— انتخاب پروژه —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">فایل اکسل WBS</label>
          <label className="flex items-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-amber-400 hover:bg-amber-50/40 transition-colors">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-700 block">
                {file ? file.name : "برای انتخاب فایل کلیک کنید"}
              </span>
              <span className="text-xs text-slate-400">فرمت‌های مجاز: xlsx ,xls</span>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{errorMsg}</div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {successMsg}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-colors cursor-pointer"
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          {uploading ? "در حال ارسال..." : "ثبت و ارسال به مدیر"}
        </button>
      </div>
    </div>
  );
}