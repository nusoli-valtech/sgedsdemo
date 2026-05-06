# Deferred Items — Phase 01 Setup Foundation

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
