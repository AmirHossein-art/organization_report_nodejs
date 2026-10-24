# Evidence-first Semantic Network Workspace

Status: implementation authorized by user; local only. Supersedes presentation assumptions in D40, not WBS governance.

## User intent
The semantic network must communicate actual project meaning and become shared grounding for future AI reporting. It must not be four adjacent lists or decorative boxes. Prioritize structure, then usable presentation, then palette polish. User selected interactive relationship network, not review-table-first.

## Stories
1. As a manager I follow project -> WBS hierarchy -> reported activity and inspect source report/period/line and relationship confidence.
2. I select a work package and understand its deliverable, linked approved KPI and commitments, dependencies and missing evidence without confusing proposal with fact.
3. I navigate across the graph, search, filter and focus a neighborhood while preserving orientation and access to unlinked items.
4. As an AI consumer I receive the same typed relationships and provenance as the visualizer, including uncertainty and explicit coverage limits.

## Invariants and acceptance
- Persisted WBS parent_id is authoritative, including non-dot codes. Never invent project objectives, deliverables, causal links or KPI relations from labels.
- WBS remains ground truth and is not edited by activity inference. Current graph excludes archived nodes. Broken/archived links become explicit gaps.
- Every displayed edge has meaningful direction, type, Persian label, evidence source and epistemic status. Suggestions are visually distinct from reference/human-confirmed records.
- Activities trace to source report, period and line. Human confirmation, AI confirmation and AI proposal are distinct. Reported completion is not acceptance of deliverable.
- Free-text prerequisites are source metadata unless resolved exactly and unambiguously to active WBS codes. No fuzzy matching; no guaranteed causal delay or critical-path claim.
- No silent data truncation. Full fetched coverage and any visual/prompt omissions are disclosed. Missing report evidence is not proof of no work; unmapped is not proven scope creep.
- Canvas renders actual typed edges with arrowheads/labels, pan/zoom/fit, selectable nodes and edges, focused neighborhood, expandable hierarchy/search, evidence inspector and full-context recovery.
- Inspector supports existing activity correction, source context and linked entities. Table remains secondary fallback.
- Persian-first RTL, Vazirmatn and Persian numerals for presentation; identifiers stay literal in stored data. Responsive accessible controls.
- Existing async sync jobs and project isolation retained. No extra live AI calls to draw graph.
- Shared browser-safe contract powers API visual data and bounded AI serializer. Preserve project goals, source fallback and long-term memory; document which reporting endpoints actually consume it.

## Scope
No production deployment, credential changes, bulk AI rerun, database rewrite, new vector DB, speculative ontology entities, new workflow approvals or color-brand redesign. No promise of full project understanding from incomplete evidence. Subsequent new domains require evidence and explicit schema decisions.

## Verification
Pure behavior tests for provenance, parent relations, archive/broken-link isolation, inferred-vs-confirmed status, lifecycle, deterministic layout/cycles and explicit omissions. Typecheck/build per architectural layer. Browser exercise with clearly labeled isolated fixtures; actual-data verification read-only if safely available. Never substitute fixture verification for live production verification.
