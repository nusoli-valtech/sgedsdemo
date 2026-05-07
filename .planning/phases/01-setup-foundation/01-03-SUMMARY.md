---
phase: 01-setup-foundation
plan: 03
subsystem: infra
tags: [husky, pre-commit, eslint, security-control, no-publish-constraint, eds]

# Dependency graph
requires: []
provides:
  - Pre-commit guard that rejects publish-tier AEM hostnames in runtime code
  - Tooling enforcement of CP-1 (no-Publish architecture constraint)
  - File:line:match diagnostic format reusable by future lint scripts
affects:
  - 02-cfo-migration (article-* blocks must use Author host once Publish ref is removed)
  - all future phases (any new block code is now scanned at commit time)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass pre-commit script (existing build step + new scan pass) appended in-place rather than replaced"
    - "Staged-content scanning via 'git show :<file>' — prevents post-stage edit bypass"
    - "Allowlist-based path scoping (blocks/, scripts/, top-level *.html / *.json) — defaults to safe (skip)"

key-files:
  created: []
  modified:
    - .husky/pre-commit.mjs

key-decisions:
  - "Used single project-wide regex /publish-[A-Za-z0-9-]+\\.adobeaemcloud\\.com/ rather than literal 'publish-p23458-' (per CONTEXT D-04 — catches accidental copy-paste from any AEM Cloud project)"
  - "Read STAGED content via 'git show :<file>' instead of working-tree content — closes the stage-then-edit bypass"
  - "Top-level *.html / *.json scanned but nested config dirs (.github/, tools/, .planning/, docs/) deliberately skipped (per CONTEXT D-05)"
  - "Preserved existing model-partials build step verbatim and APPENDED the scan pass (per CONTEXT D-06)"
  - "Added targeted eslint-disable comments rather than refactoring the inherited 'run' helper, to keep the diff minimal and the existing behavior bit-identical"

patterns-established:
  - "Pre-commit is the gate of last resort: scan staged content (not working tree) so post-stage edits cannot regress"
  - "Allowlist-by-path-prefix for security scans — explicit, auditable, deterministic"
  - "Diagnostic message format: 'pre-commit: <file>:<line>  matched <substring>' + one-line `why` + Fix: hint"

requirements-completed: [SET-03]

# Metrics
duration: ~12min
completed: 2026-05-06
---

# Phase 01 Plan 03: Pre-commit guard for publish hosts Summary

**Two-pass husky pre-commit hook that rejects any new `publish-<id>.adobeaemcloud.com` reference in runtime code paths (blocks/, scripts/, top-level *.html / *.json), preserving the existing model-partials build step verbatim.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-06T15:52:00Z (approx)
- **Completed:** 2026-05-06T16:04:46Z
- **Tasks:** 2 (1 implementation + 1 smoke verification)
- **Files modified:** 1 (`.husky/pre-commit.mjs`)

## Accomplishments

- Extended `.husky/pre-commit.mjs` with a publish-host scan pass that reads STAGED content (`git show :<file>`) so post-stage edits cannot bypass the guard.
- Failure mode emits `pre-commit: <file>:<line>  matched '<host>'` + a one-line `why` referencing ROADMAP Phase 1 SET-03 + a `Fix:` hint pointing at `scripts/config.js` (AEM_AUTHOR_HOST).
- Preserved the existing model-partials block (lines 12-22 in the new file) — `build:json --silent` still runs and the merged JSON artifacts are still re-staged automatically.
- All three smoke scenarios pass: positive (publish host in blocks/) rejects with rc=1; negative (author host) allows with rc=0; out-of-scope (.planning/) allows with rc=0.

## Task Commits

1. **Task 1: Extend .husky/pre-commit.mjs with a publish-host scan pass** — `730509f` (feat)
2. **Task 2: Run the three functional smoke scenarios end-to-end and confirm clean exit** — _no commit_ (verification-only task; produced no diff)

## Files Created/Modified

- `.husky/pre-commit.mjs` — grew from 21 → 81 lines. Existing model-partials behavior preserved verbatim (with quote style normalized to single quotes per airbnb-base) + new SET-03 publish-host scan pass appended.

## New file contents

```js
import { exec } from 'node:child_process';

// eslint-disable-next-line no-promise-executor-return
const run = (cmd) => new Promise((resolve, reject) => exec(
  cmd,
  (error, stdout) => {
    if (error) reject(error);
    else resolve(stdout);
  },
));

const changeset = await run('git diff --cached --name-only --diff-filter=ACMR');
const modifiedFiles = changeset.split('\n').filter(Boolean);

// check if there are any model files staged
const modifledPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifledPartials.length > 0) {
  const output = await run('npm run build:json --silent');
  // eslint-disable-next-line no-console
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}

// SET-03: enforce no-Publish constraint by scanning staged runtime-code files
// for any reference to an AEM Cloud publish hostname. Skip docs/planning/config dirs.
const PUBLISH_HOST_RE = /publish-[A-Za-z0-9-]+\.adobeaemcloud\.com/;

const isRuntimeCodePath = (file) => {
  // Allowlist of runtime-code paths per D-05.
  if (file.startsWith('blocks/')) return true;
  if (file.startsWith('scripts/')) return true;
  // Top-level *.html / *.json only (no nested config — those are skipped).
  if (!file.includes('/')) {
    if (file.endsWith('.html')) return true;
    if (file.endsWith('.json')) return true;
  }
  return false;
};

const violations = [];
const runtimeFiles = modifiedFiles.filter(isRuntimeCodePath);
// eslint-disable-next-line no-restricted-syntax
for (const file of runtimeFiles) {
  // Read STAGED content (not working-tree content) so the guard reflects
  // exactly what is about to be committed.
  let staged = null;
  try {
    // eslint-disable-next-line no-await-in-loop
    staged = await run(`git show :${file}`);
  } catch {
    // File staged for deletion or unreadable — nothing to scan.
    staged = null;
  }
  if (staged !== null) {
    const lines = staged.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const match = lines[i].match(PUBLISH_HOST_RE);
      if (match) {
        violations.push({ file, line: i + 1, match: match[0] });
      }
    }
  }
}

if (violations.length > 0) {
  /* eslint-disable no-console */
  console.error('');
  console.error('pre-commit: publish-tier AEM hostnames are banned in runtime code.');
  console.error('  See ROADMAP Phase 1 SET-03 — the EDS demo intentionally has no Publish tier.');
  console.error('');
  // eslint-disable-next-line no-restricted-syntax
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  matched '${v.match}'`);
  }
  console.error('');
  console.error('Fix: replace with the Author host from scripts/config.js (AEM_AUTHOR_HOST),');
  console.error('     or move the reference to .planning/ / docs/ if it is documentation.');
  /* eslint-enable no-console */
  process.exit(1);
}
```

## Smoke scenario output

### POSITIVE — publish host in `blocks/` (must reject)

- **Setup:** staged `blocks/__tmp_smoke__/__tmp_smoke__.js` containing `const x = 'https://publish-p99999-e88888.adobeaemcloud.com/test';`
- **Exit code:** `1` (PASS)
- **stderr (verbatim):**
  ```
  pre-commit: publish-tier AEM hostnames are banned in runtime code.
    See ROADMAP Phase 1 SET-03 — the EDS demo intentionally has no Publish tier.

    blocks/__tmp_smoke__/__tmp_smoke__.js:1  matched 'publish-p99999-e88888.adobeaemcloud.com'

  Fix: replace with the Author host from scripts/config.js (AEM_AUTHOR_HOST),
       or move the reference to .planning/ / docs/ if it is documentation.
  ```

### NEGATIVE — author host in `blocks/` (must allow)

- **Setup:** staged `blocks/__tmp_smoke__/__tmp_smoke__.js` containing `const x = 'https://author-p23458-e585661.adobeaemcloud.com/test';`
- **Exit code:** `0` (PASS — author hostnames do not trip the regex)
- **stderr:** _(empty)_

### OUT-OF-SCOPE — publish host in `.planning/` (must allow)

- **Setup:** staged `.planning/__tmp_smoke__.md` containing `Publish hosts like https://publish-p23458-e585661.adobeaemcloud.com are documented.`
- **Exit code:** `0` (PASS — `.planning/` is not in the runtime-code allowlist)
- **stderr:** _(empty)_

### Cleanliness check

- After all three scenarios, `git status --porcelain | grep -E "^.. (blocks/__tmp|\.planning/__tmp)"` returns nothing — no leftover smoke files.

## Existing behavior preserved

The model-partials block is preserved verbatim from the original file. The two surface-level changes are:

1. Quote style normalized: `"node:child_process"` → `'node:child_process'` (single-quote per airbnb-base; the original was the only file in the repo using double quotes for that import).
2. `console.log(output)` prefixed with `// eslint-disable-next-line no-console` (the existing warning was previously hidden because `npm run lint:js` does not lint `.husky/` by default).

No semantic change: the same `npm run build:json --silent` runs when `_*.json` partials are staged, and the same `git add component-models.json component-definition.json component-filters.json` re-stages the merged outputs.

## Decisions Made

- See key-decisions in frontmatter. All four locked decisions from CONTEXT.md (D-04, D-05, D-06) were honored. One additional decision was made during execution: keep the inherited `run` helper bit-identical and silence the pre-existing `no-promise-executor-return` warning with a targeted eslint-disable rather than refactor it to `(resolve, reject) => { ... }` form. Rationale: the plan explicitly requires "preserve the existing model-partials behavior verbatim" and the `run` helper is the load-bearing primitive of that behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed project dependencies**
- **Found during:** Task 1 verification (lint gate)
- **Issue:** `node_modules/` was empty in this fresh worktree; `./node_modules/.bin/eslint` did not exist, so the plan's lint verify step (`npm run lint:js -- .husky/pre-commit.mjs`) could not run with the project-pinned ESLint v8 (`npx eslint` resolved to a global v9 incompatible with the legacy `.eslintrc.js`).
- **Fix:** Ran `npm ci --no-audit --no-fund`. Installed 402 packages. `package-lock.json` and `package.json` untouched (no drift). `node_modules/` is gitignored.
- **Verification:** `./node_modules/.bin/eslint --no-ignore .husky/pre-commit.mjs` exits 0 after fixes.
- **Committed in:** N/A (no source-tree change — only `node_modules/` populated, which is gitignored).

**2. [Rule 1 - Bug] Eliminated `no-continue` violations introduced by the plan-prescribed loop body**
- **Found during:** Task 1 verification (lint with `--no-ignore`).
- **Issue:** The plan-prescribed `for...of` loop used `continue` for the path-skip and the deletion-skip branches. airbnb-base's `no-continue` rule rejected both.
- **Fix:** Pre-filtered runtime files via `modifiedFiles.filter(isRuntimeCodePath)` (eliminating the first `continue`) and replaced the deletion-skip `continue` with a `staged !== null` guard around the line-scanning loop (eliminating the second). Behavior identical: deleted/unreadable files contribute zero violations.
- **Files modified:** `.husky/pre-commit.mjs`
- **Verification:** `./node_modules/.bin/eslint --no-ignore .husky/pre-commit.mjs` → 0 errors, 0 warnings. All three smoke scenarios still pass.
- **Committed in:** `730509f` (Task 1 commit).

**3. [Rule 1 - Bug] Silenced the `no-promise-executor-return` warning on the inherited `run` helper**
- **Found during:** Task 1 verification (lint with `--no-ignore`).
- **Issue:** The original `run = (cmd) => new Promise((resolve, reject) => exec(cmd, (error, stdout) => { if (error) reject(error); else resolve(stdout); }))` form returns the result of `exec()` from the executor function, which `no-promise-executor-return` flags. This was a pre-existing latent issue in the original file (hidden because `npm run lint:js` doesn't lint `.husky/`). Touching the file in this plan brings it into scope of any future audit.
- **Fix:** Added `// eslint-disable-next-line no-promise-executor-return` directly above the helper. Did NOT refactor to `(resolve, reject) => { exec(...) }` form, because the plan explicitly requires "the existing model-partials behavior is preserved verbatim" and this helper is the primitive that drives both the existing build step and the new scan.
- **Files modified:** `.husky/pre-commit.mjs`
- **Verification:** Lint clean; both build-step (model-partials flow, indirectly via the smoke scenarios that don't stage partials) and new-scan flow continue to work.
- **Committed in:** `730509f` (Task 1 commit).

**4. [Rule 2 - Critical] Marked intentional console use with eslint-disable per CLAUDE.md convention**
- **Found during:** Task 1 verification.
- **Issue:** CLAUDE.md mandates `// eslint-disable-next-line no-console` for intentional `console.*` usage. The existing `console.log(output)` in the model-partials block lacked this comment (pre-existing latent issue, hidden because `.husky/` isn't linted by default), and the new violation-reporter block has 8 intentional `console.error` calls.
- **Fix:** Added `// eslint-disable-next-line no-console` above `console.log(output)` and wrapped the violation reporter in `/* eslint-disable no-console */ ... /* eslint-enable no-console */` block-comment pair.
- **Files modified:** `.husky/pre-commit.mjs`
- **Verification:** Lint clean (0 warnings, 0 errors with `--no-ignore`).
- **Committed in:** `730509f` (Task 1 commit).

---

**Total deviations:** 4 auto-fixed (1 blocking — dep install; 3 lint correctness — `no-continue` × 2, `no-promise-executor-return` × 1, `no-console` policy × multiple)
**Impact on plan:** All four fixes are correctness/policy compliance — none change behavior. The three smoke scenarios pass exactly as the plan prescribes.

## Issues Encountered

- **`npm run lint:js -- .husky/pre-commit.mjs` does NOT actually scan only `.husky/pre-commit.mjs`.** When the script `eslint . --ext .json,.js,.mjs` is invoked with an extra positional arg, eslint scans `.` AND `.husky/pre-commit.mjs` (the latter only emits the "File ignored by default" warning). The full scan also surfaces 3 pre-existing errors in `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js` (`no-underscore-dangle`, `eol-last` × 2). These are out of scope for this plan per the SCOPE BOUNDARY rule and are deferred — they will be resolved by Plan 02 (CFO migration of the article blocks). Direct `./node_modules/.bin/eslint --no-ignore .husky/pre-commit.mjs` is the lint command that actually exercises the file modified by this plan, and it exits 0.
- **`.husky/pre-commit.mjs` is not part of CI lint coverage.** The default eslint dotfile-ignore behavior excludes it from `npm run lint:js`. This is a tooling gap, not a correctness gap for SET-03 (the hook runs on every developer commit regardless of CI). Documented as a known limitation; addressing it is not in this plan's scope.

## Known Limitations (per threat model)

- **`git commit --no-verify` bypasses the hook (T-01-03-02, accepted).** A deliberate developer choice. CI-side enforcement is a future requirement, not in scope for SET-03.
- **String-concatenation obfuscation defeats the regex (T-01-03-05, accepted).** `'publi' + 'sh-p23458-' + 'e585661.adobeaemcloud.com'` would not match. Caught at code review.
- **Working-copy edits AFTER `git add` are NOT scanned (T-01-03-01, mitigated).** The hook reads STAGED content via `git show :<file>`, so the dirty edit is not the version that would be committed. The committed version (the staged version) is what gets scanned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 1 wave 1 plan 03 complete. Pre-commit guard is active for any subsequent work in this worktree (and on `main` once merged).
- Plan 02 (CFO migration of `article-hero` and `article-teaser`) MUST remove the existing `https://publish-p23458-e585661.adobeaemcloud.com/...` GraphQL endpoint references from those blocks before attempting to commit them, because this guard now rejects them. The migration plan should already do this (it replaces the endpoint with the Author proxy), but the guard makes the constraint mechanical.
- No blockers for Phase 2.

## Self-Check: PASSED

- `.planning/phases/01-setup-foundation/01-03-SUMMARY.md` — FOUND (this file).
- `.husky/pre-commit.mjs` — FOUND (modified).
- Commit `730509f` — FOUND in `git log`.
- All five plan-acceptance grep checks return `1` as expected.
- All three functional smoke scenarios pass (rc 1 / 0 / 0).
- Working tree clean after smoke run.

---
*Phase: 01-setup-foundation*
*Completed: 2026-05-06*
