export interface User {
  id: number;
  username: string;
  full_name: string;
  role: "user" | "manager";
  job_title?: string | null ;
  is_active: boolean;
  must_change_password: boolean;
  password_changed_at: string | null;
  created_at: string;
  updatedAt?: string;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  wbs_file_name?: string | null; 
  code: string;
  is_active: boolean;
  created_at: string;
  updatedAt?: string;  
}

export interface ReportPeriod {
  id: number;
  title: string;
  report_type: "weekly" | "monthly";
  period_start: string; // YYYY-MM-DD
  period_end: string;   // YYYY-MM-DD
  is_open: boolean;
  created_at: string;
}

export interface UserProject {
  id: number;
  user_id: number;
  project_id: number;
  created_at: string;
}

export interface ReportFile {
  id: number;
  report_id: number;
  filename: string;
  original_filename: string;
  file_size: number;
  created_at: string;
}

export interface NextAction {
  id: number;
  report_id: number;
  action_text: string;
  target_date: string; // تاریخ به صورت رشته متنی "YYYY-MM-DD" از API می‌آید
}

export interface Report {
  id: number;
  user_id: number;
  user_full_name: string;
  user_username: string;
  project_id: number;
  project_title: string;
  report_type: "weekly" | "monthly";
  period_id: number;
  period_title: string;
  period_start: string;
  period_end: string;
  activities_done: string;
  results_achieved: string;
  kpi_text: string;
  status: "submitted" | "late";
  submitted_at: string;
  files: ReportFile[];
  nextActions?: NextAction[];
}

export interface DeadlineSetting {
  id: number;
  report_type: "weekly" | "monthly";
  deadline_day: number; // For weekly: 0=Saturday, 1=Sunday... (or day of week). For monthly: day of month (1-31)
  deadline_time: string; // HH:MM
}

export interface DashboardSummary {
  total_expected: number;
  submitted_count: number;
  late_count: number;
  missing_count: number;
}

export interface DashboardRow {
  user_id: number;
  user_full_name: string;
  user_username: string;
  project_title: string;
  status_key: "submitted" | "late" | "missing";
  status_label: string;
  report: Report | null;
}
