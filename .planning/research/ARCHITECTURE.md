# Architecture Patterns — sgedsdemo POC

**Domain:** Adobe AEM Edge Delivery Services (EDS / Helix / Franklin) demo on AEM Cloud Service Author + Universal Editor (no Publish tier)
**Researched:** 2026-05-06
**Scope:** Architectural design for the four POC capabilities
**Overall confidence:** MEDIUM-HIGH (Context7 unavailable; aem.live docs surfaced via WebSearch summaries; primary aem.live URLs blocked by sandbox — claims marked accordingly)

---

## TL;DR — Build Order and Recommendation Snapshot

User-chosen order: **CFO → Placeholders → Target → HTML API**. Confirmed sound, with one caveat:

| # | Capability | Where it hooks | New runtime code | Out-of-repo work |
|---|------------|---------------|------------------|------------------|
| 1 | Content Fragment Overlay (CFO) | Replaces GraphQL fetch in `blocks/article-*` with `loadFragment(cfPath)` | `scripts/cf-overlay.js` (helper) | Mustache templates + `/config` POSTs to Admin API |
| 2 | Placeholders | New `scripts/placeholders.js`, called in eager phase before `decorateMain` | `scripts/placeholders.js` + decorator hook | Author `/placeholders` spreadsheet in AEM |
| 3 | Adobe Target | New `plugins/martech/` (vendored from `adobe-rnd/aem-martech`) called in `loadEager` | `plugins/martech/*`, head.html preload hints, edits to `scripts/scripts.js` | Datastream + Target activities in Adobe UI |
| 4 | HTML Fragment API | **No new runtime code** — exposes existing `.plain.html` cross-origin via `headers.json` | none in this repo | `headers.json` POST to Admin API + CORS allowlist |

**HTML API trade-off (server vs client) — recommendation:** **Server-side via the existing edge `.plain.html` endpoint, gated by `headers.json` CORS** (no new origin, no Helix function, no proxy). Rationale below in §4.

**Caveat on user's order:** Task 4 (HTML API) has zero blocking dependency on Tasks 1–3 — it is a configuration-only deliverable. Recommend it can be done in parallel with Task 1 (CFO) by a second person if available; otherwise keep the chosen order.

---

## How the four capabilities sit on the existing pipeline

```
┌────────────────────────── EDS browser pipeline ───────────────────────────┐
│                                                                            │
│  head.html  ──► aem.js ─┬─► scripts.js ── loadPage()                       │
│                         │                  │                               │
│  ┌──────────── EAGER ───┼──────────────────▼──────────────┐                │
│  │ decorateTemplateAndTheme                               │                │
│  │ ▶ NEW: await fetchPlaceholders()  [Cap. 2]             │                │
│  │ ▶ NEW: martechEager()             [Cap. 3]             │                │
│  │ decorateMain(main)                                     │                │
│  │   ├─ decorateButtons / decorateIcons                   │                │
│  │   ├─ buildAutoBlocks  ── (still empty, do not abuse)   │                │
│  │   ├─ decorateSections                                  │                │
│  │   └─ decorateBlocks   ─► loadBlock(article-hero)       │                │
│  │                              │                          │               │
│  │                              ▼                          │               │
│  │              [Cap. 1] CFO: loadFragment(cfPath)         │               │
│  │              + [Cap. 2] resolvePlaceholders(block)      │               │
│  │ loadSection(first)  (LCP)                              │               │
│  └────────────────────────────────────────────────────────┘                │
│  ┌──────────── LAZY ──────────────────────────────────────┐                │
│  │ loadHeader / loadSections(main) / loadFooter           │                │
│  │ ▶ NEW: martechLazy()              [Cap. 3]             │                │
│  └────────────────────────────────────────────────────────┘                │
│  ┌──────────── DELAYED (3s) ──────────────────────────────┐                │
│  │ delayed.js (currently empty)                           │                │
│  │ ▶ NEW: martechDelayed()           [Cap. 3]             │                │
│  └────────────────────────────────────────────────────────┘                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘

[Cap. 4] HTML Fragment API — orthogonal to runtime; lives in admin-side
         headers.json + (optionally) helix-config redirects. No code path.
```

---

## Capability 1 — Content Fragment Overlay (CFO)

### Component boundaries

| Layer | New / Changed file | Responsibility |
|-------|--------------------|----------------|
| Author-side service (off-repo) | `json2html` worker (Adobe-hosted) + Mustache templates | Convert CF JSON → semantic HTML on publish |
| Author-side config (off-repo) | Admin API `POST /config/{org}/sites/{site}/content-source.json` | Register `overlay.url` and `overlay.type: "markup"` |
| Author repo (this repo) | `templates/article.mustache`, `templates/article-teaser.mustache` (or wherever the json2html worker reads them — doc says "same org/site/branch") | Define HTML shape per CF model |
| Block source (this repo) | `blocks/article-hero/article-hero.js` — **rewritten** | Resolve CF path → fetch `.plain.html` via `loadFragment` → take semantic HTML directly |
| Block source (this repo) | `blocks/article-teaser/article-teaser.js` — **rewritten** | Same pattern |
| Reusable helper | `scripts/cf-overlay.js` (new, optional) | One place for `cfPathToFragmentPath(cfPath)` and `loadCFAsFragment(cfPath)` |

### Data flow

```
Author edits CF in AEM Author
   │
   ▼
CF "publish" (from Author, no Publish tier needed) hits Admin API
   │  Admin API sees configured overlay → calls json2html worker
   ▼
json2html worker fetches CF JSON from Author + applies Mustache template
   │
   ▼
Edge Delivery ingests rendered HTML at e.g.
   /content/dam/sgedsdemo/articles/<slug>  →  served as /articles/<slug>.plain.html
   │
   ▼
Browser: blocks/article-hero/article-hero.js decorate(block)
   ├─ read <a href> = /content/dam/.../articles/<slug>
   ├─ map DAM path → site path (helper)
   ├─ loadFragment(sitePath)            ◄── reuses blocks/fragment/fragment.js:21
   └─ replace block content with first .section of fragment
```

### Integration points with existing code

- **Replaces** the hardcoded `GRAPHQL_ENDPOINT` literal at `blocks/article-hero/article-hero.js:1` and `blocks/article-teaser/article-teaser.js:1`.
- **Replaces** the unsafe `block.innerHTML = \`...${title}...\`` template-literal assignment at `blocks/article-hero/article-hero.js:23-30` and `blocks/article-teaser/article-teaser.js:20`. The XSS risk listed in the existing ARCHITECTURE.md anti-patterns disappears because the overlay produces sanitized server-rendered HTML — DOMPurify becomes unnecessary on this path.
- **Reuses** `loadFragment` from `blocks/fragment/fragment.js:21` — already battle-tested by header (`/nav`) and footer (`/footer`).
- Universal Editor compatibility: because the block now consumes a published path that mirrors authoring, any `aue:content-*` events on the article block are already handled by `scripts/editor-support.js:101` re-decoration (it re-runs `decorateBlock` which re-imports the block module which re-fetches the fragment).
- `scripts/scripts.js`: no change needed unless a `getCfMountConfig()` helper is added there for path mapping (recommended; matches the location of `moveInstrumentation`).

### Caveats

- **Author preview ≠ live**: the json2html worker is invoked on publish-to-EDS, not on Author-only. Confirm the Author preview path renders previewed CFs through the same overlay. (LOW confidence — needs validation against `/preview/` Admin API behavior.)
- **Mustache templates live somewhere**: docs imply they live under the same org/site/branch — likely `templates/<model>.mustache` in this repo. Treat that location as MEDIUM confidence; the CFO doc page is the authoritative source.

---

## Capability 2 — Generic Placeholder / Variable Mechanism

### Component boundaries

| File | Status | Responsibility |
|------|--------|----------------|
| `scripts/placeholders.js` | **NEW** | Export `fetchPlaceholders(prefix?)`. Loads `/placeholders.json` once and caches; returns `{ key: text }` dictionary |
| `scripts/scripts.js` | **edit** `loadEager` | Call `await fetchPlaceholders()` before `decorateMain(main)`; stash on `window.hlx.placeholders` (sanctioned global) |
| `scripts/scripts.js` | **edit** `decorateMain` | After `decorateBlocks`, run `resolvePlaceholders(main)` walker that scans text nodes inside any element tagged `data-resolve-placeholders` (or globally — see decision below) |
| `scripts/editor-support.js` | **edit** `applyChanges` | After re-decoration, re-run `resolvePlaceholders` on the patched subtree so authored edits in UE see resolved values immediately |
| `helix-query.yaml` (existing) | **edit** | Add a `placeholders` index pointing at the authored spreadsheet path, OR rely on the default behavior of `https://www.aem.live/placeholders.json` if author publishes a sheet at that path |
| `models/_*.json` | **no change** | Placeholders work on raw text, no model schema change |

### Data flow

```
                                       ┌─ /placeholders.json ─┐
Author edits a Sheets/Excel doc ───►   │ { data: [            │  served by EDS
at /placeholders in AEM author          │   {Key:"brandName", │  spreadsheets-as-JSON
                                        │    Text:"Acme"},    │  (cached at edge)
                                        │   {Key:"currentYr", │
                                        │    Text:"2026"} ]}  │
                                       └──────────┬───────────┘
                                                  │ once per page
                                  loadEager() ────▼
                                  fetchPlaceholders() → window.hlx.placeholders
                                                  │
                                  decorateMain ───┼─► decorateBlocks
                                                  │
                                  resolvePlaceholders(main):
                                       walk text nodes, replace /\{\{(\w+)\}\}/g
                                       skip <script>, <style>, <textarea>, contenteditable
                                                  │
                                                  ▼
                                       DOM has final string values
```

### Integration points

- **Hooks into eager phase** in `scripts/scripts.js:92` `loadEager` BEFORE `decorateMain`. Justification: placeholders must be present for LCP-eligible text. The fetch is a single `~few-KB` JSON; expected p95 < 50 ms from edge cache; fits inside the eager budget.
- **Resolver runs after** `decorateBlocks` in `decorateMain` at `scripts/scripts.js:79-86` so block-injected content (e.g. `cards.js` building `<li>`s, `article-hero` after CFO migration) is also resolved.
- **Universal Editor**: hook resolver into `scripts/editor-support.js:101`'s post-`applyChanges` step so live edits in UE re-resolve. Be careful not to resolve in source HTML retrieved from `event.detail.response.updates[0].content` *before* the patch is committed — resolve only after.
- **Order vs Target**: resolver must run BEFORE Target propositions are applied so that any Target offer text overriding `{{brandName}}` wins. Sequencing: `fetchPlaceholders → resolvePlaceholders → martechEager`.

### Decision: opt-in vs opt-out scope

| Approach | Pros | Cons |
|----------|------|------|
| **Global** (resolve all text nodes under `<main>`) | Zero author burden, "any text block" requirement met | Risk of false-positive `{{` literals (rare); slightly slower walk |
| **Opt-in via class** (e.g., `block.classList.contains('placeholders-on')`) | Predictable, fast | Defeats the "any text block" requirement |
| **Opt-out via class** (default-on; `<div class="no-placeholders">` to skip) | Best of both | Slight extra complexity |

**Recommendation: Global with opt-out class** — matches the literal "any text block" requirement in PROJECT.md while giving an escape hatch.

### Confidence

- `fetchPlaceholders` API name + spreadsheet location: HIGH (aem.live/developer/placeholders + multiple secondary sources confirm)
- Hooking into eager phase before `decorateMain`: MEDIUM (best practice from EDS phasing principles; not directly mandated by docs)
- Global walker pattern: MEDIUM (no canonical aem.live recipe; common pattern in community blocks)

---

## Capability 3 — Adobe Target Integration

### Component boundaries — recommended path: vendor `adobe-rnd/aem-martech`

| File / dir | Status | Responsibility |
|------------|--------|----------------|
| `plugins/martech/src/index.js` | **NEW** (vendored) | Exports `initMartech`, `martechEager`, `martechLazy`, `martechDelayed` |
| `plugins/martech/src/alloy.min.js` | **NEW** (vendored) | Adobe Web SDK |
| `head.html` | **edit** | Add preload hints: `<link rel="modulepreload" href="/plugins/martech/src/index.js">` and `<link rel="preload" as="script" href="/plugins/martech/src/alloy.min.js">` (keep `nonce="aem"` rules in mind: preload links don't need nonce, but no inline scripts added) |
| `scripts/scripts.js` | **edit** top of file | `import { initMartech, martechEager, martechLazy, martechDelayed } from '../plugins/martech/src/index.js'`; call `const martechLoadedPromise = initMartech({ datastreamId, orgId }, { personalization: true })` synchronously at module load |
| `scripts/scripts.js` `loadEager` | **edit** | Replace LCP-section load with `await Promise.all([martechLoadedPromise.then(martechEager), loadSection(main.querySelector('.section'), waitForFirstImage)])` |
| `scripts/scripts.js` `loadLazy` | **edit** | After `loadFooter`, call `martechLazy()` |
| `scripts/delayed.js` | **edit** | Add `martechDelayed()` (currently empty file) |
| `.hlxignore` | **edit** | Ensure `plugins/` is shipped (do NOT exclude); `_*.json` rule is unaffected |
| Adobe UI (off-repo) | author task | Two activities in Target: `banner-text-variation`, `page-logo-variation`. Targeting rule: page URL match. |

### Why aem-martech (not raw at.js)

- aem.live doc's "Configuring Adobe Target Integration" page is itself the recipe for the WebSDK + Alloy approach; `aem-martech` is the maintained reference plugin from `adobe-rnd/`.
- Eliminates flicker via the WebSDK's "renderDecisions: false → onDecoratedElement" pattern: decisions arrive during eager, applied per-block after decoration.
- The legacy at.js approach exists (Mayur Satav blog) but is documented as legacy. (HIGH confidence aem-martech is the preferred 2025+ path.)

### Data flow

```
loadPage()
   │
   ├─ initMartech({datastreamId, orgId}) — fires alloy("configure") + first sendEvent immediately
   │     │
   │     └─ alloy → datastream → Target → returns propositions list (DOM-based offer metadata)
   │
   ├─ loadEager()
   │     ├─ martechEager()  — registers onDecoratedElement callbacks, awaits first proposition payload
   │     ├─ decorateMain    — blocks render
   │     ├─ for each block in viewport: alloy applies matching proposition (innerHTML/attribute swap)
   │     └─ LCP section ready
   │
   ├─ loadLazy()
   │     └─ martechLazy() — analytics beacons, ACDL hookup, view-change tracking
   │
   └─ loadDelayed()
         └─ martechDelayed() — Launch container if any, third-party tags
```

### Integration points

- **Activity 1 — banner text**: target a block by data-aue-resource selector or by class (`.dam-banner h1`, `.hero h1`). Target offer is HTML/text replacement on the matching element. The aem-martech `onDecoratedElement` hook ensures the swap happens AFTER `decorate(block)` finishes so block-built DOM is in place.
- **Activity 2 — page logo**: target the logo node inside `blocks/header/header.js` output (likely an `<img>` inside `.nav-brand`). Because header loads in lazy phase, the proposition for the logo will be applied during lazy, not eager. Acceptable for this demo since logo isn't LCP. **Watch:** if visual flicker appears, hoist the logo selector to the eager-resolved set in martech config.
- **head.html**: preload hints are essential — without them, the eager-phase `await martechEager` adds full RTT to LCP. Adding preload turns it into a dependent-but-prefetched chain.
- **Existing CSP** at `head.html:3` uses `nonce-aem` with `strict-dynamic`. The aem-martech plugin loads alloy as a dynamic ES module — covered by `strict-dynamic`. The Target backend response, when injected as innerHTML, is NOT script-protected by CSP by design (it's content). Confirm offers cannot include `<script>` injections — Target Activity authors must use HTML offers, not script offers.
- **No interaction with Placeholders other than ordering**: ensure `resolvePlaceholders` runs BEFORE `martechEager` swaps content; otherwise an offer text containing `{{brandName}}` would not be resolved.

### Confidence

- `aem-martech` plugin shape and exports (`martechEager`/`martechLazy`/`martechDelayed`): HIGH (multiple search hits + GitHub README quotation)
- Preload hint location + timing: HIGH
- Specifically `await Promise.all([martechLoadedPromise.then(martechEager), loadSection(...)])`: HIGH (matches reference snippet)
- Whether the existing Target account/property requires migration to a Datastream: MEDIUM — depends on how the existing Target property was provisioned. Flagged as research follow-up.

---

## Capability 4 — HTML Fragment API (external consumer)

### The trade-off: server-side vs client-side

| Approach | Where rendering happens | Where CORS/auth lives | Net code |
|----------|------------------------|----------------------|----------|
| **A. Reuse `.plain.html` cross-origin (RECOMMENDED)** | Edge Delivery (already rendered) | `headers.json` config posted to Admin API | Zero new runtime code in this repo |
| B. Helix Function (server) | Custom Cloudflare worker / Edge Worker proxy | In the function | New worker repo + deploy pipeline |
| C. Client-side proxy (your external app fetches via its own backend) | External app's backend | External app's CORS headers | None in this repo, but external app burden |

**Recommendation: A (server-side, reuse `.plain.html`).**

### Rationale

1. **EDS already renders pages and fragments as HTML at `<path>.plain.html`** — consumed today by `blocks/fragment/fragment.js:25`. Same endpoint is publicly cacheable and CDN-fronted.
2. **CORS is the only missing piece** for cross-origin browser consumers. aem.live ships a first-class `headers.json` mechanism (`https://admin.hlx.page/config/{org}/sites/{site}/headers.json`) to set `access-control-allow-origin` per URL glob. (HIGH confidence — `aem.live/docs/custom-headers`.)
3. **No new origin to maintain** — no Cloudflare Worker, no AWS Lambda, no Helix function deploy pipeline. PoC stays in this one repo.
4. **Author publishes a fragment, external app consumes it** — same content model as `/nav` and `/footer`. Mental model already proven in the codebase.
5. **Future production hardening** (path B) becomes additive, not a rewrite: if the real project needs auth/rate-limit, a worker can be inserted in front of the same `.plain.html` URL without breaking external consumers.
6. **Author CF support is free**: after CFO (Cap. 1), even Content Fragments are addressable as `.plain.html`. So the same API serves regular pages, sections, AND content fragments uniformly.

### Component boundaries

| Component | Location | Responsibility |
|-----------|----------|----------------|
| Endpoint | `https://<site>.aem.page|aem.live/<path>.plain.html` | Already exists; serves rendered HTML for any author content |
| CORS config | `headers.json` POSTed to Admin API | `{ "/api/fragments/**": [{ "key": "access-control-allow-origin", "value": "https://external-app.example.com" }, { "key": "access-control-allow-methods", "value": "GET, OPTIONS" }] }` |
| Path-shaping (optional) | `helix-config` redirects `/api/fragments/*` → `/fragments/*` | Pretty external-facing URL; keeps internal author paths private |
| Author content | AEM author at `/content/sgedsdemo/fragments/<name>` | Authored as ordinary pages or as Content Fragments (post-Cap.1) |
| **No JS in this repo** | n/a | The endpoint is config + author content |

### Data flow (cross-origin)

```
External web app (https://external-app.example.com)
   │  fetch('https://main--sgedsdemo--<owner>.aem.live/api/fragments/promo-banner.plain.html')
   ▼
Edge Delivery edge
   │  matches headers.json glob /api/fragments/**
   │  attaches: access-control-allow-origin: https://external-app.example.com
   │  attaches: vary: origin
   │  serves cached rendered HTML
   ▼
Browser receives 200 + ACAO header → rendering happens in external app
```

### Integration points

- **No code in `scripts/scripts.js` or `scripts/aem.js` changes.**
- Authors create fragments via Universal Editor under a designated path (`/fragments/*`). Optional helix-config rewrite to expose them under `/api/fragments/*`.
- For Content Fragments (post-Cap.1), the same endpoint shape works because CFO renders CFs as `.plain.html` pages.
- **Security note (matches PROJECT.md "Out of Scope"):** PoC starts with explicit-origin allowlist (`access-control-allow-origin: https://external-app.example.com`, NOT `*`). This avoids the CSRF risk called out in `aem.live/docs/custom-headers` for sidekick-authenticated authors.

### Why NOT a Helix function (path B)

- Adds a deploy target outside this repo.
- Solves no problem that `headers.json` doesn't already solve.
- Defers the same auth question to a different surface; better to add auth as a follow-on milestone (per PROJECT.md "Out of Scope").

### Why NOT a client-side proxy (path C)

- Pushes responsibility to consumers — defeats the point of "external web app on a different domain."
- Doesn't reduce attack surface; just relocates it.

### Confidence

- `headers.json` mechanism exists and supports `access-control-allow-origin`: HIGH
- `.plain.html` is publicly addressable per page/fragment: HIGH (used in this repo and across all EDS sites)
- Glob-based scoping: HIGH

---

## Build order — final recommendation

| Step | Capability | Why now | Unblocks |
|------|-----------|---------|----------|
| 1 | **CFO** | Fixes the broken article blocks (PROJECT.md key decision); establishes `loadFragment`-from-CF pattern; removes XSS hot spot | Cap. 4 (HTML API gains CFs as a content type) |
| 2 | **Placeholders** | Independent of Target/CFO at the wire level; introduces the "resolve in eager → re-resolve in editor-support" lifecycle hook that Target will reuse | Cap. 3 (Target offers can reference placeholder values) |
| 3 | **Target** | Needs Placeholders resolved BEFORE proposition application (ordering); needs the CFO migration done so personalization tests run on real article blocks rather than broken GraphQL ones | none required |
| 4 | **HTML API** | Pure config; can be done first if a second person is available | none |

### Inter-capability dependencies (explicit)

```
CFO ─────┐
         ├─► Target  (real content to personalize)
Placeholders ─► Target  (resolution must precede proposition apply)
                                │
                                ▼
                        (no dep)  HTML API  ─────────► Cap. 1 helps but not required
```

**No capability blocks Cap. 4 strictly** — it can be parallelized.

---

## Cross-cutting concerns

### Security
- CFO removes the existing innerHTML XSS path in article blocks.
- Placeholders walker writes `node.nodeValue` (text), never `innerHTML` — XSS-safe by construction.
- Target offers must be HTML-only (not script). Document in `docs/target.md` the activity-author rule.
- HTML API uses explicit origin allowlist; never `*`.

### Performance
- Placeholders fetch is single edge-cached JSON; budget < 50 ms.
- Target eager round-trip will measurably impact LCP — preload hints are mandatory; instrument only personalized pages (matches aem.live recommendation).
- CFO removes the publish-domain CORS round-trip on every article view; page should get faster.

### Universal Editor
- All four capabilities need the editor-support flow re-tested:
  - CFO: `aue:content-patch` on article block re-runs `decorate` → re-fetches fragment. ✅
  - Placeholders: re-resolve after `applyChanges` (added integration point above).
  - Target: out of UE preview path — disable martech in author iframe via `if (window.location.hostname.includes('adobeaemcloud'))` guard at `initMartech` call site.
  - HTML API: no UE interaction.

### CSP (`head.html:3`)
- All four capabilities respect the existing `script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:`.
- Target's alloy module load is covered by `strict-dynamic`.
- No new inline scripts required.

---

## Open questions for downstream phases

1. **CFO Mustache template repo location** — confirm whether Mustache files live in this repo (`templates/`) or in the json2html worker config. Affects which milestone owns them.
2. **Target Datastream provisioning** — does the existing Target property already have a Datastream + WebSDK orgId, or do those need to be created? Affects Cap. 3 first-day work.
3. **Author preview behavior under CFO** — does `*.aem.page` preview render CF overlays the same way as `*.aem.live`? Affects whether the migration is verifiable inside Universal Editor.
4. **Placeholder spreadsheet path** — `/placeholders` at site root vs `/i18n/en/placeholders` vs another convention. Drives the `fetchPlaceholders()` argument shape.

---

## Sources

- [Publishing AEM Content Fragments to Edge Delivery Services](https://www.aem.live/developer/content-fragment-overlay) — primary CFO doc (HIGH; surfaced via WebSearch summary)
- [JSON2HTML for Edge Delivery Services](https://www.aem.live/developer/json2html) — Mustache template service used by CFO (HIGH)
- [Using Placeholders](https://www.aem.live/developer/placeholders) — `fetchPlaceholders()` API (HIGH)
- [Spreadsheets and JSON](https://www.aem.live/developer/spreadsheets) — backing store format for placeholders (HIGH)
- [Configuring Adobe Target Integration](https://www.aem.live/developer/target-integration) — primary Target doc (HIGH)
- [Configuring Adobe Experience Cloud Integration](https://www.aem.live/developer/martech-integration) — sister doc covering WebSDK (HIGH)
- [adobe-rnd/aem-martech](https://github.com/adobe-rnd/aem-martech) — reference plugin to vendor for Cap. 3 (HIGH)
- [Custom HTTP Response Headers](https://www.aem.live/docs/custom-headers) — `headers.json` for Cap. 4 CORS (HIGH)
- [Document-based Project Configuration](https://www.aem.live/docs/configuration) — Admin API config pattern (MEDIUM)
- [aem.live FAQ](https://www.aem.live/docs/faq) — general guidance (MEDIUM)
- Existing repo: `.planning/codebase/ARCHITECTURE.md`, `scripts/scripts.js`, `blocks/fragment/fragment.js`, `blocks/article-hero/article-hero.js`, `head.html` — primary integration anchors (HIGH)

Confidence reduced from HIGH → MEDIUM-HIGH overall because primary aem.live URLs were not directly fetched (sandbox blocked WebFetch and curl); claims rest on multiple WebSearch-summarized excerpts of the same canonical pages, which agree across sources.
