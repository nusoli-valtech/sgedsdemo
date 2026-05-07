# Deferred Items — Phase 01

Pre-existing issues encountered during phase execution that are out of scope for the current plan but should be tracked for later resolution.

## Discovered during 01-01 execution (2026-05-06)

### Pre-existing lint errors in `article-*` blocks

**Files:**
- `blocks/article-hero/article-hero.js` — 1 error (`no-underscore-dangle` on `_path` line 20), 1 error (`eol-last` line 34), 1 warning (`no-console` line 32)
- `blocks/article-teaser/article-teaser.js` — 1 error (`eol-last` line 29), 1 warning (`no-console` line 27)

**Origin:** Pre-existing in commits `c40ad8f` ("New hero") and `4075bca` ("new component") on `main`, NOT introduced by plan 01-01.

**Why deferred:** Plan 01-01 was a surgical null-guard plan touching only `scripts/editor-support.js`, `blocks/header/header.js`, `blocks/footer/footer.js`. The article-block lint errors are out of the `<scope_boundary>` for plan 01-01.

**Tracked already in CONCERNS.md:** The CFO (Content Fragment Office) migration is the umbrella for cleaning up article blocks (XSS hardening + lint hygiene). These lint errors will be naturally resolved when those blocks are rewritten as part of that migration. They were *not* listed in the plan-01 acceptance criteria.

**Action when picked up:** Either:
1. Fix in a small `chore(lint)` plan before CFO migration if blocking CI, OR
2. Carry forward into the CFO migration plan and resolve as part of the article-block rewrites.

**CI impact:** `.github/workflows/main.yaml` runs `npm run lint` on every push. These errors mean CI is currently red on `main` independent of plan 01-01 work — confirm with the orchestrator whether to fix-forward in a chore plan or accept until CFO migration.

---


Items discovered during execution that are out of scope for the current plan and have been deferred.

## From Plan 01-04 (DOMPurify vendored upgrade)

### Pre-existing lint failures in article blocks (out of scope)

Discovered when running `npm run lint:js` for Task 1 verification. These errors exist on
unmodified files in the base codebase and were NOT introduced by Plan 01-04.

**Files / Errors:**

- `blocks/article-hero/article-hero.js`
  - Line 20:23 — `no-underscore-dangle` (`_path` identifier)
  - Line 32:5 — `no-console` warning
  - Line 34:2 — `eol-last` (newline required at end of file)
- `blocks/article-teaser/article-teaser.js`
  - Line 27:5 — `no-console` warning
  - Line 29:2 — `eol-last` (newline required at end of file)

**Disposition:** Phase 2 will rewrite both files as part of the CFO migration (CP-2 fix).
The new files will be authored to lint clean. No fix needed in Phase 1 — touching these
files now would conflict with the planned Phase 2 rewrite.

**Plan-04 verification adjustment:** The plan's automated `verify` step in Task 1 / Task 2
expects `npm run lint:js` (full repo) to exit 0. Because of these pre-existing failures,
the executor verified scope-bounded lint-cleanliness instead — running ESLint directly
against `scripts/dompurify.min.js` (file-ignored, exit 0) and `package.json` (exit 0).
This was applied as a Rule 1 deviation to the plan's verification phrasing; the underlying
SCOPE BOUNDARY rule explicitly forbids fixing unrelated pre-existing failures.
