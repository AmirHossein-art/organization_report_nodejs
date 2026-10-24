# Evidence-first semantic workspace — local verification

## Scope and status
The user renewed permission to replace the interface. The original three-column list presentation has been replaced in StrategicNetworkExplorer by SemanticNetworkCanvas. Independent UI review and backend followup review both passed with no blockers. Backend checkpoint 0e383f3 and followup checkpoint 87bc172 have been source-verified; UI is ready for its exact-file local checkpoint. No production push or live data mutation was performed by the parent agent.

## Executed verification
- `node --import tsx --test tests/*.test.ts`: runner reports 55 tests, 51 pass, 4 skipped, 0 fail.
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0; Vite reports a large-chunk warning (main JS roughly 2.08 MB uncompressed); no new graph runtime dependency added.
- Headless isolated Chrome: `tests/semantic-workspace.browser.mjs` reports 12 passed, 0 failed.
- Pure workspace tests: 5 passed. RED/GREEN observed for projection/focus/filter/limit behavior, readable framing, and WBS-anchored evidence order.

Some older database tests return early without a configured snapshot. Test runner success MUST NOT be represented as proof that PostgreSQL integration or live production data was exercised. All browser data is explicitly synthetic and local.

## Browser acceptance exercised
1. Real integrated typed directional SVG edges replace old category lists; AI proposals use dashed strokes.
2. Selecting activity reveals source line, model confidence, relationship provenance and editor.
3. Selecting edge reveals actual source/target and epistemic class.
4. Source toggle exposes report/period nodes; neighborhood focus preserves WBS ancestry.
5. Zoom changes camera, not semantic records.
6. Persian-normalized cross-entity search and empty state.
7. Gap navigation retains unlinked activities without declaring proven scope creep.
8. Existing activity PATCH contract updates fixture and refreshes graph readback.
9. 390px layout has no document horizontal overflow and inspector remains available.
10. Late old-project sync status cannot create stale polling after entity switch (RED then GREEN).
11. Late activity mutation cannot hide or overwrite newly selected project (RED then GREEN).
12. No browser runtime errors in the exercised flows.

## Evidence artifacts
Scratch output: `C:/Users/asus/AppData/Local/hermes/cache/scratch/semantic-workspace-qa/`:
- `results.json`
- `semantic-desktop.png`
- `semantic-mobile.png`
Screenshots inspected: default auto-fit originally made mobile nodes unreadable; readable framing with explicit fit-all, readable-size restoration and an all-node navigator corrected that issue. Offscreen canvas nodes remain reachable through drag, zoom and navigator; no rendered node is claimed to be physically inside the viewport.

## Reproduction
Start only the Vite frontend, not server.ts (no database startup or AI jobs):
`./node_modules/.bin/vite --host 127.0.0.1 --port 5179 --strictPort`
Open `/tests/fixtures/semantic-workspace.html`. It replaces fetch only inside the test entry, labels all data synthetic and blocks unrecognized requests. This file is not imported into the production entry.
Install Playwright in a scratch prefix rather than app dependencies, set `SEMANTIC_PLAYWRIGHT_PATH` to its module directory and `SEMANTIC_BROWSER_OUTPUT` to a scratch directory, then run `node tests/semantic-workspace.browser.mjs`.

## Remaining boundaries
- No live authenticated API, actual project data or model output was exercised.
- Backend graph context is currently used by single-report analysis; deputy/portfolio graph reasoning is not implemented by this interface replacement.
- A graph represents recorded evidence and gaps, not guaranteed complete project knowledge, deliverable acceptance or proven causality.
- Independent UI and backend reviews are accepted locally. Deployment and live authenticated acceptance still require explicit user permission. Optional reviewer suggestions (deeper future provenance traversal and additional lifecycle symmetry) are nonblocking followups.
- Backend followup 87bc172 preserves actual WBS hierarchy in the legacy projection, hard-clamps query sizes, and serializes typed relationship/source paths into AI context.
- The uncommitted server.ts router-model defaults and railway_credentials_rotated.txt are user-owned and excluded from feature commits.
