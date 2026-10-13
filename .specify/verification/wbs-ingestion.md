# WBS ingestion verification — 2026-10-12

## Scope and target
- Repository: `D:/Traffic/Websites/organization_report_nodejs`.
- Source: read-only Railway snapshot under ignored `backups/wbs-snapshot-20261012-131727`.
- Execution target: isolated PostgreSQL database `org_report_wbs_test_20261012` and compiled local HTTP server on port 3317. Neither Railway nor the existing local working database was overwritten.

## Observed results
- `WBS_TEST_SNAPSHOT=... npx tsx --test tests/*.test.ts`: 7 passed, 0 failed, 0 skipped with the snapshot supplied.
- Valid source project IDs: 8, 14, 31, 33, 55. Persisted node counts: 24, 24, 63, 39, 20 respectively; total 170.
- Repeat backfill preserved `(id, project_id, code, parent_id)`; each parent belongs to its child's project.
- Known invalid projects 4 and 53 were rejected, not repaired. Their failures did not prevent valid-project ingestion. User owns source repair.
- Transaction lifecycle tested against real PostgreSQL: upload, replacement, removed-node archival, retained KPI link and prior workbook, rejected linked deletion (409), failed submission rollback, cleanup of failed new upload, and unlinked graph/metadata/disk deletion.
- `npx tsc --noEmit`: exit 0.
- `git diff --check`: exit 0 (line-ending notices only).
- `npm run build`: exit 0. Nonblocking warning: frontend chunk exceeds 500 kB; Vite CJS API deprecation appears when booting the compiled backend.
- Compiled `dist/server.cjs` startup: schema readiness succeeded, automatic existing-file backfill ran, `/api/health` returned 200.
- HTTP access-control probes on compiled backend: POST `/api/projects/8/wbs-submissions` and DELETE `/api/projects/8/wbs-file` returned 401 without authentication and 403 for a real active nonmanager from the isolated DB. Tokens were generated with an isolated test-only signing secret, never production credentials.
- CLI dry-run: validated all sources, reported the two expected source failures and exited 1. This is intentional partial-failure reporting, not a successful full-data import.
- Snapshot dump/test environment are confirmed Git-ignored.

## Review disposition and reproduced regression
 
- Independent review returned `passed=true` while listing concrete logic errors; this verdict is rejected (fail-closed). The legacy POST `/api/projects` and PUT `/api/projects/:id` WBS mutations bypass graph sync/history and linked-delete guards. This is now reproduced by `tests/wbs-project-routes.integration.test.ts` against the compiled local server: project POST creates zero nodes instead of the expected three. Earlier seven passing tests covered the dedicated WBS routes/service, not this alternate path.
- A separate fix agent is addressing all mutation pathways, moving backfill parsing outside the transaction with locked reference revalidation, avoiding redundant archive writes, and preserving single-sheet source metadata. New shared-database integration tests must run with `--test-concurrency=1` and against a freshly built backend artifact.

## Fixes verified and status update (2026-10-12)
- **Legacy route mutations fixed:** Both `POST /api/projects` and `PUT /api/projects/:id` in `server.ts` now execute `applyWbsUploadInTx` and `removeWbsInTx` inside their transaction. Tested and confirmed in `tests/wbs-project-routes.integration.test.ts` (status 201 creates 3 nodes, 409 deletion guard stops linked removal, replace archives old node).
- **Transaction hold time optimized:** `readWbsGraph` is now called outside the interactive database transaction in `backfillWbsGraphs`, with re-verification of the filename under the advisory lock.
- **Redundant archive writes suppressed:** `syncWbsNodes` now checks whether `attributes.active === false && parent_id === null` before issuing updates to already-archived nodes.
- **Single-sheet metadata retained:** Custom headers, prerequisite, and explicit parent codes are captured into `attributes`.
- **Test suite status:** All 11 tests in `tests/*.test.ts` pass (`tests: 11, pass: 11, fail: 0`).
- **Defective source workbooks (Projects 4 & 53):** Explicitly marked as deferred and user-owned (`DATA2`). Cleanly isolated with non-blocking error status.

## Remaining gates
- Commit changes and deploy to Railway production. Verify automatic startup backfill in live logs.
