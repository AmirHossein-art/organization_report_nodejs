# Tasks: Dual-Surface KPI Visualization & Performance

**Spec**: `.specify/specs/kpi-dual-surface-visualization.md` | **Plan**: `.specify/plans/kpi-dual-surface-visualization.md`

## Phase 1: A4 PDF & Raw Report Unified Matrix Table (User Story 1 - P1)
- [ ] **T001**: [US1] Create pure helper function in `src/utils/kpiVisuals.ts` to compute achievement ratio, status color class, and bounded progress percentage.
- [ ] **T002**: [US1] Refactor KPI rendering in `src/components/ReportsPdfDocument.tsx`: replace loose text entries with a high-density 6-column matrix table (`ردیف`, `عنوان شاخص`, `واحد`, `مبنا`, `مقدار دوره`, `هدف`, `درصد تحقق`).
- [ ] **T003**: [US1] Embed print-safe inline micro-progress bars (CSS `print-color-adjust: exact`) in the final column of the PDF table.
- [ ] **T004**: [US1] Ensure `not_measured` KPI entries render cleanly as a muted status cell with the missing reason clearly formatted without breaking table columns.

## Phase 2: Live Interactive Comparison Gauge in Staff Entry (User Story 2 - P2)
- [ ] **T005**: [US2] Build a lightweight `KpiInteractiveGauge` sub-component in `src/views/MyReports.tsx` using zero-dependency SVG/CSS.
- [ ] **T006**: [US2] Connect the interactive gauge to the numeric input in `ReportEditModal`: show real-time progress relative to baseline and target with instant color transitions.

## Phase 3: Performance & Save Latency Optimization (Guardrail PERF-001)
- [ ] **T007**: [PERF] In `src/views/MyReports.tsx`, update `handleSave` to consume the returned `newReport` from `POST /api/reports` and `PUT /api/reports/:id` and update local state directly instead of triggering a full `fetch("/api/reports")` storm.
- [ ] **T008**: [PERF] Provide optimistic visual confirmation (instant green checkmark feedback) on form submit.

## Phase 4: Verification & Build
- [ ] **T009**: Run `npm run build` to verify zero TypeScript errors and zero compilation failures.
- [ ] **T010**: Validate A4 PDF print preview in browser for projects with 1, 3, and 0 KPIs to confirm zero page-break distortion.
