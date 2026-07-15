import { useState, useEffect } from "react";
import {
  User as UserIcon,
  Folder,
  Calendar,
  Clock,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Plus,
  Search,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Paperclip,
  Sparkles,
  RefreshCw,
  Download,
  AlertTriangle,
  Menu,
} from "lucide-react";
import { User, Project, ReportPeriod, Report, DeadlineSetting, DashboardSummary, DashboardRow } from "./types";

export default function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("org_report_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Menu State
  const [currentView, setCurrentView] = useState<string>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // App-wide Data State
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [periods, setPeriods] = useState<ReportPeriod[]>([]);
  const [deadlineSettings, setDeadlineSettings] = useState<DeadlineSetting[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);

  // UI / Action states
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch all app data
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
    if (user) {
      fetchData();
    }
  }, [user]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        localStorage.setItem("org_report_user", JSON.stringify(data.user));
        setCurrentView("home");
      } else {
        setLoginError(data.error || "خطایی رخ داد.");
      }
    } catch (err) {
      setLoginError("ارتباط با سرور برقرار نشد.");
    }
  };

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("org_report_user");
    setCurrentView("home");
  };

  // Helper: Flash message timer
  const flashSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const flashError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 4000);
  };

  // --- 1. SUBMIT REPORT VIEW STATE ---
  const [subReportType, setSubReportType] = useState<"weekly" | "monthly">("weekly");
  const [subPeriodId, setSubPeriodId] = useState<number>(0);
  const [subProjectId, setSubProjectId] = useState<number>(0);
  const [activitiesDone, setActivitiesDone] = useState("");
  const [resultsAchieved, setResultsAchieved] = useState("");
  const [nextActions, setNextActions] = useState("");
  const [kpiText, setKpiText] = useState("");
  const [subFiles, setSubFiles] = useState<FileList | null>(null);

  // Set default submit options when types or lists change
  useEffect(() => {
    const openP = periods.filter((p) => p.report_type === subReportType && p.is_open);
    if (openP.length > 0) {
      setSubPeriodId(openP[0].id);
    } else {
      setSubPeriodId(0);
    }
  }, [subReportType, periods]);

  // Filter projects assigned to current user
  const [userAssignedProjects, setUserAssignedProjects] = useState<Project[]>([]);
  useEffect(() => {
    if (user) {
      fetch("/api/user-projects")
        .then((r) => r.json())
        .then((allocations: any[]) => {
          const myProjectIds = allocations
            .filter((a) => a.user_id === user.id)
            .map((a) => a.project_id);
          const assigned = projects.filter((p) => myProjectIds.includes(p.id) && p.is_active);
          setUserAssignedProjects(assigned);
          if (assigned.length > 0) {
            setSubProjectId(assigned[0].id);
          }
        });
    }
  }, [user, projects]);

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subPeriodId) {
      flashError("لطفاً یک بازه معتبر انتخاب کنید.");
      return;
    }
    if (!subProjectId) {
      flashError("لطفاً یک پروژه انتخاب کنید.");
      return;
    }
    if (!activitiesDone.trim()) {
      flashError("پر کردن فیلد فعالیت‌های انجام‌شده الزامی است.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("user_id", user?.id.toString() || "");
    formData.append("project_id", subProjectId.toString());
    formData.append("report_type", subReportType);
    formData.append("period_id", subPeriodId.toString());
    formData.append("activities_done", activitiesDone);
    formData.append("results_achieved", resultsAchieved);
    formData.append("next_actions", nextActions);
    formData.append("kpi_text", kpiText);

    if (subFiles) {
      for (let i = 0; i < subFiles.length; i++) {
        formData.append("files", subFiles[i]);
      }
    }

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        flashSuccess("گزارش شما با موفقیت ثبت شد.");
        setActivitiesDone("");
        setResultsAchieved("");
        setNextActions("");
        setKpiText("");
        setSubFiles(null);
        // Reset file input value
        const fileInput = document.getElementById("report_files_input") as HTMLInputElement;
        if (fileInput) fileInput.value = "";
        fetchData();
      } else {
        const err = await res.json();
        flashError(err.error || "خطا در ثبت گزارش.");
      }
    } catch (err) {
      flashError("ارتباط با سرور دچار مشکل شد.");
    } finally {
      setLoading(false);
    }
  };

  // --- 2. MY REPORTS VIEW STATE ---
  const [mySearch, setMySearch] = useState("");
  const [myProjFilter, setMyProjFilter] = useState<string>("all");
  const [myTypeFilter, setMyTypeFilter] = useState<string>("all");
  const [myStatusFilter, setMyStatusFilter] = useState<string>("all");
  const [editingReport, setEditingReport] = useState<Report | null>(null);
  const [editActivities, setEditActivities] = useState("");
  const [editResults, setEditResults] = useState("");
  const [editNextActions, setEditNextActions] = useState("");
  const [editKpiText, setEditKpiText] = useState("");
  const [editNewFiles, setEditNewFiles] = useState<FileList | null>(null);
  const [deletedFileIds, setDeletedFileIds] = useState<number[]>([]);

  const handleOpenEditReport = (rep: Report) => {
    setEditingReport(rep);
    setEditActivities(rep.activities_done);
    setEditResults(rep.results_achieved);
    setEditNextActions(rep.next_actions);
    setEditKpiText(rep.kpi_text);
    setDeletedFileIds([]);
    setEditNewFiles(null);
  };

  const handleUpdateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("activities_done", editActivities);
    formData.append("results_achieved", editResults);
    formData.append("next_actions", editNextActions);
    formData.append("kpi_text", editKpiText);
    formData.append("deleted_file_ids", JSON.stringify(deletedFileIds));

    if (editNewFiles) {
      for (let i = 0; i < editNewFiles.length; i++) {
        formData.append("files", editNewFiles[i]);
      }
    }

    try {
      const res = await fetch(`/api/reports/${editingReport.id}`, {
        method: "PUT",
        body: formData,
      });

      if (res.ok) {
        flashSuccess("گزارش با موفقیت به‌روزرسانی شد.");
        setEditingReport(null);
        fetchData();
      } else {
        const err = await res.json();
        flashError(err.error || "خطا در به‌روزرسانی گزارش.");
      }
    } catch (err) {
      flashError("خطا در ارتباط با سرور.");
    } finally {
      setLoading(false);
    }
  };

  // --- 3. MANAGER DASHBOARD VIEW STATE ---
  const [dashPeriodId, setDashPeriodId] = useState<number>(0);
  const [dashProjId, setDashProjId] = useState<string>("all");
  const [dashUserId, setDashUserId] = useState<string>("all");
  const [dashStatusFilter, setDashStatusFilter] = useState<string>("all");
  const [dashSummary, setDashSummary] = useState<DashboardSummary | null>(null);
  const [dashRows, setDashRows] = useState<DashboardRow[]>([]);
  const [viewingReportDetail, setViewingReportDetail] = useState<Report | null>(null);

  // AI Analysis states
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  // Load first period as default in Dashboard
  useEffect(() => {
    if (periods.length > 0 && dashPeriodId === 0) {
      setDashPeriodId(periods[0].id);
    }
  }, [periods, dashPeriodId]);

  const fetchDashboardData = async () => {
    if (dashPeriodId === 0) return;
    try {
      let url = `/api/dashboard/summary?period_id=${dashPeriodId}`;
      if (dashProjId !== "all") url += `&project_id=${dashProjId}`;
      if (dashUserId !== "all") url += `&user_id=${dashUserId}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDashSummary(data.summary);
        setDashRows(data.rows);
      }
    } catch (err) {
      console.error("Error fetching dashboard:", err);
    }
  };

  useEffect(() => {
    if (user?.role === "manager" && dashPeriodId !== 0) {
      fetchDashboardData();
    }
  }, [user, dashPeriodId, dashProjId, dashUserId]);

  const handleAIAnalyze = async () => {
    if (!dashPeriodId) return;
    const activePeriod = periods.find((p) => p.id === dashPeriodId);
    if (!activePeriod) return;

    setAiAnalyzing(true);
    setAiAnalysis("");

    // Gather all currently filtered reports
    const submittedReports = dashRows
      .filter((row) => row.status_key !== "missing" && row.report)
      .map((row) => row.report);

    try {
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_title: activePeriod.title,
          reports: submittedReports,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAiAnalysis(data.analysis);
      } else {
        setAiAnalysis(`خطا: ${data.error || "امکان دریافت تحلیل وجود ندارد."}`);
      }
    } catch (err) {
      setAiAnalysis("خطا در برقراری ارتباط با سرویس هوش مصنوعی.");
    } finally {
      setAiAnalyzing(false);
    }
  };

  // --- 4. PROJECTS VIEW STATE ---
  const [newProjCode, setNewProjCode] = useState("");
  const [newProjTitle, setNewProjTitle] = useState("");
  const [newProjDesc, setNewProjDesc] = useState("");
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjCode.trim() || !newProjTitle.trim()) {
      flashError("کد و عنوان پروژه الزامی هستند.");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newProjCode,
          title: newProjTitle,
          description: newProjDesc,
        }),
      });

      if (res.ok) {
        flashSuccess("پروژه جدید با موفقیت ساخته شد.");
        setNewProjCode("");
        setNewProjTitle("");
        setNewProjDesc("");
        fetchData();
      } else {
        const err = await res.json();
        flashError(err.error || "خطا در ساخت پروژه.");
      }
    } catch (err) {
      flashError("خطا در ارتباط با سرور.");
    }
  };

  const handleToggleProjectStatus = async (proj: Project) => {
    try {
      const res = await fetch(`/api/projects/${proj.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !proj.is_active }),
      });

      if (res.ok) {
        flashSuccess(`پروژه با موفقیت ${!proj.is_active ? "فعال" : "غیرفعال"} شد.`);
        fetchData();
      }
    } catch (err) {
      flashError("خطا در بروزرسانی وضعیت پروژه.");
    }
  };

  // --- 5. DEADLINE SETTINGS VIEW STATE ---
  const handleUpdateDeadline = async (id: number, day: number, time: string) => {
    try {
      const res = await fetch(`/api/deadline-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline_day: day, deadline_time: time }),
      });

      if (res.ok) {
        flashSuccess("تنظیمات ددلاین با موفقیت به‌روزرسانی شد.");
        fetchData();
      } else {
        flashError("خطا در ذخیره‌سازی تغییرات.");
      }
    } catch (err) {
      flashError("خطا در ارتباط با سرور.");
    }
  };

  // --- 6. USER MANAGEMENT VIEW STATE ---
  const [newUsername, setNewUsername] = useState("");
  const [newFullName, setNewFullName] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "manager">("user");
  const [newTemporaryPassword, setNewTemporaryPassword] = useState("123456");
  const [newMustChangePassword, setNewMustChangePassword] = useState(true);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullName.trim()) {
      flashError("نام کاربری و نام خانوادگی الزامی هستند.");
      return;
    }

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          full_name: newFullName,
          role: newUserRole,
          password: newTemporaryPassword,
          must_change_password: newMustChangePassword,
        }),
      });

      if (res.ok) {
        flashSuccess("کاربر جدید با موفقیت ایجاد شد.");
        setNewUsername("");
        setNewFullName("");
        setNewTemporaryPassword("123456");
        fetchData();
      } else {
        const err = await res.json();
        flashError(err.error || "خطا در ایجاد کاربر.");
      }
    } catch (err) {
      flashError("خطا در ارتباط با سرور.");
    }
  };

  const handleToggleUserStatus = async (usr: User) => {
    try {
      const res = await fetch(`/api/users/${usr.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !usr.is_active }),
      });

      if (res.ok) {
        flashSuccess(`کاربر با موفقیت ${!usr.is_active ? "فعال" : "غیرفعال"} شد.`);
        fetchData();
      }
    } catch (err) {
      flashError("خطا در بروزرسانی وضعیت کاربر.");
    }
  };

  const handleResetUserPassword = async (userId: number) => {
    const password_val = prompt("لطفاً رمز عبور جدید را وارد کنید (پیش‌فرض: 123456):", "123456");
    if (password_val === null) return;

    try {
      const res = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temporary_password: password_val }),
      });

      if (res.ok) {
        flashSuccess("رمز عبور کاربر با موفقیت بازنشانی شد.");
        fetchData();
      }
    } catch (err) {
      flashError("خطا در بازنشانی رمز عبور.");
    }
  };

  // --- 7. REPORT PERIOD VIEW STATE ---
  const [newPeriodTitle, setNewPeriodTitle] = useState("");
  const [newPeriodType, setNewPeriodType] = useState<"weekly" | "monthly">("weekly");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPeriodTitle.trim() || !newPeriodStart || !newPeriodEnd) {
      flashError("تکمیل تمامی فیلدها الزامی است.");
      return;
    }

    try {
      const res = await fetch("/api/report-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newPeriodTitle,
          report_type: newPeriodType,
          period_start: newPeriodStart,
          period_end: newPeriodEnd,
        }),
      });

      if (res.ok) {
        flashSuccess("بازه گزارش‌دهی جدید ساخته شد.");
        setNewPeriodTitle("");
        setNewPeriodStart("");
        setNewPeriodEnd("");
        fetchData();
      } else {
        const err = await res.json();
        flashError(err.error || "خطا در ایجاد بازه گزارش.");
      }
    } catch (err) {
      flashError("خطا در ارتباط با سرور.");
    }
  };

  const handleTogglePeriodOpen = async (pe: ReportPeriod) => {
    try {
      const res = await fetch(`/api/report-periods/${pe.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open: !pe.is_open }),
      });

      if (res.ok) {
        flashSuccess(`بازه گزارش با موفقیت ${!pe.is_open ? "باز" : "بسته"} شد.`);
        fetchData();
      }
    } catch (err) {
      flashError("خطا در تغییر وضعیت بازه گزارش.");
    }
  };

  // --- 8. PROJECT ALLOCATION VIEW STATE ---
  const [allocUserId, setAllocUserId] = useState<number>(0);
  const [allocUserProjects, setAllocUserProjects] = useState<number[]>([]);

  // Load assigned projects when selected user changes
  useEffect(() => {
    if (allocUserId !== 0) {
      fetch("/api/user-projects")
        .then((r) => r.json())
        .then((allocations: any[]) => {
          const userProjIds = allocations
            .filter((a) => a.user_id === allocUserId)
            .map((a) => a.project_id);
          setAllocUserProjects(userProjIds);
        });
    } else {
      setAllocUserProjects([]);
    }
  }, [allocUserId]);

  const handleSaveAllocations = async () => {
    if (allocUserId === 0) return;

    try {
      const res = await fetch("/api/user-projects/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: allocUserId,
          project_ids: allocUserProjects,
        }),
      });

      if (res.ok) {
        flashSuccess("تخصیص پروژه‌ها با موفقیت بروزرسانی شد.");
        fetchData();
      } else {
        flashError("خطا در ذخیره تخصیص پروژه‌ها.");
      }
    } catch (err) {
      flashError("خطا در ارتباط با سرور.");
    }
  };

  const handleToggleAllocation = (projId: number) => {
    if (allocUserProjects.includes(projId)) {
      setAllocUserProjects(allocUserProjects.filter((id) => id !== projId));
    } else {
      setAllocUserProjects([...allocUserProjects, projId]);
    }
  };

  // If not logged in, render Login UI
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4 font-sans">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-6 py-8 text-center text-white">
            <img src="/logo.png" alt="لوگوی سازمان" className="h-30 w-30 object-contain inline-block" />
            <h1 className="text-2xl font-bold font-sans tracking-tight">سامانه پیگیری استراتژیک سازمان حمل‌ونقل و ترافیک شهرداری تهران</h1>
            <p className="text-slate-400 mt-2 text-sm">دروازه ورود پرسنل و مدیریت پروژه‌ها</p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {loginError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl flex items-center gap-2 border border-red-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">نام کاربری</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثلاً ahmadi"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 text-sm font-medium mb-1.5">رمز عبور</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 text-white rounded-xl py-2.5 font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <UserIcon className="w-5 h-5" />
              <span>ورود به حساب کاربری</span>
            </button>

            <div className="pt-4 text-center border-t border-slate-100 text-xs text-slate-400">
              راهنما: رمز عبور پیش‌فرض برای تمامی پرسنل <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-medium text-slate-600">123456</code> می‌باشد.
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Common Layout Rendering
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans" dir="rtl">
      {/* Toast Alert Flash Messages */}
      {successMessage && (
        <div className="fixed top-4 left-4 z-50 bg-green-600 text-white font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-green-700 animate-slide-in">
          <CheckCircle2 className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-4 left-4 z-50 bg-red-600 text-white font-medium px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 border border-red-700 animate-slide-in">
          <AlertCircle className="w-5 h-5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Mobile Top Header */}
      <header className="md:hidden bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="لوگوی سازمان" className="h-10 w-10 object-contain inline-block" />
          <span className="font-bold text-lg">پیگیری استراتژیک سازمانی</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 hover:bg-slate-800 rounded transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? "block" : "hidden"
        } md:block w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col border-l border-slate-800 md:min-h-screen flex-shrink-0 z-30`}
      >
        {/* Desktop Sidebar Header */}
        <div className="p-6 hidden md:flex items-center gap-3 border-b border-slate-800">
          <img src="/logo.png" alt="لوگوی سازمان" className="h-15 w-15 object-contain inline-block" />
          <div>
            <h1 className="font-bold text-white text-base">پیگیری استراتژیک سازمانی</h1>
            <p className="text-xs text-slate-400 mt-0.5">پورتال خدمات هوشمند</p>
          </div>
        </div>

        {/* User Info Badge */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-800 text-white rounded-full flex items-center justify-center font-bold">
            {user.full_name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-white text-sm truncate">{user.full_name}</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              نقش: {user.role === "manager" ? "مدیر سیستم" : "کاربر عادی"}
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {/* Public Views */}
          <button
            onClick={() => {
              setCurrentView("home");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentView === "home" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>پیشخوان کاربری</span>
          </button>

          <button
            onClick={() => {
              setCurrentView("submit_report");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentView === "submit_report" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <ClipboardList className="w-4 h-4" />
            <span> ثبت گزارش عملکرد</span>
          </button>

          <button
            onClick={() => {
              setCurrentView("my_reports");
              setMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
              currentView === "my_reports" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span> گزارش‌های من</span>
          </button>

          {/* Manager-only Views */}
          {user.role === "manager" && (
            <>
              <div className="pt-4 pb-2 text-[10px] uppercase tracking-wider font-bold text-slate-500 border-t border-slate-800 mt-4">
                بخش مدیریت سازمان
              </div>

              <button
                onClick={() => {
                  setCurrentView("manager_dashboard");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "manager_dashboard" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span> داشبورد نظارتی مدیر</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("manage_projects");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "manage_projects" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Folder className="w-4 h-4" />
                <span> مدیریت پروژه‌ها</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("deadline_settings");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "deadline_settings" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Clock className="w-4 h-4" />
                <span> تنظیمات ددلاین</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("manage_users");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "manage_users" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Users className="w-4 h-4" />
                <span> مدیریت کاربران</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("report_periods");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "report_periods" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span> بازه‌های گزارش‌دهی</span>
              </button>

              <button
                onClick={() => {
                  setCurrentView("project_allocations");
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                  currentView === "project_allocations" ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"
                }`}
              >
                <Settings className="w-4 h-4" />
                <span> تخصیص پروژه به پرسنل</span>
              </button>
            </>
          )}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج از حساب</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        {/* ========================================================== */}
        {/* VIEW: WELCOME HOME */}
        {/* ========================================================== */}
        {currentView === "home" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3">
                <span className="bg-white/10 text-white text-xs px-3 py-1 rounded-full font-medium">نسخه جدید ۱.۰.۰</span>
                <h2 className="text-2xl md:text-3xl font-extrabold">{user.full_name} عزیز، خوش آمدید.</h2>
                <p className="text-slate-300 text-sm md:text-base">
                  به پرتال سازمانی پیگیری و پایش استراتژیک پروژه‌ها خوش آمدید. امکان ثبت گزارشات در اینجا فراهم است.
                </p>
              </div>
              <span className="text-6xl md:text-7xl">🎯</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm font-medium text-slate-500">کاربران فعال سامانه</div>
                <div className="text-3xl font-bold mt-2 text-slate-950 font-mono">
                  {users.length > 0 ? users.filter((u) => u.is_active).length : "بیشتر از ۱۰"} نفر
                </div>
                <div className="text-xs text-green-600 mt-2 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>تمام پرسنل همگام‌سازی شدند</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm font-medium text-slate-500">پروژه‌های فعال</div>
                <div className="text-3xl font-bold mt-2 text-slate-950 font-mono">
                  {projects.length > 0 ? projects.filter((p) => p.is_active).length : "۳"} پروژه
                </div>
                <div className="text-xs text-blue-600 mt-2 flex items-center gap-1 font-medium">
                  <Folder className="w-3.5 h-3.5" />
                  <span>در حال توسعه و نظارت مستمر</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm font-medium text-slate-500">بازه گزارش‌دهی باز</div>
                <div className="text-3xl font-bold mt-2 text-slate-950 font-mono">
                  {periods.filter((p) => p.is_open).length} بازه فعال
                </div>
                <div className="text-xs text-orange-600 mt-2 flex items-center gap-1 font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  <span>آماده ثبت گزارشات نوبتی</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">امکانات اصلی سامانه</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600 text-sm">
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  ورود امن و اختصاصی کاربران با قابلیت تغییر رمز عبور در اولین ورود
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  ثبت گزارش‌های هفتگی و ماهانه برای پروژه‌های تخصیص‌یافته
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  آپلود فایل‌های پیوست گزارش (Word, Excel, PDF و تصاویر داکیومنت)
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  مدیریت پروژه‌ها، تخصیص نیروها و تنظیم ددلاین‌های خودکار
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  داشبورد نظارتی و مدیریتی به همراه آمارگیری درصدی
                </li>
                <li className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                  تحلیل و خلاصه‌سازی هوشمند گزارشات با هوش مصنوعی
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: SUBMIT REPORT */}
        {/* ========================================================== */}
        {currentView === "submit_report" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">📝 ثبت گزارش جدید</h1>
              <p className="text-slate-500 text-sm mt-1">در این بخش می‌توانید گزارش عملکرد دوره‌ای خود را ثبت نمایید.</p>
            </div>

            {userAssignedProjects.length === 0 ? (
              <div className="bg-amber-50 text-amber-800 p-6 rounded-2xl border border-amber-200 flex gap-4">
                <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-600" />
                <div className="space-y-1">
                  <h4 className="font-bold">عدم تخصیص پروژه مجاز</h4>
                  <p className="text-sm">
                    هیچ پروژه‌ای برای شما تعریف نشده است. جهت ثبت گزارش، مدیریت سامانه ابتدا باید پروژه‌های مجاز شما را در پنل اختصاصی مشخص کند.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1.5">نوع گزارش</label>
                    <select
                      value={subReportType}
                      onChange={(e) => setSubReportType(e.target.value as "weekly" | "monthly")}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value="weekly">گزارش هفتگی</option>
                      <option value="monthly">گزارش ماهانه</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1.5">بازه گزارش‌دهی</label>
                    <select
                      value={subPeriodId}
                      onChange={(e) => setSubPeriodId(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      <option value={0}>-- انتخاب بازه --</option>
                      {periods
                        .filter((p) => p.report_type === subReportType && p.is_open)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} ({p.period_start} تا {p.period_end})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1.5">انتخاب پروژه مربوطه</label>
                    <select
                      value={subProjectId}
                      onChange={(e) => setSubProjectId(parseInt(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    >
                      {userAssignedProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1.5">فعالیت‌های انجام‌شده *</label>
                    <textarea
                      required
                      value={activitiesDone}
                      onChange={(e) => setActivitiesDone(e.target.value)}
                      placeholder="لیست فعالیت‌ها، کارهای توسعه داده شده و جلسات در قالب بندهای مرتب..."
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1.5">نتایج حاصل‌شده</label>
                    <textarea
                      value={resultsAchieved}
                      onChange={(e) => setResultsAchieved(e.target.value)}
                      placeholder="نتایج ملموس، دستاوردها و خروجی‌هایی که بدست آمد..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-slate-700 text-sm font-medium mb-1.5">اقدامات آتی (برنامه‌ریزی دوره‌ی بعد)</label>
                      <textarea
                        value={nextActions}
                        onChange={(e) => setNextActions(e.target.value)}
                        placeholder="کارهایی که در بازه زمانی بعدی قصد انجام آن را دارید..."
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 text-sm font-medium mb-1.5">شاخص‌ها و معیارهای سنجش (KPIs)</label>
                      <textarea
                        value={kpiText}
                        onChange={(e) => setKpiText(e.target.value)}
                        placeholder="درصد پیشرفت کار، متغیرهای کلیدی انجام فعالیت و آمارها..."
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 text-sm font-medium mb-1.5">فایل‌های پیوست گزارش (حداکثر ۱۰ مگابایت)</label>
                  <input
                    type="file"
                    id="report_files_input"
                    multiple
                    onChange={(e) => setSubFiles(e.target.files)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-600 file:ml-4 file:bg-slate-900 file:text-white file:border-none file:px-3 file:py-1 file:rounded-lg file:cursor-pointer hover:file:bg-slate-800"
                  />
                  <p className="text-xs text-slate-400 mt-1">فرمت‌های مجاز: PDF، Word، Excel، تصاویر داکیومنت و زیپ.</p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-slate-900 text-white font-medium px-6 py-2.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>ثبت نهایی گزارش</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: MY REPORTS */}
        {/* ========================================================== */}
        {currentView === "my_reports" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">📄 گزارش‌های ثبت‌شده من</h1>
              <p className="text-slate-500 text-sm mt-1">آرشیو گزارش‌هایی که تاکنون در سامانه ثبت کرده‌اید.</p>
            </div>

            {/* Filter controls */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">جستجو در متن</label>
                <div className="relative">
                  <input
                    type="text"
                    value={mySearch}
                    onChange={(e) => setMySearch(e.target.value)}
                    placeholder="جستجو در فعالیت‌ها..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pr-3 pl-8 py-1.5 text-xs focus:outline-none"
                  />
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">بر اساس پروژه</label>
                <select
                  value={myProjFilter}
                  onChange={(e) => setMyProjFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="all">همه پروژه‌ها</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id.toString()}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">نوع گزارش</label>
                <select
                  value={myTypeFilter}
                  onChange={(e) => setMyTypeFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="all">همه انواع</option>
                  <option value="weekly">هفتگی</option>
                  <option value="monthly">ماهانه</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">وضعیت ددلاین</label>
                <select
                  value={myStatusFilter}
                  onChange={(e) => setMyStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="submitted">ثبت‌شده</option>
                  <option value="late">تأخیری</option>
                </select>
              </div>
            </div>

            {/* Reports list */}
            {allReports.filter((r) => r.user_id === user.id).length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>شما هنوز هیچ گزارشی در سامانه ثبت نکرده‌اید.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {allReports
                  .filter((r) => {
                    if (r.user_id !== user.id) return false;
                    if (myProjFilter !== "all" && r.project_id.toString() !== myProjFilter) return false;
                    if (myTypeFilter !== "all" && r.report_type !== myTypeFilter) return false;
                    if (myStatusFilter !== "all" && r.status !== myStatusFilter) return false;
                    if (
                      mySearch.trim() &&
                      !r.activities_done.toLowerCase().includes(mySearch.toLowerCase()) &&
                      !r.project_title.toLowerCase().includes(mySearch.toLowerCase())
                    )
                      return false;
                    return true;
                  })
                  .map((rep) => (
                    <div key={rep.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all space-y-4">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                        <div>
                          <h4 className="font-bold text-slate-900 text-base">{rep.project_title}</h4>
                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg">
                              {rep.report_type === "weekly" ? "هفتگی" : "ماهانه"} | {rep.period_title}
                            </span>
                            <span>ثبت شده در: {new Date(rep.submitted_at).toLocaleDateString("fa-IR")}</span>
                          </div>
                        </div>

                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            rep.status === "late"
                              ? "bg-orange-50 text-orange-600 border border-orange-100"
                              : "bg-green-50 text-green-600 border border-green-100"
                          }`}
                        >
                          {rep.status === "late" ? "تأخیری" : "ثبت‌شده منظم"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
                        <div>
                          <h5 className="font-bold text-xs text-slate-400 uppercase">فعالیت‌های انجام‌شده</h5>
                          <p className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-3">{rep.activities_done}</p>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-400 uppercase">نتایج حاصل‌شده</h5>
                          <p className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 line-clamp-3">
                            {rep.results_achieved || "ثبت نشده"}
                          </p>
                        </div>
                      </div>

                      {rep.files && rep.files.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <span className="text-xs font-medium text-slate-400">فایل‌های پیوست:</span>
                          {rep.files.map((file) => (
                            <a
                              key={file.id}
                              href={`/uploads/${file.filename}`}
                              download
                              target="_blank"
                              className="text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 px-2 py-1 rounded-lg flex items-center gap-1.5"
                            >
                              <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                              <span className="max-w-[120px] truncate">{file.original_filename}</span>
                            </a>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-end pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleOpenEditReport(rep)}
                          className="text-xs bg-slate-900 text-white hover:bg-slate-800 px-4 py-1.5 rounded-xl transition-all cursor-pointer font-medium"
                        >
                          ویرایش و به‌روزرسانی گزارش
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Edit Report Modal */}
            {editingReport && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
                  <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center rounded-t-3xl">
                    <div>
                      <h3 className="font-bold">ویرایش گزارش</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {editingReport.project_title} - {editingReport.period_title}
                      </p>
                    </div>
                    <button onClick={() => setEditingReport(null)} className="p-1 hover:bg-white/10 rounded-full">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <form onSubmit={handleUpdateReport} className="p-6 space-y-4">
                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1">فعالیت‌های انجام‌شده *</label>
                      <textarea
                        required
                        value={editActivities}
                        onChange={(e) => setEditActivities(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-950"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1">نتایج حاصل‌شده</label>
                      <textarea
                        value={editResults}
                        onChange={(e) => setEditResults(e.target.value)}
                        rows={3}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-950"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 text-xs font-semibold mb-1">اقدامات آتی</label>
                        <textarea
                          value={editNextActions}
                          onChange={(e) => setEditNextActions(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-700 text-xs font-semibold mb-1">شاخص‌ها (KPIs)</label>
                        <textarea
                          value={editKpiText}
                          onChange={(e) => setEditKpiText(e.target.value)}
                          rows={3}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Manage Files */}
                    {editingReport.files && editingReport.files.length > 0 && (
                      <div className="space-y-2">
                        <label className="block text-slate-700 text-xs font-semibold">حذف پیوست‌های موجود</label>
                        <div className="flex flex-wrap gap-2">
                          {editingReport.files.map((file) => {
                            const isDeleted = deletedFileIds.includes(file.id);
                            return (
                              <button
                                type="button"
                                key={file.id}
                                onClick={() => {
                                  if (isDeleted) {
                                    setDeletedFileIds(deletedFileIds.filter((id) => id !== file.id));
                                  } else {
                                    setDeletedFileIds([...deletedFileIds, file.id]);
                                  }
                                }}
                                className={`text-xs border px-2 py-1 rounded-lg flex items-center gap-1.5 transition-colors ${
                                  isDeleted
                                    ? "bg-red-50 text-red-600 border-red-200 line-through"
                                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200"
                                }`}
                              >
                                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                                <span>{file.original_filename}</span>
                                {isDeleted ? <Plus className="w-3.5 h-3.5 rotate-45" /> : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-700 text-xs font-semibold mb-1">آپلود پیوست‌های جدید</label>
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setEditNewFiles(e.target.files)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setEditingReport(null)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2 rounded-xl text-xs"
                      >
                        انصراف
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2 rounded-xl text-xs flex items-center gap-1"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>بروزرسانی نهایی</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: MANAGER DASHBOARD */}
        {/* ========================================================== */}
        {currentView === "manager_dashboard" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">📊 داشبورد نظارتی گزارش‌ها</h1>
              <p className="text-slate-500 text-sm mt-1">پنل پایش عملکرد، نظارت بر ددلاین‌ها و تحلیل جامع هوش مصنوعی.</p>
            </div>

            {/* Dashboard Filters */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">انتخاب بازه گزارش‌دهی</label>
                <select
                  value={dashPeriodId}
                  onChange={(e) => setDashPeriodId(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-950"
                >
                  <option value={0}>-- انتخاب بازه --</option>
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.report_type === "weekly" ? "هفتگی" : "ماهانه"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">فیلتر پروژه</label>
                <select
                  value={dashProjId}
                  onChange={(e) => setDashProjId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="all">همه پروژه‌ها</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">فیلتر پرسنل</label>
                <select
                  value={dashUserId}
                  onChange={(e) => setDashUserId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="all">همه کاربران</option>
                  {users
                    .filter((u) => u.role === "user")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">وضعیت دلیوری</label>
                <select
                  value={dashStatusFilter}
                  onChange={(e) => setDashStatusFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="all">همه وضعیت‌ها</option>
                  <option value="submitted">ثبت‌شده</option>
                  <option value="late">تأخیری</option>
                  <option value="missing">ثبت‌نشده</option>
                </select>
              </div>
            </div>

            {/* Metrics cards */}
            {dashSummary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                  <span className="text-slate-400 text-xs font-medium">مورد انتظار کل</span>
                  <div className="text-2xl font-bold mt-1 text-slate-900 font-mono">{dashSummary.total_expected} مورد</div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-r-4 border-r-green-500">
                  <span className="text-slate-400 text-xs font-medium">ثبت‌شده به موقع</span>
                  <div className="text-2xl font-bold mt-1 text-green-600 font-mono">{dashSummary.submitted_count} مورد</div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-r-4 border-r-orange-500">
                  <span className="text-slate-400 text-xs font-medium">ثبت‌شده با تأخیر</span>
                  <div className="text-2xl font-bold mt-1 text-orange-600 font-mono">{dashSummary.late_count} مورد</div>
                </div>

                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-r-4 border-r-red-500">
                  <span className="text-slate-400 text-xs font-medium">اقدام نشده (مفقود)</span>
                  <div className="text-2xl font-bold mt-1 text-red-600 font-mono">{dashSummary.missing_count} مورد</div>
                </div>
              </div>
            )}

            {/* AI Summary Block */}
            <div className="bg-gradient-to-br from-indigo-550 to-purple-650 bg-slate-900 rounded-3xl p-6 text-white shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
                  <h3 className="font-bold text-lg">تحلیل هوشمند گزارشات با Gemini AI</h3>
                </div>
                <button
                  onClick={handleAIAnalyze}
                  disabled={aiAnalyzing || dashPeriodId === 0}
                  className="bg-white text-slate-900 text-xs font-bold px-4 py-2 rounded-xl shadow hover:bg-slate-100 cursor-pointer disabled:opacity-50 transition-all flex items-center gap-1.5"
                >
                  {aiAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>دریافت تحلیل هوش مصنوعی</span>
                </button>
              </div>

              <p className="text-slate-300 text-xs">
                سامانه هوش مصنوعی با تجمیع تمام بندهای گزارشات ثبت شده، وضعیت پیشرفت پروژه‌ها را جمع‌بندی کرده و ریسک‌ها و تاخیرها را استخراج می‌کند.
              </p>

              {aiAnalysis ? (
                <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-slate-100 text-xs leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis}
                </div>
              ) : (
                aiAnalyzing && (
                  <div className="bg-white/5 p-8 rounded-2xl border border-white/5 text-center text-xs text-slate-400 flex items-center justify-center gap-3">
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>هوش مصنوعی در حال مطالعه گزارشات و تهیه تحلیل نهایی می‌باشد، لطفاً منتظر بمانید...</span>
                  </div>
                )
              )}
            </div>

            {/* Submissions Detail Table */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-base">لیست پایش و دسترسی به فایل‌ها</h3>
                <span className="text-xs text-slate-400">تعداد کل رکوردها: {dashRows.length} مورد</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                      <th className="px-6 py-3">نام پرسنل</th>
                      <th className="px-6 py-3">پروژه مربوطه</th>
                      <th className="px-6 py-3">وضعیت نهایی</th>
                      <th className="px-6 py-3">زمان ارسال</th>
                      <th className="px-6 py-3">پیوست</th>
                      <th className="px-6 py-3 text-left">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {dashRows
                      .filter((row) => {
                        if (dashStatusFilter !== "all" && row.status_key !== dashStatusFilter) return false;
                        return true;
                      })
                      .map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900">{row.user_full_name}</td>
                          <td className="px-6 py-4">{row.project_title}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-semibold ${
                                row.status_key === "submitted"
                                  ? "bg-green-50 text-green-600 border border-green-100"
                                  : row.status_key === "late"
                                  ? "bg-orange-50 text-orange-600 border border-orange-100"
                                  : "bg-red-50 text-red-600 border border-red-100"
                              }`}
                            >
                              {row.status_label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {row.report ? new Date(row.report.submitted_at).toLocaleDateString("fa-IR") : "ارسال نشده"}
                          </td>
                          <td className="px-6 py-4">
                            {row.report?.files && row.report.files.length > 0 ? (
                              <span className="flex items-center gap-1 text-slate-400">
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>{row.report.files.length} فایل</span>
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-6 py-4 text-left">
                            {row.report ? (
                              <button
                                onClick={() => setViewingReportDetail(row.report)}
                                className="text-slate-900 hover:text-slate-850 font-bold hover:underline cursor-pointer"
                              >
                                مشاهده گزارش
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Report Detail Modal */}
            {viewingReportDetail && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
                  <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center rounded-t-3xl">
                    <div>
                      <h3 className="font-bold">بررسی جزئی گزارش پرسنل</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        فرستنده: {viewingReportDetail.user_full_name} ({viewingReportDetail.period_title})
                      </p>
                    </div>
                    <button onClick={() => setViewingReportDetail(null)} className="p-1 hover:bg-white/10 rounded-full">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-5 text-sm text-slate-700">
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-xs text-slate-400 font-bold block">پروژه هدف:</span>
                        <span className="font-bold text-slate-900">{viewingReportDetail.project_title}</span>
                      </div>
                      <div>
                        <span className="text-xs text-slate-400 font-bold block">زمان دقیق ثبت:</span>
                        <span>{new Date(viewingReportDetail.submitted_at).toLocaleString("fa-IR")}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <h5 className="font-bold text-xs text-slate-400 uppercase">فعالیت‌های انجام‌شده:</h5>
                        <p className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                          {viewingReportDetail.activities_done}
                        </p>
                      </div>

                      <div>
                        <h5 className="font-bold text-xs text-slate-400 uppercase">نتایج حاصل‌شده:</h5>
                        <p className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed">
                          {viewingReportDetail.results_achieved || "ثبت نشده است"}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-bold text-xs text-slate-400 uppercase">اقدامات آتی:</h5>
                          <p className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
                            {viewingReportDetail.next_actions || "ثبت نشده"}
                          </p>
                        </div>
                        <div>
                          <h5 className="font-bold text-xs text-slate-400 uppercase">شاخص‌ها و درصد پیشرفت:</h5>
                          <p className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap font-mono">
                            {viewingReportDetail.kpi_text || "ثبت نشده"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {viewingReportDetail.files && viewingReportDetail.files.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <h5 className="font-bold text-xs text-slate-400 uppercase">دانلود فایل‌های پیوست:</h5>
                        <div className="flex flex-wrap gap-2">
                          {viewingReportDetail.files.map((file) => (
                            <a
                              key={file.id}
                              href={`/uploads/${file.filename}`}
                              download
                              target="_blank"
                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                            >
                              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                              <span>{file.original_filename}</span>
                              <Download className="w-3.5 h-3.5 text-slate-400 ml-1" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: MANAGE PROJECTS */}
        {/* ========================================================== */}
        {currentView === "manage_projects" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">📂 مدیریت پروژه‌ها</h1>
              <p className="text-slate-500 text-sm mt-1">تعریف پروژه‌های جدید و کنترل فعال/غیرفعال بودن آن‌ها در سازمان.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Creation Form */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 h-fit space-y-4 shadow-sm">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">ساخت پروژه جدید</h3>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">کد اختصاصی پروژه</label>
                    <input
                      type="text"
                      required
                      value={newProjCode}
                      onChange={(e) => setNewProjCode(e.target.value)}
                      placeholder="مثلاً PRJ-MOB-105"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">عنوان کامل پروژه</label>
                    <input
                      type="text"
                      required
                      value={newProjTitle}
                      onChange={(e) => setNewProjTitle(e.target.value)}
                      placeholder="مثلاً توسعه مسیر سرزندگی"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">توضیحات و اهداف کلان</label>
                    <textarea
                      value={newProjDesc}
                      onChange={(e) => setNewProjDesc(e.target.value)}
                      placeholder="شرح مختصری در رابطه با اهداف پروژه..."
                      rows={3}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ایجاد و ثبت پروژه</span>
                  </button>
                </form>
              </div>

              {/* Projects List */}
              <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">لیست پروژه‌های فعال و غیرفعال</h3>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {projects.map((proj) => (
                    <div key={proj.id} className="p-4 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                      <div className="space-y-1.5 max-w-[70%]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{proj.title}</span>
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold text-slate-500">
                            {proj.code}
                          </code>
                        </div>
                        <p className="text-slate-500 leading-relaxed text-xs">{proj.description || "بدون توضیحات."}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold ${
                            proj.is_active
                              ? "bg-green-50 text-green-600 border border-green-100"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {proj.is_active ? "فعال" : "غیرفعال"}
                        </span>

                        <button
                          onClick={() => handleToggleProjectStatus(proj)}
                          className={`font-bold px-3 py-1 rounded-xl cursor-pointer ${
                            proj.is_active
                              ? "text-red-500 bg-red-50 hover:bg-red-100"
                              : "text-green-500 bg-green-50 hover:bg-green-100"
                          }`}
                        >
                          {proj.is_active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: DEADLINE SETTINGS */}
        {/* ========================================================== */}
        {currentView === "deadline_settings" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">⏱️ تنظیمات ددلاین گزارش‌دهی</h1>
              <p className="text-slate-500 text-sm mt-1">تعیین مهلت مجاز جهت ارسال گزارشات و مشخص کردن تأخیرها.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {deadlineSettings.map((dl) => {
                const daysOfWeek = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
                return (
                  <div key={dl.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                    <h3 className="font-bold text-slate-950 border-b border-slate-100 pb-2">
                      ددلاین {dl.report_type === "weekly" ? "گزارش‌های هفتگی" : "گزارش‌های ماهانه"}
                    </h3>

                    <div className="space-y-4 text-xs">
                      {dl.report_type === "weekly" ? (
                        <div>
                          <label className="block text-slate-600 font-medium mb-1.5">روز ددلاین در هفته</label>
                          <select
                            defaultValue={dl.deadline_day}
                            id={`dl-day-${dl.id}`}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2"
                          >
                            {daysOfWeek.map((day, index) => (
                              <option key={index} value={index}>
                                {day}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-slate-600 font-medium mb-1.5">روز ددلاین در ماه</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            id={`dl-day-${dl.id}`}
                            defaultValue={dl.deadline_day}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-left"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-slate-600 font-medium mb-1.5">ساعت دقیق سررسید ددلاین</label>
                        <input
                          type="time"
                          id={`dl-time-${dl.id}`}
                          defaultValue={dl.deadline_time}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-left"
                        />
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => {
                            const dayInput = document.getElementById(`dl-day-${dl.id}`) as HTMLSelectElement | HTMLInputElement;
                            const timeInput = document.getElementById(`dl-time-${dl.id}`) as HTMLInputElement;
                            if (dayInput && timeInput) {
                              handleUpdateDeadline(dl.id, parseInt(dayInput.value), timeInput.value);
                            }
                          }}
                          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-xl text-xs cursor-pointer text-center"
                        >
                          ذخیره تنظیمات ددلاین
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: MANAGE USERS */}
        {/* ========================================================== */}
        {currentView === "manage_users" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">👤 مدیریت کاربران و پرسنل</h1>
              <p className="text-slate-500 text-sm mt-1">ساخت اکانت برای پرسنل، فعال/غیرفعال کردن کاربران و تغییر رمز عبور.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* User Creator */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm h-fit space-y-4">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">ثبت نام کاربر جدید</h3>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">نام کاربری (انگلیسی)</label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="مثلاً rezai"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-left"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">نام و نام خانوادگی (فارسی)</label>
                    <input
                      type="text"
                      required
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      placeholder="مثلاً نرگس رضایی"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">نقش دسترسی کاربر</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as "user" | "manager")}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="user">کاربر عادی (پرسنل)</option>
                      <option value="manager">مدیر سیستم (سرپرست)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">رمز عبور اولیه موقت</label>
                    <input
                      type="password"
                      value={newTemporaryPassword}
                      onChange={(e) => setNewTemporaryPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-left"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="must-change-pw"
                      checked={newMustChangePassword}
                      onChange={(e) => setNewMustChangePassword(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="must-change-pw" className="text-xs text-slate-600">
                      اجبار به تغییر رمز عبور در اولین ورود به سامانه
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ایجاد حساب کاربری</span>
                  </button>
                </form>
              </div>

              {/* Users List */}
              <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">لیست کاربران ثبت‌شده در سامانه</h3>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {users.map((usr) => (
                    <div key={usr.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{usr.full_name}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span>نام کاربری: @{usr.username}</span>
                          <span>•</span>
                          <span>دسترسی: {usr.role === "manager" ? "مدیر" : "کاربر عادی"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-semibold ${
                            usr.is_active
                              ? "bg-green-50 text-green-600 border border-green-100"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {usr.is_active ? "فعال" : "غیرفعال"}
                        </span>

                        <button
                          onClick={() => handleToggleUserStatus(usr)}
                          className={`px-3 py-1 rounded-xl font-medium cursor-pointer ${
                            usr.is_active
                              ? "text-red-600 bg-red-50 hover:bg-red-100"
                              : "text-green-600 bg-green-50 hover:bg-green-100"
                          }`}
                        >
                          {usr.is_active ? "غیرفعال" : "فعال‌سازی"}
                        </button>

                        <button
                          onClick={() => handleResetUserPassword(usr.id)}
                          className="text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-xl font-medium cursor-pointer"
                        >
                          بازنشانی رمز
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: REPORT PERIODS */}
        {/* ========================================================== */}
        {currentView === "report_periods" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">🗓️ مدیریت بازه‌های گزارش‌دهی</h1>
              <p className="text-slate-500 text-sm mt-1">تعریف بازه جدید (هفتگی و ماهانه) و فعال/غیرفعال کردن پذیرش گزارشات.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Creator Form */}
              <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm h-fit space-y-4">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">ساخت دوره گزارش جدید</h3>
                <form onSubmit={handleCreatePeriod} className="space-y-4">
                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">عنوان بازه (فارسی)</label>
                    <input
                      type="text"
                      required
                      value={newPeriodTitle}
                      onChange={(e) => setNewPeriodTitle(e.target.value)}
                      placeholder="مثلاً هفته چهارم تیر ۱۴۰۵"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">نوع دوره گزارش‌دهی</label>
                    <select
                      value={newPeriodType}
                      onChange={(e) => setNewPeriodType(e.target.value as "weekly" | "monthly")}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    >
                      <option value="weekly">هفتگی</option>
                      <option value="monthly">ماهانه</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">تاریخ شروع دوره</label>
                    <input
                      type="date"
                      required
                      value={newPeriodStart}
                      onChange={(e) => setNewPeriodStart(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-left"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 text-xs font-semibold mb-1">تاریخ پایان دوره</label>
                    <input
                      type="date"
                      required
                      value={newPeriodEnd}
                      onChange={(e) => setNewPeriodEnd(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-left"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl py-2 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>ایجاد بازه گزارش</span>
                  </button>
                </form>
              </div>

              {/* Periods List */}
              <div className="md:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">لیست دوره‌های گزارش هفتگی و ماهانه</h3>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {periods.map((pe) => (
                    <div key={pe.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{pe.title}</h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                          <span>نوع: {pe.report_type === "weekly" ? "هفتگی" : "ماهانه"}</span>
                          <span>•</span>
                          <span>بازه: {pe.period_start} تا {pe.period_end}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-semibold ${
                            pe.is_open
                              ? "bg-green-50 text-green-600 border border-green-100"
                              : "bg-slate-100 text-slate-400 border border-slate-200"
                          }`}
                        >
                          {pe.is_open ? "پذیرش فعال" : "بسته شده"}
                        </span>

                        <button
                          onClick={() => handleTogglePeriodOpen(pe)}
                          className={`px-3 py-1 rounded-xl font-medium cursor-pointer ${
                            pe.is_open
                              ? "text-red-600 bg-red-50 hover:bg-red-100"
                              : "text-green-600 bg-green-50 hover:bg-green-100"
                          }`}
                        >
                          {pe.is_open ? "بستن بازه" : "باز کردن مجدد"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW: PROJECT ALLOCATION */}
        {/* ========================================================== */}
        {currentView === "project_allocations" && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-2xl font-bold text-slate-950">📌 تخصیص پروژه‌ها به نیروها</h1>
              <p className="text-slate-500 text-sm mt-1">مشخص کردن پروژه‌های مجاز برای هر یک از پرسنل جهت ارسال گزارش.</p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
              <div>
                <label className="block text-slate-700 text-sm font-semibold mb-2">انتخاب پرسنل جهت تخصیص</label>
                <select
                  value={allocUserId}
                  onChange={(e) => setAllocUserId(parseInt(e.target.value))}
                  className="w-full md:w-80 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                >
                  <option value={0}>-- انتخاب کنید --</option>
                  {users
                    .filter((u) => u.role === "user")
                    .map((usr) => (
                      <option key={usr.id} value={usr.id}>
                        {usr.full_name} (@{usr.username})
                      </option>
                    ))}
                </select>
              </div>

              {allocUserId !== 0 ? (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                    پروژه‌های قابل دسترسی کارشناس:
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projects
                      .filter((p) => p.is_active)
                      .map((proj) => {
                        const isAllocated = allocUserProjects.includes(proj.id);
                        return (
                          <div
                            key={proj.id}
                            onClick={() => handleToggleAllocation(proj.id)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                              isAllocated
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                            }`}
                          >
                            <div>
                              <div className="font-bold text-xs">{proj.title}</div>
                              <div className={`text-[10px] mt-1 ${isAllocated ? "text-slate-300" : "text-slate-400"}`}>
                                کد پروژه: {proj.code}
                              </div>
                            </div>

                            <input type="checkbox" checked={isAllocated} readOnly className="rounded" />
                          </div>
                        );
                      })}
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={handleSaveAllocations}
                      className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-2 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ذخیره تخصیص‌ها</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                  لطفاً ابتدا یکی از پرسنل را از منوی بالا انتخاب کنید تا لیست پروژه‌ها نمایان شود.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
