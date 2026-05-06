# Technology Stack — POC Capabilities (AEM EDS, Author + Universal Editor, no Publish)

**Project:** SG EDS Demo — AEM Edge Delivery POC
**Researched:** 2026-05-06
**Scope:** 4 active POC capabilities (Content Fragment Overlay, Placeholders, Adobe Target, HTML Fragment API)
**Confidence:** HIGH (all recommendations sourced from current aem.live developer docs)

---

## Overview

The existing repo is `@adobe/aem-boilerplate` v1.3.0 + Crosswalk (XWalk) authoring with Universal Editor on AEMaaCS. The four POC capabilities all run on top of that scaffold without changing the no-bundler / vanilla-ESM contract. Every recommendation below assumes:

- Content lives at `https://author-p23458-e585661.adobeaemcloud.com` and is reached via the existing `fstab.yaml` proxy.
- The Publish tier (`publish-p23458-e585661.adobeaemcloud.com`) is **not used** — the existing GraphQL calls in `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js` must be replaced.
- Edits are authored in Universal Editor; component models (`models/_*.json`) are merged into `component-definition.json` / `component-models.json` / `component-filters.json` by `merge-json-cli` via the existing pre-commit hook.
- The existing CSP (`head.html`) and DOMPurify vendor (`scripts/dompurify.min.js`) are reused.

The four capabilities use **server-side overlay** (CFO + json2html), **client-side spreadsheet fetch** (placeholders), **client-side Web SDK** (Target), and **the same json2html overlay applied to a CORS-allowlisted route** (HTML Fragment API). No new build chain. No new framework.

---

## Recommended Stack

### Capability 1 — Content Fragment Overlay (replaces broken Publish GraphQL)

**Approach:** Configure the AEM Admin API + the hosted `json2html` Cloudflare Worker to overlay JSON-format Content Fragments from the AEM **Author** instance onto Edge Delivery Services as semantic HTML pages. No GraphQL, no Publish tier required.

| Component | Choice | Version / pin | Source |
|-----------|--------|---------------|--------|
| Overlay engine | `json2html` hosted worker | `https://json2html.adobeaem.workers.dev/{org}/{site}/{branch}` (single-tenant URL pattern; service is Adobe-hosted and versionless) | `https://www.aem.live/developer/json2html` |
| Templating language | Mustache.js (logic-less) — runs inside the worker | Reference syntax `mustache` 4.2.0 (npm) — only used as syntax reference; the worker bundles its own dependency-free Mustache | aem.live `json2html` doc |
| Templates location | New repo dir `cf-templates/` (e.g. `/cf-templates/article.html`) committed to this repo | n/a — plain `.html` files | aem.live CFO doc |
| Admin API config | `https://admin.hlx.page/config/{org}/sites/{site}/public.json` (path mappings + `xwalk.content-fragment-overlay`) and `…/content.json` (overlay URL) | n/a (HTTPS REST) | aem.live CFO doc |
| CF JSON source | AEM Author Assets API — `https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/<path>/{{id}}.json` | AEMaaCS 2024.8+ (already required) | aem.live CFO doc |
| Existing config files to update | `paths.json` (already maps `/content/dam/sgedsdemo/`); add CFO mapping centrally via Admin API, **not** in `fstab.yaml` | n/a | aem.live CFO doc |
| HTML sanitization | Not needed at runtime — worker emits server-rendered semantic HTML; the page is then a normal EDS page using the existing `hero` / `columns` / etc. blocks. Client-side blocks no longer interpolate raw JSON. | DOMPurify (`scripts/dompurify.min.js`) stays for `editor-support.js` live-update path only | concerns audit + aem.live CFO doc |

**Three-step setup (verbatim from aem.live):**

1. POST to `https://admin.hlx.page/config/{org}/sites/{site}/public.json` with `paths.mappings`, `paths.includes`, and `xwalk.content-fragment-overlay.<dam-path-glob>.includes` listing the CF model `/conf/<project>/settings/dam/cfm/models/<model-name>`.
2. POST to `https://admin.hlx.page/config/{org}/sites/{site}/content.json` with `source.url` (the existing `fstab.yaml` URL) and `overlay.url` set to `https://json2html.adobeaem.workers.dev/{org}/{site}/{branch}`.
3. POST to `https://json2html.adobeaem.workers.dev/config/{org}/{site}/{branch}` with the per-path config: `path`, `endpoint` (`…/api/assets/.../{{id}}.json`), `regex` (`/[^/]+$/` to capture the slug), `template` (e.g. `/cf-templates/article.html`), `relativeURLPrefix` set to the **author** instance (since publish is unavailable: `https://author-p23458-e585661.adobeaemcloud.com`), and `forwardHeaders: ["Authorization"]` if the Author endpoint requires auth.

**Required Authorization header:** `token <admin-api-token>` from `https://admin.hlx.page/login` (Sidekick / IMS-issued admin token). Not committed; passed via curl in setup scripts only.

**Branch-awareness:** The same setup can be repeated against a feature branch (`{branch}` in the worker URL) so CFO changes can be tested in PR previews without disturbing main. Documented in aem.live FAQ.

**Why this stack (rationale):**
- Eliminates the broken `publish-p23458-...adobeaemcloud.com/graphql/execute.json/...` calls that cannot work without the Publish tier.
- Removes the need for per-CF-model browser blocks; the existing `hero`/`columns` blocks render the rendered HTML.
- Removes the XSS risk in `article-hero.js` / `article-teaser.js` because no JSON is interpolated client-side.
- Server-rendered HTML is LLM-/SEO-friendly (the explicit motivation in the aem.live CFO doc).
- `json2html` is Adobe-hosted; we don't operate a worker.

### Capability 2 — Generic Placeholders / Variables in any text block

**Approach:** Use the canonical `fetchPlaceholders` helper from the AEM block-collection. Authors maintain a `placeholders` spreadsheet at the project root (or per-locale folder). A small post-decoration walker scans rendered text/attribute nodes for `{{key}}` tokens and substitutes the camel-cased values.

| Component | Choice | Version / pin | Source |
|-----------|--------|---------------|--------|
| Helper | `fetchPlaceholders(prefix)` from `aem-block-collection` | Copy current source (Apache-2.0, ~50 lines) into `scripts/placeholders.js` | `https://raw.githubusercontent.com/adobe/aem-block-collection/main/scripts/placeholders.js` (verified 2026-05-06) |
| Author surface | Spreadsheet (Google Sheets or Excel) named `placeholders` published at `/placeholders.json` (root) — or `/<locale>/placeholders.json` if scoped | Auto-published by Edge Delivery `helix-query.yaml` | aem.live `Using Placeholders` doc + Spreadsheets doc |
| Sheet schema | Two columns: `Key`, `Text` (the helper reads `data[].Key` / `data[].Text`) | Required by helper | source code of `placeholders.js` |
| Key normalization | `Key` → camelCased (`brand name` → `brandName`, `current-year` → `currentYear`) via `toCamelCase` already in `scripts/aem.js` | n/a | source code |
| Token syntax in content | `{{brandName}}`, `{{currentYear}}` — chosen because authors already see this pattern in Mustache templates (capability 1 reuses the same braces) | Custom — agree on this in `docs/placeholders.md` | n/a |
| Resolution point | New `scripts/placeholders-resolve.js` invoked from `loadEager` (after `decorateMain`) and again in `loadLazy` to cover lazy sections; runs over text nodes in `<main>` and a chosen attribute allowlist (`alt`, `title`, `aria-label`) | n/a | aem.live + boilerplate three-phase loading |
| New file | `helix-query.yaml` entry to publish `/placeholders.json` (if not already covered by default) | YAML | aem.live Spreadsheets doc |

**Resolution snippet (for `docs/`):**
```js
import { fetchPlaceholders } from './placeholders.js';

const RE = /\{\{([a-zA-Z][\w-]*)\}\}/g;
export async function resolvePlaceholders(root = document.querySelector('main'), prefix = 'default') {
  const ph = await fetchPlaceholders(prefix);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node; while ((node = walker.nextNode())) {
    if (RE.test(node.nodeValue)) {
      node.nodeValue = node.nodeValue.replace(RE, (_, k) => (k in ph ? ph[k] : `{{${k}}}`));
    }
  }
  // attribute pass
  root.querySelectorAll('[alt], [title], [aria-label]').forEach((el) => {
    ['alt', 'title', 'aria-label'].forEach((a) => {
      const v = el.getAttribute(a);
      if (v && RE.test(v)) el.setAttribute(a, v.replace(RE, (_, k) => (k in ph ? ph[k] : `{{${k}}}`)));
    });
  });
}
```

**Why this stack (rationale):**
- `fetchPlaceholders` is the maintained, idiomatic helper; copying the current source pins us to a known-good version while preserving the no-bundler model (the helper has zero deps beyond `toCamelCase` from existing `aem.js`).
- Spreadsheet authoring matches what marketing already uses elsewhere in EDS; no new author UI.
- Token resolution after decoration means it works for **any** text block (the requirement) without touching block JS.
- Locale-prefixed sheets (`/en/placeholders.json`) are already supported by the helper, so the future multilingual project can reuse this with no code change.

### Capability 3 — Adobe Target with two demo activities

**Approach:** Adobe Experience Platform Web SDK (`alloy`) — the future-proof option per the aem.live Target doc. `at.js` is documented as legacy and explicitly second-choice.

| Component | Choice | Version / pin | Source |
|-----------|--------|---------------|--------|
| Client library | `@adobe/alloy` Web SDK (vendored as `scripts/alloy.js`) | **2.32.0** (npm `latest` as of 2026-05-06; verify on day of vendoring) | `https://registry.npmjs.org/@adobe/alloy/latest` + aem.live Target doc |
| How to vendor | Download minified standalone build from `@adobe/alloy` release; commit as `scripts/alloy.js` (no bundler in this repo) | Pin filename + record version in a header comment | aem.live convention (matches existing `scripts/dompurify.min.js`) |
| Loader file | New `scripts/target.js` exporting `initWebSDK` + `getAndApplyRenderDecisions` (verbatim from aem.live target doc) | n/a | aem.live Target doc |
| Wiring | `scripts/scripts.js` — call `initWebSDK('./alloy.js', { datastreamId, orgId })` above `loadEager`; gate on `if (getMetadata('target'))`; `await alloyLoadedPromise` before `loadSection(main.querySelector('.section'), waitForFirstImage)` | edits to existing `scripts/scripts.js` | aem.live Target doc |
| Required identifiers | `orgId` (Adobe IMS Org ID) + `datastreamId` (formerly `edgeConfigId`) — committed as **non-secret** literals in `scripts/target.js`; both are public per Web SDK security model | n/a | aem.live Target doc + Web SDK config doc |
| Activation switch | Page-level metadata `<meta name="target" content="on">` set per page from Universal Editor (page properties model) | Already supported by `getMetadata` in `scripts/aem.js` | aem.live Target doc |
| Network endpoint | `https://edge.adobedc.net/ee/v1/interact` (Web SDK Edge Network) — confirms instrumentation is correct | n/a | aem.live Target doc |
| Activity 1 — banner text variation | New `blocks/promo-banner/` block with stable `data-target="banner-text"` selector; Target VEC modifies the inner text | Authored in VEC | aem.live Target doc + VEC docs |
| Activity 2 — page logo variation | Header logo gets a stable `data-target="page-logo"` attribute on the `<img>` (edit `blocks/header/header.js`); Target VEC modifies the `src` | Authored in VEC | aem.live Target doc + VEC docs |
| CSP impact | `head.html` CSP must allow `https://*.adobedc.net` and `https://*.demdex.net` for `connect-src`; current CSP is `script-src 'nonce-aem' 'strict-dynamic'` so Web SDK loads via nonce — no `script-src` change required | edit `head.html` | aem.live Target doc + concerns audit |

**Why this stack (rationale):**
- aem.live explicitly recommends Web SDK / `alloy` over `at.js` and labels `at.js` "legacy."
- Web SDK is the same SDK used by all other Adobe Experience Cloud apps (Analytics, AEP), so a single instrumentation covers future asks.
- The Web SDK version of `applyPropositions` integrates with the EDS three-phase loading via the documented `MutationObserver` pattern, avoiding flicker (TBT 20-40 ms per aem.live measured baseline).
- `at.js` would require a domain-specific `*.tt.omtrdc.net` server domain and a separate optimized build (`atjs--wknd--hlxsites.hlx.live/scripts/at.fix.min.js`) that is "until publicly available" — i.e. not pinned, not officially distributed.

### Capability 4 — HTML Fragment API for external cross-origin consumer

**Approach:** Reuse the same `json2html` overlay from capability 1 to expose individual Content Fragments as standalone `.aem.live` HTML pages (or `.aem.page` previews) under a dedicated path prefix (e.g. `/api/fragments/`). Publish them through the same Admin API. Consumer fetches `https://main--sgedsdemo--{owner}.aem.live/api/fragments/<id>` (or fragment.plain.html for body-only).

| Component | Choice | Version / pin | Source |
|-----------|--------|---------------|--------|
| Endpoint | `https://main--sgedsdemo--{owner}.aem.live/api/fragments/<id>` (full HTML) and `…/<id>.plain.html` (body slice via existing EDS `.plain.html` convention) | EDS-native | `blocks/fragment/fragment.js:25` + aem.live docs |
| Worker reuse | Same `json2html` config record as capability 1 with `path: "/api/fragments/"` and a leaner template `cf-templates/fragment-api.html` (no `<header>`/`<footer>`, just the main content) | n/a | aem.live `json2html` doc |
| CORS | Custom HTTP response headers — Admin API config `headers.json` at `https://admin.hlx.page/config/{org}/sites/{site}/headers.json` setting `Access-Control-Allow-Origin` to a comma-separated allowlist for `path: /api/fragments/*` | EDS supports per-path custom response headers per aem.live "Custom Headers" doc | aem.live "Custom Headers" doc |
| Auth (POC) | None — public read with CORS allowlist (per `.planning/PROJECT.md` decision) | n/a | PROJECT.md key decision |
| Auth (production, deferred) | Documented next step: site-token (`hlx_*`) sent as `Authorization: token <token>` and validated at the EDS edge by enabling site authentication; or IMS service-token at a fronting worker | not implemented in POC | json2html doc (`templateApiKey`) + aem.live site-auth |
| Content negotiation | Two fixed shapes: full HTML page (default) and `<id>.plain.html` (body fragment) — consumers choose by URL suffix; identical to how the existing `blocks/fragment/fragment.js` consumes EDS fragments | EDS native | existing `blocks/fragment/fragment.js` |
| External web app integration sample | A 1-page static HTML demo in `docs/html-fragment-api/` showing `fetch('https://...aem.live/api/fragments/sample-1.plain.html').then(r=>r.text()).then(html=>document.querySelector('#mount').innerHTML=DOMPurify.sanitize(html))` | Use DOMPurify on consumer side, not in this repo | `scripts/dompurify.min.js` precedent |

**Why this stack (rationale):**
- Re-uses the worker from capability 1; one mental model for the team.
- EDS already handles caching, CDN, and TLS for `*.aem.live`; no new infrastructure.
- `.plain.html` is a first-class EDS convention (it's how this repo's own fragment block works), so external consumers get a clean body slice without us writing a parser.
- The aem.live "Custom Headers" doc is the official path for `Access-Control-Allow-Origin` — using it means CORS is configured at the EDS edge, not in application code.
- Deferring auth to the real project is explicit in `PROJECT.md`; the chosen pattern (`templateApiKey`, site-token) has a documented upgrade path.

---

## Versions Summary (all verified 2026-05-06)

| Dependency | Version | Source | Pin location |
|------------|---------|--------|--------------|
| `@adobe/aem-boilerplate` (already in repo) | 1.3.0 | existing `package.json` | `package.json` |
| `@adobe/aem-cli` (dev only) | 16.19.1 (npm latest) | `https://registry.npmjs.org/@adobe/aem-cli/latest` | global install per `README.md` |
| `@adobe/alloy` (Web SDK for Target) | 2.32.0 (npm latest) | `https://registry.npmjs.org/@adobe/alloy/latest` | vendored as `scripts/alloy.js` with version comment |
| `dompurify` (already vendored) | 3.4.2 (npm latest) — current vendor file should be replaced from this version to close the EOL/CVE drift gap flagged in CONCERNS | `https://registry.npmjs.org/dompurify/latest` | `scripts/dompurify.min.js` (add header comment with version + source URL) |
| `mustache` (syntax reference for `cf-templates/`) | 4.2.0 | `https://registry.npmjs.org/mustache/latest` | not bundled — Mustache executes inside the json2html worker |
| `merge-json-cli` (already in repo) | 1.0.4 | existing `package.json` | `package.json` |
| Node.js (CI) | 24 | existing CI | `.github/workflows/main.yaml` |
| AEMaaCS release | ≥ 2024.8 (17465) for Universal Editor | `https://experienceleague.adobe.com/.../universal-editor/introduction` (Last update 2025-11-05) | environment requirement |

**Configuration files touched (all paths relative to repo root):**

| File | Change | Capability |
|------|--------|-----------|
| `cf-templates/article.html` (new) | Mustache template for article CFs | 1 |
| `cf-templates/fragment-api.html` (new) | Mustache template for HTML Fragment API | 4 |
| `scripts/placeholders.js` (new) | Copy of `fetchPlaceholders` helper | 2 |
| `scripts/placeholders-resolve.js` (new) | Token walker | 2 |
| `scripts/alloy.js` (new, vendored) | Web SDK build | 3 |
| `scripts/target.js` (new) | `initWebSDK` + render decisions | 3 |
| `scripts/scripts.js` (edit) | Wire Target gate, drop article-* GraphQL imports, call placeholder resolver | 1, 2, 3 |
| `head.html` (edit) | Extend CSP `connect-src` for `*.adobedc.net`, `*.demdex.net` | 3 |
| `helix-query.yaml` (verify/edit) | Ensure `/placeholders.json` and `/api/fragments/*` are indexed/served | 2, 4 |
| `paths.json` (verify) | Already includes `/content/dam/sgedsdemo/` — fine | 1, 4 |
| `fstab.yaml` (no change needed) | Existing author proxy is correct | 1, 4 |
| `blocks/article-hero/*`, `blocks/article-teaser/*` (delete or repurpose) | Replaced by CFO-rendered pages composed of existing `hero`/`columns` blocks | 1 |
| `blocks/header/header.js` (edit) | Add `data-target="page-logo"` to logo `<img>` | 3 |
| `blocks/promo-banner/*` (new) | Banner text block with `data-target="banner-text"` | 3 |
| `models/_promo-banner.json` (new) | UE component model partial | 3 |
| `docs/<feature>.md` (new × 4) | Step-by-step guides per active requirement in `PROJECT.md` | 1-4 |
| Admin API config (managed via curl, not in repo) | `public.json`, `content.json`, `headers.json`, `json2html /config/...` | 1, 4 |

---

## What NOT to Use (and why)

| Don't use | Why |
|-----------|-----|
| `https://publish-p23458-e585661.adobeaemcloud.com/graphql/execute.json/sgedsdemo/article-by-path` | Publish tier is unavailable in this AEM Cloud setup (PROJECT.md constraint). This is the existing broken path. |
| Any per-CF-model browser block that interpolates GraphQL JSON into `innerHTML` | XSS risk (CONCERNS audit, medium-high) and unnecessary once CFO renders semantic HTML server-side. |
| `at.js` (Target legacy) | aem.live Target doc explicitly labels this approach legacy. The "optimized version for AEM Edge Delivery" is hosted at `atjs--wknd--hlxsites.hlx.live/scripts/at.fix.min.js` "until it is made publicly available" — not a stable distribution. Web SDK is the recommended, future-proof choice. |
| Self-hosting `json2html` | The hosted Cloudflare Worker (`json2html.adobeaem.workers.dev`) is the reference deployment; running our own worker adds operational surface for no gain in the POC. |
| Adobe Launch / Tags container loader for Target | Web SDK can be loaded directly per aem.live (no Tags container needed). Adding Tags increases LCP cost without unlocking a POC requirement. |
| `at.js` 1.x (older line) | Even within at.js, only at.js 2.x is documented as compatible with Target propositions API. Moot — we're using Web SDK. |
| New i18n / translation framework for placeholders | Out of scope per PROJECT.md ("placeholders are for global text variables, not multilingual content"). The `fetchPlaceholders('en')` prefix support is enough if multilingual is needed later. |
| Bundler (webpack, esbuild, vite) | PROJECT.md explicitly forbids changing the no-bundler EDS contract. Vendor minified files like the existing `scripts/dompurify.min.js`. |
| Adobe IO Runtime / custom Cloudflare Worker for the HTML Fragment API | Reusing `json2html` + EDS edge avoids new infra. Custom worker is the production fallback if the POC outgrows hosted `json2html` (deferred per PROJECT.md). |
| Storing the Admin API token in the repo | Token (`token <admin-api-token>`) is provisioned via Sidekick / IMS; the curl scripts in `docs/` show the placeholder, never the value. |
| Mustache executed in the browser | The browser doesn't render Mustache — `json2html` does, server-side. Don't import a Mustache library client-side. |

---

## Confidence + Rationale

| Capability | Confidence | Rationale |
|-----------|-----------|-----------|
| 1. Content Fragment Overlay | **HIGH** | Stack is taken verbatim from `https://www.aem.live/developer/content-fragment-overlay` and `https://www.aem.live/developer/json2html`, both current Adobe-maintained pages with explicit examples for AEMaaCS Author + Edge Delivery. The "Author endpoint instead of Publish" point is supported by the `endpoint` example in the aem.live CFO doc which uses `author-pXXXX-eXXXX.adobeaemcloud.com/api/assets/...`. |
| 2. Placeholders | **HIGH** | `fetchPlaceholders` source verified directly from `adobe/aem-block-collection` HEAD. Helper has zero external deps beyond the `toCamelCase` already in `scripts/aem.js`. Token-walker pattern is custom but trivial DOM manipulation; no API surface to misuse. |
| 3. Adobe Target | **HIGH** | aem.live Target doc gives the exact `initWebSDK` / `getAndApplyRenderDecisions` snippets and clearly designates Web SDK as the recommended path. `@adobe/alloy` 2.32.0 verified live on npm. The two demo activities map cleanly to Web SDK's selector-based propositions. |
| 4. HTML Fragment API | **MEDIUM-HIGH** | High confidence in the rendering pipeline (capability 1 reuse). Medium confidence on the CORS configuration shape — aem.live "Custom Headers" doc was not fetched verbatim during this research; the `headers.json` Admin API endpoint name is inferred from the public/content.json pattern. **Phase note: validate the `Access-Control-Allow-Origin` configuration against the aem.live "Custom Headers" page during the implementation phase before committing the curl scripts.** |

---

## Sources

- `https://www.aem.live/developer/content-fragment-overlay` — fetched 2026-05-06 (HIGH; current; explicit code examples)
- `https://www.aem.live/developer/json2html` — fetched 2026-05-06 (HIGH; mentions branch-awareness, Mustache 4.x syntax, `forwardHeaders`, `templateApiKey`, `useAEMMapping`)
- `https://www.aem.live/developer/placeholders` — fetched 2026-05-06 (HIGH; canonical helper API, key normalization rules)
- `https://www.aem.live/developer/target-integration` — fetched 2026-05-06 (HIGH; explicit Web SDK vs at.js recommendation; full code snippets)
- `https://www.aem.live/docs/` — fetched 2026-05-06 (MEDIUM; index page; "Custom Headers" + "AEM as a Content Source" linked from here for follow-up validation)
- `https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/developing/universal-editor/introduction` — fetched 2026-05-06 (HIGH; UE supported architectures, AEMaaCS ≥ 2023.8.13099, last updated 2025-11-05)
- `https://raw.githubusercontent.com/adobe/aem-block-collection/main/scripts/placeholders.js` — fetched 2026-05-06 (HIGH; canonical helper source code)
- `https://registry.npmjs.org/@adobe/alloy/latest` → 2.32.0 (HIGH; npm registry, 2026-05-06)
- `https://registry.npmjs.org/dompurify/latest` → 3.4.2 (HIGH; npm registry, 2026-05-06)
- `https://registry.npmjs.org/@adobe/aem-cli/latest` → 16.19.1 (HIGH; npm registry, 2026-05-06)
- `https://registry.npmjs.org/mustache/latest` → 4.2.0 (HIGH; npm registry, 2026-05-06)
- `https://experienceleague.adobe.com/en/docs/target/using/target.html` — attempted 2026-05-06, returned **HTTP 404** (URL deprecated; current Target documentation lives under `/en/docs/target/using/introduction-to-adobe-target` per Experience League site map). aem.live Target doc was authoritative for our needs, so no further fetch was performed.

---

*STACK research: 2026-05-06*
