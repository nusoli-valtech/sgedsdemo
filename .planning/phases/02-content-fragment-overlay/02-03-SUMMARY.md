---
phase: 02-content-fragment-overlay
plan: 03
status: complete
completed: 2026-05-09
requirements: [CFO-02, CFO-08]
---

# 02-03 SUMMARY — cf-overlay spike + helper

## Outcome

`scripts/cf-overlay.js` ships with two locked named exports (`assetUrl`, `fetchOverlay`). Wave 2 spike unknowns resolved.

## Captured field shape (closes OQ-5)

The Author Assets API returns:

```
properties.elements.title.value     → "Phase 2 Spike Article"        (plain string)
properties.elements.body.value      → "<p>...</p>"                   (rich-text, HTML-encoded)
properties.elements.image.value     → "/content/dam/sgedsdemo/..."   (bare DAM path)
properties.elementsOrder            → ["title", "body", "image"]
properties.cq:model.path            → "/conf/.../models/article"
```

**Implication for plan 02-04 Mustache:** variables are accessed via the **full path**, e.g. `{{{properties.elements.body.value}}}`, NOT a flattened `{{{body}}}`. The json2html worker passes the full Assets API payload to Mustache without transform.

**Body field encoding quirk** — the rich-text body in the test fragment is double-encoded (`<p>&lt;p&gt;Hello...&lt;/p&gt;</p>`). This reflects how the AEM rich-text editor stores content the user typed as literal `<p>`. DOMPurify in Phase 2 plans 02-05/06 sanitizes the unescaped output regardless — no template-side workaround needed.

## .aem.page vs .aem.live parity (OQ-1)

**Both return 404** for the test CF's `.plain.html` URL. Parity holds at the 404 level.

**Why 404 right now:** the json2html worker is registered (plan 02-02) but has no template to render — `cf-templates/article.html` doesn't exist yet. Plan 02-04 ships it.

**OQ-1 final check deferred to plan 02-08 smoke test:** once 02-04 commits + the CF re-publishes, both edges should return rendered HTML. If parity diverges then, defer the fix to a future v2 phase per D-01.

## A8 lock — `assetUrl` is identity transform

Image values are bare DAM paths. EDS edge serves DAM at the same path. `assetUrl(repoPath)` is the identity function with a `DAM_PREFIX` allowlist guard. If a future asset class needs rewriting, change the body in ONE place — no inline transforms in block code.

## CFO-1 marker contract

`fetchOverlay` requires `.article-cf` to be present in the loaded fragment. The Mustache template (plan 02-04) **MUST** wrap its output in `<div class="article-cf">…</div>`. Absent marker → `fetchOverlay` returns null and the caller falls back to D-08 empty-state.

## Acceptance criteria — verified

- [x] `samples/cf-json-sample.json` exists, contains `"properties"` (real Assets API shape).
- [x] `samples/cf-overlay-plain-html-sample.html` exists (records pre-template 404 state).
- [x] `scripts/cf-overlay.js` exists.
- [x] 2 named exports (`assetUrl`, `fetchOverlay`).
- [x] Imports `loadFragment` from `../blocks/fragment/fragment.js`.
- [x] Imports `DAM_PREFIX` from `./config.js`.
- [x] `.article-cf` marker check present.
- [x] No `publish-*.adobeaemcloud` literal — author-only.
- [x] `npx eslint scripts/cf-overlay.js` exits 0.

## Notes for downstream plans

- **Plan 02-04 (Mustache):** template wrapper class is `article-cf`. Variable paths are `{{{properties.elements.<name>.value}}}`. Rich-text body uses triple-brace; plain-text title uses double-brace.
- **Plan 02-05 (article-hero) + 02-06 (article-teaser):** `import { fetchOverlay, assetUrl } from '../../scripts/cf-overlay.js'`. `fetchOverlay` returns `<main>|null`. Single error path: null → render empty state per D-08 + DOMPurify-sanitize the result.
- **Plan 02-07 (DOC-01):** document the `.article-cf` wrapper requirement so future template authors don't accidentally break the CFO-1 defence.
- **Plan 02-08 (smoke test):** re-curl both edges + replace the placeholder plain.html sample with the live render once 02-04 has shipped.
