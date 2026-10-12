# Tasks: Strategic Semantic Network & AI Reasoning Layer

**Associated Spec**: `.specify/specs/strategic-semantic-network.md`  
**Associated Plan**: `.specify/plans/strategic-semantic-network.md`  
**Decisions Covered**: D33, D34  

---

## Task Matrix & Parallel Sub-Agent Workstreams

### Sub-Agent 1: Schema & Relational Ontology Layer (US1)
- [ ] `T1.1` [P] Add `WbsNode` model to `prisma/schema.prisma` with hierarchical tree relations (`code`, `title`, `level`, `parent_id`, `project_id`).
- [ ] `T1.2` [P] Add junction relation `KpiWbsLink` connecting `ProjectKpi` to target `WbsNode` elements.
- [ ] `T1.3` Add optional foreign key `wbs_node_id` to `NextAction` and `Report` in `prisma/schema.prisma`.
- [ ] `T1.4` Implement self-healing additive startup migrations in `ensureDatabaseSchema()` in `server.ts`.
- [ ] `T1.5` Run `npx prisma generate` and verify `npx tsc --noEmit`.

### Sub-Agent 2: Graph Ingestion & Sync Pipeline (US1)
- [ ] `T2.1` Enhance `wbsDataParser.ts` to output structured entity arrays ready for database insertion.
- [ ] `T2.2` In `server.ts` (`POST /api/projects/:id/wbs-file`), wrap Excel saving and `WbsNode` database synchronization in a transactional update.
- [ ] `T2.3` In `server.ts` (`DELETE /api/projects/:id/wbs-file`), cascade delete associated `WbsNode` entries alongside physical file unlinking.

### Sub-Agent 3: AI Cognitive & Graph Reasoning Layer (US2)
- [ ] `T3.1` Build structured graph serializer `buildProjectGraphPromptContext(project_id, period_id)` in `server.ts`.
- [ ] `T3.2` Upgrade `/api/reports/analyze-single` prompt to evaluate activity progress directly against assigned WBS node codes.
- [ ] `T3.3` Upgrade `/api/reports/analyze-deputy` and `/api/ai/strategic-analysis` prompts to execute:
  - Causal delay ripple tracing across prerequisite tasks.
  - Blind-spot analysis (deliverables lacking KPIs).
  - Scope creep detection.
- [ ] `T3.4` Defensively enforce Shamsi date formatting on all extracted commitments.

### Sub-Agent 4: Presentation & Interactive Visualizer Layer (US3)
- [ ] `T4.1` Add WBS node picker to `NextAction` creation drawers in `ProjectNextActionsDrawer.tsx` and `SubmitReport.tsx`.
- [ ] `T4.2` Render linked KPI badges and active commitments inside `WbsTreeTableRow` in `WbsViewer.tsx`.
- [ ] `T4.3` Build interactive Strategic Network Explorer tab in `ManageProjectsHub.tsx`.

### Sub-Agent 5: Performance & Security Engineering
- [ ] `T5.1` [P] Add `AiAnalysisCache` table in PostgreSQL to replace volatile in-memory cache.
- [ ] `T5.2` [P] Mount `helmet` middleware and enforce strict CSP and security headers in `server.ts`.
- [ ] `T5.3` Add composite indexes on `Report(period_id, project_id)` and `NextAction(project_id, is_completed, is_cancelled)`.
- [ ] `T5.4` Log daily benchmarks and audit status to Obsidian `Daily-Performance-and-Security-Log.md`.
