# Phase 2: Content Fragment Overlay — Research

**Researched:** 2026-05-07
**Domain:** Adobe AEM Edge Delivery Services Content Fragment Overlay (CFO) + json2html worker + Universal Editor authoring on AEMaaCS Author tier
**Confidence:** HIGH on architecture/wiring, MEDIUM on exact CF JSON shape (must be confirmed by Wave 1 spike), LOW on `*.aem.page` vs `*.aem.live` parity (OQ-1 — no authoritative doc found)

## Summary

CFO is a build-time + runtime configuration layer that, **on CF publish**, makes the EDS Admin API ingest the Author CF as a page. The browser then fetches a normal `.plain.html` URL — `loadFragment(cfPath)` works unmodified. The Wave 1 work is mostly Admin API curl POSTs (CFO Admin config, json2html `/config`) plus capturing one real CF JSON to lock the `assetUrl()` shape. The Wave 2 work rewrites two existing blocks against a tiny new helper module (`scripts/cf-overlay.js`) and per-block DOMPurify sanitization (CP-2 closure). Wave 3 is documentation (DOC-01) plus an XSS smoke verification.

The single biggest risk is **CFO-1 silent failure** — a path mismatch returns `200 OK` with HTML body where JSON/HTML-via-Mustache is expected. The defensive `Content-Type` check in `fetchOverlay()` (D-08, locked) plus a deliberate test page in DOC-01 (CFO-10) closes it.

**Primary recommendation:** `fetchOverlay(cfPath)` MUST delegate to `loadFragment(cfPath)` — not a parallel fetch. The whole point of CFO is that the browser sees a published page; Phase 2 inherits the proven Phase-1-cleared `fragment.js` primitive (which already handles `.plain.html` suffix, base-path rewriting, `decorateMain`, and `loadSections`). The only Phase-2-specific code is the cfPath input shape + DOMPurify sanitize step on the rich-text body container after `loadFragment` returns.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Wave structure (3 waves, parallel within Wave 1):**
- Wave 1 (parallel): plan-02-01 verify-or-create CF model + POST CFO Admin API config; plan-02-02 POST stub Mustache + commit `cf-templates/article.html`; plan-02-03 capture raw CF JSON + write `scripts/cf-overlay.js` with locked `assetUrl(repoPath)` + `fetchOverlay(cfPath)` signatures.
- Wave 2 (depends on Wave 1): plan-02-04 rewrite `article-hero.js`; plan-02-05 rewrite `article-teaser.js`; plan-02-06 wire `getMetadata('cf-endpoint')` consumer (CFO-08).
- Wave 3 (docs + verification): plan-02-07 author `docs/content-fragment-overlay.md`; plan-02-08 smoke test page + XSS verification.

**D-02 — Admin API auth:** All Admin API POSTs (CFO public.json + content.json + json2html /config) run `autonomous: false`. Plans ship the exact curl with `$AEM_TOKEN` placeholder; human runs once with their own session/IMS token; responses captured into DOC-01. NO secrets in repo.

**D-03 — Spike artifact layout:** New `scripts/cf-overlay.js` (named exports `assetUrl(repoPath)` + `fetchOverlay(cfPath)`); `cf-templates/article.html` (Mustache); reference responses pasted into DOC-01 under `## Reference responses`. NO transient SPIKE-LOG.md. `cf-overlay.js` is a NEW module, NOT an extension of `scripts/config.js`.

**D-04 — DOMPurify wiring:** Per-block, post-`loadFragment`, on the rich-text body container only. `DOMPurify.sanitize(body.innerHTML)` before insertion. Plain-text fields use `textContent`/`setAttribute`, never innerHTML. Do NOT modify `blocks/fragment/fragment.js`.

**D-05 — DOMPurify config:** Default profile (no custom `ALLOWED_TAGS`). Matches `scripts/editor-support.js:32-34` existing usage.

**D-06 — UE component model surface:** Each block's `_<block>.json` exposes ONE field — `cfReference` of `component: reference, valueType: cfPath, required: true`. The CF owns title, body, image; zero per-instance overrides. Display variants deferred to v2.

**D-07 — CF model verify-or-create:** Wave 1 plan-02-01 includes `autonomous: false` task: confirm `article` CF model with fields `{title: text, body: rich-text, image: image-ref}` exists; create if missing; paste model JSON export into DOC-01.

**D-08 — Empty/error state:** On any error class (404, 401/403, HTML-body-not-JSON, missing fields, network), block:
- Logs single line `console.error('article-{hero,teaser}: missing CF', cfPath)`.
- `block.replaceChildren()` to empty children but leaves block element + `data-aue-*` instrumentation intact.
- Published page: invisible.
- UE: still clickable; `cfReference` still editable; re-saving with valid CF triggers `applyChanges` → in-place re-render.
- NO inline UE-only debug message (deferred).

**Carry-forward locks (Phase 1, do not re-design):**
- `AEM_AUTHOR_HOST` from `scripts/config.js`.
- DOMPurify import path `../../scripts/dompurify.min.js` (UMD 3.4.2).
- Pre-commit guard rejects new `publish-*adobeaemcloud.com`; Phase 2 deletes the two existing literals at `blocks/article-hero/article-hero.js:1` and `blocks/article-teaser/article-teaser.js:1`.
- `editor-support.js` `applyChanges` null-guard live (Phase 1 D-10).
- Soft-fail pattern: log + return on missing data; never throw.
- Vanilla ESM, no bundler, mandatory `.js` import extensions.

### Claude's Discretion

- Internal helper names inside `scripts/cf-overlay.js` beyond the two locked exports.
- Mustache template specifics inside `cf-templates/article.html` (variable names, conditional sections) provided they match the captured CF JSON shape.
- Whether `_article-hero.json` and `_article-teaser.json` share `models/_article.json` or stay co-located. Existing repo pattern is co-located → planner-time call.
- Smoke-test page path under `/test-cfo` or similar.
- Whether `fetchOverlay` returns `<main>` (matches `loadFragment` shape) or a fragment of children.
- Per-block CSS adjustments needed for new fragment shape.

### Deferred Ideas (OUT OF SCOPE)

- CF model variants (`article-light`/`article-dark`) sharing one Mustache template — CFO-V2-01.
- Live-preview parity `aem.page` vs `aem.live` for CFO content — CFO-V2-02 (Wave 1 spike confirms parity exists/not; if not, fix is v2).
- Multi-locale CF reference resolution — CFO-V2-03.
- Per-instance overrides on the block model (title/image override fields) — rejected in discussion.
- UE-only inline debug message on broken CF — deferred (silent recoverable empty container is the contract).
- Single Playwright smoke test covering all 4 POC features — X-V2-01.
- Generic CF→HTML universal renderer — explicitly two specific models prove the pattern.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFO-01 | Per-CF-model overlay configuration via Admin API (`public.json` + `content.json`) | §Architecture / §json2html worker config — exact curl shape from aem.live docs |
| CFO-02 | CF JSON fetched from Author tier (`/api/assets/.../{{id}}.json`), never Publish | §CF JSON shape — defensive `Content-Type` check; CFO source URL is the Author proxy already in `fstab.yaml` |
| CFO-03 | HTML rendering via `json2html.adobeaem.workers.dev` with Mustache template at `cf-templates/article.html` | §Mustache template authoring — `template` worker config param; commit-time template lives in repo |
| CFO-04 | `article-hero.js` + `article-teaser.js` rewritten to use `loadFragment(cfPath)`; direct GraphQL deleted | §Block rewrite pattern — uses existing `loadFragment` from `blocks/fragment/fragment.js:21-44` |
| CFO-05 | Rich-text bodies sanitized with DOMPurify; plain-text via `textContent`/`setAttribute` | §DOMPurify integration — D-04 wiring point with code excerpt |
| CFO-06 | UE component models updated with CF reference field (`type: reference, valueType: cfPath`) | §UE component-model wiring — concrete JSON shape excerpt |
| CFO-07 | UE re-decoration preserves CFO blocks across `applyChanges` patches via `moveInstrumentation` | §UE instrumentation preservation — code excerpt |
| CFO-08 | CF endpoint sourced from `getMetadata('cf-endpoint')`; no hardcoded host or persisted-query path | §Endpoint sourcing — `getMetadata` already in `scripts/aem.js`; meta tag added in `head.html` |
| CFO-09 | Graceful empty-state when CF reference missing or fails (`console.error` + empty block, no crash) | §Error states — D-08 contract with code excerpt |
| CFO-10 | Working article page authored end-to-end in UE on AEMaaCS rendering via new pipeline | §Smoke test architecture — verification artifact |
| DOC-01 | `docs/content-fragment-overlay.md` step-by-step including Admin API curl, Mustache authoring, UE wiring, smoke-test path | §Reusable assets — DOC-01 sections enumerated in CONTEXT specifics |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No bundler / no transpile.** Vanilla ES Modules; mandatory `.js` extensions on all relative imports (enforced by `import/extensions` ESLint rule).
- **No Publish tier.** Every fetch must go through Author proxy (`fstab.yaml` mountpoint) or aem.page/aem.live. Pre-commit grep guard rejects new `publish-p23458-*` references.
- **Block decoration pattern.** Every block exports `default async function decorate(block)` that mutates the DOM in place.
- **Husky pre-commit hook auto-builds component-models.json/component-definition.json/component-filters.json from `_*.json` partials.** Never hand-edit the merged top-level files.
- **CSP `script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:`** — json2html output is server-rendered HTML, no inline scripts; `<meta name="cf-endpoint">` is metadata, not script. No new CSP work expected.
- **Documentation is a deliverable.** DOC-01 ships in the same PR (Wave 3).
- **Modern evergreen browsers only**, no IE.
- **ESLint airbnb-base + eslint-plugin-xwalk** — single quotes, trailing commas, semicolons, max-len.
- **Stylelint stylelint-config-standard.**
- **Soft-fail in production** — log to `console.error`, swallow; never throw to surface.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CF JSON storage / model definition | AEM Author (DAM) | — | CFs live in `/content/dam/sgedsdemo/...` on Author. Source of truth. |
| Author CF JSON delivery | Helix Admin API + Author proxy | — | `admin.hlx.page` ingests on CF publish; `fstab.yaml` Author proxy is the runtime fetch path. |
| JSON → HTML rendering | json2html worker (Adobe-hosted Cloudflare Worker) | — | `json2html.adobeaem.workers.dev` per CFO-03. Server-side Mustache. Stateless. |
| Mustache template hosting | EDS edge (this repo) | — | `cf-templates/article.html` committed to GitHub; worker fetches from `templateApiKey`-authenticated URL. [CITED: aem.live/developer/json2html] |
| `cf-endpoint` metadata read | Browser | — | `getMetadata('cf-endpoint')` reads `<meta name="cf-endpoint">` injected by `head.html`. Phase 2's only addition to head. |
| `loadFragment(cfPath)` execution | Browser | — | Fetches `${cfPath}.plain.html` (already EDS-rendered via json2html) and decorates. Uses existing `blocks/fragment/fragment.js:21-44`. |
| DOMPurify sanitize | Browser | — | Defense-in-depth even though server-rendered. Body container only (D-04). |
| UE instrumentation preservation | Browser | — | `moveInstrumentation` from `scripts/scripts.js:39` copies `data-aue-*` + `data-richtext-*`. |
| Recoverable empty-state | Browser | — | `block.replaceChildren()` keeps wrapper + UE attrs intact. Author re-saves CF reference → `applyChanges` re-decorates. |

## Architecture Patterns

### System Architecture Diagram (data flow on CF publish)

```text
                 ┌─────────────────────────────────────────────────────────────┐
                 │  AUTHORING TIME (one-time per CF publish)                   │
                 │                                                             │
                 │  Author publishes CF      ──►  Helix Admin API              │
                 │  (UE / CF console)             (admin.hlx.page)             │
                 │                                       │                     │
                 │                                       ▼                     │
                 │                              Checks CFO config              │
                 │  Author Assets API JSON ◄─── (public.json + content.json)   │
                 │  /content/dam/.../article  ──►                              │
                 │                              json2html worker               │
                 │  cf-templates/article.html ──►  (Mustache rendering)        │
                 │  (this repo, GitHub)              │                         │
                 │                                   ▼                         │
                 │                              HTML ingested into EDS as page │
                 │                              at the configured path        │
                 └─────────────────────────────────────────────────────────────┘

                 ┌─────────────────────────────────────────────────────────────┐
                 │  REQUEST TIME (per page view)                               │
                 │                                                             │
                 │  Browser ──► aem.page / aem.live edge                       │
                 │                  │                                          │
                 │                  ▼                                          │
                 │  Page HTML w/ <meta name="cf-endpoint" content="...">       │
                 │     + <a href="/content/dam/.../article"> in block          │
                 │                                                             │
                 │  scripts.js loadEager → decorateMain → decorateBlocks       │
                 │     │                                                       │
                 │     ▼                                                       │
                 │  blocks/article-hero/article-hero.js decorate(block)        │
                 │     │                                                       │
                 │     ├─► cfPath = block.querySelector('a').href              │
                 │     │                                                       │
                 │     ├─► fetchOverlay(cfPath) ─► loadFragment(cfPath)        │
                 │     │     │                                                 │
                 │     │     └─► fetch(`${cfPath}.plain.html`) ◄── EDS edge    │
                 │     │           Content-Type check → defensive null        │
                 │     │           Returns <main> with sanitized fragment    │
                 │     │                                                       │
                 │     ├─► moveInstrumentation(srcLink, newWrapper)            │
                 │     │   (preserves data-aue-* across DOM swap)              │
                 │     │                                                       │
                 │     ├─► body = main.querySelector('.body')                  │
                 │     ├─► body.innerHTML = DOMPurify.sanitize(body.innerHTML) │
                 │     │                                                       │
                 │     ├─► block.replaceChildren(...main.childNodes)           │
                 │     │                                                       │
                 │     └─► On any error: console.error + block.replaceChildren()
                 │                       (block element + UE attrs preserved)  │
                 └─────────────────────────────────────────────────────────────┘

                 ┌─────────────────────────────────────────────────────────────┐
                 │  UE PATCH TIME (author edits cfReference)                   │
                 │                                                             │
                 │  aue:content-patch event ──► scripts/editor-support.js      │
                 │                                  │                          │
                 │                                  ▼                          │
                 │                              applyChanges (Phase 1 fixed)   │
                 │                                  │                          │
                 │                                  ▼                          │
                 │                              decorateBlock(newBlock)        │
                 │                                  │                          │
                 │                                  ▼                          │
                 │                              loadBlock → article-hero.js    │
                 │                              decorate runs again w/ new cf  │
                 │                              D-08 empty-state preserves UE  │
                 │                              instrumentation if CF broken.  │
                 └─────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (additions to existing repo)

```
scripts/
└── cf-overlay.js           # NEW. Named exports: assetUrl(repoPath), fetchOverlay(cfPath).

cf-templates/
└── article.html            # NEW. Mustache template for the `article` CF model.

blocks/article-hero/
├── article-hero.js         # REWRITTEN. Uses fetchOverlay + DOMPurify + moveInstrumentation.
├── article-hero.css        # Adjusted selectors if new fragment shape requires.
└── _article-hero.json      # NEW. cfReference field, picked up by build:json.

blocks/article-teaser/
├── article-teaser.js       # REWRITTEN. Symmetric to article-hero.
├── article-teaser.css      # Adjusted.
└── _article-teaser.json    # NEW.

docs/
└── content-fragment-overlay.md  # NEW. DOC-01.

head.html                   # MODIFIED. + <meta name="cf-endpoint" content="...">
```

### Pattern 1: `fetchOverlay(cfPath)` delegates to `loadFragment` with defensive guard

**What:** The CF overlay endpoint is configured to serve standard EDS pages. `loadFragment` already does what we need. `fetchOverlay` adds: cfPath input validation (must start with `/content/dam/`), defensive HTTP/Content-Type handling, and uniform `null` return on any failure.

**When to use:** Every Phase 2 block that consumes a CF.

**Example:**
```javascript
// scripts/cf-overlay.js
// Source: existing pattern in blocks/fragment/fragment.js:21-44 + getMetadata in scripts/aem.js
import { loadFragment } from '../blocks/fragment/fragment.js';
import { getMetadata } from './aem.js';
import { DAM_PREFIX } from './config.js';

/**
 * Translate an AEM repository asset path to a delivery URL the browser can load.
 * Locked at Wave 1 plan-02-03 by inspecting captured CF JSON.
 * @param {string} repoPath  e.g. /content/dam/sgedsdemo/articles/foo/image.jpg
 * @returns {string} Browser-loadable asset URL (relative to current origin).
 */
export function assetUrl(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') return '';
  // Wave 1 spike: confirm whether the EDS edge serves DAM assets via the same
  // path or whether a rewrite (e.g., /assets/...) is needed. Captured response
  // sample dictates the implementation.
  return repoPath; // PLACEHOLDER — locked in Wave 1.
}

/**
 * Fetch a CF overlay as a hydrated <main> element.
 * Returns null on any failure (network, non-OK, HTML body where JSON expected,
 * missing fields). Caller checks for null and falls back to D-08 empty-state.
 * @param {string} cfPath  e.g. /content/dam/sgedsdemo/articles/my-article
 * @returns {Promise<HTMLElement|null>}
 */
export async function fetchOverlay(cfPath) {
  if (!cfPath || !cfPath.startsWith(DAM_PREFIX)) return null;
  try {
    // loadFragment already adds .plain.html, runs decorateMain + loadSections,
    // and returns null on non-OK. CFO-1 defensive: if response shape is wrong
    // (e.g., main has no children at all), treat as failure.
    const fragment = await loadFragment(cfPath);
    if (!fragment || !fragment.firstElementChild) return null;
    return fragment;
  } catch (err) {
    return null;
  }
}
```

**Confidence:** HIGH on delegating to `loadFragment` (existing primitive, Phase 1 cleared); MEDIUM on `assetUrl` body — must be locked in Wave 1 plan-02-03 by capturing one real CF JSON response.

### Pattern 2: Block decorate against `fetchOverlay` + DOMPurify body sanitization

**What:** The rewritten `article-hero.js` and `article-teaser.js` follow this skeleton.

**Example:**
```javascript
// blocks/article-hero/article-hero.js (rewritten)
// Source: pattern derived from blocks/fragment/fragment.js + blocks/cards/cards.js (moveInstrumentation)
//         + scripts/editor-support.js:32-34 (DOMPurify.sanitize default profile)
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchOverlay } from '../../scripts/cf-overlay.js';
import DOMPurify from '../../scripts/dompurify.min.js';

export default async function decorate(block) {
  const link = block.querySelector('a');
  if (!link) return;
  const cfPath = link.getAttribute('href').replace(/\.html$/, '');

  const fragment = await fetchOverlay(cfPath);
  if (!fragment) {
    // D-08: recoverable empty container. Block + data-aue-* preserved.
    // eslint-disable-next-line no-console
    console.error('article-hero: missing CF', cfPath);
    block.replaceChildren();
    return;
  }

  // DOMPurify on the rich-text body container only (D-04). Plain-text fields
  // are already textContent in the json2html-rendered HTML.
  const body = fragment.querySelector('.body');
  if (body) body.innerHTML = DOMPurify.sanitize(body.innerHTML);

  // Move UE instrumentation from the source <a> to the new wrapper so authors
  // can still click-to-edit the CF reference field after re-decoration.
  const wrapper = fragment.firstElementChild;
  moveInstrumentation(link, wrapper);

  block.replaceChildren(...fragment.childNodes);
}
```

**Confidence:** HIGH. Mirrors `blocks/cards/cards.js` (moveInstrumentation), `blocks/fragment/fragment.js` (loadFragment + replaceChildren), and `scripts/editor-support.js:32-34` (DOMPurify default profile). All three are existing, working patterns in this repo.

### Pattern 3: UE component-model partial with `cfPath` reference

**What:** `_article-hero.json` declares the block to UE with a single CF reference field. The husky pre-commit hook auto-merges into `component-models.json`/`component-definition.json`/`component-filters.json`.

**Example:**
```json
{
  "definitions": [
    {
      "title": "Article Hero",
      "id": "article-hero",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/block/v1/block",
            "template": {
              "name": "Article Hero",
              "model": "article-hero"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "article-hero",
      "fields": [
        {
          "component": "aem-content-fragment",
          "name": "cfReference",
          "label": "Article Content Fragment",
          "valueType": "string",
          "validation": {
            "rootPath": "/content/dam/sgedsdemo/articles"
          },
          "required": true
        }
      ]
    }
  ],
  "filters": []
}
```

**Source:** `blocks/fragment/_fragment.json` (existing example using `aem-content` field) + aem.live UE field-types docs ([CITED: experienceleague.adobe.com/.../universal-editor/field-types]).

**Note on field component name:** The CONTEXT D-06 specifies `component: reference, valueType: cfPath`. Adobe's official UE field-types docs document a dedicated `aem-content-fragment` component for CF picking, with `name: cfPath` as the conventional field name (per UE docs: "the aem-content-fragment component uses cfPath as the field name"). The discretion here is whether to:
- (a) Use the dedicated `aem-content-fragment` component (richer asset picker, scoped to CFs) — RECOMMENDED.
- (b) Use generic `reference` with `valueType: string` (broader picker, accepts any asset).

**Confidence:** MEDIUM. The exact component string (`aem-content-fragment` vs `reference`) should be confirmed during Wave 1 plan-02-01 by inspecting the live UE field picker behavior in the running Author tier. Both are documented; one will reject the other in current AEMaaCS UE versions.

### Pattern 4: `getMetadata('cf-endpoint')` consumer (CFO-08)

**What:** A `<meta name="cf-endpoint" content="...">` tag in `head.html` is the source of truth for the overlay endpoint. Block code reads it via `getMetadata` (already in `scripts/aem.js`).

**Example:**
```html
<!-- head.html addition -->
<meta name="cf-endpoint" content="/content/dam/sgedsdemo">
```

```javascript
// scripts/cf-overlay.js (excerpt)
import { getMetadata } from './aem.js';

const CF_ROOT = getMetadata('cf-endpoint') || DAM_PREFIX;
```

**Note:** The `cf-endpoint` value is the *DAM root prefix* under which CFs live, NOT a hardcoded service URL. The actual delivery URL is whatever the Helix CFO config maps to (which is path-based, not host-based — see CONTEXT D-03 carry-forward). The `getMetadata('cf-endpoint')` consumer pattern is an Adobe convention documented in the json2html docs.

**Confidence:** MEDIUM. The exact metadata convention should be confirmed during Wave 1 plan-02-01 against current json2html / CFO docs. If the convention differs, the meta tag value is what changes — the consumer pattern is unchanged.

### Anti-Patterns to Avoid

- **`block.innerHTML = template` with interpolated CF data.** This is the existing XSS sink at `blocks/article-hero/article-hero.js:23-30` and `blocks/article-teaser/article-teaser.js:20-25`. Replace with DOM construction or `loadFragment`-returned children.
- **Sanitizing fragment-wide inside `loadFragment`.** D-04 explicitly forbids this — risks stripping `data-aue-*` instrumentation and double-sanitizes nav/footer fragments unnecessarily.
- **Hardcoding `publish-*` host or `json2html.adobeaem.workers.dev` in block code.** The block sees a normal `loadFragment` URL. The worker is invoked at CF-publish time, not request time. Pre-commit grep guard already rejects new `publish-*` strings.
- **Hardcoding the GraphQL persisted-query path** (e.g., `graphql/execute.json/sgedsdemo/article-by-path`) — this is the pattern Phase 2 deletes. CFO-08 forbids it.
- **Calling `block.remove()` on missing CF.** D-08 explicitly requires keeping the block element so authors can re-pick the CF in UE. `block.replaceChildren()` empties children only.
- **Forgetting `.js` extension on imports.** ESLint `import/extensions` will fail CI.
- **Editing `component-models.json` / `component-definition.json` / `component-filters.json` by hand.** Always edit the `_*.json` partial; husky pre-commit regenerates the bundles.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Fragment fetch + decorate + base-path rewrite | A new fetch helper | `loadFragment` from `blocks/fragment/fragment.js:21-44` | Already proven, Phase 1 null-guarded, handles `.plain.html` suffix and media base-URL rewriting. |
| HTML sanitization | A custom regex strip | `DOMPurify.sanitize(html)` (vendored at `scripts/dompurify.min.js`, 3.4.2) | Default profile strips `<script>`, `on*=`, `javascript:`, `<iframe>`, `<object>`. Reusing the existing `editor-support.js:32-34` pattern keeps consistency. |
| UE instrumentation copying | A custom `data-aue-*` walker | `moveInstrumentation(from, to)` from `scripts/scripts.js:39-47` | Already filters `data-aue-*` + `data-richtext-*`, used by `blocks/cards/cards.js:9,19`. |
| Page metadata read | A custom `<meta>` parser | `getMetadata(name)` from `scripts/aem.js` | One-line call. Adobe-vendored. |
| JSON → HTML rendering | A custom client-side template engine (Mustache.js, Handlebars) | json2html worker with Mustache template at `cf-templates/article.html` | Adobe-hosted. Stateless. CFO-03 mandates it. Server-side rendering = zero client-side template runtime cost. |
| Auth/IMS handling for CF fetch | Browser-side IMS SDK | Helix Admin API + `fstab.yaml` Author proxy + CFO publish-time ingest | Browser sees a public EDS page. Auth is server-to-server at CF-publish time. CFO-2 / no-Publish constraint. |
| CF model schema validation | Runtime schema enforcement | Defensive optional chaining in block code + DOC-01 schema docs | Project has no test runner; runtime guards + docs is the project pattern (CONVENTIONS line 113-114). |

**Key insight:** Almost everything Phase 2 needs already exists in this repo or in Adobe-hosted infrastructure. The only new code is `scripts/cf-overlay.js` (~30 lines), one Mustache template, two block rewrites (~30 lines each), two model JSON partials (~30 lines each), and DOC-01.

## Common Pitfalls

### Pitfall 1: CFO-1 — Overlay path mismatch returns 200 OK with HTML body where JSON/Mustache-rendered HTML is expected

**What goes wrong:** Path in EDS CFO config does not match CF location in AEM repo. Browser fetch returns the *current EDS page* (a 200 OK HTML body) instead of the json2html-rendered article. `JSON.parse` throws if you try to parse it. If you blindly insert it via `loadFragment`, you get a recursive page-in-page or empty render.

**Why it happens:** Three path mappings stack: (a) `paths.json` (`/content/sgedsdemo/` → `/`), (b) `fstab.yaml` Author proxy mountpoint (`nusoli-valtech/sgedsdemo/main`), (c) the new CFO Admin API config that adds another translation layer. Trailing slashes and `.html` extensions vary by config block.

**How to avoid:**
- Defensive `Content-Type` check: `loadFragment` returns null on non-OK response, but a 200 with HTML-of-wrong-page bypasses that. Add: `if (!fragment.querySelector('.body, .article-hero, [data-cf-fragment]')) return null;` — i.e., assert a marker the json2html template emits.
- Have the Mustache template emit a stable wrapper `<div class="article-cf" data-cf-id="{{id}}">` so the `fetchOverlay` defensive check has something specific to look for.
- Document the exact mapping in DOC-01 with concrete `sgedsdemo` examples.

**Warning signs:**
- Block renders something (not empty) but it's the wrong content / nav appears inside the article slot.
- `console.error` "No item in response" disappears after Phase 2 — but the rendered output still doesn't match what UE shows in preview.
- Network tab: 200 response with `Content-Type: text/html` and a body that looks like a full page, not a CF.

**Severity:** CRITICAL (carry-forward from `.planning/research/PITFALLS.md` CFO-1).

### Pitfall 2: CP-3 — UE instrumentation lost on `innerHTML` rebuild

**What goes wrong:** The current article blocks do `block.innerHTML = template-literal`. This wipes any `data-aue-*` attributes UE added to children. Block renders correctly but is uneditable in UE — clicking on rendered text does not select the underlying CF field.

**Why it happens:** The block was written before UE instrumentation existed. Adobe's reference architecture treats `data-aue-*` as a runtime-only concern.

**How to avoid:**
- After `fetchOverlay` returns the new fragment, but BEFORE `block.replaceChildren()`, call `moveInstrumentation(srcLink, newWrapper)` to copy `data-aue-*` from the source `<a>` (which UE injected) to the new top-level child of the fragment.
- Even better: keep the source `<a>` element (with its UE attrs) as a child of the new structure — append the rendered fragment after it but before `replaceChildren()`. Test in UE.
- Smoke test in UE after every block change: open the page in Universal Editor, click each authorable field, confirm the right model field is highlighted in the side panel.

**Warning signs:**
- Click on rendered text in UE does not show the side panel highlighting the cfReference field.
- DOM inspector shows no `data-aue-resource`, `data-aue-prop`, `data-aue-type` on the rendered fragment.
- `editor-support.js applyChanges` returns false repeatedly (falls through to `window.location.reload()`).

**Severity:** HIGH (carry-forward from PITFALLS.md CP-3).

### Pitfall 3: CP-2 — XSS in CF rich-text body executes on render

**What goes wrong:** Author edits CF body with `<img src=x onerror=alert(1)>`. json2html worker renders the HTML faithfully. Block inserts via `innerHTML` (or `replaceChildren` from a parsed fragment whose subtree contains the payload). The `onerror` handler fires.

**Why it happens:** json2html Mustache uses `{{{body}}}` (unescaped) for HTML body fields by design. The escape lives on the CONSUMER side.

**How to avoid:**
- D-04 wiring point: per-block, post-`loadFragment`, on `body = fragment.querySelector('.body')` only, do `body.innerHTML = DOMPurify.sanitize(body.innerHTML)` BEFORE `block.replaceChildren(...fragment.childNodes)`.
- Plain-text fields (title, alt, image src) — if the Mustache template is well-authored, they're already `textContent`-safe. But verify in DOC-01 smoke step.
- DOMPurify default profile (D-05) — strips `<script>`, `on*=`, `javascript:`, `<iframe>`, `<object>`. Matches `scripts/editor-support.js:32-34`.

**Warning signs:**
- `securitypolicyviolation` events firing in the browser console (CSP listener in `scripts/aem.js:67-91`).
- Smoke test: a CF whose title is `<img src=x onerror=alert(1)>` fires the alert. If yes, DOMPurify wiring is wrong.

**Severity:** CRITICAL (carry-forward from PITFALLS.md CP-2). NON-NEGOTIABLE — closure happens in the same PR as the migration.

### Pitfall 4: CFO-2 — CORS / credentials misconfiguration on Author proxy

**What goes wrong:** Author tier requires IMS auth. Anonymous browser fetch to overlay URL: 401 in incognito. Or worse: auth bleed leaks unpublished/draft CFs publicly.

**Why it happens:** Two competing requirements: (a) Author needs auth for CF management, (b) the public-facing aem.live origin is anonymous. The Helix delivery proxy handles this server-side — but only for routes it knows about. New CFO routes need explicit configuration.

**How to avoid:**
- All CFO requests route through the Helix proxy (`https://<branch>--<repo>--<owner>.aem.page/...` or `aem.live/...`), NEVER directly to `author-p23458-e585661.adobeaemcloud.com` from the browser. The proxy holds the credential.
- Test in three contexts: (a) signed-in author session on `aem.page`, (b) anonymous incognito on `aem.page`, (c) anonymous on `aem.live`. All three should match intended access policy.
- Never publish unpublished CFs. CFO publishing is gated by author action — but if a CF is mid-edit, the overlay URL may serve the stale version. Document in DOC-01.

**Warning signs:**
- 401/403 responses in incognito but works in author-logged-in tab.
- Authenticated response includes draft/unpublished content fields → leak.

**Severity:** HIGH (carry-forward from PITFALLS.md CFO-2).

### Pitfall 5: CFO-3 — CF model schema drift breaks the block silently

**What goes wrong:** Author renames CF model field (`body` → `content`). Block returns nothing, no error.

**How to avoid:**
- Defensive optional chaining in block code (`fragment?.querySelector('.body')?.innerHTML`).
- Document the expected schema at the top of `article-hero.js` and `article-teaser.js` as a comment block.
- DOC-01 includes the CF model fields with screenshots; PR diff signals when schema is updated.

**Warning signs:**
- Block renders empty after a content-only change in Author.
- `console.error` "missing CF" in production.

**Severity:** MEDIUM (carry-forward from PITFALLS.md CFO-3).

### Pitfall 6: CFO-4 — `_publishUrl` / `_path` field shape change between Publish GraphQL and Author CFO

**What goes wrong:** Existing GraphQL queries return `_publishUrl` and `_dynamicUrl`. CF Overlay (driven by Author) returns different URL shapes — `_path` (DAM repo path) without rendered URL. Image `<img src>` paths break.

**How to avoid:**
- Wave 1 plan-02-03 captures one full CF JSON response and inspects which URL fields exist.
- Single `assetUrl(repoPath)` helper transforms repo paths to delivery URLs in ONE place.
- Image src paths in Mustache template use `{{image._path}}` (or whatever Wave 1 confirms) wrapped in the `assetUrl` helper.

**Warning signs:**
- Broken image icons after Phase 2 ships.
- Hover-link target shows `/content/dam/...` literal path.

**Severity:** MEDIUM (carry-forward from PITFALLS.md CFO-4).

### Pitfall 7: aem.page vs aem.live preview parity (OQ-1)

**What goes wrong:** UE preview runs on `*.aem.page`. Public site runs on `*.aem.live`. CFO ingests at CF-publish time via Helix Admin API. **Open question:** does the Admin API ingest pages for both `.aem.page` (preview) and `.aem.live` (publish) automatically, or only for one?

**Why it happens:** No authoritative documentation found in this research session that confirms the parity. Adobe docs document the publish-time flow but not explicitly preview-tier behavior.

**How to avoid:**
- Wave 1 spike (plan-02-03) MUST: (a) author one test CF, (b) hit the overlay URL on `*.aem.page`, (c) hit the same URL on `*.aem.live`, (d) compare responses. If parity, proceed. If not, document the gap and defer (CFO-V2-02).
- DOC-01 documents the result either way.

**Warning signs:**
- Article works on aem.live but UE preview shows empty/old content.
- 404 on aem.page for paths that work on aem.live.

**Severity:** MEDIUM (Wave 1 spike-and-document; defer fix to v2 if parity is broken).

## OQ Resolutions (what Wave 1 spike must answer)

| OQ | Question | What docs say | What spike must verify |
|----|----------|---------------|------------------------|
| OQ-1 | Does `*.aem.page` invoke json2html overlay the same way as `*.aem.live`? | Not authoritatively answered. CFO docs describe publish-time ingest via Admin API; no explicit preview-tier note. | Wave 1: author one test CF, hit overlay URL on both `.aem.page` and `.aem.live`, log responses, compare. If parity, proceed. If not, document gap, defer fix to CFO-V2-02. |
| OQ-2 | Mustache template location: `cf-templates/` in this repo vs separate worker-config record? | json2html docs: `template` config param is "a relative URL to a Mustache template file located under the same org/site/branch". I.e. **the worker fetches the template from the GitHub-backed repo at run time using the configured org/site/branch**. [CITED: aem.live/developer/json2html] | Wave 1: POST minimal config with `template: "/cf-templates/article.html"` to `https://json2html.adobeaem.workers.dev/config/<ORG>/<SITE>/<BRANCH>`; commit `cf-templates/article.html` to repo; trigger a CF publish; confirm the worker fetches and applies the template. Both halves work together. |
| OQ-5 | Raw shape of CF Overlay JSON from Author Assets API vs current Publish GraphQL response. `_publishUrl`/`_dynamicUrl` likely absent. | AEM Assets API docs: CF JSON has shape `{ properties: { "cq:model", title, description, elements: { fieldName: { value } } } }`. No `_publishUrl` or `_dynamicUrl` — those are GraphQL-Publish-only convenience fields. [CITED: experienceleague.adobe.com/.../assets-api-content-fragments] | Wave 1: `curl` against `<author-host>/api/assets/sgedsdemo/articles/<test-article>.json` (with IMS auth); capture full response body; paste into DOC-01 `## Reference responses`; lock `assetUrl(repoPath)` to handle the actual fields present. |

**Key takeaway:** All three OQs reduce to ONE Wave 1 spike action — capture real responses on the running infrastructure, then write the helper code against the captured shape. The CONTEXT decisions (D-01..D-08) are designed to make this work irrespective of OQ outcomes.

## Code Examples

Verified patterns from this repo and Adobe-vendored sources.

### Reading page metadata
```javascript
// Source: scripts/aem.js (Adobe-vendored framework)
import { getMetadata } from '../../scripts/aem.js';

const cfRoot = getMetadata('cf-endpoint');
```

### Loading a fragment with null-safe handling
```javascript
// Source: blocks/header/header.js:114-115 (Phase 1 null-guard pattern)
import { loadFragment } from '../fragment/fragment.js';

const fragment = await loadFragment(path);
if (!fragment) return; // soft-fail
// ...use fragment...
```

### Sanitizing HTML with DOMPurify default profile
```javascript
// Source: scripts/editor-support.js:32-34 + scripts/dompurify.min.js (UMD 3.4.2)
import DOMPurify from '../../scripts/dompurify.min.js';

body.innerHTML = DOMPurify.sanitize(body.innerHTML);
```

### Preserving UE instrumentation across DOM rebuild
```javascript
// Source: blocks/cards/cards.js:9,19 + scripts/scripts.js:39-47
import { moveInstrumentation } from '../../scripts/scripts.js';

moveInstrumentation(srcElement, destElement);
// data-aue-* and data-richtext-* attrs now on dest; src lost them.
```

### Recoverable empty-state on error
```javascript
// Source: D-08 contract + soft-fail pattern from blocks/fragment/fragment.js:51
if (!fragment) {
  // eslint-disable-next-line no-console
  console.error('article-hero: missing CF', cfPath);
  block.replaceChildren(); // empties children, preserves block element + UE attrs
  return;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GraphQL persisted-query against Publish tier (`/graphql/execute.json/.../article-by-path`) | CFO + json2html worker — content authored in CFs, ingested at publish, served as `.plain.html` | This phase | No-Publish constraint compatible. No client-side GraphQL. Fewer round-trips per page (one `loadFragment` vs one fetch + JSON parse + render). |
| Block builds HTML via `innerHTML = template-literal` | Block consumes pre-rendered HTML from json2html, sanitizes body, swaps DOM | This phase | Closes existing XSS (CP-2). Server-side Mustache = no template engine on client. |
| Hand-rolled DOMPurify call inside `editor-support.js` for live patches only | Same pattern repeated in article blocks (D-04/D-05 reuse defaults) | This phase | One sanitize policy across the codebase. Easier audit. |
| Hardcoded `publish-p23458-e585661.adobeaemcloud.com` literal in block files | Author host via `scripts/config.js` `AEM_AUTHOR_HOST`; CFO endpoint via `getMetadata('cf-endpoint')` | Phase 1 (config.js) + Phase 2 (CFO endpoint) | Pre-commit grep guard prevents regression. |
| Block decoration that wipes UE `data-aue-*` via `innerHTML =` | `moveInstrumentation` + `replaceChildren(...nodes)` keeps UE click-to-edit working | This phase | UE re-decoration via `applyChanges` succeeds; no full page reload fallback. |

**Deprecated/outdated (DO NOT USE):**
- `at.js` (legacy Adobe Target client) — Out of Scope per REQUIREMENTS.md (Phase 4 uses `@adobe/alloy`).
- `body { opacity: 0 }` full-page pre-hide — Out of Scope per REQUIREMENTS.md (kills LCP).
- Hardcoded `publish-pXXXXX-eYYYYY.adobeaemcloud.com` URLs — pre-commit guard rejects these.

## Assumptions Log

> Claims tagged `[ASSUMED]` need user confirmation before becoming locked decisions. The Wave 1 spike (plans 02-01..02-03) is designed to convert all of these to verified facts.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `aem-content-fragment` UE field component is the right component name for `cfPath`-typed picker (vs generic `reference` with `valueType: string`). | Pattern 3 / D-06 | If wrong, the UE side panel won't open the CF picker correctly. Recoverable: change `component` value in `_*.json` partial. |
| A2 | The `cf-endpoint` meta tag value should be the DAM root prefix (`/content/dam/sgedsdemo`), not a full host URL. | Pattern 4 / CFO-08 | If wrong, the meta tag carries a different value; consumer call site is unchanged. |
| A3 | json2html worker fetches the Mustache template from the GitHub-backed repo by relative path (e.g., `/cf-templates/article.html`) configured at `/config/<org>/<site>/<branch>`. Confirmed by aem.live docs at high level; exact URL resolution against the configured repo is asserted but not yet spike-verified in this project. | Pattern §json2html / OQ-2 | If wrong, the template lives elsewhere (worker-config record) and `cf-templates/` in repo is dead code. Recoverable in Wave 1. |
| A4 | The Author CF JSON exposed by `/api/assets/.../{{id}}.json` has the `properties.elements.<fieldName>.value` shape (per Adobe Assets API docs). The actual field names — `title`, `body`, `image` — match the `article` CF model defined in D-07. | OQ-5 / `assetUrl` | If wrong, Wave 1 plan-02-03 captures the actual shape, locks `assetUrl()` and Mustache template against it. |
| A5 | The defensive `Content-Type` check in `fetchOverlay` is sufficient to detect CFO-1 (200 OK with HTML-of-wrong-page). Alternative: assert presence of a stable wrapper class emitted by the Mustache template. | Pattern 1 / Pitfall 1 | Recommended belt-and-suspenders: emit `<div class="article-cf">` in template, check both `Content-Type` and presence of marker. |
| A6 | `*.aem.page` (UE preview) invokes the json2html overlay the same way as `*.aem.live`. | OQ-1 | If wrong, UE preview shows broken/stale CF content. Documented in DOC-01; fix deferred to CFO-V2-02. |
| A7 | The Helix Admin API `public.json` endpoint shape is `https://admin.hlx.page/config/<org>/sites/<site>/public.json`. The exact `<org>` for this project is the GitHub owner of the deployed repo (consistent with Adobe docs convention). | json2html worker config | Wave 1 plan-02-01 confirms by running the actual curl and capturing the response. |
| A8 | A CF `image` field of type `image-ref` in the JSON resolves to a `_path` like `/content/dam/sgedsdemo/...` requiring an `assetUrl()` transform to a delivery URL. Browsers cannot directly load Author paths. | `assetUrl` helper | If wrong, image src paths render as-is (404 or 401). Recoverable: lock `assetUrl()` body in Wave 1. |
| A9 | The husky pre-commit hook regenerates `component-models.json` / `component-definition.json` / `component-filters.json` when `_article-hero.json` and `_article-teaser.json` are added/staged. (Confirmed by reading `.husky/pre-commit.mjs:16-22` and `package.json` build:json scripts.) | UE component-model wiring | Verified; not actually `[ASSUMED]` — but listed for the planner's awareness. |

**If this table is non-empty:** The locked decisions D-01..D-08 in CONTEXT.md are designed to be Wave-1-verifiable: D-01 plans 02-01..02-03 explicitly capture and document the answers to A1, A3, A4, A6, A7. A2 and A8 are confirmed as a side effect. A5 is a belt-and-suspenders recommendation the planner can add as a defensive check.

## Open Questions

1. **OQ-1: aem.page vs aem.live parity for json2html overlay**
   - What we know: CFO ingests at CF-publish time via Admin API. The CFO docs describe the publish-tier flow; no explicit preview-tier note found.
   - What's unclear: Whether preview ingestion happens automatically at CF preview-publish time, or only at full publish.
   - Recommendation: Wave 1 plan-02-03 spikes this with a real test CF. Document outcome in DOC-01. If preview is broken, defer fix to CFO-V2-02.

2. **OQ-2: Mustache template location**
   - What we know: aem.live json2html docs say `template` config param is "a relative URL to a Mustache template file located under the same org/site/branch" — i.e., the worker fetches from the repo at the configured `/config/<org>/<site>/<branch>`.
   - What's unclear: Whether the template is fetched fresh on every CF publish (cache-busted) or cached. Whether `templateApiKey` is needed if the site is anonymously readable.
   - Recommendation: Wave 1 plan-02-02 POSTs the config + commits the template, then triggers a CF publish, observes the worker behavior. `templateApiKey` likely needed only for site-auth'd repos. This project's repo is anonymous.

3. **OQ-5: CF JSON shape on Author**
   - What we know: AEM Assets API docs describe the CF JSON shape with `properties.elements.<fieldName>.value`.
   - What's unclear: The exact wire shape returned for the `body` rich-text field (HTML string vs structured nodes vs both), and whether the `image` field returns just `_path` or also `_publishUrl` / size variants.
   - Recommendation: Wave 1 plan-02-03 captures one full response with `curl`, pastes raw JSON into DOC-01, locks `assetUrl()` and Mustache template against the actual shape.

4. **UE `aem-content-fragment` vs `reference` component**
   - What we know: Both are documented. `aem-content-fragment` is the dedicated CF picker; `reference` is generic.
   - What's unclear: Which one renders correctly in the running AEMaaCS UE version for this project.
   - Recommendation: Wave 1 plan-02-01 (CF model verify-or-create) tries `aem-content-fragment` first; if UE rejects, falls back to `reference, valueType: string` and notes in DOC-01.

5. **`assetUrl()` body — exactly what transform is needed?**
   - What we know: AEM repo paths (`/content/dam/...`) are not directly browser-loadable on the EDS edge.
   - What's unclear: Whether EDS auto-rewrites DAM paths to delivery URLs, or whether a prefix transform is required.
   - Recommendation: Wave 1 plan-02-03 tests by inserting one `<img src="/content/dam/.../image.jpg">` into a CF body and observing whether the rendered page loads it. If yes, `assetUrl` is the identity function. If no, transforms via `paths.json` includes mapping or a `?width=` rendition path.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| AEMaaCS Author tier (`author-p23458-e585661.adobeaemcloud.com`) | CF authoring + Author Assets API | ✓ | n/a (cloud) | — |
| Helix Admin API (`admin.hlx.page`) | CFO config POSTs (D-02) | ✓ | n/a (cloud) | — |
| json2html worker (`json2html.adobeaem.workers.dev`) | HTML rendering (CFO-03) | ✓ | n/a (cloud) | — |
| GitHub-backed EDS deployment | Mustache template hosting | ✓ | n/a (this repo) | — |
| User's IMS / `$AEM_TOKEN` for Admin API auth | All Admin API POSTs | ✓ (provided per `autonomous: false` task contract D-02) | per session | — |
| `npm`, `node >= 18.3.x` | `npm run lint`, `npm run build:json` | ✓ (Phase 1 verified) | per `package.json` | — |
| `curl` (for human-run Admin API tasks) | D-02 documented commands | ✓ (standard on macOS/Linux dev machines) | per OS | — |
| Existing `article` CF model on AEM Author | D-07 verify-or-create human task | TBD | TBD | Plan 02-01 creates if missing. |
| At least one test CF authored under `/content/dam/sgedsdemo/articles/` | Wave 1 spike, Wave 3 smoke test | TBD (created during Wave 1) | — | Plan creates one as part of CFO-10 verification artifact. |

**Missing dependencies with no fallback:** None — the Wave 1 plans are designed to provision all infrastructure dependencies as part of the spike work.

**Missing dependencies with fallback:** None.

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high` per `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (server-to-server only) | Helix Admin API uses IMS-issued `x-auth-token`; never exposed to browser. Browser fetches anonymous public EDS URL. |
| V3 Session Management | no | No user sessions in this phase. |
| V4 Access Control | yes (CFO trust boundary) | CF Overlay routes are public-readable via aem.page/aem.live; document the trust boundary in DOC-01: "do not store secrets in CFs". |
| V5 Input Validation | yes | DOMPurify default profile on rich-text body (D-04/D-05). cfPath input validated to start with `DAM_PREFIX` in `fetchOverlay`. URL allowlist enforced by Adobe-hosted infrastructure. |
| V6 Cryptography | no | No new crypto introduced. DOMPurify is library code, not hand-rolled. |

### Known Threat Patterns for AEM EDS + CFO

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via stored CF body content (CP-2) | Tampering / Information Disclosure | DOMPurify default profile on body container post-`loadFragment` (D-04). Plain-text fields via `textContent` / `setAttribute`. URL allowlist on image `_path` (must start with `DAM_PREFIX`). |
| XSS via stored CF title (plain-text field) | Tampering | Mustache template uses `{{title}}` (auto-escaped) — never `{{{title}}}`. Confirmed in CONTEXT specifics. |
| Unpublished/draft CF leakage to anonymous visitors (CFO-2) | Information Disclosure | All CFO requests route through Helix proxy, never directly to Author host. Author tier never browser-reachable. Test in three contexts (signed-in author / anon aem.page / anon aem.live). |
| CFO path mismatch returning HTML body (CFO-1) | Tampering / Denial of Service (false-positive renders) | Defensive `Content-Type` check + stable wrapper class assertion in `fetchOverlay`. |
| Secrets committed to repo via Admin API curl docs | Information Disclosure | D-02 mandates `$AEM_TOKEN` placeholder in DOC-01; pre-commit grep guard rejects accidentally-committed tokens (could be extended in a future phase to scan for IMS token formats). |
| CSRF on Admin API (`autonomous: false` curl) | Tampering | Adobe-managed; tokens are short-lived IMS-issued, not session cookies. |
| CSP bypass via inline event handlers in CF body | Elevation of Privilege | DOMPurify default profile strips `on*=` handlers. CSP `'strict-dynamic'` does NOT cover inline event handlers — DOMPurify is the actual mitigation. |
| Hardcoded Publish-tier host regression | Tampering (architecture) | Pre-commit grep guard from Phase 1 rejects `publish-p23458-*` strings. |

**Severity bar (`block_on: high`):** Phase 2 must NOT ship with CP-2 unmitigated. D-04/D-05 closure is non-negotiable. CFO-1 defensive check is required. CFO-2 trust-boundary documentation in DOC-01 is required.

## Reusable Assets in This Codebase

Concrete files the planner can reference. All paths absolute from repo root.

| File / Path | Line(s) | Purpose | Phase 2 use |
|------|----|---------|-------------|
| `blocks/fragment/fragment.js` | 21–44 | `loadFragment(path)` — fetches `.plain.html`, runs `decorateMain` + `loadSections`, returns `<main>`. Already null-safe. | `fetchOverlay(cfPath)` delegates to it. **Do NOT modify.** |
| `blocks/fragment/_fragment.json` | 22–28 | UE component-model partial using `aem-content` field component. Reference shape for new `_article-hero.json` / `_article-teaser.json`. | Pattern source for D-06 model partials. |
| `blocks/cards/cards.js` | 1–23 | Existing block using `moveInstrumentation` to preserve UE attrs across DOM rebuild. | Reference for the `moveInstrumentation` call site in D-08 / Pattern 2. |
| `scripts/scripts.js` | 39–47 | `moveInstrumentation(from, to)` exported helper. | Imported by rewritten article blocks. |
| `scripts/scripts.js` | 79–86 | `decorateMain(main)` — runs `decorateButtons`/`decorateIcons`/`buildAutoBlocks`/`decorateSections`/`decorateBlocks`. | `loadFragment` already calls this; no Phase 2 invocation needed. |
| `scripts/aem.js` | (vendored) | `getMetadata`, `loadFragment` (no — that's in fragment.js), `decorateBlocks`, `loadBlock`, `sampleRUM`. | `getMetadata` consumed by CFO-08 pattern. **Read-only.** |
| `scripts/editor-support.js` | 32–34 | DOMPurify default-profile sanitize + DOMParser pattern. | Exact pattern reused in D-04/D-05. |
| `scripts/editor-support.js` | 16–98 | `applyChanges` — UE patch handler. Phase 1 null-guard at line 27. | Re-decoration of CFO blocks runs through here. **Read-only.** |
| `scripts/config.js` | 12, 15 | `AEM_AUTHOR_HOST`, `DAM_PREFIX`. | `cfPath` validation against `DAM_PREFIX` in `fetchOverlay`. |
| `scripts/dompurify.min.js` | header | DOMPurify 3.4.2 UMD vendored. Self-attaches to `window.DOMPurify`. Default-export is the named-import `DOMPurify`. | Imported by rewritten article blocks. |
| `blocks/article-hero/article-hero.js` | 1–34 | EXISTING — to be REWRITTEN in Wave 2. Hardcoded GraphQL endpoint (line 1, deleted by Phase 2 per Phase 1 D-03/D-04 carve-out). innerHTML XSS sink (line 23). | Reference for the existing pattern; rewrite replaces it entirely. |
| `blocks/article-teaser/article-teaser.js` | 1–29 | EXISTING — to be REWRITTEN in Wave 2. Same pattern as article-hero. | Same. |
| `blocks/article-hero/article-hero.css`, `blocks/article-teaser/article-teaser.css` | (full files) | Existing styles. May need selector adjustments for new fragment shape. | Claude's discretion (CONTEXT). |
| `head.html` | 1–9 | CSP + script tags + base stylesheet. | + `<meta name="cf-endpoint" content="...">` for CFO-08. |
| `fstab.yaml` | 3 | Author proxy mountpoint URL. | Source of truth for the Helix delivery URL. |
| `paths.json` | 2–8 | `/content/sgedsdemo/` ↔ `/` mapping; DAM includes. | Reference for overlay path translation in `assetUrl`. |
| `.husky/pre-commit.mjs` | 16–22 | Existing model-partials build step. | Auto-builds `component-*.json` from new `_article-*.json` partials. **Read-only.** |
| `.husky/pre-commit.mjs` | 41–80 | Phase 1 publish-host scanner. | Catches accidental `publish-*` regression. **Read-only.** |
| `.planning/research/PITFALLS.md` | CFO-1..CFO-4, CP-1..CP-3 | Severity-ranked pitfalls. | Source for §Common Pitfalls section above. |
| `.planning/codebase/CONCERNS.md` | XSS section, INTEGRATIONS section | Pre-existing tech debt + GraphQL endpoint usage. | Confirms what to delete in Wave 2. |
| `.planning/phases/01-setup-foundation/01-VERIFICATION.md` | full | Phase 1 deliverables verified. | Confirms `scripts/config.js`, DOMPurify 3.4.2, pre-commit guard, applyChanges null-guard are all live. |
| `models/_image.json`, `models/_button.json`, `models/_text.json` | full | Existing UE field component model patterns. | Reference for `_article-*.json` field declarations. |
| `blocks/hero/_hero.json` | 22–43 | Existing UE block model with mixed field types (reference, text, richtext). | Pattern source for the field shape. |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/02-content-fragment-overlay/02-CONTEXT.md` — locked decisions D-01..D-08 (this phase's contract).
- `.planning/phases/02-content-fragment-overlay/02-DISCUSSION-LOG.md` — Q&A behind the locked decisions.
- `.planning/REQUIREMENTS.md` — CFO-01..CFO-10, DOC-01 full text.
- `.planning/ROADMAP.md` Phase 2 section — goal, success criteria, OQ-1/OQ-2/OQ-5 definitions, key risks.
- `.planning/research/PITFALLS.md` — CP-1, CP-2, CP-3, CFO-1..CFO-4 severity-ranked pitfalls.
- `blocks/fragment/fragment.js`, `scripts/scripts.js`, `scripts/editor-support.js`, `scripts/config.js`, `scripts/dompurify.min.js`, `blocks/cards/cards.js`, `blocks/hero/_hero.json`, `blocks/fragment/_fragment.json`, `head.html`, `fstab.yaml`, `paths.json` — first-hand reads of canonical repo files.

### Secondary (MEDIUM confidence — Adobe official docs cited via WebSearch)
- [aem.live Content Fragment Overlay](https://www.aem.live/developer/content-fragment-overlay) — Admin API config flow, `source` + `overlay` shape, curl example.
- [aem.live JSON2HTML for Edge Delivery Services](https://www.aem.live/developer/json2html) — `/config/<org>/<site>/<branch>` POST shape, `template` + `useAEMMapping` + `relativeURLPrefix` + `templateApiKey` config params, Mustache rendering semantics.
- [aem.live Bring Your Own Markup](https://www.aem.live/developer/byom) — `source.type: "markup"` config example.
- [Adobe Experience League: Content Fragments Support in the AEM Assets HTTP API](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/assets/admin/assets-api-content-fragments) — CF JSON shape `{ properties: { "cq:model", title, elements: { fieldName: { value } } } }`.
- [Adobe Experience League: Universal Editor field types](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/field-types) — `aem-content-fragment` component, `reference` vs `aem-content-fragment` distinction.
- [aem.live Site Authentication](https://www.aem.live/docs/authentication-setup-site) — `templateApiKey` site-token mechanism.
- [aem.live Configuration Templates](https://www.aem.live/docs/configuration-templates) — Admin API config patterns.
- [aem.live Repoless / Authoring path mapping](https://www.aem.live/developer/authoring-path-mapping), [Repoless authoring](https://www.aem.live/developer/repoless-authoring) — `public.json` POST shape.

### Tertiary (LOW confidence — needs Wave 1 spike validation)
- Exact `assetUrl(repoPath)` body — must capture CF JSON in Wave 1 plan-02-03.
- `*.aem.page` vs `*.aem.live` overlay parity (OQ-1) — must spike in Wave 1.
- UE `aem-content-fragment` vs `reference` component for `cfPath` — must verify in running UE.
- `cf-endpoint` meta tag exact value convention — Adobe docs reference the convention but exact format must be confirmed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries (DOMPurify 3.4.2, json2html, Mustache) and patterns (loadFragment, moveInstrumentation, getMetadata) are existing, vendored, or Adobe-hosted.
- Architecture: HIGH on the publish-time + request-time flow; MEDIUM on aem.page vs aem.live parity (OQ-1, must spike).
- Pitfalls: HIGH — all carry-forward from `.planning/research/PITFALLS.md` which was authored against the same domain in 2026-05-06 research.
- UE component model: MEDIUM — Adobe documents both `aem-content-fragment` and `reference` field components; the right one for THIS AEMaaCS version must be confirmed in Wave 1 plan-02-01.
- CF JSON shape: MEDIUM — Assets API docs describe the high-level shape, but exact field representation (`body` rich-text as string vs structured) must be captured in Wave 1.

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (30 days — stable infrastructure, but verify aem.live docs haven't changed if work slips beyond this).

---

## RESEARCH COMPLETE
