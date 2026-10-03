# Feature Specification: Dual-Surface KPI Visualization & Interactive Input

**Feature Branch**: `kpi-dual-surface-visualization`
**Created**: 2026-10-03
**Status**: Ready for Planning
**Input**: Dual-surface KPI rendering (clean A4 PDF matrix table vs. web analytics) + lightweight interactive visual feedback for staff data entry without performance regression.

## User Scenarios & Testing

### User Story 1 - Standardized A4 PDF & Raw Report KPI Presentation (Priority: P1)
As an organizational executive or auditing manager, I want periodic reports and printed A4 PDFs to display project KPIs in a single, unified compact matrix table focusing on cumulative physical progress and period growth, so that I can immediately evaluate real progress without confusing abstract ratios or broken page breaks.

**Why this priority**:
Currently, KPIs appear as unformatted text chunks that are hard to parse during formal executive reviews. A clean, unified A4 table ensures executive-ready documents.

**Independent Test**:
Can be fully tested by generating raw report details and PDF exports for projects with varying numbers of KPIs and verifying that all KPI rows render inside a compact table fitting cleanly within A4 printable width.

**Acceptance Scenarios**:
1. **Given** a project has one or more defined KPIs, **When** viewing the raw report details or exporting to PDF, **Then** all KPIs are displayed in a unified compact RTL table with columns: `[ردیف, عنوان شاخص, واحد, مبنا, عملکرد دوره, هدف, پیشرفت کل پروژه]`.
2. **Given** a KPI has recorded cumulative progress, **When** rendered in the table, **Then** the final column shows the total progress percentage (e.g. `۷.۱۵٪`) alongside a segmented two-color micro-progress bar:
   - **Segment 1 (Baseline / Prior Progress):** Dark slate (`#475569`) indicating previously accumulated progress.
   - **Segment 2 (Period Growth):** Vibrant emerald (`#10b981`) indicating newly achieved progress in this reporting cycle (e.g. `+۲.۱۵٪`).
3. **Given** a project made zero progress during a cycle, **When** rendered in the table, **Then** the progress bar retains the baseline width in slate, displays the total percentage, and indicates `(بدون رشد)`.
4. **Given** a KPI is flagged as `not_measured`, **When** rendered in the table, **Then** the current value and progress bar display a clear muted note ("عدم پایش") along with the stated reason without breaking table alignment.
5. **Given** a project has zero defined KPIs, **When** generating the report, **Then** a clean single-line notice indicates no KPIs are assigned.

---

### User Story 2 - Lightweight Interactive Input with Live Dual-Color Visual Feedback & Regression Guardrail (Priority: P2)
As a reporting staff member entering weekly/monthly report data, I want real-time visual feedback with segmented colors (prior progress vs. period growth) when typing KPI values, and I want the system to strictly prevent entering a cumulative progress lower than the previous reporting period.

**Why this priority**:
Staff frequently type raw numbers into blank input boxes with no immediate frame of reference, risking magnitude errors or accidentally entering a regressive cumulative progress number.

**Independent Test**:
Can be tested in `EditReportModal` / `SubmitReport` by adjusting a KPI input and confirming that:
1. The comparison bar adjusts instantaneously with dual-color breakdown.
2. Entering any value below the previous baseline triggers an immediate visual warning and blocks submission.

**Acceptance Scenarios**:
1. **Given** a staff member opens the report form, **When** entering or editing a numeric KPI value, **Then** a lightweight pure CSS/SVG gauge updates in real time to show current position relative to baseline (مبنا) and target (هدف).
2. **Given** the staff member enters a value less than the previous baseline, **When** typing, **Then** the input borders turn rose, an immediate Persian warning appears, and form submission is prevented.
3. **Given** low-spec devices or slower connections, **When** interacting with the KPI inputs, **Then** the interface responds instantly with zero input stutter (Zero JS bundle weight addition).

---

### User Story 3 - Intelligent Visual Representation in Web Analytics (Priority: P3)
As a project manager or analyst visiting the «تحلیل و روند شاخص‌ها» page (`ProjectKpiAnalytics.tsx`), I want charts to automatically adapt their visualization type based on the KPI's unit and nature (trend line for percentages over time, comparative bar charts for volumetric numbers) so that trends are immediately intuitive.

**Why this priority**:
Different KPIs have distinct semantics; a one-size-fits-all chart fails to communicate the true trajectory of diverse projects.

**Independent Test**:
Can be tested by navigating to the KPI analytics page and observing that percentage KPIs show a 0-100 bounded line chart with target reference line, while discrete numeric counts render as comparative bars.

**Acceptance Scenarios**:
1. **Given** an active project with historical KPI submissions, **When** selecting that project on the Analytics page, **Then** each KPI renders with its semantically appropriate Recharts view.
2. **Given** a target value and target direction, **When** viewing the chart, **Then** an explicit horizontal reference line represents the target threshold.

---

## Performance Invariants & Guardrails *(mandatory)*

- **PERF-001 (Zero-Refetch Storms):** Saving or editing a report MUST NOT trigger a full reload of the historical reports array (`fetch("/api/reports")`). The client must merge the returned single report record into local state.
- **PERF-002 (Lightweight UI Components):** Visual feedback in staff entry forms must rely strictly on native HTML/CSS/SVG, without loading external chart engines or WebGL into the editing modal.
- **PERF-003 (Sub-300ms Submission Response):** The form submission UI must immediately confirm user action (optimistic / swift feedback) rather than freezing the screen during backend processing.

## Requirements

### Functional Requirements
- **FR-001**: System MUST render a standardized 6-column matrix table for all project KPIs in `ReportsPdfDocument.tsx` and raw report preview modals.
- **FR-002**: System MUST calculate achievement ratio dynamically:
  - For `target_direction = 'minimum'` (higher is better): `(current_value / target_value) * 100`
  - For `target_direction = 'maximum'` (lower is better): `(target_value / current_value) * 100`
- **FR-003**: System MUST embed an inline micro-progress bar in the final column of the PDF table with printable CSS colors (`print-color-adjust: exact`).
- **FR-004**: The staff report form in `MyReports.tsx` MUST provide an interactive visual gauge alongside the numeric input showing position against baseline and target.
- **FR-005**: The analytics view in `ProjectKpiAnalytics.tsx` MUST adapt chart types according to `unit` (`%` vs volumetric counts).

## Success Criteria

- **SC-001**: 100% of PDF export pages with KPIs maintain uniform page geometry with zero horizontal clipping or unplanned page breaks across standard A4 dimensions.
- **SC-002**: Staff report saving perceives an immediate UI response (< 300ms) without full database re-fetch delays.
- **SC-003**: Zero additional external NPM charting packages added to the project bundle.
