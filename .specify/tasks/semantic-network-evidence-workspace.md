# Tasks: Evidence-first Semantic Network Workspace

Spec: ../specs/semantic-network-evidence-workspace.md
Plan: ../plans/semantic-network-evidence-workspace.md

## Discovery and continuity
- [x] S01 Read constitution, decisions and existing semantic task history; inspect clean tracked worktree.
- [x] S02 Use codebase-memory search/snippets/traces/coverage; read source where index metadata is changed.
- [x] S03 Record user-selected network-first structure and evidence semantics in spec/plan.

## Semantic foundation (checkpoint before UI)
- [x] S04 TDD shared semantic nodes/edges/provenance contract and safe projection.
- [x] S05 Read persisted parent hierarchy, isolate archives/dangling links and disclose graph coverage.
- [x] S06 Preserve report/period/line evidence, action lifecycle and approved KPI relations.
- [x] S07 Ground AI context in shared typed graph with bounded serialization and uncertainty rules; document actual route integration.
- [x] S08 Verify focused tests + typecheck + production build; commit backend checkpoint.

## Review gate — backend checkpoint not yet accepted

Checkpoint `a876a71` exists locally. Parent re-ran semantic tests (10 passed) and TypeScript successfully. Independent review FAILED; passing tests did not establish the required invariants. UI replacement was later explicitly reauthorized by the user and is now integrated locally; parent has not pushed/deployed. Independent UI review has passed with no blockers.

- [x] R01 Enforce project assignment/active-project policy on graph GET; regression tests.
- [x] R02 Reject foreign records in pure builder; correct KPI counts and unique relation IDs.
- [x] R03 Apply explicit bounded query/builder limits with accurate per-kind omissions; do not hide source-query failures.
- [x] R04 Contain untrusted source text and strengthen system-prompt boundary; do not claim injection immunity.
- [x] R05 Re-run focused/full tests, typecheck/build; independently verify exact remediation commit.

Backend remediation checkpoint `0e383f3` verified by parent against exact source and focused tests. Parent followups additionally fix the legacy hierarchy discriminator, hard query upper caps, and explicit typed relationship/source serialization for AI; 19 focused tests and tsc/build pass. Those followups passed independent review and are committed as `87bc172`. Final suite: 51 passed, 4 skipped, 0 failed; 12 isolated browser scenarios pass; tsc/build pass. The separate uncommitted server.ts 9Router model defaults are user-owned and excluded from this feature's staging.

## Connected workspace
- [x] S09 TDD deterministic cycle-safe RTL graph layout, neighborhood focus/search and visibility counts.
- [x] S10 Render typed directional labeled relationships rather than parallel lists.
- [x] S11 Add pan/zoom/fit, selection/path focus, recover-all and evidence/gap inspection.
- [x] S12 Retain activity correction/table and async sync controls with stale-result isolation. Independent UI review accepted with no blocking findings; optional lifecycle symmetry and partial-payload suggestions are not acceptance blockers.

## Acceptance
- [x] S13 Browser-test meaningful relationships, selection, filters, empty/gap states and responsive layout using labeled fixtures.
- [x] S14 Run regression tests, typecheck, build and independent review; record exact limitations.
- [ ] S15 Update SpecKit + MCP ADR, commit local UI checkpoint. Never push main without explicit user permission.
