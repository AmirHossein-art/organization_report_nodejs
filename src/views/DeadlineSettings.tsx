// src/views/DeadlineSettings.tsx
import { DeadlineSetting } from "../types";
import { DeadlineCard } from "../components";

interface DeadlineSettingsProps {
  settings: DeadlineSetting[];
  onRefresh: () => void;
}

export default function DeadlineSettings({ settings, onRefresh }: DeadlineSettingsProps) {
  const handleUpdateDeadline = async (id: number, day: number, time: string) => {
    try {
      const res = await fetch(`/api/deadline-settings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deadline_day: day, deadline_time: time }),
      });
      if (res.ok) onRefresh();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6 anonymity-fade-in text-xs">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-950">⏱️ تنظیمات مهلت زمانی و ددلاین‌ها</h1>
        <p className="text-slate-500 text-xs mt-1">تعیین دقیق روز و ساعت پایان پذیرش گزارشات به منظور قفل خودکار فرم ثبت عملکرد.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settings.map((dl) => (
          <DeadlineCard key={dl.id} dl={dl} onUpdate={handleUpdateDeadline} />
        ))}
      </div>
    </div>
  );
}