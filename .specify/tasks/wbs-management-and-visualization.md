# Tasks: WBS Management & Visualization

**Plan Reference**: `.specify/plans/wbs-management-and-visualization.md`
**Status**: 100% Completed

---

## Task Breakdown & Verification

- [x] **TASK-01**: Security & RBAC gating: Enforce `authenticate, requireManager` on all WBS modifying endpoints.
- [x] **TASK-02**: Hub integration: Embed `WbsViewer` inside `ManageProjectsHub.tsx` as third top tab.
- [x] **TASK-03**: Navigation simplification: Shorten sidebar link to «مدیریت پروژه‌ها».
- [x] **TASK-04**: Dropdown search integration: Use `CustomSelect` (`searchable={true}`) for project picker with zero external fields.
- [x] **TASK-05**: Dynamic parsing: Extract metadata, phases, deliverables, duration, and KPIs in `wbsDataParser.ts`.
- [x] **TASK-06**: Tree node parent synthesis: Handle missing parent levels and dot-notation hierarchy in `WbsTree.tsx`.
- [x] **TASK-07**: WBS tree-table component: Implement `WbsTreeTableRow` with 10 dedicated structural columns.
- [x] **TASK-08**: Accordion expansion: Add expand all, collapse to phases, and dynamic search ancestor expansion.
- [x] **TASK-09**: Remove source reference: Omit «سند مرجع منبع» from parser and Shenasnameh cards.
- [x] **TASK-10**: Download filename encoding: Implement RFC 6266 / RFC 5987 UTF-8 headers to eliminate Mojibake.
- [x] **TASK-11**: Batch spreadsheet standardization: Convert Excel files into 5-sheet PMBOK workbooks in `D:/Traffic/Websites/WBS/Excel_Standardized`.
- [x] **TASK-12**: Full build verification: Verify `npx tsc --noEmit` and `npm run build` pass with 0 errors.
- [x] **TASK-13**: Documentation sync: Update README.md, Constitution, Decision Log (D30-D32), and codebase-memory ADR.
