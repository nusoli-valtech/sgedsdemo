---
phase: 02-content-fragment-overlay
plan: 05
status: complete
completed: 2026-05-09
requirements: [CFO-04, CFO-05, CFO-06, CFO-07, CFO-09]
---

# 02-05 SUMMARY — article-hero rewrite

## Outcome

`blocks/article-hero/article-hero.js` rewritten as a CFO consumer:
- Legacy `GRAPHQL_ENDPOINT = 'https://publish-...'` literal **deleted** (Phase 1 D-04 carve-out).
- `block.innerHTML = template-literal` **deleted** (CP-2 XSS sink closure).
- Now imports `fetchOverlay` from `scripts/cf-overlay.js` and sanitizes the rich-text `.body` via DOMPurify default profile.
- `moveInstrumentation(link, wrapper)` preserves UE `data-aue-*` across the DOM swap (CP-3).
- D-08 empty-state on any error (`block.replaceChildren()` keeps block element + UE attrs).

`blocks/article-hero/_article-hero.json` ships with one `cfReference` field, `aem-content-fragment` component, validation root `/content/dam/sgedsdemo/articles`.

## Plan-time deviation — DOMPurify import shape

The plan called for `import DOMPurify from '../../scripts/dompurify.min.js'`. The vendored file is a **UMD-only minified bundle** with no ES export — `import DOMPurify` would resolve to `undefined`. The in-tree precedent (`scripts/editor-support.js:32-34`) loads it via `loadScript()` and reads `window.DOMPurify`.

**Adopted pattern:**
```javascript
import { loadScript } from '../../scripts/aem.js';
// ...
await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
body.innerHTML = window.DOMPurify.sanitize(body.innerHTML, { USE_PROFILES: { html: true } });
```

`loadScript` is idempotent (checks for existing `<script src=>` before injecting), so repeat decorate calls in UE patch flows cost essentially nothing.

The plan's `pattern: "DOMPurify\\.sanitize"` acceptance criterion still matches `window.DOMPurify.sanitize` — no rewrite to acceptance gates needed.

This deviation also applies to plan 02-06 (article-teaser); should be reflected in DOC-01 (plan 02-07).

## Acceptance criteria — verified

- [x] No `publish-p23458`, no `GRAPHQL_ENDPOINT`, no `block.innerHTML` literals.
- [x] `import { fetchOverlay } from '../../scripts/cf-overlay.js'` present.
- [x] `DOMPurify.sanitize` present (called as `window.DOMPurify.sanitize`).
- [x] `moveInstrumentation(` present.
- [x] `console.error('article-hero: missing CF'` present.
- [x] `block.replaceChildren()` no-args call present.
- [x] `export default async function decorate` present.
- [x] `npx eslint blocks/article-hero/article-hero.js blocks/article-hero/_article-hero.json` exits 0.
- [x] `_article-hero.json` parses, has `cfReference` field with `aem-content-fragment` component, `required: true`, validation rootPath under `/content/dam/sgedsdemo/articles`.

## Notes for downstream

- **Husky pre-commit hook** auto-rebuilds `component-models.json`, `component-definition.json`, `component-filters.json` when staged with the model partial — plan 02-06 stages its own partial in the same commit so both rebuild together (one commit, one rebuild, no interleaved bundle conflict).
- **Plan 02-08 (smoke test)** exercises XSS payload via `<img src=x onerror=alert(1)>` in CF body — DOMPurify default profile must strip the `onerror` attribute.
- **CSS not touched** — `blocks/article-hero/article-hero.css` selectors continue to apply to the existing block wrapper. If layout breaks at smoke test, CSS adjustments are a follow-up.
