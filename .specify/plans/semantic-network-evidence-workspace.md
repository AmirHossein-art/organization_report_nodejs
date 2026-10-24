# Plan: Evidence-first Semantic Network Workspace

## Discovery (current source checked, graph index freshness qualified)
- getProjectStrategicGraph in activityGraphService.ts inferred hierarchy from dotted codes instead of parent_id, retained archives, could emit dangling links, and silently limited activities/actions to 100/50.
- Existing visualizer has separate lists and activity-only search; it does not use edges as a real connected workspace.
- buildProjectGraphPromptContext in server.ts emits WBS/KPI/actions/memory but no atomic report-activity evidence. Source usage currently found in analyze-single; do not call this universal integration without route verification.
- Actual D40 implementation is a single model request with proposal/self-review instructions and deterministic server validation, not independently verified two-model auditing.
- 9Router is first configured fallback provider in callAiWithFallback, not an unlimited quota guarantee. Router settings are outside this change.

## Architecture
1. Add src/semantic/strategicGraph.ts, a browser-safe evidence contract and deterministic projection/serializer. Stable typed IDs, source records and relationship epistemic classes.
2. Add semantic payload to existing graph API without breaking legacy nodes/edges/stats. Read authoritative parent_id and same-project active approved links. Include actual report/period evidence. No schema mutation.
3. Serialize same contract to bounded AI context with explicit omitted counts and uncertainty rules. Preserve existing narrative context/memory. Inspect reporting consumers and record actual integration coverage.
4. Add deterministic relationship layout/view model and SVG+HTML canvas using installed React/Tailwind/lucide. No force physics or heavyweight dependencies. Layout combines WBS backbone with evidence neighborhoods, typed directional edge labels, explicit gap tray and a responsive inspector.
5. Preserve sync/mutation routes and stale-request guards; isolate changes by entity and ensure unmount cleanup.

## Layer checkpoints
Backend contract + tests + tsc + build committed before UI implementation. Then UI/view-model tests, browser behavior verification, full tests/typecheck/build and second commit. Stage exact files only: existing untracked railway_credentials_rotated.txt is user-owned sensitive material and MUST NOT be read/staged.

## Design sourcing
Catalogs.dev consulted for discovery only. Do not claim an imported catalog component without a verified item. Reuse spatial canvas/navigation patterns natively; prioritize relation semantics over decorative catalog effects. User explicitly deferred palette matching.

## Risks
Large graphs need bounded visual neighborhoods with explicit shown/total counts, not silent loss. Dependency cycles must never hang layout. Historical reports cannot be called complete unless source coverage is measured. Unknown evidence and independent-audit gaps remain explicit.
