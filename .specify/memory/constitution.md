# Tehran Traffic Organization Periodic Reporting System — Constitution

## Core Principles

### I. Persian-First RTL & Standalone Shamsi Engine
All user interfaces, modals, data tables, and print exports must be strictly right-to-left (RTL) styled with the official Vazirmatn typography. Persian digits are formatted at the presentation layer. Shamsi calendar calculations and deadline state evaluation must remain purely in-house within standalone TypeScript utilities (`src/dateUtils.ts` and `src/deadline.ts`) with zero dependency on external date libraries and fully covered by automated regression tests.

### II. Single Process Monolith (Railway Deployable)
The system is architected as a cohesive full-stack TypeScript monolith. The Express 4 backend and React 18 + Vite SPA are built into a single deployment artifact (`dist/server.cjs` generated via `vite build` and `esbuild server.ts`). Production runs as a single Node process to maintain operational simplicity on Railway.

### III. Historical Data Determinism (Snapshot Pattern)
When staff submit a periodic report, essential identifying metadata—including `user_full_name`, `project_title`, `period_title`, and report period boundaries—must be denormalized directly onto the `Report` table record. Future renaming or reassignment of personnel, organizational roles, or project codes must never mutate historical audit logs or archived official submissions.

### IV. Multi-Provider Defensive AI Auditing
Automated report auditing and strategic deputy analyses (`/api/reports/analyze-deputy`) must operate defensively through a tiered fallback architecture (`callAiWithFallback` spanning Gemini, Cerebras, and SambaNova). Provider throttling, outage, or token limit errors must gracefully cascade without interrupting core reporting workflows.

### V. Additive Migrations & Strict Verification
Database schema evolution via Prisma must remain strictly additive and non-destructive toward past periods and reports. Every functional change must pass full compilation and type-checking (`npm run build`) with zero errors prior to deployment.

### VI. WBS Governance & Managerial Role-Based Access Control
Work Breakdown Structure (WBS) file uploads, replacements, and deletions are strictly restricted to system managers (`requireManager`). Deputies and regular personnel cannot upload or modify project WBS spreadsheets. WBS management lives exclusively as a nested tab within the Project Management Hub (`ManageProjectsHub.tsx`).

### VII. Hierarchical Tree-Table & RFC 6266 Download Integrity
Activity lists in WBS views must render as interactive, full-width hierarchical tree-tables with accordion toggles, depth indentation, and explicit structural columns (code, title, level, deliverable, owner, duration, start date, KPI, prerequisite, notes). Excel download endpoints must adhere to RFC 6266 / RFC 5987 (`filename*=UTF-8''`) to prevent Mojibake encoding distortions for Persian filenames across all browsers.

## Governance & Operational Boundaries
- **Local File Attachments:** Report attachments and WBS Excel spreadsheets are parsed and maintained locally under `uploads/` via Multer; persistent storage volumes must be provisioned during hosting deployments.
- **Direct Action Completion:** Actions marked by personnel in periodic reports resolve immediately (`is_completed = true`) without requiring intermediate managerial gating.
- **Harmonized Monthly Project Cycles:** Monthly-cadence projects are evaluated and reported concurrently with weekly projects during the final week of each Shamsi month (`isLastWeekOfShamsiMonth`) and are exempt from missing-report flags in earlier weeks.

**Version**: 1.2.0 | **Ratified**: 2026-10-11 | **Status**: Active