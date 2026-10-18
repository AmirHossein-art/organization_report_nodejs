# Tasks: Strategic Semantic Network & AI Reasoning Layer

**Associated Spec**: `.specify/specs/strategic-semantic-network.md`  
**Associated Plan**: `.specify/plans/strategic-semantic-network.md`  
**Decisions Covered**: D33, D34  

---

## Task Matrix & Parallel Sub-Agent Workstreams

### Sub-Agent 1: Schema & Relational Ontology Layer (US1)
- [x] `T1.1` [P] Add `WbsNode` model to `prisma/schema.prisma` with hierarchical tree relations (`code`, `title`, `level`, `parent_id`, `project_id`).
- [x] `T1.2` [P] Add junction relation `KpiWbsLink` connecting `ProjectKpi` to target `WbsNode` elements.
- [x] `T1.3` Add optional foreign key `wbs_node_id` to `NextAction` and `ReportWbsLink` relation to `Report` in `prisma/schema.prisma`.
- [x] `T1.4` Implement self-healing additive startup migrations in `ensureDatabaseSchema()` in `server.ts` (with GIN index on JSONB attributes).
- [x] `T1.5` Run `npx prisma generate` and verify `npx tsc --noEmit` and `npm run build`.

### Sub-Agent 2: Graph Ingestion & Sync Pipeline (US1)
**Status:** Completed and locally verified with 11 automated tests (including isolated PostgreSQL and real Railway snapshot data); DATA2 deferred by user; ready for commit and deployment.
- [x] `T2.1` Preserve source parent codes, dictionary acceptance criteria, dates and attributes in `wbsDataParser.ts`; build validated, parent-first entity arrays in `wbsGraph.ts`.
- [x] `T2.2` On `POST /api/projects/:id/wbs-submissions`, atomically synchronize nodes, update Project and record WbsSubmission. Roll back database changes and remove only the failed new upload on error.
- [x] `T2.3` On `DELETE /api/projects/:id/wbs-file`, remove unlinked graph nodes and metadata in one transaction, then clean disk files. Return 409 for referenced WBS to preserve report/KPI/action history.
- [x] `T2.4` Automatically backfill current Project WBS references after startup schema readiness; use latest submission only when Project has no filename. Include inactive projects and isolate per-project failures.
- [x] `T2.5` Serialize writes with PostgreSQL transaction advisory locks; upsert by `(project_id, code)` to preserve IDs. Archive removed codes via `attributes.active=false`; retain original workbook revisions.
- [x] `T2.6` Add CLI `scripts/backfill-wbs-graphs.ts` (dry-run default, explicit `--apply`, nonzero exit when any project fails).
- [x] `T2.7` Exercise real Railway snapshot on isolated local PostgreSQL: seven sources inspected, five valid graphs / 170 nodes; invalid projects 4 and 53 rejected unchanged. Repeat import preserves IDs and parent links. Verify upload/rollback/archive/delete lifecycle.
- [x] `T2.8` Independent review feedback incorporated: legacy route sync, transaction hold time reduction, and redundant archival write suppression resolved and verified.
- [x] `T2.9` Route legacy POST/PUT project WBS mutations through `applyWbsUploadInTx` and `removeWbsInTx`. Verified in `tests/wbs-project-routes.integration.test.ts`.
- [x] `T2.10` Prepare backfill outside DB transaction, revalidate source reference under lock before applying; skip redundant archive updates and preserve explicit parent/attributes in single-sheet sources.
- [ ] `DATA2` User-owned repair of projects 4 (empty task sheet) and 53 (conflicting duplicate codes). Deferred by user; system isolates failures cleanly and continues. Retry via replacement upload, CLI or next startup.

**Future-consumer contract:** Current graph queries MUST exclude `attributes.active=false` nodes; archived nodes are historical references only. Excel KPI text and prerequisites are source metadata, not approved KPI links or proven causal edges. Never fuzzy-link them automatically.

### Sub-Agent 3: AI Cognitive & Graph Reasoning Layer (US2)
- [x] `T3.1` Build structured graph serializer `buildProjectGraphPromptContext(project_id)` in `server.ts` integrating project goals, WBS nodes, KPIs, and open commitments.
- [x] `T3.2` Upgrade `/api/reports/analyze-single` prompt to execute tripartite evaluation (WBS missing activities/hierarchy recommendations, missing KPI recommendations & blind spots, deliverable-oriented action audit & smart recommendations).
- [x] `T3.3` Upgrade `/api/reports/analyze-deputy` and `/api/ai/strategic-analysis` prompts to execute:
  - Causal delay ripple tracing across prerequisite tasks.
  - Blind-spot analysis (deliverables lacking KPIs).
  - Scope creep detection.
- [x] `T3.4` Defensively enforce Shamsi date formatting on all extracted commitments and recommended next actions (`ensureShamsiDate`).
- [x] `T3.5` Implement Living Project Dossier (`ProjectMemory` schema, self-healing DDL, `src/services/projectMemory.ts`, non-blocking evolution on audit, and Shenasnameh visual dossier card in `WbsViewer.tsx`).

### Sub-Agent 4: Presentation & Interactive Visualizer Layer (US3)
- [x] `T4.1` Add WBS node picker to `NextAction` creation drawers in `ProjectNextActionsDrawer.tsx` and `SubmitReport.tsx` with dedicated `GET /api/projects/:projectId/wbs-nodes` API.
- [x] `T4.2` Render linked KPI badges and active commitments inside `WbsTreeTableRow` in `WbsViewer.tsx`; add zoom controls and Persian digit normalization in `WbsTree.tsx`.
- [x] `T4.3` Build interactive Strategic Network Explorer tab in `ManageProjectsHub.tsx` (`StrategicNetworkExplorer.tsx`) with DAG layer flow, AI audit drawer, batch reflection sync, and live re-linking.

### Sub-Agent 5: Performance & Security Engineering
- [x] `T5.1` [P] Add `AiAnalysisCache` table in PostgreSQL and two-tier cache service (`src/services/aiCache.ts`) replacing volatile in-memory cache.
- [x] `T5.2` [P] Enhance `helmet` middleware (HSTS 1 year, strict-origin referrer policy) and security rate limiting in `server.ts`.
- [x] `T5.3` Add composite indexes on `Report(period_id, project_id)` and `NextAction(project_id, is_completed, is_cancelled)`.
- [ ] `T5.4` Log daily benchmarks and audit status to Obsidian `Daily-Performance-and-Security-Log.md`.
