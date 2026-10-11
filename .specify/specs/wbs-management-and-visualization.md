# Feature Specification: Work Breakdown Structure (WBS) Management & Visualization

**Feature Branch**: `soton_delet_fixes` / `main`
**Created**: 2026-10-11
**Status**: Implemented & Verified
**Decisions Covered**: D30, D31, D32

---

## 1. Feature Overview & Scope

The Work Breakdown Structure (WBS) module provides executive directors and project controllers at the Tehran Traffic Organization with end-to-end management, dynamic parsing, and multi-view interactive visualization of project work breakdown structures.

Key requirements:
1. **Managerial Access Control:** Restrict upload, replacement, and deletion of WBS spreadsheets strictly to system managers (`requireManager`). Deputies have no upload access.
2. **Unified Hub Integration:** Integrate WBS management as a nested 3rd tab in the Project Management Hub (`ManageProjectsHub.tsx`) and shorten sidebar title to «مدیریت پروژه‌ها».
3. **Zero-Space Searchable Project Picker:** Single dropdown with built-in instant search (`CustomSelect`) without separate search input rows.
4. **Hierarchical Tree-Table Presentation:** Full-width interactive tree table with collapsible/expandable nodes, depth indentation, and explicit columns for code, name, level, deliverables, owner, duration, dates, KPIs, prerequisites, and notes.
5. **Robust Dynamic Excel Parsing & Parent Synthesis:** Support diverse spreadsheet formats, synthesize missing parent nodes automatically, and isolate WBS deliverables into a dedicated PMBOK dictionary.
6. **RFC 6266 Download Encoding:** Ensure Persian filenames never distort into Mojibake (`Ø¨Ø±Ú¯Ø´Øª...`) upon browser download.
7. **Clean Shenasnameh Profile:** Omit obsolete reference document fields from project identity cards.

---

## 2. User Scenarios & Prioritized User Stories

### User Story 1 — Managerial WBS Upload & File Lifecycle (Priority: P1)
As a system manager, I need to upload, replace, and delete WBS Excel spreadsheets for any active project from the Project Management Hub, so that project structures are maintained centrally without unauthorized deputy modifications.

**Acceptance Scenarios:**
1. **Given** a manager user, **When** navigating to the «ساختار شکست کار (WBS)» tab in `ManageProjectsHub`, **Then** they see project selection and file management actions (Upload, Replace, Delete, Download).
2. **Given** a non-manager (deputy or personnel) user, **When** attempting to call `/api/projects/:id/wbs-submissions` or `/api/projects/:id/wbs-file` with DELETE/POST, **Then** the server rejects the request with HTTP 403 Forbidden.
3. **Given** a project with an existing WBS, **When** the manager clicks Delete and confirms, **Then** the database record is cleared and physical files are securely unlinked from disk.

---

### User Story 2 — Hierarchical Interactive Tree-Table (Priority: P1)
As an executive or project manager, I want to explore project tasks in a full-width expandable tree-table, so that I can see the complete hierarchy and all project dimensions without clutter or horizontal waste.

**Acceptance Scenarios:**
1. **Given** a project with multi-level tasks (e.g., `1`, `1.1`, `1.1.1`), **When** viewing the activity table, **Then** parent rows have chevron accordion buttons showing child counts, and clicking toggles child visibility.
2. **Given** the table toolbar, **When** clicking «بازکردن همه سطوح», **Then** all nested branches expand immediately.
3. **Given** the search input in the toolbar, **When** typing a query, **Then** matching tasks and all their parent ancestor nodes are displayed and expanded automatically.
4. **Given** the columns, **Then** each dimension (Code, Title, Level, Deliverable, Owner, Duration, Start Date, KPI, Prerequisite, Notes) is rendered in its dedicated column.

---

### User Story 3 — Filename Encoding & Download Parity (Priority: P2)
As a user downloading project spreadsheets, I need the downloaded file to preserve its original Persian filename exactly, without Latin-1 mojibake characters.

**Acceptance Scenarios:**
1. **Given** a file named `برگشت پذیر.xlsx`, **When** the user downloads it from the WBS viewer or project table, **Then** the browser saves it with the exact name `برگشت پذیر.xlsx` and not `Ø¨Ø±Ú¯Ø´Øª Ù¾Ø°Û_Ø±.xlsx`.
2. **Given** the HTTP response headers, **Then** `Content-Disposition` includes `filename="wbs_file.xlsx"; filename*=UTF-8''%D8%A8%D8%B1...` per RFC 6266.

---

## 3. Data Models & Database Impact

- **Project Schema (`prisma/schema.prisma`):**
  - `wbs_file_name`: String? (Sanitized original filename in UTF-8)
  - `wbs_storage_filename`: String? (Unique disk filename under `uploads/wbs/`)
- **WbsSubmission Table:**
  - Audited historical submissions log linking `project_id`, `uploaded_by`, `file_name`, `storage_filename`, and `created_at`.
- **Startup Auto-Migration:** Self-healing DDL in `server.ts:ensureDatabaseSchema` ensures table, foreign keys, and indexes exist in PostgreSQL upon boot.
