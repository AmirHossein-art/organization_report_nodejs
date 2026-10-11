# Implementation Plan: Dual-Surface KPI Visualization & Performance

**Branch**: `kpi-dual-surface-visualization` | **Date**: 2026-10-03 | **Spec**: `.specify/specs/kpi-dual-surface-visualization.md`

## Summary
Transform project KPI presentation into two specialized surfaces:
1. **A4 PDF & Raw Report Surface:** Replace loose text in `ReportsPdfDocument.tsx` with a single, unified 6-column compact matrix table containing inline micro-progress bars styled with printable CSS.
2. **Staff Entry Surface:** Introduce lightweight, zero-dependency visual comparison gauges in `MyReports.tsx` to provide immediate contextual feedback and prevent input magnitude mistakes.
3. **Performance Optimization:** Eliminate the full-database re-fetch storm upon saving (`fetch("/api/reports")`), transitioning to single-record local state updates.

## Technical Context
- **Frontend**: React 18 + Vite, Tailwind CSS, Lucide icons, Recharts (`^2.12.7`)
- **Backend / ORM**: Express 4, Prisma 7, PostgreSQL (pg driver)
- **Target Surfaces**: Modern browsers (Chrome/Edge/Firefox) + A4 print geometry (`@media print` and preview iframe)
- **Constraints**: Zero new NPM packages; sub-300ms UI save feedback; strict RTL & Persian digit preservation.

## Constitution Compliance Check
- [x] **I. Persian-First RTL & Shamsi**: All column headers, number formatting (`toPersianDigits`), and progress labels follow RTL conventions.
- [x] **II. Single Process Monolith**: No external background services or microservices required.
- [x] **III. Historical Data Determinism**: KPI snapshot relations (`ReportKpiValue`) remain intact.
- [x] **IV. Multi-Provider AI**: Unaffected.
- [x] **V. Additive & Strict Verification**: Schema untouched (existing Prisma models suffice); `npm run build` must compile with 0 errors.

## Component Architecture & Changes

### 1. Compact A4 Matrix Table (`src/components/KpiMatrixTable.tsx` & `ReportsPdfDocument.tsx`)
- Standardized 7-column table: `ردیف | عنوان شاخص | واحد | مبنا | عملکرد دوره | هدف | پیشرفت کل پروژه`
- Embedded Segmented Micro-Progress Bar:
  - Width: 100px with print-safe CSS (`print-color-adjust: exact`).
  - Segment 1: Prior accumulated baseline in dark slate (`#475569`).
  - Segment 2: Period growth newly added in vibrant emerald (`#10b981`).
  - Remaining: Clean gray track.
- Direct status indicators: Total progress percentage (e.g. `۷.۱۵٪`) and growth badge (e.g. `+۲.۱۵٪`).

### 2. Live Interactive Input with Regression Guardrail (`src/components/KpiInteractiveInput.tsx`)
- Reusable component deployed across `MyReports.tsx` and `SubmitReport.tsx`:
  - Enforces `min={baseline}` to block regression of cumulative progress.
  - Immediate visual warning when value drops below previous baseline.
  - Live dual-color progress gauge directly beneath the input with Persian legend.
  - Zero heavy charting dependencies (pure lightweight HTML/CSS/SVG).

### 3. Save Latency & State Merge Optimization (`src/views/MyReports.tsx` & `src/App.tsx`)
- Modify `handleSave`:
  - On 200/201 response, parse the returned single serialized `newReport`.
  - Update local state in `MyReports` directly (`setAllReports((prev) => [newReport, ...prev.filter(r => r.id !== newReport.id)])`).
  - Eliminate redundant calls to `fetch("/api/reports")`.

## Verification Gates
1. Run `npm run build` to verify zero TypeScript or bundle errors.
2. Verify visual alignment in PDF Print Preview modal across 1-page and multi-page reports.
3. Test staff report submission response time.
