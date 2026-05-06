# Research Summary — SG EDS Demo POC

**Synthesized:** 2026-05-06
**From:** STACK.md · FEATURES.md · ARCHITECTURE.md · PITFALLS.md
**Consumer:** gsd-roadmapper

---

## Executive Summary

This is an AEM EDS (Helix/Franklin) proof-of-concept running on AEM Cloud Service Author + Universal Editor with **no Publish tier**. That constraint is not cosmetic — every existing code path that touches the Publish endpoint is broken today (article-hero and article-teaser call a hardcoded GraphQL persisted query on `publish-p23458-*`), and every tutorial or sample from Adobe assumes Publish exists. The entire POC is about proving four patterns work without it: Content Fragment Overlay via the admin-hosted json2html worker, a global placeholder/variable mechanism backed by a spreadsheet, Adobe Target personalization via AEP Web SDK (alloy), and an HTML Fragment API for cross-origin consumers using EDS's built-in `.plain.html` + `headers.json` CORS.

The recommended approach for all four capabilities is additive and stays on the existing no-bundler vanilla-JS EDS scaffold. CFO replaces broken GraphQL with server-rendered HTML from an Author-proxied overlay. Placeholders add a single `fetchPlaceholders` + TreeWalker pass in the eager phase. Target vendors `alloy.js` and the `aem-martech` plugin, wired across all three EDS loading phases. The HTML Fragment API requires zero new runtime code — just a `headers.json` POST to the Admin API. The biggest risk across all four is the no-Publish constraint being forgotten mid-implementation; the second biggest is carrying forward the existing XSS (innerHTML + un-sanitized GraphQL data) into the new code paths.

Build order CFO → Placeholders → Target → HTML API is architecturally sound. The only real ordering constraint is that placeholder resolution must run before Target propositions are applied (eager-phase sequencing). HTML API is configuration-only and can be parallelized with Phase 1 if bandwidth allows.

---

## Stack at a Glance

| Capability | Key library / endpoint / config |
|------------|--------------------------------|
| **CFO** | `json2html.adobeaem.workers.dev` — Adobe-hosted Cloudflare Worker; Mustache 4.2 syntax; config via Admin API `content.json` + `public.json` |
| **CFO templates** | `cf-templates/article.html` committed to this repo; Mustache runs inside the worker, not in the browser |
| **Placeholders** | `fetchPlaceholders` from `aem-block-collection` (Apache-2.0, ~50 lines) copied to `scripts/placeholders.js`; backed by `/placeholders.json` spreadsheet |
| **Placeholder resolver** | New `scripts/placeholders-resolve.js` — DOM TreeWalker over text nodes + attribute allowlist; invoked in `loadEager` before `decorateMain` |
| **Target** | `@adobe/alloy` 2.32.0 vendored as `scripts/alloy.js`; `adobe-rnd/aem-martech` plugin vendored under `plugins/martech/`; **not** at.js |
| **Target wiring** | `initMartech` → `martechEager` in `loadEager`; `martechLazy` in `loadLazy`; `martechDelayed` in `delayed.js` |
| **Target activities** | Two: banner text variation (`.dam-banner h1` / `.hero h1`); page logo (`header .nav-brand img`) |
| **HTML Fragment API** | Zero new code — `headers.json` POST to Admin API sets `Access-Control-Allow-Origin` per glob `/api/fragments/**`; content at `/<path>.plain.html` |
| **DOMPurify** | `scripts/dompurify.min.js` already bundled; upgrade to 3.4.2 and actually use it in CFO block render path |
| **CSP** | `head.html` needs `connect-src` extended for `*.adobedc.net` + `*.demdex.net` (Target); no `script-src` change needed (`strict-dynamic` covers alloy module load) |

---

## Table-Stakes Features

### Phase 1 — Content Fragment Overlay

- CFO-1: Per-CF-model overlay configuration (Admin API `public.json` + `content.json`)
- CFO-2: CF JSON fetched from Author tier (`/api/assets/.../{{id}}.json`), never Publish
- CFO-3: HTML rendering via json2html worker + Mustache template
- CFO-4: `article-hero` and `article-teaser` blocks rewritten to use `loadFragment(cfPath)` (drop GraphQL)
- CFO-5: DOMPurify on all rich-text bodies; `textContent`/`setAttribute` on plain-text fields — **close existing XSS in the same PR**
- CFO-6: UE component models updated with CF reference field (`type: reference`, `valueType: cfPath`)
- CFO-8: CF endpoint sourced from `getMetadata('cf-endpoint')`, not hardcoded
- CFO-9: Graceful error state (empty block + `console.error`, no page crash)
- CFO-10: `docs/content-fragment-overlay.md`

### Phase 2 — Placeholders

- PH-1: `/placeholders.json` spreadsheet (Key + Text columns) published via EDS
- PH-2: `scripts/placeholders.js` helper (fetchPlaceholders, module-scoped cache)
- PH-3: `{{key}}` token syntax; match only known keys — unknown tokens render as-is
- PH-4: DOM TreeWalker replacement after `decorateMain`; runs in eager phase (no flash)
- PH-5: Attribute substitution: `alt`, `title`, `aria-label`
- PH-7: Missing-key fallback: leave verbatim + `console.warn` once per key
- PH-8: Tokens editable as plain text in UE; replacement only at runtime
- PH-10: Entire pass completes before LCP section renders
- PH-11: `docs/placeholders.md`

### Phase 3 — Adobe Target

- TGT-1: alloy.js (Web SDK) loaded via `initMartech`; gated on `getMetadata('target') === 'on'`
- TGT-2: Scoped pre-hide only for targeted elements (not full-body opacity)
- TGT-3: Activity A — banner text variation on stable selector
- TGT-4: Activity B — page logo variation on stable `header .nav-brand img`
- TGT-6: Stable selector contract documented + locked in block markup
- TGT-9: Target disabled inside UE iframe (`window.location.hostname.includes('adobeaemcloud')` guard)
- TGT-10: `head.html` CSP updated; `*.aem.page` + `*.aem.live` added as allowed domains in Target property
- TGT-11: `docs/target-integration.md`

### Phase 4 — HTML Fragment API

- API-1: `/<path>.plain.html` endpoint (EDS native, no new code)
- API-2: Dedicated path prefix `/api/fragments/<slug>` via path convention
- API-3: CORS allowlist via Admin API `headers.json` (explicit origins, no `*`)
- API-4: OPTIONS preflight — `Access-Control-Allow-Methods: GET`; `Vary: Origin`
- API-6: Stable wrapper `<div class="sgeds-fragment" data-fragment-id="...">` in template
- API-10: 4xx error handling in consumer embed snippet
- API-11: `docs/html-fragment-api.md` including consumer HTML snippet using DOMPurify

---

## Architecture Highlights

### Entry points (where each capability hooks into `scripts/scripts.js`)

```
loadPage()
  |
  +-- [EAGER] -----------------------------------------------------------+
  |   await fetchPlaceholders()          <- Cap. 2, before decorateMain  |
  |   initMartech({datastreamId, orgId}) <- Cap. 3, at module load       |
  |   await martechEager()               <- Cap. 3, gates LCP section    |
  |   decorateMain(main)                                                  |
  |     +-- loadBlock(article-hero)                                       |
  |          +-- [Cap. 1] CFO: loadFragment(cfPath)                       |
  |               +-- [Cap. 2] resolvePlaceholders(block)                 |
  |   loadSection(first)  [LCP]                                           |
  +-----------------------------------------------------------------------+
  |
  +-- [LAZY]  ------------------------------------------------------------+
  |   loadHeader / loadSections / loadFooter                              |
  |   martechLazy()                      <- Cap. 3, analytics/ACDL       |
  +-----------------------------------------------------------------------+
  |
  +-- [DELAYED / 3s] -----------------------------------------------------+
      martechDelayed()                   <- Cap. 3, third-party tags      |
      +-----------------------------------------------------------------------+

Cap. 4: no runtime code path -- Admin API config only.
```

### Integration points

| Touch point | Changed by | Note |
|-------------|-----------|------|
| `scripts/scripts.js` | All three runtime caps | Eager/lazy/delayed wiring |
| `scripts/editor-support.js` | CFO (re-render) + Placeholders (re-resolve after patch) | Must call `resolvePlaceholders` post-`applyChanges` |
| `blocks/article-hero/*` + `blocks/article-teaser/*` | CFO | Deleted/rewritten; GraphQL gone |
| `blocks/header/header.js` | Target | Add stable selector on logo `<img>` |
| `blocks/promo-banner/*` (new) | Target | Banner text activity target |
| `head.html` | Target | CSP `connect-src` extension |
| Admin API (off-repo curl) | CFO + HTML API | `content.json`, `public.json`, `headers.json` |
| `cf-templates/` (new dir) | CFO + HTML API | Mustache templates |

### Critical ordering constraints

1. **`fetchPlaceholders` must resolve before `martechEager` applies propositions** — a Target offer containing `{{brandName}}` would not be resolved otherwise. Sequence in `loadEager`: fetch placeholders → `resolvePlaceholders` → `martechEager`.
2. **CFO must land before Target** — Target activities target real article block DOM; testing against broken GraphQL blocks is meaningless.
3. **`applyChanges` null-safety fix (CF-EXISTING-3) must land before any block work** — 2-line guard in `editor-support.js`; otherwise UE patches on the new blocks silently swallow.
4. **DOMPurify upgrade + wiring must happen in Phase 1 CFO PR** — not a separate ticket.

---

## Watch Out For

| # | Pitfall | Severity | Phase | Prevention |
|---|---------|----------|-------|------------|
| 1 | **No-Publish constraint forgotten** — any fetch pointing at `publish-p23458-*` silently fails | CRITICAL | All | Add pre-commit grep for `publish-p23458`; document constraint as section 1 of every feature guide |
| 2 | **XSS carried forward** — CFO migration changes data source but keeps `block.innerHTML = template-literal`; wide blast radius | CRITICAL | Phase 1 | DOMPurify all rich-text bodies + `textContent` for plain fields in the same PR as CFO migration |
| 3 | **CFO overlay path mismatch** — config prefix mismatches DAM path; 200 OK returns HTML body that fails JSON.parse | CRITICAL | Phase 1 | Document exact URL chain in `docs/`; add `/test-cfo.html` smoke page; check `Content-Type` before parsing |
| 4 | **Placeholder flash / CLS** — `{{brandName}}` visible before sheet loads; or tokens swap mid-LCP | HIGH | Phase 2 | `fetchPlaceholders` must complete before LCP section renders; use `textContent` not `innerHTML` |
| 5 | **Target LCP regression** — alloy.js adds 50-150 KB + round-trip before LCP block renders | HIGH | Phase 3 | Preload hints in `head.html`; 1.5 s hard timeout; only activate on `<meta name="target" content="on">` pages |
| 6 | **Target domain not allowlisted** — `*.aem.page` / `*.aem.live` not added to Target property; all activities 403 | HIGH | Phase 3 | Configure Target property domains BEFORE writing block code |
| 7 | **CORS misconfiguration on HTML API** — either `*` (too open) or wrong origin (demo fails) | HIGH | Phase 4 | Explicit origin list in `headers.json`; `Vary: Origin`; reject non-listed origins with 403 |
| 8 | **UE instrumentation lost on block re-render** — `innerHTML` rebuild wipes `data-aue-*` attrs | HIGH | Phase 1-3 | Call `moveInstrumentation` before any child replacement; prefer DOM construction over `innerHTML` |

---

## Build Order Rationale

### Why CFO first

Article blocks are **currently broken** — they fetch from an unreachable Publish GraphQL endpoint. Every subsequent feature depends on functional blocks. CFO also closes the pre-existing XSS (DOMPurify wiring, `textContent` discipline) and establishes the `loadFragment` + Mustache template pattern reused by the HTML API.

### Why Placeholders second

Independent of Target at the wire level, but Target propositions may reference placeholder values. The eager-phase ordering constraint (`resolvePlaceholders` before `martechEager`) means Placeholders must be built and its lifecycle hooks proven before Target lands. The walker also extends `editor-support.js` in a pattern Target needs to avoid.

### Why Target third

Needs (a) real article DOM from CFO to personalize against, (b) placeholders resolved before proposition application, (c) `delayed.js` populated (currently an empty stub).

### Why HTML Fragment API fourth

Zero runtime code — just Admin API configuration + a Mustache template variant from CFO. **Can be parallelized with Phase 1** if a second developer is available. Primary reason to order it last: reuses CFO-established patterns and benefits from DOMPurify proven in Phase 1. `data-aue-*` attribute stripping (API-6) also requires a working CFO pipeline to test against.

### Parallelization opportunities

- Phase 4 (HTML API config) can run in parallel with Phase 1
- Admin API setup for CFO (`content.json`, `public.json` POSTs) can be done before block code is written
- Target property domain configuration can be done during Phase 2

---

## Open Questions

| # | Question | Spike in | Blocks |
|---|----------|----------|--------|
| OQ-1 | Does `*.aem.page` preview invoke the json2html overlay the same way as `*.aem.live`? If not, CFO changes can't be verified in UE. | Phase 1 start | Phase 1 verification |
| OQ-2 | Exact location of Mustache templates — `cf-templates/` in this repo vs. separate worker-config record? STACK.md flags as MEDIUM confidence. | Phase 1 start | Template authoring |
| OQ-3 | Does the existing Target property already have a Datastream + WebSDK orgId? Or does a new Datastream need to be created in AEP? | Phase 3 start | Phase 3 day 1 |
| OQ-4 | Exact `headers.json` Admin API payload shape for CORS — inferred from `public.json`/`content.json` pattern; validate against `aem.live/docs/custom-headers`. | Phase 4 start | Phase 4 CORS setup |
| OQ-5 | Raw shape of CF Overlay JSON from Author Assets API vs. current Publish GraphQL — `_publishUrl`, `_dynamicUrl` may be absent. Log a raw response in Phase 1 spike. | Phase 1 spike | Asset URL helper |
| OQ-6 | Placeholder spreadsheet path: `/placeholders` at site root vs. locale-scoped? Drives `fetchPlaceholders()` prefix arg and `helix-query.yaml`. | Phase 2 start | PH-1 |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| CFO stack (json2html + Admin API) | HIGH | Sourced verbatim from current aem.live CFO + json2html docs |
| CFO no-publish variant | MEDIUM | Author endpoint inferred from doc examples; OQ-1 + OQ-5 need spike validation |
| Placeholders (`fetchPlaceholders` API) | HIGH | Source-verified from adobe/aem-block-collection HEAD |
| Placeholder TreeWalker pattern | MEDIUM | Community-standard; not a canonical aem.live recipe |
| Target — Web SDK / aem-martech | HIGH | aem.live doc explicitly recommends this path; alloy 2.32.0 verified on npm |
| Target — domain + Datastream config | MEDIUM | Depends on existing property provisioning (OQ-3) |
| HTML Fragment API — `.plain.html` + `headers.json` | HIGH | Both are documented EDS primitives used in this repo today |
| HTML Fragment API — exact CORS payload shape | MEDIUM | Inferred pattern; validate before Phase 4 (OQ-4) |
| **Overall** | **MEDIUM-HIGH** | All four capabilities have viable documented paths; three specific gaps flagged as open questions |

---

## Cross-References

| File | What it contains |
|------|-----------------|
| `.planning/research/STACK.md` | Recommended libraries, versions, config files, Admin API call shapes, "what NOT to use" table |
| `.planning/research/FEATURES.md` | Full feature tables (table stakes + differentiators + anti-features) per capability; cross-capability dependency map |
| `.planning/research/ARCHITECTURE.md` | Component boundaries, data flow diagrams, eager/lazy/delayed wiring, open questions list |
| `.planning/research/PITFALLS.md` | Full pitfall catalogue with severity, phase mapping, detection steps, carry-forward issues |
| `.planning/PROJECT.md` | Validated constraints, key decisions, out-of-scope items — ground truth for all research |
| `.planning/codebase/CONCERNS.md` | Pre-existing issues (XSS, ESLint EOL, empty stubs, applyChanges null crash) |
| `.planning/codebase/INTEGRATIONS.md` | Current broken GraphQL endpoint details |

---

*Summary: 2026-05-06*
