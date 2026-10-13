# Architecture Plan: Strategic Semantic Network (WBS ↔ Activities ↔ KPIs ↔ AI)

**Feature Branch**: `main`  
**Status**: Draft  
**Associated Spec**: `.specify/specs/strategic-semantic-network.md`  
**Decisions Covered**: D33, D34  

---

## 1. Architectural Architecture Overview

The strategic network transforms disconnected entities into a structured relational knowledge graph in PostgreSQL:
1. **Relational Schema Evolution (`prisma/schema.prisma`)**:
   - Introduce `WbsNode` with hierarchical self-relation (`parent_id`), `code` (`1.1.1`), `title`, `level`, and `node_type` (`phase`, `deliverable`, `work_package`).
   - Store deliverable text on `WbsNode.deliverable_text` and dictionary metadata in JSONB `attributes`; a separate deliverable entity remains future work.
   - Relate `Report` through `ReportWbsLink`, and `NextAction` through optional `wbs_node_id`.
   - Relate `ProjectKpi` to `WbsNode` via an explicit junction table `KpiWbsLink`.
2. **Dynamic Sync Engine (`wbsDataParser.ts` & `server.ts`)**:
   - Parse upload first, then atomically upsert `WbsNode`, update Project and record WbsSubmission in PostgreSQL. Disk writes are NOT database-transactional: retain old revisions and clean only a failed new file after rollback.
3. **Graph-Grounded AI Prompts (`server.ts`)**:
   - Instead of injecting unstructured text blocks, AI prompt builders traverse the relational graph:
     - Root: `Project`
     - Branches: `WbsNode` hierarchy
     - Leaves: `NextAction`, `Report`, and `ProjectKpi` values
   - Prompts enforce causal validation, dependency traversal, and gap analysis.
4. **Asynchronous Job & Caching Layer**:
   - AI evaluations run as tracked background jobs with durable caching in `AiAnalysisCache`.

## 2. Implemented ingestion infrastructure (D36)

- Modules: `src/utils/wbsGraph.ts`, `src/services/wbsGraphSync.ts`, and `scripts/backfill-wbs-graphs.ts`.
- Parent codes explicitly supplied by spreadsheets take precedence over inferred hierarchy. Infer/synthesize only missing parents and mark synthesized nodes for review. Reject conflicting duplicate codes, invalid codes, cycles and empty structures.
- Acquire per-project PostgreSQL advisory transaction lock (namespace 172901) before backfill, replacement or deletion; reread current file metadata under lock.
- Upsert `(project_id, code)` to preserve node IDs and existing relations. Archive removed codes (`attributes.active=false`, detached parent); never silently erase referenced report/KPI/action nodes. Block full deletion with 409 if any links exist.
- Backfill runs after schema readiness and starts after HTTP listener, so health checks need not wait for all Excel files. Each project has its own transaction; failures are reported and retried on next startup or explicit CLI. No durable job queue is implemented in this step.
- Project filename is authoritative. Latest WbsSubmission is a fallback only when that filename is absent, not when its current file is missing/unreadable.
- Preserve source filename, SHA-256, code, declared level, explicit parent, dictionary columns and parser version as provenance. Retained revisions consume storage; a future retention policy must protect referenced history.
- Future graph consumers must filter archived nodes. Imported KPI text/prerequisites are not automatically approved measurement or dependency edges; mapping needs explicit IDs and later validation.

## 3. Verification and operating procedure

Real Railway snapshot: `backups/wbs-snapshot-20261012-131727/` (ignored by Git). Local test database: `org_report_wbs_test_20261012`; original `org_report_db` and production were not changed. Five valid graphs imported (170 nodes). Projects 4 and 53 have source-data defects, deferred to user repair.

```bash
WBS_TEST_SNAPSHOT='D:/Traffic/Websites/organization_report_nodejs/backups/wbs-snapshot-20261012-131727' npx tsx --test tests/*.test.ts
npx tsc --noEmit
npm run build
# Default is read-only dry-run. Exit 1 means one or more sources failed validation.
npx tsx scripts/backfill-wbs-graphs.ts --env backups/wbs-snapshot-20261012-131727/test.env --wbs-dir backups/wbs-snapshot-20261012-131727/wbs_files
# Add --apply only for an explicitly verified target database.
```

Production deployment and post-deployment graph counts are pending. Do not claim production migration success or measured latency gains from local tests. Startup schema failure is fail-closed; WBS-source failures do not prevent unrelated valid projects or normal reporting from operating.
