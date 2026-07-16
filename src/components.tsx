// components.tsx
import { useState, useRef, useEffect } from "react";
import {
  gregorianToShamsi,
  shamsiToGregorian,
  getShamsiMonthDays,
  SHAMSI_MONTH_NAMES,
  toPersianDigits
} from "./dateUtils";

// --- CUSTOM SELECT DROPDOWN ---
interface Option {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (val: any) => void;
  options: Option[];
  className?: string;
  dir?: "rtl" | "ltr";
}

export function CustomSelect({ value, onChange, options, className = "", dir = "rtl" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Find selected option
  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : "";

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} dir={dir}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-xs text-right cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all hover:bg-slate-100"
      >
        <span className="truncate">{displayLabel || "انتخاب کنید..."}</span>
        <svg
          className={`w-4 h-4 text-slate-500 mr-2 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100 max-h-60 overflow-y-auto">
          <div className="py-1">
            {options.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full text-right px-4 py-2 text-xs transition-colors hover:bg-slate-50 cursor-pointer ${
                    isSelected ? "bg-slate-100 text-blue-600 font-semibold" : "text-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- SHAMSI DATE PICKER COMPONENT ---
interface ShamsiDatePickerProps {
  value: string; // YYYY-MM-DD (Gregorian)
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}

export function ShamsiDatePicker({ value, onChange, className = "", placeholder = "تاریخ را انتخاب کنید" }: ShamsiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse today's date in Shamsi calendar
  const today = new Date();
  const todayShamsi = gregorianToShamsi(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
  ) || { year: 1405, month: 4, day: 16 };

  const selectedShamsi = gregorianToShamsi(value);

  // Calendar states
  const [currentYear, setCurrentYear] = useState(selectedShamsi ? selectedShamsi.year : todayShamsi.year);
  const [currentMonth, setCurrentMonth] = useState(selectedShamsi ? selectedShamsi.month : todayShamsi.month);

  // Sync state if selected value changes
  useEffect(() => {
    if (selectedShamsi) {
      setCurrentYear(selectedShamsi.year);
      setCurrentMonth(selectedShamsi.month);
    }
  }, [value]);

  // Close calendar popover on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Generate calendar grid
  const daysInMonth = getShamsiMonthDays(currentYear, currentMonth);
  const gFirstDayStr = shamsiToGregorian(currentYear, currentMonth, 1);
  const gFirstDay = new Date(gFirstDayStr);
  const startWeekday = (gFirstDay.getDay() + 1) % 7; // Convert JS Sunday=0 to Persian Saturday=0

  const daysGrid: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) {
    daysGrid.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    daysGrid.push(i);
  }

  const displayValue = selectedShamsi
    ? toPersianDigits(`${selectedShamsi.year}/${String(selectedShamsi.month).padStart(2, "0")}/${String(selectedShamsi.day).padStart(2, "0")}`)
    : "";

  const handleDaySelect = (day: number) => {
    const gDate = shamsiToGregorian(currentYear, currentMonth, day);
    onChange(gDate);
    setIsOpen(false);
  };

  const yearsList: number[] = [];
  for (let y = 1400; y <= 1420; y++) {
    yearsList.push(y);
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} dir="rtl">
      <div className="relative">
        <input
          type="text"
          readOnly
          value={displayValue}
          onClick={() => setIsOpen(!isOpen)}
          placeholder={placeholder}
          className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-xs text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all hover:bg-slate-100"
        />
        <div className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-72 left-0 md:right-0 md:left-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
                className="bg-transparent border-none text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                {SHAMSI_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(parseInt(e.target.value))}
                className="bg-transparent border-none text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(String(y))}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-100 rounded-lg cursor-pointer text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1.5">
            <div>ش</div>
            <div>ی</div>
            <div>د</div>
            <div>س</div>
            <div>چ</div>
            <div>پ</div>
            <div>ج</div>
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="w-8 h-8" />;
              }

              const isSelected = selectedShamsi &&
                selectedShamsi.year === currentYear &&
                selectedShamsi.month === currentMonth &&
                selectedShamsi.day === day;

              const isDayToday = todayShamsi &&
                todayShamsi.year === currentYear &&
                todayShamsi.month === currentMonth &&
                todayShamsi.day === day;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`w-8 h-8 text-xs rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-900 text-white font-bold"
                      : isDayToday
                      ? "border border-blue-600 text-blue-600 font-bold"
                      : "hover:bg-slate-100 text-slate-800"
                  }`}
                >
                  {toPersianDigits(String(day))}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// --- DEADLINE CARD COMPONENT ---
interface DeadlineSetting {
  id: number;
  report_type: "weekly" | "monthly";
  deadline_day: number;
  deadline_time: string;
}

interface DeadlineCardProps {
  dl: DeadlineSetting;
  onUpdate: (id: number, day: number, time: string) => void;
}

export function DeadlineCard({ dl, onUpdate }: DeadlineCardProps) {
  const [day, setDay] = useState(dl.deadline_day);
  const [time, setTime] = useState(dl.deadline_time);

  const daysOfWeek = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
      <h3 className="font-bold text-slate-950 border-b border-slate-100 pb-2">
        ددلاین {dl.report_type === "weekly" ? "گزارش‌های هفتگی" : "گزارش‌های ماهانه"}
      </h3>

      <div className="space-y-4 text-xs">
        {dl.report_type === "weekly" ? (
          <div>
            <label className="block text-slate-600 font-medium mb-1.5">روز ددلاین در هفته</label>
            <CustomSelect
              value={day}
              onChange={(val) => setDay(Number(val))}
              options={daysOfWeek.map((d, index) => ({
                value: index,
                label: d
              }))}
            />
          </div>
        ) : (
          <div>
            <label className="block text-slate-600 font-medium mb-1.5">روز ددلاین در ماه</label>
            <input
              type="number"
              min={1}
              max={31}
              value={day}
              onChange={(e) => setDay(parseInt(e.target.value) || 1)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-left"
            />
          </div>
        )}

        <div>
          <label className="block text-slate-600 font-medium mb-1.5">ساعت دقیق سررسید ددلاین</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-left"
          />
        </div>

        <div className="pt-2">
          <button
            onClick={() => onUpdate(dl.id, day, time)}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2 rounded-xl text-xs cursor-pointer text-center"
          >
            ذخیره تنظیمات ددلاین
          </button>
        </div>
      </div>
    </div>
  );
}
