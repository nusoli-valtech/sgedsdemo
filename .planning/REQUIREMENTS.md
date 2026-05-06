# Requirements: SG EDS Demo POC

**Defined:** 2026-05-06
**Core Value:** Every feature ships with a working implementation _and_ a step-by-step guide in `docs/` so future projects can reuse the patterns without rediscovery.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases. IDs follow the `.planning/research/FEATURES.md` numbering for traceability.

### Setup (pre-Phase-1 fixes)

- [ ] **SET-01**: `editor-support.js:26` `applyChanges` null-guard so UE patches on new blocks don't crash silently when `updates` is undefined
- [ ] **SET-02**: Centralize the AEM Author host + project codename (`sgedsdemo`, `--main--*--*`) into a single config module so feature code doesn't hardcode publish/preview hostnames
- [ ] **SET-03**: Pre-commit grep guard rejecting any new reference to `publish-p23458-` to enforce the no-Publish constraint
- [ ] **SET-04**: Replace vendored `scripts/dompurify.min.js` with the npm 3.4.2 build, add a header comment with version + source URL, and confirm tree-shake-friendly export

### Content Fragment Overlay (CFO)

- [ ] **CFO-01**: Per-CF-model overlay configuration applied to AEM Author via the Admin API (`public.json` + `content.json` POSTs)
- [ ] **CFO-02**: Article CF JSON is fetched from the Author tier (`/api/assets/.../{{id}}.json`) — never from Publish
- [ ] **CFO-03**: HTML rendering goes through the Adobe-hosted `json2html.adobeaem.workers.dev` worker using a Mustache template committed at `cf-templates/article.html`
- [ ] **CFO-04**: `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js` are rewritten to use `loadFragment(cfPath)` — direct GraphQL calls deleted
- [ ] **CFO-05**: All rich-text body fields are sanitized with DOMPurify before insertion; plain-text fields use `textContent` / `setAttribute` — closes the existing XSS in the same PR as the migration
- [ ] **CFO-06**: Universal Editor component models (`blocks/article-*/_*.json`) updated with a Content-Fragment reference field (`type: reference`, `valueType: cfPath`) so editors can pick a CF in UE
- [ ] **CFO-07**: UE re-decoration plumbing (`scripts/editor-support.js`) preserves CFO blocks correctly across `applyChanges` patches via `moveInstrumentation`
- [ ] **CFO-08**: CF endpoint sourced from `getMetadata('cf-endpoint')` (or equivalent site-config) — no hardcoded host or persisted-query path
- [ ] **CFO-09**: Graceful empty-state when a CF reference is missing or fails (empty block + `console.error`, no page crash)
- [ ] **CFO-10**: Working article page authored end-to-end in Universal Editor on AEMaaCS that renders via the new pipeline (verification artifact)

### Placeholders

- [ ] **PH-01**: `/placeholders.json` spreadsheet (Key + Text columns) published via EDS at the site root and reachable through the Author proxy
- [ ] **PH-02**: `scripts/placeholders.js` helper (port of `fetchPlaceholders` from `adobe/aem-block-collection`) with module-scoped cache
- [ ] **PH-03**: `{{key}}` token syntax — only known keys are replaced; unknown tokens render verbatim and warn once per key
- [ ] **PH-04**: DOM TreeWalker resolver runs in the eager phase after `decorateMain` and before the LCP section paints — works in any block's text content (not block-specific)
- [ ] **PH-05**: Attribute substitution allowlist: `alt`, `title`, `aria-label`
- [ ] **PH-06**: Tokens remain editable as plain text in Universal Editor — replacement only happens at runtime
- [ ] **PH-07**: `editor-support.js` re-runs `resolvePlaceholders` after `applyChanges` so UE-edited content stays resolved
- [ ] **PH-08**: One demo page in the repo using at least three placeholder tokens across two block types (verification artifact)

### Adobe Target Integration

- [ ] **TGT-01**: `@adobe/alloy` 2.32.0 vendored as `scripts/alloy.js` (mirrors the existing `dompurify.min.js` vendoring pattern); `adobe-rnd/aem-martech` plugin vendored under `plugins/martech/`
- [ ] **TGT-02**: Martech wired across all three EDS phases: `martechEager` in `loadEager` (after `resolvePlaceholders`), `martechLazy` in `loadLazy`, `martechDelayed` in `scripts/delayed.js` (currently empty)
- [ ] **TGT-03**: Activation gated on `<meta name="target" content="on">` so non-targeted pages don't pay the cost
- [ ] **TGT-04**: Pre-hide is **scoped** to targeted regions only — no full-page `body { opacity: 0 }`; LCP must not regress
- [ ] **TGT-05**: Activity A — banner-text variation on a stable selector (e.g. `.dam-banner h1` or a new `.promo-banner h1`)
- [ ] **TGT-06**: Activity B — page-logo variation on a stable selector (`header .nav-brand img`); selector contract documented in the block's source
- [ ] **TGT-07**: `head.html` CSP `connect-src` extended with `*.adobedc.net` and `*.demdex.net`; Target property domain allowlist updated to include `*.aem.page` + `*.aem.live`
- [ ] **TGT-08**: Target script disabled inside the Universal Editor iframe (`window.location.hostname.includes('adobeaemcloud')` guard)
- [ ] **TGT-09**: 1.5 s hard timeout on Target round-trip; render with default content if exceeded
- [ ] **TGT-10**: Both activities running live in the existing Target property, observable end-to-end (verification artifact)

### HTML Fragment API

- [ ] **API-01**: External-facing endpoint at `/api/fragments/<slug>.plain.html` using EDS-native `.plain.html` rendering (zero new runtime code)
- [ ] **API-02**: Path convention documented — content authored under a dedicated `/api/fragments/` tree in the AEM Author so URLs are stable
- [ ] **API-03**: CORS allowlist configured via Admin API `headers.json` POST — explicit origin list, never `*`; includes `Access-Control-Allow-Origin`, `Vary: Origin`, `Access-Control-Allow-Methods: GET`, `OPTIONS` preflight handling
- [ ] **API-04**: Stable wrapper markup `<div class="sgeds-fragment" data-fragment-id="...">` produced by the Mustache template so consumers can target it
- [ ] **API-05**: Universal-Editor-only attributes (`data-aue-*`, `data-richtext-*`) stripped from the API response so consumer DOM stays clean
- [ ] **API-06**: Sample external consumer page in `docs/` showing the embed pattern with DOMPurify on the consumer side and a 4xx error fallback
- [ ] **API-07**: One end-to-end fragment authored in UE and successfully rendered into the consumer page from a different origin (verification artifact)

### Documentation

- [ ] **DOC-01**: `docs/content-fragment-overlay.md` — step-by-step including AEM Admin API curl commands, Mustache template authoring, UE component-model wiring, smoke-test page path
- [ ] **DOC-02**: `docs/placeholders.md` — step-by-step including spreadsheet authoring conventions, walker behavior, attribute allowlist, missing-key handling, UE editing flow
- [ ] **DOC-03**: `docs/target-integration.md` — step-by-step including Target UI walkthrough (activity creation, selector setup, audience targeting, domain allowlist), AEP Datastream / orgId configuration, CSP changes, both demo activities
- [ ] **DOC-04**: `docs/html-fragment-api.md` — step-by-step including content-authoring flow in UE, CORS Admin API setup, consumer embed snippet, security notes (DOMPurify on consumer side, what _not_ to expose)
- [ ] **DOC-05**: `docs/README.md` index linking each guide and noting the global no-Publish constraint at the top of every page

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### CFO

- **CFO-V2-01**: CF model variants (e.g. `article-light`, `article-dark`) sharing a single Mustache template with conditional sections
- **CFO-V2-02**: Live-preview parity between `aem.page` (UE preview) and `aem.live` for CFO content
- **CFO-V2-03**: Multi-locale CF reference resolution

### Placeholders

- **PH-V2-01**: Locale-scoped placeholder spreadsheets (`/i18n/<locale>/placeholders.json`)
- **PH-V2-02**: Nested token resolution (placeholders that reference other placeholders)
- **PH-V2-03**: Build-time resolution mode for static fragments

### Target

- **TGT-V2-01**: Cross-capability demo: Target proposition that overrides a placeholder value site-wide
- **TGT-V2-02**: A/B/n activities and Auto-Allocate
- **TGT-V2-03**: Personalization based on Adobe Audience Manager segments
- **TGT-V2-04**: Server-side rendering hints (Edge personalization)

### HTML Fragment API

- **API-V2-01**: Per-consumer API key with the Admin API token mechanism
- **API-V2-02**: Adobe IMS / OAuth-secured endpoint for enterprise consumers
- **API-V2-03**: GraphQL-style flexible queries on top of the same content
- **API-V2-04**: Rate limiting and per-origin quotas

### Cross-cutting

- **X-V2-01**: Test framework adoption (Vitest or Playwright) covering blocks, scripts, and the four POC features
- **X-V2-02**: Migrate ESLint 8 (EOL) to ESLint 9 + flat config; resolve `eslint-config-airbnb-base` 15 / `eslint-plugin-xwalk` GitHub-direct dependency
- **X-V2-03**: Performance budget enforcement on Lighthouse CI (LCP, CLS, TBT) for the POC pages

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AEM Publish tier features | EDS deployment doesn't include Publish; constraint is foundational, not a deferral |
| Production hardening of HTML Fragment API auth (full IMS, multi-tenant key rotation) | POC is public-read + CORS allowlist; production auth is a known-solution deferred to the real project |
| Replacing the existing block library or build chain | Vanilla-JS / no-bundler EDS conventions stay; experiments adapt to them, not the other way around |
| Backfilling documentation for pre-existing blocks | `docs/` only covers the four POC features |
| Generic CMS i18n / translation tooling | Placeholders are for global text variables, not multilingual content |
| Real-time / push delivery for HTML Fragment API | Pull-only via HTTP; pub/sub deferred |
| Adobe Analytics / Customer Journey Analytics integration | Out of POC scope; Target observability via Target's own reporting only |
| `at.js` (legacy Target client) | aem.live recommends Web SDK / alloy; using `at.js` would diverge from Adobe guidance |
| Full-page `body { opacity: 0 }` flicker hide for Target | Kills LCP; scoped pre-hide is the pattern instead |
| Server-side worker beyond `json2html` | Stay within the documented EDS no-Publish stack — no custom Helix functions or proxies |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SET-01 | TBD | Pending |
| SET-02 | TBD | Pending |
| SET-03 | TBD | Pending |
| SET-04 | TBD | Pending |
| CFO-01 | TBD | Pending |
| CFO-02 | TBD | Pending |
| CFO-03 | TBD | Pending |
| CFO-04 | TBD | Pending |
| CFO-05 | TBD | Pending |
| CFO-06 | TBD | Pending |
| CFO-07 | TBD | Pending |
| CFO-08 | TBD | Pending |
| CFO-09 | TBD | Pending |
| CFO-10 | TBD | Pending |
| PH-01 | TBD | Pending |
| PH-02 | TBD | Pending |
| PH-03 | TBD | Pending |
| PH-04 | TBD | Pending |
| PH-05 | TBD | Pending |
| PH-06 | TBD | Pending |
| PH-07 | TBD | Pending |
| PH-08 | TBD | Pending |
| TGT-01 | TBD | Pending |
| TGT-02 | TBD | Pending |
| TGT-03 | TBD | Pending |
| TGT-04 | TBD | Pending |
| TGT-05 | TBD | Pending |
| TGT-06 | TBD | Pending |
| TGT-07 | TBD | Pending |
| TGT-08 | TBD | Pending |
| TGT-09 | TBD | Pending |
| TGT-10 | TBD | Pending |
| API-01 | TBD | Pending |
| API-02 | TBD | Pending |
| API-03 | TBD | Pending |
| API-04 | TBD | Pending |
| API-05 | TBD | Pending |
| API-06 | TBD | Pending |
| API-07 | TBD | Pending |
| DOC-01 | TBD | Pending |
| DOC-02 | TBD | Pending |
| DOC-03 | TBD | Pending |
| DOC-04 | TBD | Pending |
| DOC-05 | TBD | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 0 (filled in by roadmap)
- Unmapped: 44 ⚠️ (resolved by roadmap creation)

---
*Requirements defined: 2026-05-06*
*Last updated: 2026-05-06 after initial definition*
