// src/App.tsx
import { useState, useEffect } from "react";
import { User, Project, ReportPeriod, Report, DeadlineSetting } from "./types";
import Sidebar from "./components/Sidebar";

// وارد کردن تمام ویوهای ماژولار (که در پوشه views می‌سازیم)
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
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("org_report_user");
    return saved ? JSON.parse(saved) : null;
  });
  
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

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("org_report_user");
    setCurrentView("home");
  };

  if (!user) {
    // اینجا فرم لاگین قدیمی‌ات را که در App.old.tsx داری قرار می‌دهی
    return <p className="text-center p-10">لطفاً وارد شوید...</p>; 
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50/50 font-sans" dir="rtl">
      {/* سایدبار ناوبری سیستم */}
      <Sidebar user={user} currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} />

      {/*بخش نمایش داینامیک ویوها براساس انتخاب کاربر */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {currentView === "home" && <HomeDashboard users={users} projects={projects} periods={periods} user={user} />}
        {currentView === "submit_report" && <SubmitReport projects={projects} periods={periods} user={user} onRefresh={fetchData} />}
        {currentView === "my_reports" && <MyReports projects={projects} allReports={allReports} user={user} onRefresh={fetchData} />}
        
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
