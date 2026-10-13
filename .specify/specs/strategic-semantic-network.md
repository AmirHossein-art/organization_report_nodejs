# Feature Specification: Strategic Semantic Network (Projects ↔ WBS ↔ Activities ↔ KPIs ↔ AI)

**Feature Branch**: `main`  
**Created**: 2026-10-12  
**Status**: Architecture & Specification Draft (Active Priority)  
**Decisions Covered**: D33  

---

## 1. Feature Overview & Strategic Vision

The Organization Periodic Reporting System has successfully implemented Work Breakdown Structure (WBS) ingestion and multi-view interactive visualization (Tree, Table, Dictionary). As standardized project WBS spreadsheets are uploaded across organizational initiatives, the core objective of the platform transitions from operational report archiving to an **Integrated Strategic Performance & Governance System**.

In this architecture, organizational entities no longer exist as disconnected data silos (raw text reports, independent KPI lists, or standalone Excel files). Instead, they are synthesized into a **Unified Strategic Semantic Network (Knowledge Graph)**:
1. **Strategic Objectives (اهداف کلان سازمانی)** define the institutional targets.
2. **Projects (پروژه‌های راهبردی)** serve as the vehicles to achieve these objectives.
3. **WBS Phases & Work Packages (بسته‌های کاری و فازها)** break projects down into MECE deliverables.
4. **Operational Activities & Next Actions (اقدامات و فعالیت‌ها)** represent the periodic work executing those packages.
5. **Key Performance Indicators (KPIs - شاخص‌های کلیدی عملکرد)** measure both operational outputs (Work Package KPIs) and strategic outcomes (Project & Composite KPIs).
6. **Multi-Agent AI Reasoning Layer**: AI agents operate directly on top of this semantic graph rather than bare unstructured text prompts, enabling deep causality analysis, impact tracing, gap detection, and strategic alignment scoring.

---

## 2. Conceptual Ontology & Graph Architecture

```text
[ Strategic Objective ]
         ▲
         │ (CONTRIBUTES_TO)
         │
    [ Project ] ──────── (MEASURED_BY) ────────► [ Outcome KPI ]
         │
         │ (DECOMPOSED_INTO)
         ▼
[ WBS Work Package ] ── (PRODUCES) ─────────────► [ Deliverable / Output ]
         │                                              │
         │ (EXECUTED_BY)                                │ (MEASURED_BY)
         ▼                                              ▼
[ Periodic Activity / Next Action ] ── (DRIVES) ──► [ Output KPI ]
         │
         │ (DEPENDS_ON)
         ▼
[ Prerequisite Work Package ]
```

### Graph Node Definitions
- **Node: `Project`**: High-level organizational undertaking assigned to a responsible deputy/official.
- **Node: `WbsNode`**: Granular hierarchical element (`Phase`, `Deliverable`, `WorkPackage`) parsed from project WBS spreadsheets with standard code (`1.1.2`), title, duration, and owner.
- **Node: `Deliverable`**: Tangible physical or digital outcome produced by a work package.
- **Node: `Activity`**: Periodic work performed in weekly/monthly reporting periods or registered as commitments (`NextAction`).
- **Node: `Kpi`**: Quantitative metric (`ProjectKpi` or `CompositeKpi`) with baseline, target value, measurement unit, and direction.
- **Node: `StrategicObjective`**: Master municipal goal (e.g., Traffic Congestion Reduction, Public Transit Optimization, Safety Enhancement).

### Graph Edge Relations
- `(Project) -[:DECOMPOSED_INTO]-> (WbsNode)`
- `(WbsNode) -[:PRODUCES]-> (Deliverable)`
- `(WbsNode) -[:DEPENDS_ON]-> (WbsNode)` (Prerequisite relationship)
- `(Activity) -[:EXECUTES]-> (WbsNode)` (Reported periodic activity mapped to a specific WBS code)
- `(Activity) -[:DRIVES]-> (Kpi)` (Activity positively influencing an indicator)
- `(Deliverable) -[:MEASURED_BY]-> (Kpi)` (Formal measurement criteria)
- `(Project) -[:CONTRIBUTES_TO]-> (StrategicObjective)`

---

## 3. Prioritized User Stories

### User Story 1 — Semantic Grounding of Activities to WBS & KPIs (Priority: P1)
As an executive director or project controller, I want periodic reports and next actions to be semantically linked to specific WBS work packages and their corresponding KPIs, so that executive management has complete visibility into which parts of the strategic project plan are progressing and which are stalled.

**Independent Test**: Can be verified by linking a periodic report's activities to WBS code `1.2.1` and KPI `سنسورهای فعال`, verifying the relationship persists in the database and updates both WBS progress and KPI tracking.

**Acceptance Scenarios**:
1. **Given** a project with an approved WBS, **When** staff submit a report or next action, **Then** they can link the action to a specific WBS task code and affected KPI.
2. **Given** a linked activity, **When** viewing the WBS Tree-Table, **Then** the work package displays cumulative execution history, latest recorded values, and completion status.
3. **Given** an activity with no linked WBS task, **Then** the system tags it as "Unmapped / Operational Firefighting" for managerial review.

---

### User Story 2 — Multi-Agent AI Graph Reasoning Engine (Priority: P1)
As executive management, I want the AI audit layer to reason over the interconnected graph (WBS + Activities + KPIs + Historical Reports) rather than treating prompt input as disconnected text, so that AI audits produce verified causality, impact assessments, and predictive risk alerts.

**Independent Test**: Execute `/api/ai/strategic-analysis` on a period where a critical prerequisite WBS task has zero activity; verify the AI specifically identifies the downstream work packages and KPIs that will suffer delayed delivery.

**Acceptance Scenarios**:
1. **Causality & Ripple Analysis**: When an activity delay occurs, the AI identifies downstream prerequisite dependencies and flags blocked work packages.
2. **Measurement Gap Analysis**: The AI detects WBS deliverables that have zero defined KPIs and alerts management to "Blind Spots" in governance.
3. **Scope Creep Detection**: The AI evaluates reported activities against approved WBS boundaries, flagging efforts spent outside project scope.
4. **Strict Grounding**: The AI outputs structured JSON with citations to exact WBS codes and KPI IDs, strictly adhering to zero-hallucination rules.

---

### User Story 3 — Interactive Strategic Network Visualizer (Priority: P2)
As a project manager or director, I want an interactive visual canvas showing how my project's WBS tasks feed into operational KPIs and overarching organizational goals, so that I can explore strategic dependencies intuitively.

**Independent Test**: Open the Strategic Network tab inside `ManageProjectsHub` and verify nodes render with active relationships, allowing 1-click drill-down from Strategic Goal to individual weekly activities.

---

## 4. Multi-Sub-Agent Orchestration Plan

To execute this large-scale strategic transformation cleanly without context fragmentation or regressions, work is partitioned across dedicated sub-agents:

1. **Sub-Agent 1 — Ontology & Schema Architect (Database & Model Layer)**:
   - Design additive Prisma schema: `WbsNode`, `WbsActivityLink`, `KpiDeliverableLink`.
   - Implement self-healing database migrations in `server.ts` startup.
2. **Sub-Agent 2 — Ingestion & Graph Builder (Parsing & Normalization Engine)**:
   - Enhance `wbsDataParser.ts` to persist extracted WBS nodes into relational database entities alongside Excel disk storage.
   - Preserve existing `ProjectKpi`, `ReportWbsLink` and `NextAction` references across WBS replacements; do not invent new links from names or free-text prerequisites. Explicit entity-ID mapping is later work.
   - Automatically import valid pre-existing project WBS files, including those already stored in Railway volumes. Per-project validation failures must leave source files and prior graph unchanged and must not block other projects.
   - Preserve explicit source parent codes and dictionary metadata, reject conflicting duplicate codes/cycles, and retain source provenance.
   - Removed codes are archived to preserve history; linked WBS cannot be physically deleted. New uploads and metadata/node writes must have rollback/cleanup coverage.
   - Projects 4 and 53 have known invalid source files and are deferred to user correction; no automatic source rewriting is authorized.
3. **Sub-Agent 3 — AI Strategic Graph Reasoning Agent (Cognitive Layer)**:
   - Refactor AI prompt pipelines (`analyze-single`, `analyze-deputy`, `strategic-analysis`) to feed structured graph sub-trees rather than flattened text dumps.
   - Implement Chain-of-Thought validation for impact analysis, delay propagation, and strategic score calculation.
4. **Sub-Agent 4 — Visual Explorer & UI Hub (Frontend Presentation)**:
   - Extend `ManageProjectsHub.tsx` and `WbsViewer.tsx` with unified network relationship tags.
   - Build lightweight, dependency-safe SVG/Canvas or 2D node-link representation of the project strategic graph.
