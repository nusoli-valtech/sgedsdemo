# Roadmap: SG EDS Demo POC

**Created:** 2026-05-06
**Granularity:** coarse (5 phases)
**Build order (user-chosen, research-validated):** SETUP → CFO → Placeholders → Target → HTML Fragment API
**Total v1 requirements:** 44
**Coverage:** 44 / 44 (100%)

---

## Core Value Reminder

Every feature ships with a working implementation **and** a step-by-step `docs/<feature>.md` guide so future projects can reuse the patterns without rediscovery. Documentation is a deliverable, not an afterthought — every feature phase carries its own DOC requirement as a success criterion.

---

## Phases

- [x] **Phase 1: Setup & Foundation** — Pre-feature fixes that unblock every subsequent phase (UE patch crash, hostname coupling, no-Publish guard, DOMPurify upgrade) (completed 2026-05-07)
- [ ] **Phase 2: Content Fragment Overlay** — Replace broken Publish-GraphQL article blocks with the json2html overlay pipeline; close the inherited XSS in the same PR
- [ ] **Phase 3: Placeholders** — Generic `{{key}}` resolver runnable in any text block, sourced from a `/placeholders.json` spreadsheet, resolved before LCP and re-resolved after UE patches
- [ ] **Phase 4: Adobe Target Integration** — Two demo activities (banner text + page logo) wired across all three EDS phases via vendored alloy + aem-martech, gated on per-page metadata, with scoped pre-hide
- [ ] **Phase 5: HTML Fragment API** — Cross-origin `.plain.html` endpoint under `/api/fragments/*` configured via Admin API `headers.json`, consumable by an external web app on a different domain

---

## Phase Details

### Phase 1: Setup & Foundation
**Goal**: Repo is safe to build features on — UE patches stop swallowing on new blocks, hostnames are centralized, the no-Publish constraint is enforced by tooling, and DOMPurify is upgraded so it can be wired into the CFO PR.
**Depends on**: Nothing (first phase)
**Requirements**: SET-01, SET-02, SET-03, SET-04
**Success Criteria** (what must be TRUE):
  1. An author editing a block in Universal Editor can patch any block (including new ones added later) without `applyChanges` throwing on undefined `updates` and falling through to a full page reload that loses unsaved work.
  2. Every reference to the AEM Author host and the project codename (`sgedsdemo`, `--main--*--*`) flows through one config module — there are zero hardcoded `publish-p23458-*` strings anywhere in `blocks/` or `scripts/`.
  3. A pre-commit grep guard fails any commit that introduces a new `publish-p23458-*` reference, so the no-Publish constraint cannot regress.
  4. `scripts/dompurify.min.js` is the npm 3.4.2 build (header comment records version + source URL) and is import-ready for Phase 2 to wire into the CFO render path.
**Plans**: 4 plans
Plans:
- [x] 01-01-PLAN.md — Null-guard family: applyChanges + header/footer fragment guards (SET-01)
- [x] 01-02-PLAN.md — Central config module scripts/config.js (SET-02)
- [x] 01-03-PLAN.md — Pre-commit guard rejecting publish-host references (SET-03)
- [x] 01-04-PLAN.md — DOMPurify 3.4.2 vendored upgrade with provenance header (SET-04)
**Open questions to resolve here**: none — this phase is mechanical
**Key risks**: very low; all four items are surgical edits with carry-forward sources in `.planning/codebase/CONCERNS.md` (CF-EXISTING-3, CF-EXISTING-4)

### Phase 2: Content Fragment Overlay
**Goal**: Article content is authored as Content Fragments in Universal Editor, fetched from the **Author** tier (never Publish), rendered server-side via the json2html worker, and inserted into the page through `loadFragment` with all rich-text DOMPurify-sanitized — closing the existing XSS in the same PR as the migration.
**Depends on**: Phase 1 (UE null-guard must be in place; centralized hostname module is the source of truth for the Author endpoint; DOMPurify 3.4.2 is the version wired in here)
**Requirements**: CFO-01, CFO-02, CFO-03, CFO-04, CFO-05, CFO-06, CFO-07, CFO-08, CFO-09, CFO-10, DOC-01
**Success Criteria** (what must be TRUE):
  1. An author can create a Content Fragment in AEM Author, reference it from an `article-hero` or `article-teaser` block in Universal Editor, and the rendered page shows the CF content fetched from the Author tier with zero requests to any `publish-p23458-*` host.
  2. A CF whose `title` or `body` contains an XSS payload (e.g. `<img src=x onerror=alert(1)>`) renders as inert text or sanitized HTML — never executes — verified by an explicit smoke step in the docs.
  3. When a CF reference is missing, broken, or returns 404, the article block degrades to an empty container with a single `console.error` and the rest of the page renders normally.
  4. Editing a referenced CF in Universal Editor re-decorates the article block in place (UE instrumentation preserved via `moveInstrumentation`) without a full page reload.
  5. `docs/content-fragment-overlay.md` walks a new contributor through the full setup — Admin API curl commands (`public.json`, `content.json`, json2html `/config`), Mustache template authoring at `cf-templates/article.html`, UE component-model wiring, and the smoke-test page path — end to end.
**Plans**: 8 plans
Plans:
- [x] 02-01-cf-model-verify-create-PLAN.md — Wave 1: verify-or-create AEM `article` CF model + POST CFO Admin API config; capture responses (autonomous:false; CFO-01, CFO-02)
- [x] 02-02-json2html-config-PLAN.md — Wave 1: POST json2html worker `/config` registering `cf-templates/article.html` (autonomous:false; CFO-03)
- [ ] 02-03-cf-overlay-spike-helper-PLAN.md — Wave 1: capture CF JSON + `.plain.html` samples; write `scripts/cf-overlay.js` with locked `assetUrl`/`fetchOverlay` exports (autonomous:false; CFO-02, CFO-08)
- [ ] 02-04-mustache-template-PLAN.md — Wave 1: author `cf-templates/article.html` Mustache template (autonomous:true; CFO-03)
- [ ] 02-05-article-hero-rewrite-PLAN.md — Wave 2: rewrite `blocks/article-hero/article-hero.js` + add `_article-hero.json` (autonomous:true; CFO-04, CFO-05, CFO-06, CFO-07, CFO-09)
- [ ] 02-06-article-teaser-rewrite-PLAN.md — Wave 2: rewrite `blocks/article-teaser/article-teaser.js` + add `_article-teaser.json` + `head.html` cf-endpoint meta (autonomous:true; CFO-04, CFO-05, CFO-06, CFO-07, CFO-08, CFO-09)
- [ ] 02-07-doc-content-fragment-overlay-PLAN.md — Wave 3: author `docs/content-fragment-overlay.md` end-to-end (autonomous:true; CFO-10, DOC-01)
- [ ] 02-08-smoke-tests-PLAN.md — Wave 3: four smoke tests (zero publish-host requests, XSS inert, missing CF graceful, UE re-decoration in place) (autonomous:false; CFO-10)
**UI hint**: yes
**Open questions to resolve here**:
  - **OQ-1** — Does `*.aem.page` preview invoke the json2html overlay the same way as `*.aem.live`? Spike before locking implementation: log a raw response from both contexts and confirm parity.
  - **OQ-2** — Mustache template location: `cf-templates/` in this repo vs separate worker-config record? Spike before locking implementation: post a minimal template via `/config/<org>/<site>/<branch>` and confirm the worker resolves it from this repo.
  - **OQ-5** — Raw shape of CF Overlay JSON from Author Assets API vs current Publish GraphQL — `_publishUrl` / `_dynamicUrl` may be absent. Spike before locking implementation: capture one full response, compare to the GraphQL-era assumptions in `article-hero.js`, and write a single `assetUrl()` helper before the block rewrite.
**Key risks**: CFO-1 (overlay path mismatch yielding 200-OK-with-HTML-body), CP-2 (carrying forward XSS — non-negotiable mitigation in this PR), CP-3 (UE instrumentation lost on `innerHTML` rebuild)

### Phase 3: Placeholders
**Goal**: Authors declare global text variables (`{{brandName}}`, `{{currentYear}}`, etc.) once in a `/placeholders.json` spreadsheet, and a runtime walker resolves them inside any text content (and an attribute allowlist) before the LCP section paints — without flashing raw `{{token}}` syntax.
**Depends on**: Phase 2 (CFO blocks are decorated by the time the resolver runs, so placeholder tokens inside CF body content also resolve)
**Requirements**: PH-01, PH-02, PH-03, PH-04, PH-05, PH-06, PH-07, PH-08, DOC-02
**Success Criteria** (what must be TRUE):
  1. An author can add a row to `/placeholders.json` (Key + Text), publish, and see the new value resolved on every page that uses `{{key}}` — without any code change.
  2. A page using `{{brandName}}` inside a hero, a teaser, an `<img alt="">`, and a `<button title="">` renders all four with the resolved value before the LCP section paints — no flash of raw `{{...}}`, no CLS spike.
  3. An unknown token (`{{nonsense}}`) renders verbatim as `{{nonsense}}` and emits exactly one `console.warn` per missing key per page load — never blanks out content.
  4. Editing a block in Universal Editor leaves placeholder tokens visible as plain text in the editor pane while still resolving correctly in the rendered preview — and after `applyChanges`, the patched subtree is re-resolved without flicker.
  5. `docs/placeholders.md` walks a new contributor through spreadsheet authoring conventions, the walker's text-vs-attribute behavior, the missing-key fallback, the UE editing flow, and includes a verification page using at least three tokens across two block types.
**Plans**: TBD
**UI hint**: yes
**Open questions to resolve here**:
  - **OQ-6** — Placeholder spreadsheet path: `/placeholders` at site root vs locale-scoped (`/i18n/<locale>/placeholders`)? Spike before locking implementation: confirm the `fetchPlaceholders()` prefix arg shape and `helix-query.yaml` indexing path.
**Key risks**: PH-2 (LCP/CLS regression if the fetch isn't sequenced before the LCP section), PH-3 (XSS via sheet content — mitigated by `textContent`-only substitution and attribute allowlist), PH-5 (mangling UE `data-aue-*` attributes if the walker isn't filtered)

### Phase 4: Adobe Target Integration
**Goal**: Two demo activities — a banner text variation and a page logo variation — run live in the existing Target property, served via `@adobe/alloy` + the vendored `aem-martech` plugin, gated on `<meta name="target" content="on">`, with scoped pre-hide so LCP does not regress and the Target script disabled inside the Universal Editor iframe.
**Depends on**: Phase 3 (placeholder resolution must run before `martechEager` applies propositions, so a Target offer containing `{{brandName}}` resolves correctly) and Phase 2 (CFO must precede Target — activities must run against real article block DOM, not broken GraphQL stubs)
**Requirements**: TGT-01, TGT-02, TGT-03, TGT-04, TGT-05, TGT-06, TGT-07, TGT-08, TGT-09, TGT-10, DOC-03
**Success Criteria** (what must be TRUE):
  1. On a page tagged `<meta name="target" content="on">`, a visitor sees the banner text variation (Activity A) and the page logo variation (Activity B) applied before the LCP section paints — no flash of control content, no full-page `body { opacity: 0 }`.
  2. On a page **without** the `target` meta, no Target script loads, no AEP edge call fires, and LCP matches the pre-Target baseline — verified by network-tab inspection.
  3. Opening any page in the Universal Editor iframe shows control content only — Target is short-circuited via the `adobeaemcloud` hostname guard, so authors never see variants polluting the editor view.
  4. If the Target round-trip exceeds 1.5 s, the page renders default content and the activity is logged as timed-out — the page never blocks indefinitely on AEP.
  5. `docs/target-integration.md` walks a new contributor through the Target UI (activity creation, selector setup, audience targeting, domain allowlist for `*.aem.page` + `*.aem.live`), the AEP Datastream / orgId configuration, the CSP `connect-src` change for `*.adobedc.net` + `*.demdex.net`, and both demo activities end-to-end.
**Plans**: TBD
**UI hint**: yes
**Open questions to resolve here**:
  - **OQ-3** — Does the existing Target property already have a Datastream + WebSDK orgId, or does a new Datastream need to be created in AEP? Spike before locking implementation: open the Target property, check AEP for an existing Datastream tied to its orgId, and either reuse or create + document on day 1 of this phase.
**Key risks**: TGT-2 (LCP regression from alloy weight + round-trip — preload hints + 1.5s timeout are mandatory), TGT-1 (FOUC if pre-hide is wrong), TGT-4 (domain not allowlisted in the Target property → all activities 403)

### Phase 5: HTML Fragment API
**Goal**: An external web app on a different domain can `fetch()` a Content Fragment (or page slice) rendered as HTML from `https://main--sgedsdemo--<owner>.aem.live/api/fragments/<slug>.plain.html`, with explicit-origin CORS configured via the Admin API `headers.json`, no Universal-Editor instrumentation leaking into the response, and a documented consumer-side embed pattern using DOMPurify.
**Depends on**: Phase 4 in the linear plan (user's chosen order). **Strict dependency:** Phase 2 only (CFO establishes the json2html template pattern reused here, and DOMPurify discipline proven in CFO carries to consumer-side guidance). **Parallelization opportunity:** because this phase is mostly Admin-API-config-only with zero new runtime code, it can run in parallel with Phases 2-3 if a second contributor has bandwidth. Documented here; ordered last in the linear plan per the user's choice.
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07, DOC-04, DOC-05
**Success Criteria** (what must be TRUE):
  1. An external consumer page on `https://external-app.example.com` can `fetch('https://main--sgedsdemo--<owner>.aem.live/api/fragments/<slug>.plain.html')`, receive a 200 response with `Access-Control-Allow-Origin` matching its origin (never `*`) and `Vary: Origin`, and inject the HTML — successful end-to-end embed across origins.
  2. A request from a non-allowlisted origin receives a CORS-blocked response (no `Access-Control-Allow-Origin` header for that origin) and the consumer's `fetch` rejects — the allowlist is enforced, not advisory.
  3. The HTML returned to the consumer contains the stable wrapper `<div class="sgeds-fragment" data-fragment-id="...">` and contains zero `data-aue-*` / `data-richtext-*` Universal-Editor attributes — consumers' DOM stays clean and CF paths are not leaked.
  4. The sample external consumer page in `docs/` demonstrates the fetch-sanitize-mount pattern with DOMPurify on the consumer side and a graceful 4xx error fallback — copyable end-to-end snippet that runs against the live POC.
  5. `docs/html-fragment-api.md` walks a new contributor through content authoring under `/api/fragments/` in UE, the CORS Admin API `headers.json` POST shape, the consumer embed snippet, and the deferred-auth note. `docs/README.md` indexes all four feature guides with the no-Publish constraint flagged at the top of every guide.
**Plans**: TBD
**Open questions to resolve here**:
  - **OQ-4** — Exact `headers.json` Admin API payload shape for CORS. Spike before locking implementation: validate against `aem.live/docs/custom-headers` (the CORS payload was inferred from the `public.json`/`content.json` pattern); confirm `Access-Control-Allow-Origin`, `Vary: Origin`, `Access-Control-Allow-Methods`, and OPTIONS preflight behavior before committing the curl scripts.
**Key risks**: API-2 (CORS too permissive or too strict — explicit allowlist is mandatory), API-1 (consumer-side XSS — defense-in-depth via consumer-side DOMPurify is documented, not optional), API-6 (UE attribute leakage — strip in Mustache template)

---

## Parallelization Note

Phase 5 (HTML Fragment API) is configuration-only — no new runtime JS code. **It can run in parallel with Phases 2-3** if a second contributor is available. The hard prerequisite is the `cf-templates/` Mustache pattern established in Phase 2; once that template exists, a second contributor can run the Admin API `headers.json` POST, author a sample fragment under `/api/fragments/`, and ship the consumer demo independently. In the linear plan we keep it as Phase 5 per the user's chosen order (CFO → PH → TGT → HTML API), but the dependency graph permits earlier execution.

---

## Progress Table

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Setup & Foundation | 4/4 | Complete    | 2026-05-07 |
| 2. Content Fragment Overlay | 2/8 | In Progress|  |
| 3. Placeholders | 0/0 | Not started | - |
| 4. Adobe Target Integration | 0/0 | Not started | - |
| 5. HTML Fragment API | 0/0 | Not started | - |

---

## Coverage Audit

| Category | Requirements | Mapped to Phase |
|----------|--------------|-----------------|
| SETUP (4) | SET-01, SET-02, SET-03, SET-04 | Phase 1 |
| CFO (10) | CFO-01..CFO-10 | Phase 2 |
| PH (8) | PH-01..PH-08 | Phase 3 |
| TGT (10) | TGT-01..TGT-10 | Phase 4 |
| API (7) | API-01..API-07 | Phase 5 |
| DOC (5) | DOC-01 → P2, DOC-02 → P3, DOC-03 → P4, DOC-04 → P5, DOC-05 → P5 | Distributed (DOC owned by feature phase) |

**Total v1 requirements:** 44
**Mapped:** 44
**Orphaned:** 0
**Coverage:** 100%

---

*Roadmap created: 2026-05-06*
