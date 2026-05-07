---
phase: 01-setup-foundation
plan: 01
subsystem: reliability
tags: [eds, universal-editor, null-guard, reliability, applyChanges, loadFragment]

# Dependency graph
requires:
  - phase: bootstrap
    provides: Existing decorate/loadFragment plumbing in scripts/aem.js, blocks/header, blocks/footer, blocks/fragment, scripts/editor-support.js
provides:
  - Reliable applyChanges in Universal Editor patches (no TypeError on missing updates)
  - Soft-fail decorate paths in header.js and footer.js when /nav or /footer 404
  - Confirmed existing null-guard in blocks/fragment/fragment.js decorate (verification only)
affects: [02-cf-migration, 03-target-integration, 04-fragment-api, 05-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soft-fail null-guard immediately after every loadFragment(...) await before any DOM access"
    - "Defensive `if (!updates || !updates.length) return false;` in applyChanges so caller's reload-on-fail path handles gracefully"

key-files:
  created:
    - .planning/phases/01-setup-foundation/deferred-items.md
  modified:
    - scripts/editor-support.js
    - blocks/header/header.js
    - blocks/footer/footer.js

key-decisions:
  - "Preserved soft-fail pattern (silent return) over inline error UI per CONTEXT.md D-11 — matches existing convention in blocks/article-hero/article-hero.js error path"
  - "Did not edit blocks/fragment/fragment.js — verification confirmed the existing `if (fragment) {` guard at line 51 already wraps every fragment.X access (only usage is fragment.querySelector at line 52, inside the if-block, function ends at line 58)"
  - "Did not auto-fix the pre-existing lint errors in blocks/article-*/*.js — out of scope per execute-plan.md scope_boundary; logged to deferred-items.md to be carried into the CFO migration"

patterns-established:
  - "Null-guard placement: insert directly after `await loadFragment(...)` and before the next statement that touches the result. Two-space indent, single-line `if (!fragment) return;`. No comments, no JSDoc additions."
  - "applyChanges defensive chain: `if (!resource) return false;` already existed; this plan added `if (!updates || !updates.length) return false;` as the symmetric companion before destructuring updates[0]."

requirements-completed: [SET-01]

# Metrics
duration: 5min
completed: 2026-05-06
---

# Phase 01 Plan 01: applyChanges + fragment null-guards Summary

**Three surgical null-guards (one each in scripts/editor-support.js, blocks/header/header.js, blocks/footer/footer.js) plus verification that blocks/fragment/fragment.js already guards correctly — eliminates the CF-EXISTING-3 null-pointer crash family.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-06T15:58:52Z
- **Completed:** 2026-05-06T16:03:02Z
- **Tasks:** 3 (2 edit-tasks committed, 1 verification-only)
- **Files modified:** 3

## Accomplishments

- `scripts/editor-support.js` line 27: `applyChanges` no longer throws TypeError when a Universal Editor patch arrives with `detail.response.updates` undefined; returns `false` so the caller falls through to its existing `window.location.reload()` graceful-degradation path.
- `blocks/header/header.js` line 115: header `decorate` now returns silently if `loadFragment('/nav')` returns `null`, instead of throwing on `fragment.firstElementChild`.
- `blocks/footer/footer.js` line 13: footer `decorate` now returns silently if `loadFragment('/footer')` returns `null`, same pattern.
- Verified: `blocks/fragment/fragment.js` decorate at line 47 already wraps every `fragment.X` access inside an existing `if (fragment) {` guard at line 51. No edit applied.

## Task Commits

Each task was committed atomically:

1. **Task 1: applyChanges null-guard for undefined updates** — `1b3234e` (fix)
2. **Task 2: header.js + footer.js fragment null-guards** — `6daa62d` (fix)
3. **Task 3: Verify blocks/fragment/fragment.js already guards null fragment correctly** — verification only, no edit, no commit (existing `if (fragment) {` at line 51 confirmed; only `fragment.X` usage is `fragment.querySelector` at line 52, inside the if-block; function ends at line 58)

**Plan metadata commit:** [pending — orchestrator handles wave-merge]

## Files Created/Modified

- `scripts/editor-support.js` — Added `!updates ||` to the existing `if (!updates.length)` check at line 27. Single in-place edit, line count unchanged (125 → 125).
- `blocks/header/header.js` — Inserted `if (!fragment) return;` at new line 115, immediately after `const fragment = await loadFragment(navPath);` at line 114. Line count 166 → 167. Existing blank line preserved before `// decorate nav DOM` comment at line 117.
- `blocks/footer/footer.js` — Inserted `if (!fragment) return;` at new line 13, immediately after `const fragment = await loadFragment(footerPath);` at line 12. Line count 20 → 21. Existing blank line preserved before `// decorate footer DOM` comment at line 15.
- `.planning/phases/01-setup-foundation/deferred-items.md` — Created. Tracks pre-existing lint errors in `blocks/article-*/*.js` that surfaced during full-repo lint and are out of scope for this plan.
- `blocks/fragment/fragment.js` — UNCHANGED (verification confirmed existing guard is correct). `git diff blocks/fragment/fragment.js` returns empty.

## Acceptance Verification

Plan verification grep checks:

```
$ grep -n "if (!updates || !updates.length) return false;" scripts/editor-support.js
27:  if (!updates || !updates.length) return false;          # ✅ line 27

$ grep -c "if (!updates.length) return false;" scripts/editor-support.js
0                                                            # ✅ unguarded form gone

$ grep -n "if (!fragment) return;" blocks/header/header.js
115:  if (!fragment) return;                                 # ✅ line 115

$ grep -n "if (!fragment) return;" blocks/footer/footer.js
13:  if (!fragment) return;                                  # ✅ line 13

$ grep -n "while (fragment.firstElementChild)" blocks/header/header.js
121:  while (fragment.firstElementChild) ...                 # ✅ shifted to line 121

$ grep -n "while (fragment.firstElementChild)" blocks/footer/footer.js
18:  while (fragment.firstElementChild) ...                  # ✅ shifted to line 18

$ wc -l blocks/header/header.js blocks/footer/footer.js
     167 blocks/header/header.js                             # ✅ +1 from 166
      21 blocks/footer/footer.js                             # ✅ +1 from 20

$ grep -n "if (fragment) {" blocks/fragment/fragment.js
51:  if (fragment) {                                         # ✅ line 51 (verification)

$ git diff --name-only blocks/fragment/fragment.js
                                                             # ✅ empty (no edit applied)
```

Aggregate diff stat:

```
$ git diff --stat ca868da..HEAD
 blocks/footer/footer.js   | 1 +
 blocks/header/header.js   | 1 +
 scripts/editor-support.js | 2 +-
 3 files changed, 3 insertions(+), 1 deletion(-)
```

Note on the diff stat: `editor-support.js` shows `+2/−1` (rather than the plan's "exactly three insertions and zero deletions" framing) because Task 1 was an in-place token replacement on a single line rather than a fresh inserted line. Three guards were added; one outdated guard form was removed. Net behavior matches the plan's intent and acceptance criteria — the unguarded form is absent and the guarded form is on the prescribed line.

## Lint Results

`npm run lint` was run after all edits.

- **Plan-scoped lint** (`eslint scripts/editor-support.js blocks/header/header.js blocks/footer/footer.js blocks/fragment/fragment.js`): exit 0, clean. ✅
- **Full-repo lint** (`npm run lint`): 3 pre-existing errors / 2 pre-existing warnings in `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js`. These were already on `main` (commits `c40ad8f` and `4075bca`) and are NOT introduced by this plan. They are out of `scope_boundary` per execute-plan.md (only auto-fix issues directly caused by current task changes; pre-existing failures in unrelated files go to deferred-items). Logged to `.planning/phases/01-setup-foundation/deferred-items.md`. The CFO migration (per CLAUDE.md) is the umbrella for resolving them — they are tracked there.

## Decisions Made

- **D-11 preserved (soft-fail over inline error UI):** The chosen behavior on null fragment is silent `return;` — same shape as `blocks/article-hero/article-hero.js:12-32` `try/catch { console.error; return; }` pattern. Not adding any UI affordance to a missing nav/footer scenario; that is intentionally deferred until product feedback says otherwise.
- **fragment.js verification confirmed no gap:** Plan explicitly said "verify only; only patch if a gap is found." Inspection of lines 47-58 shows `fragment.querySelector` (the only `fragment.X` access) is on line 52, inside the if-block opened on line 51 and closed on line 58. No edit was applied. Recorded in this SUMMARY per Task 3 acceptance criterion.
- **`applyChanges` count discrepancy:** Plan acceptance said "applyChanges occurrences = 3 in original"; actual original count is 2 (function declaration at line 16 + reassignment in attachEventListeners at line 111). Verified the count is unchanged by this edit (2 → 2), which is the actual invariant. Minor doc inaccuracy in the plan's acceptance line; functional acceptance still met.

## Deviations from Plan

**None — plan executed exactly as written.** No deviation rules (1-4) triggered. Three guards landed at the prescribed lines. Verification of `blocks/fragment/fragment.js` confirmed the existing guard. The pre-existing article-block lint errors are out of scope (per `scope_boundary`) and were correctly logged to `deferred-items.md` rather than auto-fixed.

## Issues Encountered

- **eslint not installed in worktree at start.** `npm ci` was needed before lint could run (worktree was freshly created without `node_modules`). Resolved by running `npm ci` once; took ~4s. Not a deviation — expected first-time setup in a fresh worktree.
- **`npx eslint` pulled wrong version.** First lint attempt via `npx eslint` triggered eslint v9.39.4 which is incompatible with the project's `.eslintrc.js` (v8 format). Switched to `node_modules/.bin/eslint` (the project-pinned 8.57.1) which works correctly. Already-known npm-tooling quirk; no code change needed.

## Threat Flags

None — this plan is reliability-only. No new endpoints, auth paths, file access, or schema changes. The DoS-via-self-reload threat is mitigated by the guards as documented in the plan's `<threat_model>`. Existing DOMPurify sanitization at `scripts/editor-support.js:34` is unchanged.

## Self-Check: PASSED

- `scripts/editor-support.js` exists, line 27 contains `if (!updates || !updates.length) return false;` — FOUND
- `blocks/header/header.js` exists, line 115 contains `if (!fragment) return;` — FOUND
- `blocks/footer/footer.js` exists, line 13 contains `if (!fragment) return;` — FOUND
- `blocks/fragment/fragment.js` line 51 contains `if (fragment) {` (unchanged) — FOUND
- Commit `1b3234e` exists — FOUND (`fix(01-01): guard applyChanges against undefined response.updates`)
- Commit `6daa62d` exists — FOUND (`fix(01-01): guard header/footer decorate against null fragment`)
- `.planning/phases/01-setup-foundation/deferred-items.md` exists — FOUND

## User Setup Required

None — pure code edits. No env vars, no dashboards, no external services touched.

## Next Phase Readiness

- Reliability baseline established for all phase 02-05 work that touches `loadFragment` or Universal Editor patches.
- Phase 02 (CFO migration) can rely on `applyChanges` no longer crashing, which is important because that migration adds new patch-able blocks (`article-hero`, `article-teaser`) which will exercise the patch path more heavily.
- Phase 04 (HTML Fragment API) will reuse `loadFragment` from a different call site; the soft-fail pattern is now codified and consistent across header/footer/fragment.
- **Blocker carried forward:** Pre-existing article-block lint errors will fail CI until resolved. Orchestrator should decide whether to ship a small `chore(lint)` plan before phase 02 or fold the fix into the CFO migration. Tracked in `deferred-items.md`.

---
*Phase: 01-setup-foundation*
*Completed: 2026-05-06*
