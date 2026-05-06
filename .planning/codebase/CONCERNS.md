# Codebase Concerns

**Analysis Date:** 2026-05-06

## Tech Debt

**Empty `buildAutoBlocks` stub:**
- Issue: `buildAutoBlocks()` contains only a `// TODO: add auto block, if needed` comment wrapped in a try/catch with no body. Function is wired into `decorateMain()` but does nothing.
- Files: `scripts/scripts.js:65-72`
- Impact: Dead code path executed on every page render. Misleading to readers who expect logic.
- Fix approach: Either remove the function entirely (and its `decorateMain` call) or implement the auto-blocking pattern when needed (e.g., auto-build hero from first H1+picture).

**Empty `delayed.js` placeholder:**
- Issue: File contains a single comment `// add delayed functionality here`. Loaded after a 3-second `setTimeout` for nothing.
- Files: `scripts/delayed.js:1`, imported by `scripts/scripts.js:138`
- Impact: Wasted scheduled module import + network round-trip on every page.
- Fix approach: Remove the import entirely until delayed work exists; reintroduce when there is real third-party / analytics work to defer.

**Empty `hero.js` block:**
- Issue: `blocks/hero/hero.js` is a 0-byte file. The hero block has a model (`_hero.json`) and CSS, but no JS decorator. Block loader (`aem.js:584-593`) attempts a dynamic `import()` of this file each time a hero is on the page; the import resolves with no default export.
- Files: `blocks/hero/hero.js` (empty), `blocks/hero/hero.css`, `blocks/hero/_hero.json`
- Impact: Extra HTTP fetch per page render with zero behavior. Easy to forget the file exists.
- Fix approach: Either delete `hero.js` (and let `loadBlock` skip it gracefully — confirm the loader tolerates 404s) or add a real decorator if hero needs DOM massaging.

**Suppressed eslint rules pile-up:**
- Issue: 24+ `eslint-disable` comments across `scripts/aem.js`, `scripts/scripts.js`, `scripts/editor-support.js`, `scripts/editor-support-rte.js`, `blocks/header/header.js`, `blocks/fragment/fragment.js`. Includes `no-cond-assign`, `no-await-in-loop`, `no-use-before-define`, `import/no-cycle`, `guard-for-in`.
- Files: see grep above
- Impact: Each disable bypasses an Airbnb rule; cumulatively reduces signal from `npm run lint`.
- Fix approach: Most are inherited from the AEM boilerplate (`aem.js`) and acceptable as-is. The `import/no-cycle` between `scripts/scripts.js` ↔ `blocks/fragment/fragment.js` is a real cycle worth refactoring — extract `decorateMain` into its own module.

**Sequential block/section loading on hot path:**
- Issue: `loadSection` (`aem.js:686-689`) and `loadSections` (`aem.js:701-709`) await blocks one at a time inside `for` loops with `no-await-in-loop` disabled.
- Files: `scripts/aem.js:681-710`
- Impact: Pages with many blocks pay full network latency per block instead of parallelizing. This is intentional in the boilerplate (preserves order, controls LCP), but it is worth knowing when adding many fetch-heavy blocks.
- Fix approach: Leave as-is for the first section (LCP); consider `Promise.all` for non-critical sections if a page has 10+ blocks.

## Known Bugs

**`applyChanges` does not guard against undefined `updates`:**
- Symptoms: `if (!updates.length)` will throw `TypeError: Cannot read properties of undefined` if `detail.response.updates` is missing.
- Files: `scripts/editor-support.js:26-27`
- Trigger: Universal Editor event with no `response.updates` payload (network failure, malformed response).
- Workaround: None. The error is swallowed only by the global RUM `unhandledrejection` listener.
- Fix: Change to `if (!updates || !updates.length) return false;`.

**`fragment.js` decorate assumes `loadFragment` returned a fragment:**
- Symptoms: If `link` exists but the fragment fetch fails, `loadFragment` returns `null`. `decorate` checks `if (fragment)` correctly — OK. But `header.js:114` does `while (fragment.firstElementChild)` with no null check; if `/nav.plain.html` 404s, `header.js` throws.
- Files: `blocks/header/header.js:114-120`, `blocks/footer/footer.js:12-17` (same pattern)
- Trigger: Missing `/nav` or `/footer` content path.
- Workaround: Ensure nav/footer pages exist on every environment.
- Fix: Guard with `if (!fragment) return;` after `loadFragment` calls.

**`article-hero` / `article-teaser` only support `/content/dam/` paths:**
- Symptoms: Silent no-op when an editor links to a `/content/sgedsdemo/` page or any non-DAM URL — the block leaves authoring HTML in place with no error UI.
- Files: `blocks/article-hero/article-hero.js:8`, `blocks/article-teaser/article-teaser.js:8`
- Trigger: Author drops a link that is not under `/content/dam/`.
- Workaround: None visible to authors.
- Fix: Render an inline error placeholder in non-prod / preview, or surface a console warning at minimum.

**`paths.json` mappings reference `/content/sgedsdemo/`, fstab references `nusoli-valtech/sgedsdemo`:**
- Symptoms: `paths.json` includes `/content/dam/sgedsdemo/`, but the `sgedsdemo` content path is project-name-coupled and will break if the AEM project is renamed.
- Files: `paths.json`, `fstab.yaml`
- Trigger: Project rename or fork.
- Fix: Centralize project name; document that `paths.json`, `fstab.yaml`, and the GraphQL endpoint constants must stay in sync.

## Security Considerations

**`innerHTML` with unescaped GraphQL response data (XSS):**
- Risk: `article-hero.js` and `article-teaser.js` interpolate `item.title`, `item.body.html`, and `item.image._path` directly into a template literal assigned to `block.innerHTML`. If an author publishes a Content Fragment containing `"><script>...` in `title`, or any HTML in the unsanitized rich-text body, it executes in the page origin.
- Files: `blocks/article-hero/article-hero.js:23-30`, `blocks/article-teaser/article-teaser.js:20-25`
- Current mitigation: Page-level CSP (`head.html:2-5`, `404.html:6-9`) sets `script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; base-uri 'self'; object-src 'none';`. `'unsafe-inline'` plus `http: https:` in `script-src` is permissive; the `'strict-dynamic'` keyword cancels host-list and `'unsafe-inline'` in CSP3-compliant browsers, but legacy browsers fall back to allowing them. `object-src 'none'` is good.
- Recommendations: 
  - For `article-teaser` body (already rich text), pipe through `scripts/dompurify.min.js` (already bundled — `editor-support.js:32-34` shows the pattern).
  - For `title` and `image._path`, escape via `textContent` / `setAttribute` rather than template-literal HTML.
  - Severity: Medium-High. Trust boundary is the AEM author role, but CF imports from third parties widen this.

**Unsanitized `innerHTML` from arbitrary `.plain.html` fetch:**
- Risk: `fragment.js:28` does `main.innerHTML = await resp.text()` for any path passed to `loadFragment`. Path comes from a link `href` in authored content, which is then fetched same-origin. Author-controlled, but no sanitization.
- Files: `blocks/fragment/fragment.js:28`
- Current mitigation: Same-origin fetch + AEM publishes only authored markup.
- Recommendations: Acceptable in trusted-author model. Document the trust assumption; consider DOMPurify pass for parity with `editor-support.js`.

**`buildBlock` uses `colEl.innerHTML +=` for string content:**
- Risk: `aem.js:557` injects unsanitized strings via `innerHTML +=`. Currently only called by `loadHeader`/`loadFooter` with `''`, so unreachable today, but if a future caller passes user content the XSS surface grows.
- Files: `scripts/aem.js:544-568`
- Current mitigation: Only called with empty strings.
- Recommendations: Switch to `textContent` for string vals or document the API contract that `string` rows must be pre-sanitized.

**`script-src 'unsafe-inline' http: https:`:**
- Risk: CSP allows ALL HTTP/HTTPS hosts as script sources and inline scripts. `'strict-dynamic'` mitigates this on modern browsers, but the policy is broad.
- Files: `head.html:2-5`, `404.html:6-9`
- Current mitigation: Nonce-based loading + `strict-dynamic` for CSP3 browsers.
- Recommendations: Acceptable for AEM nonce model; tighten if CSP v3 support across target audience is confirmed.

**No secrets in repo:** No `.env`, no embedded credentials. GraphQL endpoint URL is a public AEM publish URL; not a secret.

## Performance Bottlenecks

**Per-block GraphQL fetch with no caching:**
- Problem: Every render of `article-hero` or `article-teaser` fires a fresh `fetch` to the AEM GraphQL endpoint. No `cache-control` overrides, no in-memory dedupe. Two blocks pointing at the same article = two requests.
- Files: `blocks/article-hero/article-hero.js:13`, `blocks/article-teaser/article-teaser.js:13`
- Cause: No caching layer.
- Improvement path: Wrap fetch in a module-level `Map<url, Promise>` to dedupe within a page render. Rely on browser HTTP cache for cross-page caching (verify CDN cache headers on the GraphQL endpoint).

**Eager font load on first request:**
- Problem: `loadFonts()` is called twice — once in `loadEager` (only on desktop or repeat visits, OK) and unconditionally in `loadLazy` (`scripts.js:129`). On first mobile visit, fonts.css blocks rendering of section #2 onward.
- Files: `scripts/scripts.js:104-105, 129`
- Cause: Conservative double-call.
- Improvement path: The `loadFonts` function is idempotent (CSS dedup in `loadCSS`), so impact is small, but worth verifying lazy path doesn't undo the mobile delay.

**Sequential awaits in section loading:**
- Problem: See "Tech Debt — Sequential block/section loading on hot path."
- Files: `scripts/aem.js:686-689, 703-709`

## Fragile Areas

**`scripts/aem.js` (738 lines) — boilerplate-frozen:**
- Files: `scripts/aem.js`
- Why fragile: Vendored Adobe boilerplate. Diverges silently from upstream over time. Contains RUM beacon, block/section/icon/button decoration, dynamic block loader, picture optimizer — single point of failure for the framework.
- Safe modification: Avoid edits; prefer overriding behavior in `scripts/scripts.js`. If a fix is required, document the divergence so future upstream pulls do not overwrite it.
- Test coverage: None — no tests exist anywhere in the repo.

**`blocks/header/header.js` (166 lines):**
- Files: `blocks/header/header.js`
- Why fragile: Dense interaction logic with `forceExpanded` tri-state, mutually-recursive functions (`closeOnEscape` ↔ `toggleMenu`, hence the `no-use-before-define` disables), string-typed `forceExpanded` ('false'/'true' strings vs booleans on line 76 — likely bug-prone).
- Safe modification: Manual QA on desktop AND mobile, with keyboard nav (Tab/Esc/Enter/Space) and screen reader.
- Test coverage: None.

**`scripts/editor-support.js` redecoration logic:**
- Files: `scripts/editor-support.js`
- Why fragile: Lots of optional chaining + nested conditions; falls back to `window.location.reload()` (`editor-support.js:113`) on any failure path. Easy to silently corrupt editor state.
- Safe modification: Test in Universal Editor across content-patch, update, add, move, remove, copy events.

**Project-coupled identifiers:**
- Files: `fstab.yaml` (`nusoli-valtech/sgedsdemo`), `paths.json` (`/content/sgedsdemo/`), `blocks/article-hero/article-hero.js:1`, `blocks/article-teaser/article-teaser.js:1` (hardcoded `sgedsdemo` in GraphQL endpoint URL).
- Why fragile: Renaming the AEM project requires manual edits in 4+ files with no validation.
- Safe modification: Search-and-replace `sgedsdemo` plus `p23458-e585661` instance ID; verify with author preview after.

## Scaling Limits

**Block count per page:**
- Current capacity: Sequential `loadBlock` calls. ~5-10 fetch-heavy blocks before LCP suffers.
- Limit: Network-bound; depends on author content shape.
- Scaling path: Parallelize non-LCP sections (see Tech Debt entry).

**GraphQL endpoint dependency:**
- Current capacity: All article blocks rely on a single AEM publish endpoint.
- Limit: Endpoint outage = blocks render empty (caught silently).
- Scaling path: Add a static fallback render or skeleton state so blocks degrade visibly.

## Dependencies at Risk

**`eslint` 8.57.1 (EOL):**
- Risk: ESLint v8 reached end-of-life in Oct 2024. No further security/bug fixes. v9 is the current line.
- Files: `package.json:23`
- Impact: Eventually new Node versions or plugins will drop v8 compat.
- Migration plan: Bump to ESLint 9 (flat config required) — coordinate with `eslint-config-airbnb-base` (which has not officially released a v9-compatible version yet) and `eslint-plugin-xwalk`.

**`eslint-config-airbnb-base` 15.0.0:**
- Risk: Last release 2022-05; not v9-compatible.
- Files: `package.json:24`
- Impact: Blocks the ESLint 9 upgrade.
- Migration plan: Either wait for an official release or switch to a maintained alternative (e.g., `@eslint/js` + selected airbnb rules).

**`eslint-plugin-xwalk` from GitHub (`adobe-rnd/eslint-plugin-xwalk`):**
- Risk: Direct GitHub dependency, no semver pin (`package.json:27`). Upstream changes can break the build silently.
- Files: `package.json:27`
- Migration plan: Pin to a specific commit SHA or wait for an npm publish.

**`stylelint` 17.0.0:**
- Risk: stylelint 17 is current (16/17/18 line moves fast). OK.
- Files: `package.json:30`

**`dompurify.min.js` vendored copy:**
- Risk: Bundled as a static file (`scripts/dompurify.min.js`) instead of an npm dependency. No version visible in package.json — version drift risk; CVE patches require manual replacement.
- Files: `scripts/dompurify.min.js`
- Migration plan: Add `dompurify` to npm deps, copy from `node_modules` at build time, or document the source URL + version in a comment at the top of the file.

**Node 24 in CI vs comment "Use Node.js 20":**
- Risk: `.github/workflows/main.yaml:8-10` and `cleanup-on-create.yaml` install Node 24 but the step name says `Use Node.js 20`. Mismatch suggests stale config; whichever is intended should match.
- Files: `.github/workflows/main.yaml`, `.github/workflows/cleanup-on-create.yaml`
- Fix: Pick one Node version consciously; update step name to match.

## Missing Critical Features

**Test suite:**
- Problem: Zero tests in repo. No unit, integration, or E2E coverage. No test runner in `package.json`.
- Blocks: Safe refactoring of `aem.js`, `header.js`, `editor-support.js`. Confidence in CI is limited to lint.
- Recommended: Add at minimum smoke tests for `decorateMain`, `loadFragment`, and the article-* blocks (mock `fetch`).

**`README.md` placeholder substitution:**
- Problem: README contains `{repo}` / `{owner}` placeholders that the cleanup workflow only fills on `Initial commit` event. If repo is forked or imported manually, README has unsubstituted braces.
- Files: `README.md`
- Fix: Manual replacement.

**No prod build step:**
- Problem: `package.json` has only `lint` and `build:json` (model/definition merging). No bundling, no minification of `scripts/aem.js` or block JS files.
- Files: `package.json`
- Note: This is intentional in AEM Edge Delivery (CDN delivers source modules directly), but worth documenting.

## Test Coverage Gaps

**Everything:**
- What's not tested: All decorators, the dynamic block loader, RUM sampling, fragment loading, GraphQL fetch error paths, header keyboard accessibility, editor patch logic.
- Files: All files under `blocks/` and `scripts/`.
- Risk: Regressions go unnoticed until a content author or editor reports them; the author surface is hard to test manually.
- Priority: High for `editor-support.js` (data corruption risk) and `article-*` blocks (XSS-adjacent). Medium for boilerplate `aem.js`.

---

*Concerns audit: 2026-05-06*
