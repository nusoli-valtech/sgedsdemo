# Domain Pitfalls — AEM EDS POC (No Publish Tier)

**Domain:** Adobe AEM Edge Delivery Services (Helix / Franklin) demo, AEM Cloud Service Author + Universal Editor, no Publish tier
**Researched:** 2026-05-06
**Scope:** Four POC capabilities — Content Fragment Overlay, generic placeholders, Adobe Target, HTML Fragment API

---

## Severity Legend

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Causes rewrite, security incident, or full feature failure. Must be addressed before merge. |
| **HIGH** | Breaks the feature for real authors / users; visible regression (FOUC, LCP, broken auth). |
| **MEDIUM** | Causes confusion, inconsistent behavior, or stale content; recoverable. |
| **LOW** | Hygiene; degrades DX or future-maintainability. |

---

## Critical Pitfalls (Cross-Cutting)

### CP-1: Treating "no Publish tier" as a footnote instead of an architecture constraint

**Severity:** CRITICAL
**What goes wrong:** Every Adobe sample, blog post, and "official" pattern for EDS assumes a Publish tier exists. Copy-pasting a tutorial silently breaks because the Publish endpoint (`publish-pXXXXX-eYYYYY.adobeaemcloud.com`) is unreachable — the existing `article-hero.js` / `article-teaser.js` GraphQL fetch is exactly this trap (see `.planning/codebase/INTEGRATIONS.md` line 16).
**Why it happens:** Adobe's reference architecture diagrams treat Publish as the default; Universal Editor docs assume it. The demo Cloud Service does not include it.
**Consequences:** Article blocks return 404 / DNS-fail / CORS-fail; placeholders sheet returns 401; Target activities never resolve; HTML Fragment API has no public origin to serve from.
**Prevention:**
- Every fetch in this POC MUST go through the Author proxy (`/bin/franklin.delivery/...`) configured in `fstab.yaml`, or through aem.live preview/live origin (`*.aem.page`, `*.aem.live`) — NEVER direct to a `publish-*` host.
- Add a CI lint rule (or grep check in pre-commit) that fails the build on any string match for `publish-p23458` or `publish-*.adobeaemcloud.com`.
- In `docs/<feature>.md`, lead each guide with "Publish tier is unavailable. This pattern uses Author + delivery proxy because…".
**Detection:**
- Network tab shows requests to `publish-*.adobeaemcloud.com` → instant red flag.
- 401/403/CORS errors on a fetch → check it's not pointing at Publish.
- Works locally but fails on aem.page → environment-coupled URL leaked through.
**Phase mapping:** ALL four phases. Specifically blocks Phase 1 (CFO migration must replace the Publish GraphQL call).

---

### CP-2: Carrying forward existing XSS in `article-hero` / `article-teaser` instead of fixing during CFO migration

**Severity:** CRITICAL
**What goes wrong:** The current blocks build a template literal containing `${item.title}`, `${item.body.html}`, `${item.image._path}` and assign it via `block.innerHTML` (`.planning/codebase/CONCERNS.md` line 69). The CFO migration changes the data source from GraphQL to a CF Overlay JSON endpoint, but the rendering code is the same. Migrating without fixing the sink leaves the XSS in place against new data — and arguably widens it (Author content has historically been less curated than Publish content).
**Why it happens:** "We're just changing the fetch URL" mindset; reviewers assume security is unchanged.
**Consequences:** Author with stored-XSS payload in CF title or body executes script in site origin. CSP (`'unsafe-inline' http: https:` in `head.html`) does NOT stop this — `'strict-dynamic'` only governs script tags, and the HTML injection vector creates DOM nodes that re-evaluate inline event handlers under permissive policy.
**Prevention:**
- CFO migration PR MUST include: (a) DOMPurify pass on all rich-text bodies, (b) `textContent` / `setAttribute` on plain-text fields (title, alt, paths), (c) URL allowlist on image `_path` (must start with `/content/dam/`).
- Add a unit-style smoke test (even without a test runner — a `docs/<feature>.md` "verification" section with a payload like `<img src=x onerror=alert(1)>` in the CF title that MUST render as text).
- Use the existing `scripts/dompurify.min.js` (already bundled, never imported per CONCERNS line 174); follow the pattern in `scripts/editor-support.js:32-34`.
- Code review checklist: any `innerHTML =` or `innerHTML +=` with template-literal interpolation of fetched data → block the PR.
**Detection:**
- Grep for `innerHTML.*\$\{` across `blocks/` after the migration — should be zero in article blocks.
- Manual: paste an XSS payload into a CF title in Author and view the rendered page.
- CSP violation reports (`securitypolicyviolation` listener in `aem.js:83-91`) — these will fire if a script slips through.
**Phase mapping:** Phase 1 (CFO migration). NOT a separate phase — the same PR that introduces CFO retires the unsafe sinks.
**Carry-forward from CONCERNS.md:** Yes — line 68-75 explicitly. Severity bumped from "Medium-High" to CRITICAL because the migration is the natural moment to fix it; deferring is a deliberate choice to ship known-vulnerable code.

---

### CP-3: Universal Editor instrumentation lost on re-render

**Severity:** HIGH
**What goes wrong:** `editor-support.js` re-decorates blocks on UE patch events. If a block's `decorate()` replaces inner DOM with `block.innerHTML = …` (article blocks do this) the `data-aue-*` instrumentation attributes added by UE on child elements vanish. Author can no longer click-to-edit the field.
**Why it happens:** Decorators built before instrumentation existed; `moveInstrumentation` (exported from `scripts/scripts.js`) is the prescribed escape hatch but rarely used by hand-rolled blocks.
**Consequences:** Block renders correctly but is uneditable in UE. Author opens an issue; nobody can repro because preview URLs work fine.
**Prevention:**
- For any block decorated for UE (article-hero, article-teaser, every new placeholder-aware block), call `moveInstrumentation(srcElement, destElement)` BEFORE replacing children.
- Prefer DOM construction (`document.createElement` + `appendChild`) over `innerHTML` so existing instrumentation nodes can be moved rather than torched.
- Smoke test in UE after every block change: open the page in Universal Editor, click each authorable field, confirm the right model field is highlighted.
**Detection:**
- Open the page in Universal Editor; clicking on rendered text does not select the underlying CF field.
- DOM inspector shows no `data-aue-resource`, `data-aue-prop`, `data-aue-type` on rendered fields.
- `editor-support.js applyChanges` returns false repeatedly (falls through to `window.location.reload()` per CONCERNS line 113).
**Phase mapping:** Phase 1 (CFO blocks must keep instrumentation), Phase 2 (placeholder block must instrument the placeholder source field), Phase 3 (Target blocks need instrumentation for the default variant).

---

## Pitfalls Specific to: Content Fragment Overlay (CFO)

### CFO-1: Overlay path mismatch between Author proxy and CF storage path

**Severity:** CRITICAL
**What goes wrong:** CFO works by configuring a path in the EDS site so that `/<some-prefix>/path/to/cf` is intercepted and rewritten to fetch the CF JSON from Author. If the prefix in the EDS config (e.g., `paths.json` or a CFO-specific config) does not match the CF location in the AEM repo, requests 404 silently OR return an HTML page instead of JSON.
**Why it happens:**
- Project path coupling: `paths.json` already references `/content/sgedsdemo/` and `/content/dam/sgedsdemo/` (CONCERNS line 60). CFs typically live under `/content/dam/<project>/` — the path must align.
- Author proxy in `fstab.yaml` (`nusoli-valtech/sgedsdemo/main`) has its own mapping; CFO adds another translation layer on top.
- Trailing slashes and `.json` extensions vary by configuration block.
**Consequences:** Block fetches return 200 OK with HTML body → JSON.parse throws → block silently logs `console.error` and renders empty (existing pattern from CONCERNS line 38-44 + CONVENTIONS line 108).
**Prevention:**
- Document the exact mapping in `docs/content-fragment-overlay.md`: AEM CF path → EDS overlay URL → fetch URL with concrete examples for THIS project (`sgedsdemo`).
- Add one canonical sample CF in the repo's content tree, fetched via overlay, used by an integration smoke page (`/test-cfo.html` or similar). If the smoke page renders, mapping is correct.
- Write a defensive fetch wrapper that checks `Content-Type` is `application/json` before parsing, with a useful error otherwise.
**Detection:**
- Network tab: response is 200 but `Content-Type: text/html`.
- `JSON.parse` errors with "Unexpected token < in JSON at position 0".
- Block renders empty in an environment that worked yesterday (project rename or path drift — see CONCERNS line 60).
**Phase mapping:** Phase 1.

---

### CFO-2: CORS / credentials misconfiguration on the Author proxy

**Severity:** HIGH
**What goes wrong:** The Author tier is normally gated by IMS (Adobe SSO). When the browser fetches a CF Overlay URL, it may need credentials (cookies) but cross-origin requests strip them by default. Conversely, sending credentials to Author from a non-trusted origin opens up CSRF.
**Why it happens:** Two competing requirements: (a) Author needs auth, (b) the public-facing aem.live origin is not authenticated. The Helix delivery proxy (`fstab.yaml` mountpoint) handles this server-side — but only for the routes it knows about. New CFO routes need explicit configuration.
**Consequences:**
- Anonymous visitors to aem.page get 401s on CF data → blocks render empty.
- Or worse: anonymous public access leaks unpublished/draft CFs because the proxy is too permissive.
**Prevention:**
- Verify all CFO requests route through the Helix proxy (`https://<branch>--<repo>--<owner>.aem.page/...`) NOT directly to `author-p23458-e585661.adobeaemcloud.com` from the browser. The proxy holds the credential.
- Test the CFO endpoints in three contexts: signed-in author session, anonymous incognito tab on aem.page, anonymous on aem.live. All three must match the intended access policy.
- Document the trust boundary in `docs/content-fragment-overlay.md`: "CF Overlay routes are public-readable via aem.page/aem.live; do not store secrets in CFs."
**Detection:**
- 401 / 403 responses in incognito.
- Successful response in author-logged-in tab, failure in incognito → credential bleed.
- Authenticated response includes draft/unpublished content fields → leak.
**Phase mapping:** Phase 1.

---

### CFO-3: CF model schema drift breaks the block silently

**Severity:** MEDIUM
**What goes wrong:** Block code reads `data.title`, `data.body.html`, `data.image._path`. Author renames a CF model field (`body` → `content`) — block returns nothing, no error, no warning.
**Why it happens:** No schema contract; no TypeScript; no runtime validation.
**Consequences:** Pages render empty in production after an Author UI change; debugging requires correlating CF model history with block code.
**Prevention:**
- Defensive guards already in code style (CONVENTIONS line 113-114): `data?.foo?.bar` with `if (!item) throw new Error('No item in response')`. Extend this to surface a visible error in non-prod.
- Write the expected JSON shape into a comment block at the top of `article-hero.js`. When the comment drifts from reality, that's the signal.
- Document the CF model fields in `docs/content-fragment-overlay.md` with screenshots — when Author edits the model, devs see the doc PR.
**Detection:**
- Block renders empty after a content-only change.
- `console.error` "No item in response" or "Cannot read properties of undefined" in production.
- CF model `lastModified` recent + first failure date aligns.
**Phase mapping:** Phase 1.

---

### CFO-4: Publish-only `_publishUrl` / `_path` fields returned from Overlay

**Severity:** MEDIUM
**What goes wrong:** GraphQL queries against Publish return convenience fields like `_publishUrl` and `_dynamicUrl`. CF Overlay (driven by Author) may return different URL shapes — `_path` (DAM repo path) without the rendered URL. Blocks that string-format `_publishUrl` or use it as `<img src>` get broken images.
**Why it happens:** Block code (`article-hero.js`, `article-teaser.js`) was written against Publish GraphQL response; CFO response is structurally different.
**Consequences:** Images 404. Links route to AEM author admin paths (which 401 for anonymous).
**Prevention:**
- During Phase 1 migration, log a sample response from CF Overlay to a doc / scratch file. Confirm every field used by the block exists in the new response with the same semantics.
- Rewrite asset URL formatting through a single helper (`assetUrl(repoPath)`) so the format change happens in one place.
- Image `_path` referenced fields must be transformed to delivery URLs (typically by prefixing with the EDS host or using a `?width=` rendition path).
**Detection:**
- Broken image icons after Phase 1 ships.
- Hover-link target shows `/content/dam/...` literal path (raw repo path leaked to the page).
**Phase mapping:** Phase 1.

---

## Pitfalls Specific to: Generic Placeholders Mechanism

### PH-1: Placeholders cache invalidation is not what you think

**Severity:** HIGH
**What goes wrong:** EDS placeholders are typically loaded from a `placeholders.json` (a Google-Sheet- or Excel-backed sheet on the content side). The runtime caches them, often via `window.placeholders` or similar memo. Editor changes the sheet, hits Publish — but the visitor's browser still serves the cached value until full reload AND CDN purge.
**Why it happens:** Three caches stack: (1) browser memory (per-tab), (2) browser HTTP cache for `placeholders.json`, (3) aem.live CDN. Each has its own TTL and invalidation trigger.
**Consequences:** Author "fixed the typo" but the typo persists for hours/days for some users. Worse: shown values can differ between visitors at the same moment.
**Prevention:**
- Document the full chain in `docs/placeholders.md` with explicit "to invalidate: 1) re-publish sheet, 2) bump cache key in URL, 3) hard-refresh".
- Append a build-time / publish-time hash to the placeholders fetch URL (`/placeholders.json?v=<hash>`) to force a fresh fetch on deploy. If a per-deploy hash isn't available, use a short `Cache-Control: max-age=60` header expectation and document the 60s lag.
- Memoize `loadPlaceholders` per page-render (one fetch per navigation), NOT per-session. Avoid `sessionStorage` like the fonts pattern (`scripts/scripts.js:55`) — it traps stale values across navigation.
- Smoke test: change a placeholder in the sheet, publish, check live. Document time-to-propagate.
**Detection:**
- Author reports "I changed it but it still shows the old value".
- Network tab: `placeholders.json` returns from cache (`(disk cache)`).
- Different visitors see different values (CDN edge inconsistency).
**Phase mapping:** Phase 2.

---

### PH-2: Placeholder substitution timing breaks LCP / CLS

**Severity:** HIGH
**What goes wrong:** Substitution happens on an `eager`-phase block before placeholders are loaded → renders raw `{{brandName}}` literal, then swaps to "Acme Corp" later → Cumulative Layout Shift, flash of token-text.
**Why it happens:** EDS three-phase loading: eager runs synchronously for LCP block; lazy runs after; placeholders are typically a fetch (network round-trip).
**Consequences:** LCP regression on the eager block. CLS as text width changes mid-render. Flash of `{{}}` syntax is unprofessional.
**Prevention:**
- Decision: load `placeholders.json` BEFORE `loadEager` (in head, blocking) for short critical placeholders only — accept ~50ms LCP cost for a no-flash result.
- OR: use CSS `visibility:hidden` on tokenized text until placeholders resolve, with a tight (<150ms) timeout fallback that just renders the literal token.
- Substitute via `textContent` not `innerHTML` (also defends against XSS via placeholder values from the sheet — see PH-3).
- Test on slow 3G throttling: does the page show `{{...}}` for any frame? If yes, redesign.
**Detection:**
- Lighthouse / WebPageTest filmstrip shows `{{brandName}}` text frame.
- LCP regresses by >100ms after placeholders ship.
- CLS score above 0.1.
**Phase mapping:** Phase 2.

---

### PH-3: Placeholder values are NOT trusted strings

**Severity:** HIGH
**What goes wrong:** Authors edit the placeholders sheet. A typo or copy-paste introduces `<script>...` or `<img onerror>` into a value. The substitution code does `el.innerHTML = el.innerHTML.replace('{{x}}', val)` → stored XSS at the global level (one bad cell, every page on the site).
**Why it happens:** Placeholders feel like "config", but they're author-controlled content with the broadest blast radius on the site.
**Consequences:** Cross-site scripting, executed on every page, persistent until the cell is fixed AND caches are purged (see PH-1). Nightmare combination with CP-1 + CP-2.
**Prevention:**
- Substitute via `textContent` walk: traverse text nodes, replace `{{x}}` matches in `nodeValue`. NEVER touch `innerHTML`.
- If a placeholder value MUST contain HTML (rare, document the exception), DOMPurify it, AND tag the cell with a known prefix (e.g., `html:<p>...</p>`) so the substitution code knows to sanitize.
- URL-typed placeholders: validate against an allowlist of schemes (`http`, `https`, `mailto:`) before assigning to `href` / `src`.
- Document the trust model in `docs/placeholders.md`: "Anyone with sheet access can affect every page. Treat sheet edits like deployment changes."
**Detection:**
- Grep new placeholder code for `innerHTML` usages with placeholder values — should be zero.
- Inject `<script>alert(1)</script>` into a test placeholder cell, publish, verify it renders as literal text.
- CSP violation reports increase after placeholders ship.
**Phase mapping:** Phase 2. Same review checklist as CP-2.

---

### PH-4: Placeholder syntax collision with existing content

**Severity:** MEDIUM
**What goes wrong:** Choose `{{brandName}}` syntax, then someone authors an article literally about Mustache templating containing `{{name}}` examples. Substitution mangles the article.
**Why it happens:** Curly-brace double-stash is a popular template syntax; documentation and code samples often contain it.
**Consequences:** Word lost, article shows wrong content; reverse-engineering by support takes hours.
**Prevention:**
- Use a less-collision-prone delimiter: `[[brandName]]`, `${brandName}` is even worse (template literals), `<sg-var name="brandName"/>` is verbose but unambiguous.
- Or: match only known placeholder names — substitute `{{x}}` ONLY if `x` exists in placeholders.json. Unknown tokens render as-is.
- Document the syntax choice in `docs/placeholders.md` with a "do not use this in content" callout.
**Detection:**
- Authors report rendered content missing words.
- Logs show "missing placeholder: `name`" warnings (if implemented).
**Phase mapping:** Phase 2.

---

### PH-5: Substitution operates on Universal Editor instrumentation attributes

**Severity:** MEDIUM
**What goes wrong:** Naive substitution traverses ALL text nodes — including those inside `data-aue-*` attribute values or inside script/style tags.
**Why it happens:** Tree-walker without filter.
**Consequences:** Editor instrumentation breaks (CP-3 cascade); inline JSON/JS gets mangled.
**Prevention:**
- TreeWalker with `acceptNode` filter: skip `<script>`, `<style>`, `<noscript>`. Skip nodes whose ancestor has `contenteditable="true"` (UE-rendered fields).
- Operate on the rendered DOM AFTER `decorate()` blocks run, not before.
- Smoke test in Universal Editor: confirm placeholders resolve in preview AND editor remains clickable (CP-3 detection applies).
**Detection:**
- UE click-to-edit broken on placeholder-bearing blocks.
- View source shows mangled `data-aue-prop` values.
**Phase mapping:** Phase 2.

---

## Pitfalls Specific to: Adobe Target Integration

### TGT-1: FOUC / flicker on banner + logo activities

**Severity:** HIGH
**What goes wrong:** Default content (control variant) renders, then Target's response arrives, then DOM swaps. Visitor sees the wrong value flash for 100-500ms. Worst on mobile 3G.
**Why it happens:** Target requires a network round-trip; EDS three-phase loading (`scripts/scripts.js`) renders eager content before any external script can inject.
**Consequences:** Defeats the purpose of personalization (visitor sees both versions). Looks broken; analytics reports inflated control impressions.
**Prevention:**
- Use Target's pre-hide snippet pattern, scoped to specific selectors only — NOT the whole `<body>`. Pre-hide `.banner-target-zone, .logo-target-zone` with a `visibility:hidden` rule that times out after ~3000ms (Target SDK default).
- Inject the pre-hide CSS in `head.html` BEFORE any other stylesheet, with the smallest possible scope.
- Server-Side Decisioning where available: pre-resolve activities via Adobe Target Delivery API at edge / build time and ship the resolved value directly. Trades dynamism for zero flicker.
- Test on throttled connection: load the page 10 times, count visible flickers. Goal: zero on 95th percentile.
**Detection:**
- WebPageTest / Lighthouse video filmstrip shows control content briefly.
- Target reports unexpectedly high "default experience" exposure on activities that should be 50/50.
- User reports "I saw it change".
**Phase mapping:** Phase 3.

---

### TGT-2: Target script (alloy.js / at.js) crushes LCP

**Severity:** HIGH
**What goes wrong:** Target SDK loaded synchronously in head adds 50-150KB + a network round trip + execution time. LCP element waits for the SDK to resolve before rendering (especially when LCP is inside a Target zone like the hero banner).
**Why it happens:** "Personalize the LCP" is the whole pitch, but the LCP block IS the eager-phase block in EDS, and Target's eager script is heavier than the EDS eager block itself.
**Consequences:** LCP regresses from ~1.5s to ~3-4s. CWV failing. SEO impact on Publish-tier site (less relevant here, but the same pattern lands in the future production project).
**Prevention:**
- Prefer **Adobe Experience Platform Web SDK (`alloy.js`)** over legacy `at.js` — smaller, async-friendly.
- For EDS three-phase loading: integrate Target in the `lazy` phase if possible. Only the activities themselves that touch the LCP block must run earlier; everything else (analytics, profile sync) defers.
- Use Target's `applyResponse` API to render specific decisions on demand instead of automatically firing on every page view.
- Pre-resolve LCP-touching activities via Edge Decisioning (server-side), and let client-side Target handle below-fold activities.
- Set a hard timeout (~1500ms) on Target round-trip — fall back to control on timeout, log to RUM.
**Detection:**
- Lighthouse LCP > 2.5s in the field after Target ships.
- WebPageTest waterfall: Target script blocks rendering.
- RUM checkpoint `lcp` regresses post-Target.
**Phase mapping:** Phase 3.

---

### TGT-3: Universal Editor preview shows the wrong variant (or none)

**Severity:** MEDIUM
**What goes wrong:** Author opens a page in Universal Editor → Target fires against the editor frame → some random variant renders → author thinks the page is broken or starts editing the variant content into the source CF.
**Why it happens:** Target's mboxes don't know they're in an editor context; they fire normally.
**Consequences:** Authors edit variants thinking they're editing source content. Activities run "inside" Author, polluting analytics. Worst case: an editor accidentally publishes the variant text into the default CF.
**Prevention:**
- Detect editor context: `window.location.hostname.includes('adobeaemcloud.com')` or `parent !== window` (UE iframes). When detected, short-circuit Target activation and always render control.
- Document the editor-context guard in `docs/target-integration.md`.
- Editor-mode banner: when Target is suppressed, show a small badge `[Personalization disabled in editor]` so authors know.
**Detection:**
- Author screenshots showing variant content in UE.
- Target audience traffic from `*.adobeaemcloud.com` referrers.
**Phase mapping:** Phase 3.

---

### TGT-4: No Publish tier means no real Edge Decisioning origin

**Severity:** HIGH
**What goes wrong:** Adobe Target's at.js / alloy.js typically bind to the **Publish tier domain** for cookie scope, mbox firing, and consent. Without Publish, Target's "page" is the aem.live preview/live origin (`*.aem.page` / `*.aem.live`) which Target may not have configured as a valid property domain.
**Why it happens:** Target property is keyed by domain. The aem.live URLs are project-specific subdomains; Target setup typically points at the production publish domain.
**Consequences:** Activities don't fire, cookie scope mismatched, mbox calls 403.
**Prevention:**
- Add the aem.page / aem.live origin to the Target property's allowed domains BEFORE writing any client code.
- Verify by hitting Target's debug overlay (`mboxDisable`/`mboxDebug` URL params, or Adobe Experience Platform Debugger extension).
- Document the Target property + domain mapping in `docs/target-integration.md` with a screenshot of the Target Properties screen.
- If the existing Target account uses a fixed production domain, request a new property OR use Target's wildcard domain feature.
**Detection:**
- Network tab shows `tt.omtrdc.net` or `<id>.tt.omtrdc.net` calls returning 403/404.
- Target debug shows "no matching property for domain".
- Activities load in Target UI but never fire on the page.
**Phase mapping:** Phase 3 — verify domain config BEFORE writing block code.

---

### TGT-5: Profile / ECID stitching fails without a stable identity tier

**Severity:** MEDIUM
**What goes wrong:** Adobe Target uses ECID (Experience Cloud ID) for visitor identity. Without a Publish tier or properly configured Web SDK, the ECID may not persist across pages — every navigation looks like a new visitor — activities reset, sequencing breaks.
**Why it happens:** ECID requires the AEP Web SDK or Experience Cloud ID Service properly configured with the right `orgId` and a third-party cookie context (or first-party via reverse proxy).
**Consequences:** A/B test results invalid (visitor counted multiple times). Sequential activities never sequence. Profile attributes not respected.
**Prevention:**
- Use AEP Web SDK with first-party cookie (set via the aem.live first-party domain).
- Document the orgId, dataStream ID, and cookie domain in `docs/target-integration.md`.
- For POC, accept that A/B reporting is non-statistical and document this loud-and-clear — the POC proves the integration plumbing, not test validity.
**Detection:**
- Multiple ECIDs for the same browser across pageviews.
- Profile attributes set on page 1 don't apply on page 2.
**Phase mapping:** Phase 3.

---

### TGT-6: Consent / privacy not wired before Target fires

**Severity:** MEDIUM
**What goes wrong:** Target fires in regions requiring consent (GDPR, CCPA) without checking — non-compliant pageview, potential fine.
**Why it happens:** No consent management in the boilerplate. Target SDK fires by default.
**Consequences:** Regulatory exposure. Even a POC can be subpoenaed if it fires real Target calls in production-adjacent environments.
**Prevention:**
- Default-deny: Target does NOT fire until a consent flag is set. For POC, hardcode the flag to `true` ONLY on the demo origin AND document this is non-production.
- Strip identifiable data from any test impressions; use synthetic profile data only.
- Document in `docs/target-integration.md` the consent gap and how production would close it (OneTrust, etc.).
**Detection:**
- Target calls observed from EU IPs without consent banner.
- GDPR-compliance audit flags.
**Phase mapping:** Phase 3.

---

## Pitfalls Specific to: HTML Fragment API (External Consumer)

### API-1: XSS in served HTML — DOMPurify on server isn't enough

**Severity:** CRITICAL
**What goes wrong:** External web app receives HTML and `innerHTML`s it into their DOM. Whether the API sanitized or not, the consumer's environment determines safety. If the API ALSO ships unsanitized author content, both sides are exposed.
**Why it happens:** "It's just HTML" mindset. CONCERNS line 174-177 already notes DOMPurify is bundled but unused.
**Consequences:** Stored XSS that propagates to every external consumer. Worse than a single-site XSS — the author content executes in the consumer's origin (their cookies, their tokens).
**Prevention:**
- API MUST DOMPurify all HTML server-side (or in the edge function) before responding. Use a strict allowlist profile (`USE_PROFILES: { html: true }`, no `script`, no `style`, no event handlers).
- Set `Content-Type: text/html; charset=utf-8` and a strong `Content-Security-Policy` header on the response that the consumer can adopt verbatim.
- Document in `docs/html-fragment-api.md`: "consumers MUST treat this HTML as untrusted by default; we sanitize, but defense-in-depth requires they sanitize too."
- Provide a JS snippet for consumers that uses DOMPurify on their side.
**Detection:**
- Penetration test: inject `<img src=x onerror=alert(document.domain)>` into the source CF; confirm consumer's domain does NOT alert.
- Audit response: `<script>` tags, `on*=` handlers, `javascript:` URLs all stripped.
**Phase mapping:** Phase 4. Same DOMPurify pattern as CP-2 — bundled but unused. Hook into Phase 1's pattern.

---

### API-2: CORS allowlist too permissive (or too strict)

**Severity:** HIGH
**What goes wrong:** Two failure modes: (a) `Access-Control-Allow-Origin: *` accidentally enables every origin to embed → token-less content scraping, hotlinking. (b) Hard-coded single origin → consumer demo on a different port / subdomain fails.
**Why it happens:** PROJECT.md explicitly mentions "CORS allowlist for the POC" but allowlist is undefined.
**Consequences:** (a) Anyone can scrape and re-host content; competitive risk. (b) Demo doesn't work on the day; embarrassing.
**Prevention:**
- Define the allowlist explicitly in `docs/html-fragment-api.md`: `https://demo.example.com, https://demo-staging.example.com`. NO wildcards.
- Implement allowlist check against the `Origin` request header; respond `Access-Control-Allow-Origin` with the matched origin (NOT `*`) to satisfy credentialed requests.
- Echo back `Vary: Origin` header so caches don't poison cross-origin responses.
- Reject (do NOT silently allow) origins not in the list — return 403 with a clear error body.
**Detection:**
- Test from a non-allowlisted origin: must fail.
- Test from an allowlisted origin: must succeed.
- Inspect response headers for `Vary: Origin`.
**Phase mapping:** Phase 4.

---

### API-3: Caching strategy mismatched to update frequency

**Severity:** MEDIUM
**What goes wrong:** Either: (a) `Cache-Control: max-age=86400` so author publishes don't propagate for a day. (b) `Cache-Control: no-cache` so every external consumer hits origin → at scale, melts the Author proxy.
**Why it happens:** No conscious decision on freshness vs. load. EDS CDN defaults aren't designed for cross-domain API consumption.
**Consequences:** Stale content OR DOS-by-customer.
**Prevention:**
- Define an SLA in `docs/html-fragment-api.md`: e.g., "fragments cached for 60s edge-side; explicit purge on publish via [mechanism] if available; otherwise accept up to 60s lag."
- Use `Cache-Control: public, max-age=60, stale-while-revalidate=600` for sensible defaults.
- Set `ETag` based on a hash of the underlying CF version so conditional GET works.
- Surface cache headers in the response and document them.
**Detection:**
- Author publishes a change; consumer doesn't see it for >60s → too cold.
- Consumer's request count to API ≈ their pageview count → no caching → too hot.
**Phase mapping:** Phase 4.

---

### API-4: API origin coupling to the same EDS site (cookie / referrer leakage)

**Severity:** MEDIUM
**What goes wrong:** API served from the same origin as the demo site → the consumer's `<iframe>` or `fetch` includes the visitor's session cookies (if any) → unintentional auth leakage, OR strict CORS preflight rejects the request because credentials don't match `Access-Control-Allow-Origin: *`.
**Why it happens:** Convenient to host API at `*.aem.live/api/fragment/<id>`. Same origin = same cookie scope.
**Consequences:** Cookie/auth leakage; preflight failures.
**Prevention:**
- Either host the API on a separate subdomain (`api.<project>.aem.live` if available) OR ensure the EDS site doesn't set authentication cookies.
- Always respond with `Access-Control-Allow-Credentials: false` unless explicitly needed; instruct consumers `fetch(url, { credentials: 'omit' })`.
- Strip `Set-Cookie` from API responses defensively.
**Detection:**
- API response includes cookies in DevTools.
- Consumer's preflight OPTIONS fails with credentials mismatch.
**Phase mapping:** Phase 4.

---

### API-5: External API has no rate limiting → trivial DoS

**Severity:** MEDIUM (PROJECT.md explicitly defers full hardening, but POC must not be openly DoS-able from the internet)
**What goes wrong:** API endpoint is publicly readable; one buggy consumer with a `setInterval(fetch, 100)` melts it. Or a malicious actor hammers it.
**Why it happens:** PROJECT.md "Out of Scope" line 35 defers rate limiting. Still — a public POC URL on the internet is a target.
**Consequences:** Author proxy degrades; aem.live SLA impacts; demo unavailable when needed.
**Prevention:**
- Even as POC: add basic CDN-level rate limiting (e.g., aem.live built-in, or a tiny in-memory counter at the edge function level — 60 req/min/IP).
- Cache aggressively (API-3) — cached responses don't hit origin.
- Document the rate limit in `docs/html-fragment-api.md` with the consumer-side recommended retry/backoff.
- Auth as the proper long-term fix (deferred per PROJECT.md), but document the gap.
**Detection:**
- RUM error rate spike correlated with consumer traffic.
- Author proxy 503s.
**Phase mapping:** Phase 4.

---

### API-6: Universal Editor instrumentation leaks into API response

**Severity:** MEDIUM
**What goes wrong:** Internal page rendering includes `data-aue-*` attributes for editor support. The HTML Fragment API serves the rendered HTML and forwards these attributes — external consumer's DOM is now polluted with AEM-specific attributes that mean nothing in their context (and reveal CF paths / repo structure to anyone viewing source).
**Why it happens:** Reusing the page render pipeline for the API.
**Consequences:** Information disclosure (CF paths, repo structure). DOM pollution. Possible XSS surface if consumer's tooling treats `data-aue-resource` URLs specially.
**Prevention:**
- API response renderer MUST strip `data-aue-*`, `data-cmp-*`, and any AEM-specific attributes before responding.
- Use a dedicated render path for the API, not the page-decorate path.
- Document the cleaned-output guarantee in `docs/html-fragment-api.md`.
**Detection:**
- Inspect API response: `grep -i data-aue` should yield nothing.
- Curl the API endpoint and view source.
**Phase mapping:** Phase 4.

---

## Carry-Forward Pitfalls (from `.planning/codebase/CONCERNS.md`)

These pre-existing issues affect the POC and must not be ignored:

### CF-EXISTING-1: ESLint 8 EOL + unmaintained `eslint-config-airbnb-base`

**Severity:** LOW (POC), HIGH (production project that comes after)
**Carry-forward source:** CONCERNS line 154-163.
**POC implication:** Unrelated to the four capabilities, but a Renovate auto-merge or new Node version could break CI mid-POC. If lint fails, the GitHub Actions pipeline blocks Code Sync deploys.
**Prevention:** Pin `node` in workflow to a known-good version (resolve the Node 24 vs "Use Node.js 20" mismatch, CONCERNS line 180). Snapshot lockfile.
**Phase mapping:** Address in initial setup phase before the four capabilities, OR document as known issue and skip.

---

### CF-EXISTING-2: Empty `delayed.js` and `hero.js` stubs

**Severity:** LOW
**Carry-forward source:** CONCERNS line 14-23.
**POC implication:** Phase 3 (Target) is a natural place to actually USE `delayed.js` (deferred Target / analytics work). Don't reintroduce the empty file pattern. If delayed-phase work isn't needed, REMOVE the import.
**Prevention:** Decide per-feature whether delayed-phase logic is needed; keep `delayed.js` either populated or absent — never empty.
**Phase mapping:** Phase 3 specifically.

---

### CF-EXISTING-3: `applyChanges` undefined-`updates` crash + nav fragment fetch crash

**Severity:** MEDIUM
**Carry-forward source:** CONCERNS line 38-51.
**POC implication:** Editor-support patches are central to the CFO + placeholder + Target features (every block change goes through this path). A null `updates` will swallow the patch and force `window.location.reload()` — author loses unsaved changes.
**Prevention:** Apply the documented one-line guards (`if (!updates || !updates.length) return false;` and `if (!fragment) return;`) as part of Phase 1 setup before writing CFO blocks. Tiny PR, big leverage.
**Phase mapping:** Phase 1 (or earlier groundwork).

---

### CF-EXISTING-4: Project-name coupling (`sgedsdemo`, `p23458-e585661`)

**Severity:** MEDIUM
**Carry-forward source:** CONCERNS line 60-64, 134-137.
**POC implication:** If the POC repo is forked or the AEM project renamed mid-flight, all four capabilities break in different ways:
- CFO: path mismatch (CFO-1).
- Placeholders: `placeholders.json` URL drift.
- Target: domain config mismatch (TGT-4).
- HTML API: endpoint URL changes for external consumer.
**Prevention:** Centralize identifiers in a single config module (`scripts/config.js` or top-level constants in `scripts/scripts.js`) — single source of truth for `PROJECT_NAME`, `AEM_INSTANCE_ID`, `DAM_PREFIX`. Reference everywhere instead of re-typing literals.
**Phase mapping:** Phase 1 setup; refactor as part of CFO migration.

---

### CF-EXISTING-5: No tests; reliance on manual UE smoke-testing

**Severity:** MEDIUM
**Carry-forward source:** CONCERNS line 186-207.
**POC implication:** Every pitfall above relies on detection via "test in UE / inspect network tab" — easy to skip under deadline pressure. Without automated checks, regressions land silently.
**Prevention:**
- Even without a test runner, write `docs/<feature>.md` with explicit "verification steps" (a-b-c list of clicks + expected results). Treat the doc as the test plan.
- Consider a single Playwright smoke test in a hidden `tests/` dir if it can be added without scope creep — covering all four capabilities at smoke level.
- Add a console.error → fail-CI check (parse build logs for "Article hero failed").
**Phase mapping:** All four phases.

---

## Phase-Specific Warnings Summary

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| Setup (pre-Phase-1) | Editor-support guards | CF-EXISTING-3 (null updates / fragment) | Apply 2-line guard PR first |
| Setup (pre-Phase-1) | Identifier coupling | CF-EXISTING-4 | Centralize project name constants |
| Phase 1 (CFO) | Path mismatch | CFO-1 | Document the exact URL chain in `docs/` + smoke page |
| Phase 1 (CFO) | XSS retained | CP-2 | DOMPurify + textContent in same PR |
| Phase 1 (CFO) | UE instrumentation lost | CP-3 | Use `moveInstrumentation`, avoid `innerHTML` rebuild |
| Phase 1 (CFO) | CORS / credentials | CFO-2 | Test in 3 contexts (auth, anon page, anon live) |
| Phase 1 (CFO) | Schema drift | CFO-3 | Defensive guards, document schema in block header |
| Phase 1 (CFO) | URL field shape change | CFO-4 | Single `assetUrl()` helper, log first response |
| Phase 2 (Placeholders) | Cache invalidation | PH-1 | Document cache chain; per-deploy hash; 60s TTL |
| Phase 2 (Placeholders) | LCP / CLS regression | PH-2 | Pre-load placeholders OR `visibility:hidden` with timeout |
| Phase 2 (Placeholders) | XSS via sheet | PH-3 | `textContent`-only substitution; URL allowlist |
| Phase 2 (Placeholders) | Syntax collision | PH-4 | Match only known names; document syntax |
| Phase 2 (Placeholders) | Mangling UE attrs | PH-5 | TreeWalker filter; skip script/style/contenteditable |
| Phase 3 (Target) | FOUC / flicker | TGT-1 | Scoped pre-hide; 3s timeout; SS decisioning if available |
| Phase 3 (Target) | LCP regression | TGT-2 | alloy.js (not at.js); lazy phase; 1.5s timeout |
| Phase 3 (Target) | UE editor pollution | TGT-3 | Editor-context guard; show "personalization disabled" badge |
| Phase 3 (Target) | Domain not allowlisted | TGT-4 | Configure Target property domain BEFORE writing code |
| Phase 3 (Target) | ECID instability | TGT-5 | AEP Web SDK + first-party cookie; document POC limits |
| Phase 3 (Target) | Consent missing | TGT-6 | Default-deny outside demo origin; document gap |
| Phase 4 (HTML API) | XSS in served HTML | API-1 | Server-side DOMPurify + consumer-side guidance |
| Phase 4 (HTML API) | CORS misconfig | API-2 | Explicit allowlist, no wildcards, `Vary: Origin` |
| Phase 4 (HTML API) | Cache strategy | API-3 | 60s + SWR; ETag from CF version |
| Phase 4 (HTML API) | Cookie leakage | API-4 | Subdomain or strip cookies; `credentials: 'omit'` |
| Phase 4 (HTML API) | DoS / rate limit | API-5 | CDN rate limit + aggressive cache |
| Phase 4 (HTML API) | UE attrs leaked | API-6 | Strip `data-aue-*` / `data-cmp-*` server-side |

---

## Sources & Confidence

| Pitfall family | Confidence | Sources |
|----------------|-----------|---------|
| CP-1, CP-2, CP-3 (cross-cutting) | HIGH | `.planning/codebase/CONCERNS.md`, `.planning/codebase/INTEGRATIONS.md`, direct code reading. |
| CFO-1 to CFO-4 | MEDIUM | Training-data knowledge of AEM Content Fragment Overlay + EDS path-routing semantics; live docs (`aem.live/developer/content-fragment-overlay`) could not be fetched in this session — flag for verification before Phase 1 implementation. |
| PH-1 to PH-5 | MEDIUM | EDS placeholders pattern from training; cache behavior is consistent with general CDN/edge norms. Live docs not fetched — verify TTL specifics. |
| TGT-1 to TGT-6 | MEDIUM | Adobe Target / AEP Web SDK / EDS three-phase loading interactions are well-documented in training data; specific aem.live integration guide not fetched this session. |
| API-1 to API-6 | HIGH (security pitfalls), MEDIUM (specific API mechanism on EDS-no-publish — depends on whether this is implemented as Edge Function, AEM servlet via proxy, or static prebuild). | General web-API security knowledge + EDS architecture constraints. |
| Carry-forward (CF-EXISTING-*) | HIGH | Direct reading of `.planning/codebase/CONCERNS.md` lines cited inline. |

**Verification recommended before each phase kicks off:** fetch `https://www.aem.live/developer/<feature>` and reconcile against the relevant pitfalls in this doc. Update confidence levels and add anything Adobe has shipped since the training cutoff. Flag specifically: any change to CFO request shape, `placeholders.json` cache headers, alloy.js bundle size, or new EDS-native rate limit / CORS controls.

---

*Pitfalls research: 2026-05-06*
