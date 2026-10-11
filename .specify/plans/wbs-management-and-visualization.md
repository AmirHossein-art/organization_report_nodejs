# Implementation Plan: WBS Management & Visualization

**Plan Date**: 2026-10-11
**Specification**: `.specify/specs/wbs-management-and-visualization.md`
**Status**: Completed & Verified

---

## Technical Context
- **Repository Structure**: TypeScript Full-Stack Monorepo
- **Language/Framework**: React 18, Vite, Express 4, Prisma 7, PostgreSQL
- **Key Modules**:
  - `server.ts`: Auth middleware, Multer storage, WBS CRUD endpoints, RFC 6266 download headers
  - `src/views/ManageProjectsHub.tsx`: Top horizontal tabbed coordinator
  - `src/views/WbsViewer.tsx`: WBS administration, Shenasnameh cards, interactive Tree-Table (`WbsTreeTableRow`)
  - `src/views/WbsTree.tsx`: Hierarchical visual tree diagram (`WbsTreePane`)
  - `src/utils/wbsDataParser.ts`: Resilient Excel extractor, parent synthesizer, PMBOK mapping

---

## Phase Execution Checklist

### Phase 1 — Access Control & Hub Consolidation (D30)
- [x] Merge `soton_delet_fixes` branch with `main` and resolve schema/layout conflicts.
- [x] Delete redundant deputy upload views (`src/views/WbsUpload.tsx`, `src/views/WbsReview.tsx`).
- [x] Restrict `/api/projects/:id/wbs-submissions` and `/api/projects/:id/wbs-file` to `requireManager`.
- [x] Add 3rd tab «ساختار شکست کار (WBS)» to `ManageProjectsHub.tsx`.
- [x] Shorten sidebar navigation title to «مدیریت پروژه‌ها».

### Phase 2 — Dynamic Parsing & Robust Tree Synthesis (D31)
- [x] Expand `wbsDataParser.ts` to parse both single-sheet and multi-sheet workbooks.
- [x] Implement natural numeric sorting and parent synthesis in `WbsTree.tsx` (synthesizing missing parents `1` and `1.1` when starting at `1.1.1`).
- [x] Replace long filename text on project lists with compact `WBS دارد` badge and direct download action.
- [x] Embed hidden PMBOK guardrail prompt in standard template generator.

### Phase 3 — Tree-Table Transformation, RFC 6266 Downloads & Clean Shenasnameh (D32)
- [x] Redesign activity cards into a full-width expandable hierarchical tree-table (`WbsTreeTableRow`).
- [x] Implement depth-based indentation, accordion toggle chevrons, child count badges, and expand-all/collapse-all controls.
- [x] Support 10 explicit columns: Code, Name, Level, Deliverable, Owner, Duration, Start Date, KPI, Prerequisite, Notes.
- [x] Implement RFC 6266 / RFC 5987 UTF-8 download headers and client `download` attributes to resolve Mojibake (`Ø¨Ø±Ú¯Ø´Øª...`).
- [x] Remove obsolete «سند مرجع منبع» from parser and project profile UI.
- [x] Batch-convert existing spreadsheets in `D:/Traffic/Websites/WBS/Excel` into standardized 5-sheet workbooks with highlighted synthesized parents in `D:/Traffic/Websites/WBS/Excel_Standardized`.

---

## Verification & Quality Gates
- **TypeScript Typecheck**: `npx tsc --noEmit` -> 0 errors.
- **Production Build**: `npm run build` -> clean bundle generation.
- **Architecture Log**: Updated `.specify/decision.log` (D30, D31, D32) and codebase-memory ADR.
