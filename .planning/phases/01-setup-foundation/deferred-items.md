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
