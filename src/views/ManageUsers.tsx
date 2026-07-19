// src/views/ManageUsers.tsx
import { useState } from "react";
import { Plus, User, Trash2, Edit2, X, CheckCircle2 } from "lucide-react";
import { User as UserType } from "../types";
import { CustomSelect } from ".././components";

interface ManageUsersProps {
  users: UserType[];
  onRefresh: () => void;
}

export default function ManageUsers({ users, onRefresh }: ManageUsersProps) {
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "manager">("user");
  const [newTemporaryPassword, setNewTemporaryPassword] = useState("123456");
  const [newMustChangePassword, setNewMustChangePassword] = useState(true);

  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editUserFullName, setEditUserFullName] = useState("");
  const [editUserUsername, setEditUserUsername] = useState("");
  const [editUserRole, setEditUserRole] = useState<"user" | "manager">("user");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername, full_name: newFullName, role: newUserRole, password: newTemporaryPassword, must_change_password: newMustChangePassword }),
      });
      if (res.ok) {
        setNewUsername("");
        setNewFullName("");
        setNewTemporaryPassword("123456");
        onRefresh();
      }
    } catch (err) { console.error(err); }
  };

  const handleToggleStatus = async (usr: UserType) => {
    try {
      await fetch(`/api/users/${usr.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !usr.is_active }),
      });
      onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleResetPassword = async (id: number) => {
    const pval = prompt("رمز عبور جدید را وارد نمایید:", "123456");
    if (pval === null) return;
    try {
      await fetch(`/api/users/${id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporary_password: pval }),
      });
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف حساب این پرسنل اطمینان دارید؟ تمامی داده‌های تخصیص و گزارش‌های وی فیزیکی پاک خواهند شد.")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) onRefresh();
    } catch (err) { console.error(err); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: editUserFullName, username: editUserUsername, role: editUserRole }),
      });
      if (res.ok) {
        setEditingUser(null);
        onRefresh();
      }
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 animate-fade-in text-xs">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">👤 مدیریت کاربران و پرسنل</h1>
        <p className="text-slate-500 text-xs mt-1">ایجاد پروفایل سازمانی، مانیتورینگ وضعیت حساب‌ها و بازنشانی دسترسی نیروها.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* فرم ثبت نام کاربر */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 h-fit space-y-4 shadow-2xs">
          <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">ثبت نام اکانت جدید کارشناس</h3>
          <form onSubmit={handleCreate} className="space-y-3.5">
            <input type="text" required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="نام کاربری (انگلیسی)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-left" />
            <input type="text" required value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="نام و نام خانوادگی کارشناس" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
            <CustomSelect value={newUserRole} onChange={(v) => setNewUserRole(v)} options={[{ value: "user", label: "کاربر عادی (کارشناس)" }, { value: "manager", label: "مدیر سیستم (سرپرست)" }]} />
            <input type="password" value={newTemporaryPassword} onChange={(e) => setNewTemporaryPassword(e.target.value)} placeholder="رمز عبور موقت اولیه" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-left" />
            <div className="flex items-center gap-2"><input type="checkbox" id="must-change" checked={newMustChangePassword} onChange={(e) => setNewMustChangePassword(e.target.checked)} /><label htmlFor="must-change" className="text-slate-500">اجبار به تغییر رمز در اولین ورود</label></div>
            <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-xl font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> ثبت حساب کاربری</button>
          </form>
        </div>

        {/* لیست کاربران */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {users.map((usr) => (
              <div key={usr.id} className="p-4 flex items-center justify-between hover:bg-slate-50/40 transition-colors">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{usr.full_name}</h4>
                  <div className="flex items-center gap-3 text-slate-400 mt-1"><span>شناسه: @{usr.username}</span><span>نقش: {usr.role === "manager" ? "مدیر" : "کارشناس"}</span></div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleStatus(usr)} className={`px-2.5 py-1 rounded-xl font-bold transition-all ${usr.is_active ? "text-red-600 bg-red-50 hover:bg-red-100" : "text-green-600 bg-green-50 hover:bg-green-100"}`}>{usr.is_active ? "غیرفعال" : "فعال‌سازی"}</button>
                  <button onClick={() => handleResetPassword(usr.id)} className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl font-medium hover:bg-slate-200">بازنشانی رمز</button>
                  <button onClick={() => { setEditingUser(usr); setEditUserFullName(usr.full_name); setEditUserUsername(usr.username); setEditUserRole(usr.role); }} className="text-blue-600 bg-blue-50 p-1.5 rounded-xl hover:bg-blue-100"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(usr.id)} className="text-red-600 bg-red-50 p-1.5 rounded-xl hover:bg-red-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* مودال ویرایش کاربر */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">ویرایش سطح دسترسی کاربر</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <input type="text" required value={editUserFullName} onChange={(e) => setEditUserFullName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" />
              <input type="text" required value={editUserUsername} onChange={(e) => setEditUserUsername(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-left" />
              <CustomSelect value={editUserRole} onChange={(v) => setEditUserRole(v)} options={[{ value: "user", label: "کارشناس عادی" }, { value: "manager", label: "مدیر سیستم" }]} />
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-slate-900 text-white py-2 rounded-xl hover:bg-slate-800 transition-all font-semibold">ذخیره تغییرات</button>
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-slate-100 py-2 rounded-xl font-semibold">انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}