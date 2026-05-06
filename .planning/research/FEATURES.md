# Feature Landscape — SG EDS Demo POC

**Domain:** AEM Edge Delivery Services (EDS / Helix / Franklin) on AEMaaCS Author + Universal Editor, **no Publish tier**
**Researched:** 2026-05-06
**Scope:** Four POC capabilities — (1) Content Fragment Overlay, (2) Generic placeholder/variable mechanism in any text block, (3) Adobe Target integration with two demo activities, (4) HTML Fragment API for external consumers
**Overall confidence:** MEDIUM — official aem.live docs cover the four capabilities, but implementation specifics for the no-publish constraint are inferred from authoring-tier patterns + community examples. Flagged per-feature.

---

## Capability 1 — Content Fragment Overlay (CFO)

**Goal:** Replace direct Publish-GraphQL calls in `article-hero` and `article-teaser` with a CFO pipeline that publishes Content Fragments through the EDS authoring tier (Admin API → json2html → Mustache → semantic HTML page).

**Critical context for this POC:** The official CFO flow ingests CF JSON as a *page* in EDS via the Admin API. With Publish disabled, the equivalent path is:
- Author edits CF in AEMaaCS Author + Universal Editor.
- A site-config overlay maps `/content/dam/.../cf-path` to a virtual EDS page whose contents come from `/graphql/execute.json` on the **Author** instance (not Publish), or from the AEM Author CF JSON endpoint via `fstab.yaml` proxy.
- Block (`article-hero` / `article-teaser`) consumes the rendered HTML fragment via `loadFragment(path)` rather than calling GraphQL directly.

### Table Stakes (must-have for the POC to demonstrate the pattern)

| # | Feature | Complexity | Author-side? | Depends on |
|---|---------|------------|--------------|------------|
| CFO-1 | **Per-CF-model overlay configuration** — declarative mapping between a CF model and a delivery template | M | Author (site config + xwalk content-fragment-overlay block) | — |
| CFO-2 | **JSON source via Author tier** — fetch CF JSON from `/api/assets/.../cf.json` or persisted-query on **Author** (not Publish), proxied through `fstab.yaml` | M | Frontend (block code) + Author proxy | CFO-1 |
| CFO-3 | **HTML rendering pipeline** — JSON→HTML transform (Mustache template OR JS-side render in the block) producing semantic HTML | M | Mostly frontend; template lives alongside block | CFO-2 |
| CFO-4 | **Block-level integration for `article-hero` and `article-teaser`** — replace existing `block.innerHTML = template-literal` with sanitized DOM construction (`document.createElement` + `textContent`) | M | Frontend only | CFO-3 |
| CFO-5 | **DOMPurify on any HTML body field** — `body.html` from CF must pass through `scripts/dompurify.min.js` before insertion (currently bundled but unused) | S | Frontend only | CFO-4 |
| CFO-6 | **Universal Editor reference field for CF picker** — `_<block>.json` must declare the CF reference field (`type: reference`, `valueType: cfPath`, `fragmentModel: <model>`) so authors can pick CFs in Universal Editor | S | Author (`_article-hero.json`, `_article-teaser.json` + rebuild `component-models.json`) | — |
| CFO-7 | **`aue:content-patch` re-decoration on CF edit** — when an author edits the referenced CF, the block must re-render via `editor-support.js` flow | S | Frontend (existing infrastructure already supports this) | CFO-4 |
| CFO-8 | **Centralized CF endpoint config via `<meta>`** — replace hard-coded `https://publish-p23458-...` constant with `getMetadata('cf-endpoint')` so environment is swappable | S | Author (`head.html` meta) + frontend | CFO-2 |
| CFO-9 | **Error / empty state** — block degrades to empty + `console.error` on fetch failure, never throws or breaks page render | S | Frontend only | CFO-4 |
| CFO-10 | **Step-by-step `docs/content-fragment-overlay.md`** — author UI click-path (creating model, picking CF in UE) + code walk-through | S | — | All above |

### Differentiators (nice-to-have, not POC-blocking)

| # | Feature | Complexity | Author-side? | Notes |
|---|---------|------------|--------------|-------|
| CFO-D1 | **Mustache template files per CF model** stored in repo (e.g. `templates/article.mustache`) — closer to the "real" json2html flow | L | Author (site config) + frontend | Mustache pulled at runtime adds a dependency vs string-template in JS |
| CFO-D2 | **Cache layer** — `Cache-Control` honoured + in-memory dedupe of identical CF fetches within a page | S | Frontend only | Useful when one CF appears in N teaser blocks |
| CFO-D3 | **Stale-while-revalidate on Author proxy** — `fstab.yaml`-served CF JSON cached for short TTL | S | Infra | Real project concern, POC can skip |
| CFO-D4 | **Multi-locale CF resolution** — same CF path with locale fallback (`en` → `en-US`) | M | Author + frontend | Out of scope per PROJECT.md but pattern worth noting |
| CFO-D5 | **CF preview parity** — block renders identically in `?wcmmode=disabled` vs published EDS path | S | — | Good for confidence but POC tolerates Author-only preview |
| CFO-D6 | **Auto-block from CF link** — pasting a CF DAM link in a doc/UE auto-instantiates `article-hero` block via `buildAutoBlocks` (currently a TODO stub in `scripts.js:65`) | M | Frontend only | Nice DX win |

### Anti-features (deliberately NOT to build)

| Anti-feature | Why avoid in POC |
|--------------|------------------|
| Bringing back Publish-tier GraphQL persisted queries | The whole point is no-publish; would re-introduce the broken path |
| Generic CF→HTML universal renderer covering all CF models | Two specific models (`article-hero`, `article-teaser`) is enough to prove the pattern |
| Custom OSGi service / dispatcher tweaks | Pattern must work without server-side changes beyond what AEMaaCS Author already exposes |
| CF translation workflow | Out of scope per PROJECT.md ("Generic CMS i18n") |
| Multi-tenant CF endpoint resolution | Single `cf-endpoint` meta is enough |

---

## Capability 2 — Generic Placeholder / Variable Mechanism in Any Text Block

**Goal:** Authors declare global values (`{{brandName}}`, `{{currentYear}}`, etc.) once in a placeholders sheet and reference them inside any text content; values resolve at render time across all pages.

**Critical context:** Out-of-the-box `fetchPlaceholders` from aem.live returns a key→value object — but does **not** automatically replace `{{token}}` patterns inside DOM text. The "any text block" requirement means the POC must add a **DOM-walker that replaces tokens in text nodes after `decorateMain`**, hooked early enough that LCP text sees resolved values.

### Table Stakes

| # | Feature | Complexity | Author-side? | Depends on |
|---|---------|------------|--------------|------------|
| PH-1 | **Placeholders source** — single sheet/spreadsheet (or AEM-authored "placeholders" CF/page) with `Key` + `Text` columns, fetched via `fetchPlaceholders()` pattern | S | Author (creates placeholders sheet/page) | — |
| PH-2 | **`/scripts/placeholders.js` helper** — wraps `fetchPlaceholders`, caches result in module scope, returns `Promise<Record<string, string>>` | S | Frontend only | PH-1 |
| PH-3 | **`{{token}}` syntax** — double-curly delimited keys; matches `[a-zA-Z0-9_.-]+` between braces | S | — | — |
| PH-4 | **DOM tree-walker replacement** — after `decorateMain`, walk `Node.TEXT_NODE` under `<main>` and replace any `{{key}}` with resolved value; runs in eager phase so first paint is correct | M | Frontend only | PH-2, PH-3 |
| PH-5 | **Attribute placeholder support** — also resolve tokens in `alt`, `title`, `aria-label`, `href` attributes (not just text nodes) | S | Frontend only | PH-4 |
| PH-6 | **Built-in dynamic tokens** — `{{currentYear}}`, `{{currentDate}}` resolved client-side without sheet entry; documented set | S | Frontend only | PH-4 |
| PH-7 | **Missing-key fallback** — if key not in sheet, leave token verbatim (or render empty) and `console.warn` once per missing key | S | Frontend only | PH-4 |
| PH-8 | **Universal Editor compatibility** — placeholder tokens stay editable as plain text in UE; replacement happens only at runtime, never persisted to AEM | S | — | PH-4 |
| PH-9 | **Re-resolution on `aue:content-patch`** — when UE patches a block, the new content runs through the same walker so newly-edited text honours tokens | S | Frontend (extend `editor-support.js`) | PH-4 |
| PH-10 | **Runs before LCP** — placeholder pass is part of `loadEager` so the first section's text already has values resolved (no flicker) | M | Frontend only | PH-4 |
| PH-11 | **Step-by-step `docs/placeholders.md`** — sheet creation + token usage + extending built-ins | S | — | All above |

### Differentiators

| # | Feature | Complexity | Author-side? | Notes |
|---|---------|------------|--------------|-------|
| PH-D1 | **Nested / scoped placeholders** — namespace tokens (`{{site.brand.name}}`) backed by hierarchical sheet | M | Author + frontend | Useful when sheet grows large |
| PH-D2 | **Locale-aware placeholders** — locale-prefixed sheets resolved by `document.documentElement.lang` | M | Author + frontend | Marked out-of-scope per PROJECT.md but the helper signature should leave room |
| PH-D3 | **Type-cast tokens** — `{{currentYear:number}}`, `{{lastUpdated:date:YYYY-MM-DD}}` | M | Frontend only | |
| PH-D4 | **Author-time validation** — UE highlights unresolved tokens (warning UI) without breaking save | L | Author (UE plugin) | Significant effort, defer |
| PH-D5 | **Token usage report** — debug command (`window.placeholdersReport()`) listing all tokens found on the current page and their resolution status | S | Frontend only | Great for the docs/demo |
| PH-D6 | **Performance budget** — TreeWalker pass measured under 5ms on a 50KB main; benchmark recorded in docs | S | Frontend only | |

### Anti-features

| Anti-feature | Why avoid in POC |
|--------------|------------------|
| Full ICU MessageFormat (plurals, gender) | Overkill for variable substitution; PROJECT.md scopes this away from translation tooling |
| Multi-locale translation pipeline | Explicitly out of scope — placeholders are global text vars, not i18n |
| Server-side templating of `{{tokens}}` | Defeats the "works through Universal Editor" contract; tokens must remain in the source |
| Block-specific placeholder mechanism | Requirement is *any* text block — generic walker, not per-block opt-in |
| Two-way binding (live update from sheet without reload) | Not needed for POC; sheet→runtime is one-shot per page load |
| Markdown / HTML inside placeholder values | Plain text only — HTML in values is an XSS hole that DOMPurify wouldn't catch consistently |

---

## Capability 3 — Adobe Target Integration (Two Demo Activities)

**Goal:** Two activities running on the existing Target account/property:
- **A** — banner text variation (a hero or article-hero variant headline/CTA)
- **B** — page logo variation (header logo image swap)

**Critical context:** aem.live's official Target integration assumes either (a) at.js loaded via Launch with `body { opacity: 0 }` flicker hide, or (b) the modern `aem-martech` plugin (WebSDK + ACDL) which decomposes the stack and applies propositions through an `onDecoratedElement` callback wired into `decorateBlock`/`decorateSection`. For a POC, at.js is the simplest demonstrable path because the user already has a Target property; WebSDK is the more future-proof recommendation.

### Table Stakes

| # | Feature | Complexity | Author-side? | Depends on |
|---|---------|------------|--------------|------------|
| TGT-1 | **at.js (or WebSDK) loaded in `loadDelayed` or just-in-time pre-LCP** — POC recommendation: at.js v2.x in eager phase, *not* Launch, to keep deps minimal | M | Frontend only (`scripts/delayed.js` or new `scripts/martech.js`) | — |
| TGT-2 | **Flicker control for the two activities** — selective pre-hide of *only* the targeted DOM nodes (banner text container + logo `<img>`), not full-page `body { opacity:0 }` (would tank LCP) | M | Frontend (CSS rules + early script) | TGT-1 |
| TGT-3 | **Activity A — banner text** — Target form-based or VEC activity with `mbox` selector pointing at a stable container class (e.g., `.hero h1`); content swap via DOM replace | M | Author (Target UI activity creation) + frontend (selector contract) | TGT-1, TGT-2 |
| TGT-4 | **Activity B — page logo** — Target activity replacing `header img.logo` `src` attribute (form-based offer, simplest) | M | Author (Target UI) + frontend | TGT-1, TGT-2 |
| TGT-5 | **Mbox parameters from page metadata** — pass `pageType`, `template`, `path` to Target so authors can target activities by section | S | Frontend only (read `getMetadata`) | TGT-1 |
| TGT-6 | **Stable selector contract documented** — block markup guarantees the selectors Target activities depend on (`.hero h1`, `header .logo img`); regression-tested in docs | S | Frontend (block code) | TGT-3, TGT-4 |
| TGT-7 | **Audience: simple URL-param targeting** for the demo (`?demoVariant=A`) — no IMS audience setup needed for POC | S | Author (Target UI) | TGT-1 |
| TGT-8 | **Activities run only on configured pages** — `mbox` only fires on `/article/*` or specific demo pages, not site-wide, to avoid interfering with header/nav fragments | S | Frontend (early-exit guard) | TGT-1 |
| TGT-9 | **Universal Editor preview unaffected** — Target script disabled in UE iframe (detect `window.location.hostname` ends in `adobeaemcloud.com` or via `?ueRender=true`) | S | Frontend only | TGT-1 |
| TGT-10 | **No-publish constraint** — entire integration must work on Author preview / `fstab.yaml`-proxied EDS preview because there is no Publish; CSP in `head.html` must permit `tt.omtrdc.net` and `assets.adobedtm.com` (or WebSDK edge) | M | Author (`head.html` CSP edit) + frontend | TGT-1 |
| TGT-11 | **Step-by-step `docs/target-integration.md`** — Target UI clicks (create activity, paste selector, define experience), code wiring, CSP edit, troubleshooting | S | — | All above |

### Differentiators

| # | Feature | Complexity | Author-side? | Notes |
|---|---------|------------|--------------|-------|
| TGT-D1 | **Migrate to `aem-martech` plugin (WebSDK + ACDL)** — drop at.js, use `onDecoratedElement` hook | L | Frontend (significant refactor) | Future-proof, recommended for the real project |
| TGT-D2 | **Personalization via Content Fragments** — Activity B serves a *CF reference* not a raw image URL; couples with CFO pipeline | L | Author (Target XF/CF offers) + frontend | Requires CFO-D1 (template path) |
| TGT-D3 | **Variable-driven activities via Placeholders** — Activity A swaps the `{{brandName}}` placeholder *value*, not the DOM — one offer changes copy site-wide | M | Author (Target offer = JSON) + frontend (placeholders helper accepts Target proposition override) | Depends on Capability 2 (PH-2, PH-4); demonstrates capability synergy |
| TGT-D4 | **Analytics tie-in** — Adobe Analytics `s.tl()` events on activity exposure | M | Author (Launch) + frontend | Out of scope for POC unless explicitly asked |
| TGT-D5 | **Visual debug overlay** — `?targetDebug=1` highlights mboxed elements with their activity name | S | Frontend only | Nice for the docs/demo |
| TGT-D6 | **A/A test as smoke check** — first activity is identical control vs identical experience to validate plumbing without visual change | S | Author (Target UI) | |

### Anti-features

| Anti-feature | Why avoid in POC |
|--------------|------------------|
| Adobe Launch / DTM tag manager | Adds an opaque dependency layer for two demo activities; pull at.js (or WebSDK) directly |
| Site-wide `body { opacity: 0 }` pre-hide | Wrecks LCP; only the two targeted regions need pre-hide |
| Full WebSDK + AEP edge personalization | Out of POC scope; mark as "real project recommendation" instead |
| Per-block Target wrapper (one mbox per block) | Two named activities is enough; broader pattern is a refactor |
| ECID / Customer ID stitching across domains | The HTML Fragment API consumer (Capability 4) is anonymous — no identity bridging needed for POC |
| Multi-property Target setup | Use the existing property only |
| Authoring-side activity creation tooling (XFs as Target offers) | Real project value, but requires Publish/asset-export plumbing the POC doesn't have |

---

## Capability 4 — HTML Fragment API for External Consumers

**Goal:** External web app on a different domain fetches a Content Fragment (or page slice) rendered as HTML and embeds it into its own page.

**Critical context:** EDS already serves `.plain.html` for any page (no `<html>`, `<head>`, `<body>` — just a `<div>` of decorated content). For an external consumer, the contract is:
- Public `GET /<path>.plain.html` → returns clean HTML.
- CORS allowlist on the EDS edge OR Author origin (since publish is unavailable, the API likely fronts `fstab.yaml`-proxied Author).
- Optional: a small embed JS shim that the external app drops in to fetch + insert + scope styles.

### Table Stakes

| # | Feature | Complexity | Author-side? | Depends on |
|---|---------|------------|--------------|------------|
| API-1 | **Stable `/<path>.plain.html` endpoint** — any authored page or fragment available as plain HTML over HTTPS | S | Author (existing EDS behaviour) | — |
| API-2 | **Dedicated fragment route prefix** — e.g., `/api/fragments/<slug>` (URL-rewrite or path convention) so consumers have a clean contract distinct from regular pages | S | Author (paths convention) + maybe `helix-query.yaml` | API-1 |
| API-3 | **CORS allowlist** — `Access-Control-Allow-Origin: <consumer-domain>` (not `*`) on the fragment endpoint, configured at the EDS edge or via `fstab.yaml` proxy headers | M | Infra / config (Author dispatcher OSGi or EDS edge config) | API-1 |
| API-4 | **CORS preflight handling** — `OPTIONS` returns 204 with `Access-Control-Allow-Methods: GET` and `Access-Control-Allow-Headers: <minimal set>` | S | Infra | API-3 |
| API-5 | **Self-contained HTML output** — no relative `/scripts/aem.js` or `/styles/styles.css` references the consumer needs to host; either inline critical CSS scoped under a wrapper class, or document the consumer-hosted CSS contract | M | Frontend (build step or runtime stripping in a wrapper block) | API-1 |
| API-6 | **Stable wrapper element with predictable class** — `<div class="sgeds-fragment" data-fragment-id="...">…</div>` so consumers can style/scope | S | Frontend (block code on the EDS side) | API-1 |
| API-7 | **Embed snippet for consumers** — published `embed.js` doing `fetch(plain.html) → sanitize → insert → optional shadow DOM scoping` | M | Frontend only | API-1, API-5 |
| API-8 | **`Content-Type: text/html; charset=utf-8`** explicit | S | Infra | API-1 |
| API-9 | **Cache-Control: public, max-age=300, stale-while-revalidate=86400** at the edge for read performance | S | Infra (EDS edge defaults usually OK, verify) | API-1 |
| API-10 | **Failure mode** — 404 returns the `404.html` body but consumer's `embed.js` detects non-200 and renders a graceful placeholder | S | Frontend only | API-7 |
| API-11 | **Step-by-step `docs/html-fragment-api.md`** — endpoint contract, CORS setup, sample consumer HTML, troubleshooting (CORS errors, mixed content, CSP on consumer side) | S | — | All above |

### Differentiators

| # | Feature | Complexity | Author-side? | Notes |
|---|---------|------------|--------------|-------|
| API-D1 | **Versioned fragment URLs** — `/api/fragments/v1/<slug>` with deprecation policy | S | Convention | |
| API-D2 | **JSON variant** — `?format=json` returns `{ html, meta, lastModified }` for consumers that want headers | M | Frontend only | |
| API-D3 | **Web Component delivery** (`<sgeds-fragment src="…">`) — registered custom element handles fetch + Shadow DOM isolation in one tag | M | Frontend (consumer-hosted) | API-7 |
| API-D4 | **Shadow-DOM CSS isolation** — fragment styles never bleed into consumer page | M | Frontend (embed.js) | API-7 |
| API-D5 | **`If-Modified-Since` / `ETag`** — conditional GETs cache-friendly | S | Infra | |
| API-D6 | **Subresource Integrity for embed.js** — consumers pin `integrity="sha384-…"` | S | Build-time | |
| API-D7 | **Demo consumer page in repo** — `docs/external-consumer-demo.html` standalone page that calls the API; useful for `docs/` walkthrough screenshots | S | — | |

### Anti-features (per PROJECT.md "Out of Scope")

| Anti-feature | Why avoid in POC |
|--------------|------------------|
| **Production-grade auth (IMS / OAuth / signed URLs)** | Explicitly deferred per PROJECT.md; CORS allowlist + public read is the POC contract |
| **Per-consumer API keys with rotation** | Multi-tenant key management is out of scope |
| **Rate limiting / abuse mitigation** | Out of scope; document as next-step concern |
| **Server-side rendering of `<head>` / `<script>` references for the consumer** | The consumer hosts its own page; we ship the inner HTML, not a full document |
| **GraphQL endpoint for external app** | Original GraphQL path is the *broken* one being replaced; HTML is the correct contract for "render and embed" |
| **WebSocket / push update channel** | Pull-only fetch on demand; live updates are not a POC requirement |
| **Multi-region edge replication tuning** | EDS handles this; we're not in the infrastructure tuning business for a POC |
| **Consumer-side React/Vue components** | Consumer is a generic external web app; a vanilla embed snippet is enough |

---

## Cross-Capability Dependency Map

```
              ┌──────────────────────────┐
              │ CAPABILITY 1: CFO        │
              │ (article-hero/teaser)    │
              └────────┬─────────────────┘
                       │ provides clean fragment
                       │ pattern reusable by API-2
                       ▼
              ┌──────────────────────────┐
              │ CAPABILITY 4: HTML       │
              │ Fragment API             │
              └──────────────────────────┘

   ┌──────────────────────────┐
   │ CAPABILITY 2:            │
   │ Placeholders             │◀──── PH walker runs in loadEager,
   │ (TreeWalker on <main>)   │      *before* CFO blocks load
   └────────┬─────────────────┘
            │ optional Differentiator (TGT-D3):
            │ Target proposition overrides placeholder value
            ▼
   ┌──────────────────────────┐
   │ CAPABILITY 3: Target     │
   │ (banner text + logo)     │
   └──────────────────────────┘
```

### Dependencies summary

| Dependency | From | To | Necessity |
|------------|------|----|-----------|
| Block code that escapes / sanitizes innerHTML | CFO-4, CFO-5 | All four capabilities | HARD — existing XSS hole must close before any new feature ships |
| `<meta>`-driven endpoint config | CFO-8 | TGT-1 (Target endpoint), API-3 (origin allowlist) | SOFT — same pattern reusable |
| Placeholder walker timing | PH-4, PH-10 | CFO blocks (so `{{brandName}}` resolves inside CF body too) | HARD — walker must run after `decorateMain` and after CF block content is materialized |
| UE re-decoration plumbing (`editor-support.js`) | Existing | CFO-7, PH-9 | HARD — already in repo; both new capabilities must hook into it |
| Stable DOM selectors | CFO-4, header markup | TGT-3, TGT-4 | HARD — Target activities break if class names move |
| CORS-clean origin | API-3 | API-7 (embed.js) | HARD |
| Sanitization (`dompurify`) | CFO-5, API-7 | All HTML interpolation | HARD — POC must not regress on XSS |

---

## Author-side vs Frontend-only Quick Reference

**Capability 1 — CFO**
- Author-side: CFO-1 (overlay site config), CFO-6 (`_<block>.json` model with CF reference field), CFO-8 (`<meta>` config), CFO-D1 (Mustache templates registered in site config)
- Frontend-only: CFO-2, CFO-3, CFO-4, CFO-5, CFO-7, CFO-9, CFO-D2

**Capability 2 — Placeholders**
- Author-side: PH-1 (placeholders sheet/page), PH-D2 (locale folders)
- Frontend-only: PH-2 through PH-10 — almost entirely a frontend pattern

**Capability 3 — Target**
- Author-side: TGT-3 + TGT-4 (Target UI activity definitions), TGT-7 (audience), TGT-10 (CSP edit in `head.html`)
- Frontend-only: TGT-1, TGT-2, TGT-5, TGT-6, TGT-8, TGT-9, TGT-D5

**Capability 4 — HTML Fragment API**
- Author-side: API-3 + API-4 (CORS — likely Author dispatcher OSGi config or EDS edge config), API-2 (path convention)
- Frontend-only: API-5, API-6, API-7, API-10, API-D2, API-D3, API-D4

---

## MVP Recommendation (matches PROJECT.md "build in order")

1. **CFO-1 → CFO-9** — fix the broken article blocks first; everything else builds on a working CF integration pattern + closed XSS hole.
2. **PH-1 → PH-10** — global text variables; the walker runs in `loadEager` and benefits CFO blocks immediately.
3. **TGT-1 → TGT-10** — two demo activities; depends on stable selectors from CFO + (optionally) PH for the synergy demo.
4. **API-1 → API-10** — external consumer; reuses the sanitized HTML contract established by CFO and the routing patterns established by Capability 1.

**Defer to "real project":**
- All Differentiators marked above (CFO-D*, PH-D*, TGT-D*, API-D*).
- Anti-features remain out of scope permanently for this repo.

---

## Confidence Assessment per Capability

| Capability | Confidence | Reason |
|------------|------------|--------|
| CFO | MEDIUM | Official aem.live docs assume Publish; the no-publish authoring-tier variant is inferred from path-mapping + `fstab.yaml` patterns. CFO-2 (JSON source via Author) needs validation in spike. |
| Placeholders | MEDIUM-HIGH | `fetchPlaceholders` is documented; the TreeWalker pattern is community-standard but **not** documented in aem.live as the canonical "any text block" mechanism — this POC is partly defining the pattern. |
| Adobe Target | MEDIUM | aem.live `target-integration` doc exists but recommends the modern `aem-martech` (WebSDK) path; the simpler at.js path is well-documented elsewhere. CSP edits required; flicker handling is the main risk. |
| HTML Fragment API | MEDIUM | `.plain.html` is a documented EDS primitive. CORS configuration on AEMaaCS Author (without Publish) is the gap — needs validation that allowlist headers can be set on the proxied responses. |

---

## Sources

- [aem.live — Publishing AEM Content Fragments to Edge Delivery Services (Content Fragment Overlay)](https://www.aem.live/developer/content-fragment-overlay)
- [aem.live — JSON2HTML for Edge Delivery Services](https://www.aem.live/developer/json2html)
- [aem.live — Path mapping for AEM authoring as your content source](https://www.aem.live/developer/authoring-path-mapping)
- [aem.live — Component model definitions](https://www.aem.live/developer/component-model-definitions)
- [aem.live — Universal-Editor blocks](https://www.aem.live/developer/universal-editor-blocks)
- [aem.live — Using Placeholders (developer)](https://www.aem.live/developer/placeholders)
- [aem.live — Placeholders (docs)](https://www.aem.live/docs/placeholders)
- [aem.live — Translation and Localization](https://www.aem.live/docs/translation-and-localization)
- [aem.live — Spreadsheets and JSON](https://www.aem.live/developer/spreadsheets)
- [aem.live — Configuring Adobe Target Integration](https://www.aem.live/developer/target-integration)
- [aem.live — Configuring Adobe Experience Cloud Integration (Martech)](https://www.aem.live/developer/martech-integration)
- [GitHub — adobe-rnd/aem-martech (WebSDK + ACDL plugin)](https://github.com/adobe-rnd/aem-martech)
- [Adobe — How does at.js Manage Flicker?](https://experienceleague.adobe.com/en/docs/target-dev/developer/client-side/at-js-implementation/at-js/manage-flicker-with-atjs)
- [Adobe — CORS configuration with AEM Headless](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/headless/deployment/cross-origin-resource-sharing)
- [Adobe — Develop for Cross-Origin Resource Sharing (CORS) with AEM](https://experienceleague.adobe.com/en/docs/experience-manager-learn/foundation/security/develop-for-cross-origin-resource-sharing)
- [aem.live — Web Components](https://www.aem.live/developer/web-components)
- [aem.live — Markup, Sections, Blocks, Auto Blocking](https://www.aem.live/developer/markup-sections-blocks)
- [aem.live — Fragments](https://www.aem.live/docs/fragments)
- [aem.live — Sidekick](https://www.aem.live/docs/sidekick)
- [Medium / Mayur Satav — EDS Target Integration (Legacy at.js path)](https://medium.com/@mayursatav/edge-delivery-services-target-integration-legacy-d0028ca400ca)
- [Exadel — AEM Experience Fragments: Consuming Outside AEM](https://exadel.com/news/aem-experience-fragments-consuming-outside-aem)
- [allabout.network — Using Web Components in EDS Blocks](https://allabout.network/blogs/ddt/integrations/using-web-components-in-adobe-edge-delivery-services-blocks)
- [Adobe Experience League Community — How to edit Content Fragment in Universal Editor EDS](https://experienceleaguecommunities.adobe.com/t5/adobe-experience-manager/how-to-edit-content-fragment-in-universal-editor-eds/m-p/756609)
