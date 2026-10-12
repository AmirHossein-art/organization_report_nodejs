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
   - Introduce `WbsDeliverable` containing PMBOK dictionary fields (acceptance criteria, duration, assigned owner).
   - Relate `Report` and `NextAction` to `WbsNode` via `wbs_node_id`.
   - Relate `ProjectKpi` to `WbsNode` via an explicit junction table `KpiWbsLink`.
2. **Dynamic Sync Engine (`wbsDataParser.ts` & `server.ts`)**:
   - On WBS upload/replace, parse sheets and upsert `WbsNode` records transactionally with the file on disk.
3. **Graph-Grounded AI Prompts (`server.ts`)**:
   - Instead of injecting unstructured text blocks, AI prompt builders traverse the relational graph:
     - Root: `Project`
     - Branches: `WbsNode` hierarchy
     - Leaves: `NextAction`, `Report`, and `ProjectKpi` values
   - Prompts enforce causal validation, dependency traversal, and gap analysis.
4. **Asynchronous Job & Caching Layer**:
   - AI evaluations run as tracked background jobs with durable caching in `AiAnalysisCache`.
