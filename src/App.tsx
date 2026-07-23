// src/App.tsx
import { useState, useEffect } from "react";
import { User, Project, ReportPeriod, Report, DeadlineSetting } from "./types";
import Sidebar from "./components/Sidebar";
import Login from "./views/Login";
import GatewayPortal from "./views/GatewayPortal";
import MustChangePasswordModal from "./components/MustChangePasswordModal"; // 🟢 اضافه شدن مودال تغییر رمز

// وارد کردن تمام ویوهای ماژولار
import HomeDashboard from "./views/HomeDashboard";
import SubmitReport from "./views/SubmitReport";
import MyReports from "./views/MyReports";
import ManagerDashboard from "./views/ManagerDashboard";
import ManageProjects from "./views/ManageProjects";
import DeadlineSettings from "./views/DeadlineSettings";
import ManageUsers from "./views/ManageUsers";
import ReportPeriods from "./views/ReportPeriods";
import ProjectAllocations from "./views/ProjectAllocations";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  
  const [currentView, setCurrentView] = useState<string>(() => {
    return localStorage.getItem("org_report_view") || "home";
  });

  // استیت‌های سراسری دیتای برنامه
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [periods, setPeriods] = useState<ReportPeriod[]>([]);
  const [deadlineSettings, setDeadlineSettings] = useState<DeadlineSetting[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);

  // لود دیتای سراسری از بک‌اند
  const fetchData = async () => {
    try {
      const [uRes, pRes, peRes, dRes, rRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/projects"),
        fetch("/api/report-periods"),
        fetch("/api/deadline-settings"),
        fetch("/api/reports"),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (pRes.ok) setProjects(await pRes.json());
      if (peRes.ok) setPeriods(await peRes.json());
      if (dRes.ok) setDeadlineSettings(await dRes.json());
      if (rRes.ok) setAllReports(await rRes.json());
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  // ۱. بررسی وضعیت کوکی امن به محض بوت شدن کامپوننت
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("عدم وجود کوکی معتبر");
      })
      .then((data) => {
        setUser(data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  // ۲. واکشی داده‌های پروژه‌ها و گزارش‌ها به محض تایید کاربر
  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("خطا در خروج از سرور:", err);
    } finally {
      setUser(null);
      setCurrentView("home");
    }
  };

  // لودینگ در زمان بررسی نشست کاربری
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">در حال ایمن‌سازی و بررسی نشست کاربری سازمان...</p>
        </div>
      </div>
    );
  }

  // گارد ورود کاربر (دروازه ورود و لاگین)
  if (!user) {
    if (!showLogin) {
      return <GatewayPortal onSelectTraffic={() => setShowLogin(true)} />;
    }
    
    return (
      <Login 
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setCurrentView("home");
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50/50 font-sans" dir="rtl">
      {/* 🔒 لایه مودال تغییر اجباری رمز عبور در صورت فعال بودن پرچم */}
      {user && user.must_change_password && (
        <MustChangePasswordModal
          user={user}
          onSuccess={(updatedUser) => {
            setUser(updatedUser);
          }}
        />
      )}

      {/* سایدبار ناوبری سیستم */}
      <Sidebar user={user} currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} />

      {/* بخش نمایش داینامیک ویوها براساس انتخاب کاربر */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {currentView === "home" && (
          <HomeDashboard 
            user={user} 
            users={users} 
            projects={projects} 
            periods={periods} 
            allReports={allReports} 
          />
        )}
        
        {currentView === "submit_report" && (
          <SubmitReport 
            projects={projects} 
            periods={periods} 
            user={user} 
            allReports={allReports} 
            onRefresh={fetchData}
            onNavigate={(view) => setCurrentView(view)} // 🟢 اصلاح‌شده به setCurrentView
          />
        )}

        {currentView === "my_reports" && (
          <MyReports 
            currentUser={user} 
            reports={allReports} 
            projects={projects} 
            periods={periods} 
            onRefresh={fetchData} 
          />
        )}

        {/* روت‌های مدیریتی */}
        {user.role === "manager" && (
          <>
            {currentView === "manager_dashboard" && <ManagerDashboard periods={periods} projects={projects} users={users} />}
            {currentView === "manage_projects" && <ManageProjects projects={projects} onRefresh={fetchData} />}
            {currentView === "deadline_settings" && <DeadlineSettings settings={deadlineSettings} onRefresh={fetchData} />}
            {currentView === "manage_users" && <ManageUsers users={users} onRefresh={fetchData} />}
            {currentView === "report_periods" && <ReportPeriods periods={periods} onRefresh={fetchData} />}
            {currentView === "project_allocations" && <ProjectAllocations users={users} projects={projects} />}
          </>
        )}
      </main>
    </div>
  );
}