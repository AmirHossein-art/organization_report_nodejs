// src/views/ManageUsers.tsx
import { useState } from "react";
import { Plus, Trash2, Edit2, RefreshCw } from "lucide-react";
import { User as UserType } from "../types";
import { CustomSelect } from "../components";

interface ManageUsersProps {
  users: UserType[];
  onRefresh: () => void;
}

export default function ManageUsers({ users = [], onRefresh }: ManageUsersProps) {
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "manager">("user");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [newTemporaryPassword, setNewTemporaryPassword] = useState("123456");
  const [newMustChangePassword, setNewMustChangePassword] = useState(true);

  // استیت‌های ویرایش کاربر
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editUserFullName, setEditUserFullName] = useState("");
  const [editUserUsername, setEditUserUsername] = useState("");
  const [editUserJobTitle, setEditUserJobTitle] = useState("");
  const [editUserRole, setEditUserRole] = useState<"user" | "manager">("user");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ثبت اکانت جدید
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username: newUsername, 
          full_name: newFullName, 
          role: newUserRole, 
          job_title: newJobTitle, 
          password: newTemporaryPassword, 
          must_change_password: newMustChangePassword 
        }),
      });

      if (res.ok) {
        setNewUsername("");
        setNewFullName("");
        setNewJobTitle("");
        setNewTemporaryPassword("123456");
        setNewMustChangePassword(true);
        if (onRefresh) onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || "خطا در ثبت کاربر");
      }
    } catch (err) {
      alert("ارتباط با سرور برقرار نشد.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // فعال / غیرفعال کردن کاربر
  const handleToggleStatus = async (usr: UserType) => {
    try {
      await fetch(`/api/users/${usr.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !usr.is_active }),
      });
      if (onRefresh) onRefresh();
    } catch (err) { 
      console.error(err); 
    }
  };

  // بازنشانی رمز عبور
  const handleResetPassword = async (id: number) => {
    const pval = prompt("رمز عبور جدید را وارد نمایید:", "123456");
    if (pval === null) return;
    try {
      await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporary_password: pval }),
      });
      alert("رمز عبور با موفقیت بازنشانی شد.");
    } catch (err) { 
      console.error(err); 
    }
  };

  // حذف کاربر
  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف حساب این پرسنل اطمینان دارید؟ تمامی داده‌های تخصیص و گزارش‌های وی پاک خواهند شد.")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok && onRefresh) onRefresh();
    } catch (err) { 
      console.error(err); 
    }
  };

  // ذخیره ویرایش کاربر
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          full_name: editUserFullName, 
          username: editUserUsername, 
          job_title: editUserJobTitle,
          role: editUserRole,
        }),
      });
      if (res.ok) {
        setEditingUser(null);
        if (onRefresh) onRefresh();
      }
    } catch (err) { 
      console.error(err); 
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs font-sans dir-rtl text-right">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">👤 مدیریت کاربران و پرسنل</h1>
        <p className="text-slate-500 text-xs mt-1">ایجاد پروفایل سازمانی، مانیتورینگ وضعیت حساب‌ها و تعیین سمت‌های شغلی نیروها.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* فرم ثبت نام کاربر */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 h-fit space-y-4 shadow-2xs">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">ثبت نام اکانت جدید کاربر</h3>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <input 
              type="text" 
              required 
              value={newUsername} 
              onChange={(e) => setNewUsername(e.target.value)} 
              placeholder="نام کاربری (انگلیسی) یا شماره همراه" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl text-xs" 
            />
            <input 
              type="text" 
              required 
              value={newFullName} 
              onChange={(e) => setNewFullName(e.target.value)} 
              placeholder="نام و نام خانوادگی کاربر" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" 
            />
            
            {/* 🟢 فیلد جدید موقعیت شغلی */}
            <input 
              type="text" 
              value={newJobTitle} 
              onChange={(e) => setNewJobTitle(e.target.value)} 
              placeholder="موقعیت شغلی (مثلاً: معاون برنامه‌ریزی)" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" 
            />

            <CustomSelect 
              value={newUserRole} 
              onChange={(v) => setNewUserRole(v as "user" | "manager")} 
              options={[
                { value: "user", label: "کاربر" }, 
                { value: "manager", label: "مدیر سیستم" }
              ]} 
            />

            <input 
              type="password" 
              value={newTemporaryPassword} 
              onChange={(e) => setNewTemporaryPassword(e.target.value)} 
              placeholder="رمز عبور موقت اولیه" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-left text-xs" 
            />

            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="must-change" 
                checked={newMustChangePassword} 
                onChange={(e) => setNewMustChangePassword(e.target.checked)} 
              />
              <label htmlFor="must-change" className="text-slate-500 text-xs cursor-pointer">
                اجبار به تغییر رمز در اولین ورود
              </label>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white py-2.5 rounded-xl font-medium transition-all flex items-center justify-center gap-2 text-xs cursor-pointer disabled:cursor-not-allowed" 
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>در حال ثبت اطلاعات...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>ثبت حساب کاربری</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* لیست کاربران */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {users.map((usr) => (
              <div key={usr.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50/40 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm">{usr.full_name}</h4>
                    {usr.job_title && (
                      <span className="bg-emerald-50 text-emerald-800 text-[10px] px-2 py-0.5 rounded-md font-bold border border-emerald-100">
                        {usr.job_title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-slate-400 text-[11px] mt-1">
                    <span>شناسه: @{usr.username}</span>
                    <span>نقش: {usr.role === "manager" ? "مدیر سیستم" : "کاربر"}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleToggleStatus(usr)} 
                    className={`px-2.5 py-1 rounded-xl font-bold transition-all text-[11px] cursor-pointer ${
                      usr.is_active ? "text-rose-600 bg-rose-50 hover:bg-rose-100" : "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                    }`}
                  >
                    {usr.is_active ? "غیرفعال" : "فعال‌سازی"}
                  </button>

                  <button 
                    onClick={() => handleResetPassword(usr.id)} 
                    className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl font-medium hover:bg-slate-200 text-[11px] cursor-pointer"
                  >
                    بازنشانی رمز
                  </button>

                  <button 
                    onClick={() => { 
                      setEditingUser(usr); 
                      setEditUserFullName(usr.full_name); 
                      setEditUserUsername(usr.username); 
                      setEditUserJobTitle((usr as any).job_title || "");
                      setEditUserRole(usr.role as "user" | "manager"); 
                    }} 
                    className="text-blue-600 bg-blue-50 p-1.5 rounded-xl hover:bg-blue-100 cursor-pointer"
                    title="ویرایش کاربر"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button 
                    onClick={() => handleDelete(usr.id)} 
                    className="text-rose-600 bg-rose-50 p-1.5 rounded-xl hover:bg-rose-100 cursor-pointer"
                    title="حذف کاربر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* مودال ویرایش کاربر */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 dir-rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">ویرایش اطلاعات کاربر</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <input 
                type="text" 
                required 
                value={editUserFullName} 
                onChange={(e) => setEditUserFullName(e.target.value)} 
                placeholder="نام و نام خانوادگی"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" 
              />
              <input 
                type="text" 
                required 
                value={editUserUsername} 
                onChange={(e) => setEditUserUsername(e.target.value)} 
                placeholder=" نام کاربری یا شماره همراه"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-right dir-rtl text-xs" 
              />
              <input 
                type="text" 
                value={editUserJobTitle} 
                onChange={(e) => setEditUserJobTitle(e.target.value)} 
                placeholder="موقعیت شغلی"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs" 
              />
              <CustomSelect 
                value={editUserRole} 
                onChange={(v) => setEditUserRole(v as "user" | "manager")} 
                options={[
                  { value: "user", label: "کاربر" }, 
                  { value: "manager", label: "مدیر سیستم" }
                ]} 
              />
              <div className="flex gap-2 pt-2 text-xs">
                <button type="submit" className="flex-1 bg-slate-900 text-white py-2 rounded-xl hover:bg-slate-800 transition-all font-semibold cursor-pointer">
                  ذخیره تغییرات
                </button>
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-slate-100 py-2 rounded-xl font-semibold cursor-pointer">
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