---
phase: 02-content-fragment-overlay
plan: 06
status: complete
completed: 2026-05-09
requirements: [CFO-04, CFO-05, CFO-06, CFO-07, CFO-08, CFO-09]
---

# 02-06 SUMMARY — article-teaser rewrite + cf-endpoint metadata

## Outcome

Symmetric to plan 02-05. Three artifacts modified:

1. `blocks/article-teaser/article-teaser.js` — full rewrite using the same `fetchOverlay` + `loadScript` + `window.DOMPurify` + `moveInstrumentation` pattern as `article-hero`. Same DOMPurify import deviation (UMD-only vendor; see 02-05 SUMMARY for rationale).
2. `blocks/article-teaser/_article-teaser.json` — UE component model with one `cfReference` field, mirrors `_article-hero.json` shape.
3. `head.html` — added `<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>` immediately after the viewport meta. Closes CFO-08.

## CFO-08 closure

`scripts/cf-overlay.js`'s `fetchOverlay` reads `getMetadata('cf-endpoint') || DAM_PREFIX`. With this commit, page-side metadata supplies the value `/content/dam/sgedsdemo` (path only, no host — Pattern 4 / A2 compliant). The host-name configuration is no longer hardcoded in any block — it lives in `scripts/config.js` (Phase 1 lock) and `head.html` only.

## Acceptance criteria — verified

**article-teaser.js:**
- [x] No `publish-p23458`, no `GRAPHQL_ENDPOINT`, no `block.innerHTML`.
- [x] `import { fetchOverlay } from '../../scripts/cf-overlay.js'` present.
- [x] `DOMPurify.sanitize` (via `window.DOMPurify`) present.
- [x] `moveInstrumentation(` present.
- [x] `console.error('article-teaser: missing CF'` present.
- [x] `block.replaceChildren()` no-args call present.
- [x] ESLint exits 0.

**_article-teaser.json:**
- [x] Parses as valid JSON.
- [x] `"id": "article-teaser"`, `"name": "cfReference"`, validation rootPath under `/content/dam/sgedsdemo/articles`.
- [x] ESLint exits 0.

**head.html:**
- [x] 10 lines (was 9, +1 for the new meta).
- [x] Contains literal `<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>`.
- [x] Still contains `Content-Security-Policy`.
- [x] Pre-commit guard accepts (path-only value, no `publish-*` substring).

## Phase 2 runtime code surface — complete

This plan completes the runtime code changes for Phase 2:
- `scripts/cf-overlay.js` (created in 02-03)
- `cf-templates/article.html` (created in 02-04)
- `blocks/article-hero/article-hero.js` + `_article-hero.json` (rewritten in 02-05)
- `blocks/article-teaser/article-teaser.js` + `_article-teaser.json` (rewritten in 02-06)
- `head.html` (cf-endpoint meta added)

Remaining waves only ship documentation (02-07) and verify behavior (02-08 smoke tests).

## Notes for downstream

- **Husky pre-commit auto-rebuild:** committing both `_article-hero.json` and `_article-teaser.json` together triggers one `npm run build:json` invocation, producing consistent merged `component-*.json` bundles.
- **Plan 02-07 (DOC-01):** document the DOMPurify UMD pattern (`loadScript` + `window.DOMPurify`) so future block authors don't try ESM default-import.
- **Plan 02-08 (smoke test):** verify (a) UE `data-aue-*` survives a CF re-pick + Save click cycle, (b) XSS payload in CF body renders inert (no alert), (c) `.aem.page` and `.aem.live` parity returns rendered HTML now that the template is in place.
