# Phase 2: Content Fragment Overlay - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Anchor doc when options conflict:** Adobe aem.live official docs (https://www.aem.live/developer/*)

<domain>
## Phase Boundary

Replace the Publish-tier GraphQL fetch in `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js` with an Author-tier Content Fragment Overlay pipeline:

1. CF JSON is fetched from the AEM Author tier via the Helix delivery proxy (`fstab.yaml` mountpoint) — never from a `publish-*adobeaemcloud.com` host.
2. HTML rendering goes through the Adobe-hosted `json2html.adobeaem.workers.dev` worker using a Mustache template committed at `cf-templates/article.html`.
3. The rendered HTML is inserted into the page via `loadFragment(cfPath)` (the same primitive `blocks/header` and `blocks/footer` already use).
4. Rich-text body is DOMPurify-sanitized before insertion — closing the existing innerHTML XSS in the same PR as the migration (CP-2 from PITFALLS).
5. Universal Editor instrumentation is preserved across re-renders via `moveInstrumentation` (CP-3).
6. CF endpoint is sourced from `getMetadata('cf-endpoint')` — no hardcoded host or persisted-query path (CFO-08).
7. `docs/content-fragment-overlay.md` ships in the same PR with a full end-to-end walkthrough (DOC-01).

Boundaries: this phase only rewrites the two existing article blocks. New CF model variants, multi-locale resolution, and `aem.page`/`aem.live` live-preview parity are explicitly v2 (CFO-V2-01..03). New capabilities (placeholders, Target, HTML Fragment API) belong to Phases 3-5.

</domain>

<decisions>
## Implementation Decisions

### Spike sequencing & wave structure

- **D-01 (Wave structure):** Phase 2 ships in 3 waves.
  - **Wave 1 (parallel — spike + scaffolding):**
    - plan-02-01: Verify-or-create the AEM `article` CF model (autonomous: false human task) + POST CFO Admin API config (`public.json` + `content.json`) for the model.
    - plan-02-02: POST stub Mustache template via json2html `/config`; commit `cf-templates/article.html`.
    - plan-02-03: Capture raw CF Overlay JSON via curl, write `scripts/cf-overlay.js` with locked `assetUrl(repoPath)` + `fetchOverlay(cfPath)` signatures.
  - **Wave 2 (block rewrites — depends on Wave 1):**
    - plan-02-04: Rewrite `blocks/article-hero/article-hero.js` against locked `scripts/cf-overlay.js` contract; add `_article-hero.json` model.
    - plan-02-05: Rewrite `blocks/article-teaser/article-teaser.js` symmetrically; add `_article-teaser.json` model.
    - plan-02-06: Wire `getMetadata('cf-endpoint')` consumer (CFO-08); no hardcoded host in either block.
  - **Wave 3 (docs + verification):**
    - plan-02-07: Author `docs/content-fragment-overlay.md` end-to-end (CFO-10, DOC-01).
    - plan-02-08: Smoke-test page + XSS verification step (Success Criterion #2).

- **D-02 (Admin API auth):** All Wave 1 Admin API POSTs (CF model verify-or-create, `public.json`, `content.json`, json2html `/config`) run as `autonomous: false` human tasks. Plans ship the exact `curl` commands with `$AEM_TOKEN` placeholders; the human runs them once with their own AEM Author session/IMS token and pastes responses for capture. No secrets in the repo. The same curl flow ends up in DOC-01 verbatim so future contributors reproduce setup unaided.

- **D-03 (Spike artifact layout):**
  - `scripts/cf-overlay.js` — new module with named exports `assetUrl(repoPath)` and `fetchOverlay(cfPath)`. The two helpers Phase 2 blocks consume.
  - `cf-templates/article.html` — Mustache template (CFO-03).
  - Captured CF JSON + Admin API responses are pasted directly into `docs/content-fragment-overlay.md` under a `## Reference responses` section. **No transient SPIKE-LOG.md** — spike findings stay where future contributors will read them.
  - `cf-overlay.js` is a NEW module, NOT an extension of `scripts/config.js`. Phase 1 D-02 explicitly forbids pre-designing future surfaces in `config.js`; CFO helpers are a Phase 2 surface.

### DOMPurify wiring (CP-2 closure)

- **D-04 (Wiring point):** Per-block, post-`loadFragment`, on the rich-text body container only. Inside `decorate()` of `article-hero.js` and `article-teaser.js`: after `fetchOverlay()` returns the rendered fragment, locate the body element (e.g., `fragment.querySelector('.body')`) and run `DOMPurify.sanitize(body.innerHTML)` before insertion. Plain-text fields (title, alt, image src) use `textContent` / `setAttribute`, never innerHTML. **Do not** modify `blocks/fragment/fragment.js` to sanitize fragment-wide — that risks stripping `data-aue-*` instrumentation and double-sanitizes nav/footer fragments unnecessarily.

- **D-05 (DOMPurify config):** `DOMPurify.sanitize(html)` with default profile — strips `<script>`, `on*=` handlers, `javascript:` URLs, `<iframe>`, `<object>`. Allows `<p>`, `<strong>`, `<em>`, `<a href>`, `<ul>`, `<ol>`, `<li>`, `<h1>`-`<h6>`, `<img>`, `<br>`. Matches the existing usage in `scripts/editor-support.js:32-34`. No custom `ALLOWED_TAGS` list — over-fitting risks dropping tags author rich-text editors emit.

### UE component model surface (CFO-06)

- **D-06 (Model fields):** Each block's `_<block>.json` exposes ONE field: `cfReference` of `component: reference, valueType: cfPath, required: true`. The CF itself owns title, body, and image — zero per-instance overrides. Per-instance variation is handled by creating new CFs. Display variants (`hero-large`, `teaser-compact`, etc.) are explicitly deferred to v2 (CFO-V2-01).

- **D-07 (CF model verify-or-create):** Wave 1 plan-02-01 includes a `autonomous: false` human task: "In AEM Author Tools → Configuration Browser → Content Fragment Models, confirm an `article` model exists with fields {`title: text`, `body: rich-text`, `image: image-ref`}. If missing, create it. Paste the model JSON export into `docs/content-fragment-overlay.md` under `## CF model`." Idempotent — re-running just verifies. Covers both already-there and fresh-checkout cases.

### Empty / error state (CFO-09)

- **D-08 (Recoverable empty container):** When `fetchOverlay()` returns null or throws (404, 401/403, HTML-body-instead-of-JSON per CFO-1, missing fields per CFO-3 schema drift, network error — all errors treated equally for POC), the block:
  - Logs `console.error('article-{hero,teaser}: missing CF', cfPath)` — single line, prefixed with the block name.
  - Calls `block.replaceChildren()` to empty children, but leaves the block element (and its `data-aue-*` instrumentation) in the DOM.
  - On the published page: invisible (matches goal's "empty container").
  - In Universal Editor: the block is still clickable; the `cfReference` field is still editable in the UE side panel; re-saving with a valid CF triggers `applyChanges` → re-renders in place.
  - Does NOT add an inline UE-only debug message (deferred — add later if authors hit broken refs and find the silence confusing).

### Carry-forward locks (from Phase 1 — do not re-design)

- Author host comes from `AEM_AUTHOR_HOST` exported by `scripts/config.js` (Phase 1 D-01).
- DOMPurify import path is `../../scripts/dompurify.min.js` (UMD, version 3.4.2, Phase 1 D-07/D-09 verified import-friendly).
- Pre-commit guard rejects new `publish-*adobeaemcloud.com` references; Phase 2 deletes the two existing literals at `blocks/article-hero/article-hero.js:1` and `blocks/article-teaser/article-teaser.js:1` (Phase 1 D-03/D-04).
- `editor-support.js` `applyChanges` null-guard is live; no further change needed there for re-render to succeed (Phase 1 D-10).
- Soft-fail pattern: log + return on missing data; never throw to the surface (Phase 1 D-11, repeated above as D-08).
- Vanilla ESM, no bundler, mandatory `.js` import extensions, ESLint airbnb-base.

### Claude's Discretion

- Exact internal helper names inside `scripts/cf-overlay.js` beyond the two locked exports (`assetUrl`, `fetchOverlay`).
- Mustache template specifics inside `cf-templates/article.html` (variable names, conditional sections) as long as they match the captured CF JSON shape from D-03's spike.
- Whether `_article-hero.json` and `_article-teaser.json` share a model partial under `models/_article.json` or stay co-located in their block dirs (planner-time call; existing repo pattern is co-located).
- Smoke-test page path under `/test-cfo` or similar (CFO-10 verification artifact). Path can be picked at Wave 3.
- Whether `fetchOverlay` returns a `<main>` element (matches `loadFragment` return shape) or a fragment of children (planner-time call).
- Per-block CSS adjustments needed for the new fragment shape (out of CONTEXT scope; planner sees existing `.css` files and decides).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — core value (every feature ships with docs), constraints (no Publish tier, no bundler, vanilla ES modules), key decisions.
- `.planning/REQUIREMENTS.md` §`Content Fragment Overlay (CFO)` — full text of CFO-01..CFO-10.
- `.planning/REQUIREMENTS.md` §`Documentation` — full text of DOC-01.
- `.planning/ROADMAP.md` §`Phase 2: Content Fragment Overlay` — phase goal, success criteria, dependencies, open questions OQ-1/OQ-2/OQ-5, key risks.
- `.planning/STATE.md` — current position.
- `.planning/phases/01-setup-foundation/01-CONTEXT.md` — Phase 1 locked decisions D-01..D-11 that Phase 2 builds on.
- `.planning/phases/01-setup-foundation/01-VERIFICATION.md` — confirms `scripts/config.js`, DOMPurify 3.4.2, pre-commit guard, `editor-support.js` null-guard are landed.

### Risk and pitfalls (must read before implementation)
- `.planning/research/PITFALLS.md` §`CP-1` — no-Publish-tier constraint; every fetch goes through Author proxy or aem.page/aem.live.
- `.planning/research/PITFALLS.md` §`CP-2` — XSS in current article blocks; non-negotiable mitigation in this PR via DOMPurify (D-04/D-05).
- `.planning/research/PITFALLS.md` §`CP-3` — UE instrumentation lost on innerHTML rebuild; use `moveInstrumentation`, prefer DOM construction (D-08).
- `.planning/research/PITFALLS.md` §`CFO-1` — overlay path mismatch yielding 200-OK-with-HTML-body; defensive Content-Type check in `fetchOverlay`.
- `.planning/research/PITFALLS.md` §`CFO-2` — CORS / credentials misconfiguration on Author proxy; verify in three contexts (auth session / anon aem.page / anon aem.live).
- `.planning/research/PITFALLS.md` §`CFO-3` — CF model schema drift; defensive optional chaining + visible error in non-prod; document schema in DOC-01 (D-07).
- `.planning/research/PITFALLS.md` §`CFO-4` — `_publishUrl` / `_path` field shape change; single `assetUrl()` helper handles the format change in one place (D-03).

### Codebase concerns
- `.planning/codebase/CONCERNS.md` §`Known Bugs` — Phase 1 already addressed `applyChanges` and header/footer fragment null guards.
- `.planning/codebase/CONCERNS.md` §`Cross-Cutting Risks` — XSS sink in article blocks, DOMPurify wiring (closed by D-04 in this phase).
- `.planning/codebase/INTEGRATIONS.md` — current GraphQL endpoint usage (the references being deleted).
- `.planning/codebase/CONVENTIONS.md` §`Naming Patterns` and §`Function Design` — block decoration conventions; `decorate(block)` default-export, `moveInstrumentation` pattern.

### Adobe official docs (anchor when options conflict)
- `https://www.aem.live/developer/content-fragment-overlay` — CFO architecture: Admin API config, overlay path translation, JSON shape.
- `https://www.aem.live/developer/json2html` — json2html worker: `/config` endpoint, Mustache template binding, `cf-endpoint` metadata convention.
- `https://www.aem.live/developer/block-collection/fragment` — `loadFragment` primitive (the same one `blocks/header` and `blocks/footer` already use).
- `https://www.aem.live/docs/authoring/universal-editor` — Universal Editor component model (`type: reference, valueType: cfPath`), `data-aue-*` instrumentation, `aue:content-*` events.
- `https://github.com/cure53/DOMPurify` — DOMPurify 3.x API, default profile behavior (D-05).
- `https://www.aem.live/developer/keeping-it-100` — three-phase loading conventions (eager / lazy / delayed).

### Files this phase will create
- `scripts/cf-overlay.js` — new module with `assetUrl(repoPath)` and `fetchOverlay(cfPath)` named exports (D-03).
- `cf-templates/article.html` — Mustache template, CFO-03 (D-03).
- `blocks/article-hero/_article-hero.json` — UE component model with single `cfReference` field, CFO-06 (D-06).
- `blocks/article-teaser/_article-teaser.json` — UE component model with single `cfReference` field, CFO-06 (D-06).
- `docs/content-fragment-overlay.md` — DOC-01, includes Admin API curl commands, Mustache template authoring, UE component-model wiring, smoke-test page path, captured reference responses, CF model JSON.

### Files this phase will modify
- `blocks/article-hero/article-hero.js` — full rewrite. Delete the `GRAPHQL_ENDPOINT` literal and the `block.innerHTML = template-literal` body. Use `fetchOverlay(cfPath)` from `scripts/cf-overlay.js`, sanitize body with DOMPurify (D-04), preserve UE instrumentation (D-08).
- `blocks/article-teaser/article-teaser.js` — symmetric rewrite, same pattern.
- `blocks/article-hero/article-hero.css` — adjust selectors if the new fragment shape requires it (Claude's Discretion).
- `blocks/article-teaser/article-teaser.css` — same.
- `head.html` — add `<meta name="cf-endpoint" content="...">` for `getMetadata('cf-endpoint')` consumer (CFO-08), unless that metadata is delivered through a different convention captured during the Wave 1 spike.
- `component-models.json`, `component-definition.json`, `component-filters.json` — auto-regenerated by `npm run build:json` from the new `_*.json` model partials. Pre-commit hook (`.husky/pre-commit.mjs`) handles this; never hand-edit.

### Files this phase will read (no edits)
- `scripts/aem.js` — Adobe-vendored framework. Provides `loadFragment` import target, `decorateBlocks`, etc. Treat as read-only.
- `scripts/scripts.js` — provides `moveInstrumentation`, used by D-08 in re-render path.
- `scripts/editor-support.js` — provides `aue:content-*` event handling; verify the rewritten blocks survive `applyChanges` patches.
- `blocks/fragment/fragment.js` — `loadFragment` source (the primitive Phase 2 reuses, do NOT modify per D-04).
- `scripts/config.js` — `AEM_AUTHOR_HOST` import target.
- `scripts/dompurify.min.js` — DOMPurify 3.4.2 UMD, import as `import DOMPurify from '../../scripts/dompurify.min.js'`.
- `fstab.yaml` — Author proxy mountpoint (truth for the Helix delivery URL the overlay request goes through).
- `paths.json` — `/content/sgedsdemo/` ↔ `/` mapping; reference for overlay path translation logic in `assetUrl()`.
- `head.html` — current CSP (`script-src 'nonce-aem' 'strict-dynamic'`); confirm json2html worker output doesn't introduce inline event handlers that violate it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`loadFragment(path)`** in `blocks/fragment/fragment.js:24-44` — already fetches `${path}.plain.html`, runs `decorateMain` + `loadSections` on the response, and returns a `<main>` element. Phase 2's `fetchOverlay(cfPath)` either delegates to `loadFragment` (preferred — reuses the proven primitive) or implements a parallel fetch with the same shape if the overlay URL needs different content-type handling (CFO-1 defensive check).
- **`moveInstrumentation(src, dest)`** in `scripts/scripts.js:39` — copies `data-aue-*` and `data-richtext-*` attributes; the prescribed escape hatch for any block that rebuilds children. D-08 relies on this for re-render survival.
- **DOMPurify usage pattern** in `scripts/editor-support.js:32-34` — `DOMPurify.sanitize(html)` with default profile, applied to `aue:content-patch` payloads. D-04/D-05 reuse this exact pattern.
- **`getMetadata(name)`** in `scripts/aem.js` — reads `<meta name="...">` from `head`. CFO-08's `getMetadata('cf-endpoint')` consumer is a one-line call.
- **CSP nonce-aem infrastructure** — `head.html` already enforces `script-src 'nonce-aem' 'strict-dynamic'`. Phase 2 adds no inline scripts (json2html output is server-rendered HTML), so no new CSP work; `<meta name="cf-endpoint">` is metadata, not a script.
- **Component-model build pipeline** — `merge-json-cli` + `npm-run-all` already run via the husky pre-commit hook (`.husky/pre-commit.mjs`). New `_article-hero.json` / `_article-teaser.json` partials get merged into the top-level registries automatically.

### Established Patterns
- **Block decoration** — `export default async function decorate(block)`, mutate DOM in place, no return value used. Phase 2 blocks follow this exactly.
- **`<a href="/content/dam/...">` as the CF reference convention** — Crosswalk's `valueType: cfPath` renders the reference field as an `<a>` element in the block's source DOM. The block's `decorate()` reads `block.querySelector('a').getAttribute('href')` to get the cfPath. Existing article blocks already use this pattern at line 4-5; the rewrite preserves it.
- **Soft-fail** — block fails silently in production rather than throwing (`scripts/article-hero.js:31-32` is the existing example). D-08 keeps this contract.
- **Sequential block loading** — `loadSection` awaits blocks one at a time; blocking on `fetchOverlay` is acceptable.

### Integration Points
- **Phase 1 deliverables ready for Phase 2 to consume:** `scripts/config.js` (AEM_AUTHOR_HOST), `scripts/dompurify.min.js` (3.4.2 UMD), `editor-support.js` `applyChanges` null-guard, pre-commit publish-host guard.
- **Phase 5 (HTML Fragment API)** will reuse the same DOMPurify pattern (D-04/D-05) on the server side. Phase 2 establishes the wiring style.
- **Editor live-patching path** — `aue:content-*` events flow through `applyChanges` in `scripts/editor-support.js`. D-08's recoverable-empty-container behavior must survive a re-decoration triggered by saving the `cfReference` field.

### Pre-existing tech debt to clean up implicitly
- **Lint errors in `article-hero.js` and `article-teaser.js`** documented in `.planning/phases/01-setup-foundation/deferred-items.md` — both files are fully rewritten in Wave 2 (D-01 plans 02-04, 02-05); the deferred lint errors disappear with the rewrite.
- **Hardcoded `publish-p23458-` literals** at line 1 of each block file — deleted in Wave 2; pre-commit guard from Phase 1 (D-04) ensures they don't come back.

</code_context>

<specifics>
## Specific Ideas

- The `fetchOverlay` helper signature is `fetchOverlay(cfPath: string) => Promise<HTMLElement | null>`. Returning `null` on any error class (404, 401/403, HTML-body-instead-of-JSON, missing fields, network error) lets `decorate()` use a single error path (D-08).
- `assetUrl(repoPath)` accepts a repository path like `/content/dam/sgedsdemo/articles/foo/image.jpg` and returns a delivery URL the browser can load. The exact format (Author proxy prefix vs aem.page rendition path) is locked at Wave 1 plan-02-03 by capturing one real CF JSON response and inspecting which URL fields exist.
- The Mustache template at `cf-templates/article.html` uses `{{title}}` (auto-escaped) for plain-text fields, `{{{body}}}` (unescaped) for the HTML body field that DOMPurify will sanitize on the client. No other unescaped variables.
- DOC-01 must include: (a) `## Setup` with Admin API curl commands (D-02), (b) `## CF model` with the JSON schema export (D-07), (c) `## Mustache template authoring` showing `cf-templates/article.html`, (d) `## UE wiring` with the `_*.json` model excerpt (D-06), (e) `## Reference responses` with captured CF JSON (D-03), (f) `## Smoke test` with the XSS payload verification step from Success Criterion #2, (g) `## Error states` describing the recoverable-empty-container contract (D-08).
- The XSS smoke step (Success Criterion #2): create a CF whose title is the literal text `<img src=x onerror=alert(1)>`. Confirm the rendered page shows the text inert (or the body sanitized to remove the handler). If the alert fires, DOMPurify wiring (D-04) is wrong.

</specifics>

<deferred>
## Deferred Ideas

- **CF model variants** (e.g., `article-light`, `article-dark`) sharing one Mustache template with conditional sections — explicit v2 (CFO-V2-01).
- **Live-preview parity between aem.page (UE preview) and aem.live** for CFO content (OQ-1 verification) — Wave 1 spike confirms parity *exists or not*; if not, fix is v2 (CFO-V2-02).
- **Multi-locale CF reference resolution** — explicit v2 (CFO-V2-03).
- **Per-instance overrides on the block model** (title/image override fields alongside `cfReference`) — rejected during discussion in favor of single CF reference field (D-06); revisit if authoring teams demand it.
- **UE-only inline debug message on broken CF** (`Content Fragment missing or unreachable: <cfPath>` visible only inside Author iframe) — rejected for this phase; D-08's silent recoverable empty container is the contract. Add later if authors find the silence confusing.
- **Single Playwright smoke test** covering all four POC features at smoke level — captured in PITFALLS as CF-EXISTING-5; out of scope per `.planning/REQUIREMENTS.md` "Out of Scope" line ("Test framework adoption" is X-V2-01).
- **Generic CF→HTML universal renderer** covering all CF models — CONTEXT explicitly says two specific models (`article-hero`, `article-teaser`) is enough to prove the pattern (FEATURES.md alternatives table).

</deferred>

---

*Phase: 02-content-fragment-overlay*
*Context gathered: 2026-05-07*
