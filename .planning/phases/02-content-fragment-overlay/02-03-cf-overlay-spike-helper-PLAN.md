---
phase: 02-content-fragment-overlay
plan: 03
type: execute
wave: 2
depends_on: [02-01]
files_modified:
  - .planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json
  - .planning/phases/02-content-fragment-overlay/samples/cf-overlay-plain-html-sample.html
  - scripts/cf-overlay.js
autonomous: false
requirements: [CFO-02, CFO-08]
must_haves:
  truths:
    - "One real CF JSON response from the AEM Author Assets API is captured under `samples/cf-json-sample.json`, locking the field shape (`properties.elements.<name>.value`) for plan 02-04 Mustache authoring."
    - "One real `.plain.html` overlay response (after CF publish + json2html worker config) is captured under `samples/cf-overlay-plain-html-sample.html`, proving end-to-end rendering."
    - "`scripts/cf-overlay.js` exists with two named exports `assetUrl(repoPath)` and `fetchOverlay(cfPath)` — the latter delegates to `loadFragment` from `blocks/fragment/fragment.js`, validates input against `DAM_PREFIX`, asserts a stable wrapper marker for CFO-1 defensive failure, and returns null on any error class."
  artifacts:
    - path: "scripts/cf-overlay.js"
      provides: "Helper module — `fetchOverlay(cfPath): Promise<HTMLElement|null>` and `assetUrl(repoPath): string` named exports. Consumed by article-hero + article-teaser block rewrites in Wave 2."
      exports: ["fetchOverlay", "assetUrl"]
      min_lines: 40
      contains: "from '../blocks/fragment/fragment.js'"
    - path: ".planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json"
      provides: "Captured CF JSON shape (locks Mustache template variable names + assetUrl transform body)."
    - path: ".planning/phases/02-content-fragment-overlay/samples/cf-overlay-plain-html-sample.html"
      provides: "Captured `.plain.html` overlay response — proves the worker is rendering the Mustache template after a CF publish."
  key_links:
    - from: "scripts/cf-overlay.js"
      to: "blocks/fragment/fragment.js"
      via: "named import { loadFragment } — never re-implemented"
      pattern: "import\\s*\\{[^}]*loadFragment[^}]*\\}\\s*from\\s*['\"]\\.\\./blocks/fragment/fragment\\.js['\"]"
    - from: "scripts/cf-overlay.js"
      to: "scripts/config.js"
      via: "named import { DAM_PREFIX } — Phase 1 lock"
      pattern: "import\\s*\\{[^}]*DAM_PREFIX[^}]*\\}\\s*from\\s*['\"]\\./config\\.js['\"]"
---

<objective>
Wave 1 spike: capture one real CF JSON response from the AEM Author Assets API and one real `.plain.html` response from the json2html worker, then write `scripts/cf-overlay.js` with the two locked named exports (`assetUrl`, `fetchOverlay`). The captured samples answer OQ-5 (raw CF JSON shape) and OQ-1 (aem.page vs aem.live parity), and lock A4/A5/A8. The helper file embeds the locked signatures; its body uses `loadFragment` from `blocks/fragment/fragment.js` and the `DAM_PREFIX` constant from `scripts/config.js`. Per D-02 the curl is `autonomous: false`; the rest is Claude-autonomous after the human pastes responses back.

Purpose: Lock all Wave 1 unknowns into committed files so Wave 2 block rewrites have a stable contract — `fetchOverlay(cfPath): Promise<HTMLElement|null>` and `assetUrl(repoPath): string`. Both Wave 2 plans (02-05, 02-06) import from this file.
Output: Two captured samples + `scripts/cf-overlay.js` (~40-60 LOC).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02-content-fragment-overlay/02-CONTEXT.md
@.planning/phases/02-content-fragment-overlay/02-RESEARCH.md
@.planning/phases/02-content-fragment-overlay/02-PATTERNS.md
@CLAUDE.md
@.planning/phases/02-content-fragment-overlay/02-01-SUMMARY.md
@scripts/config.js
@blocks/fragment/fragment.js

<interfaces>
<!-- LOCKED signatures (D-03) — DO NOT change names or arity. -->

```javascript
// scripts/cf-overlay.js (REQUIRED EXPORTS)

/**
 * Translate an AEM repository path to a delivery URL the browser can load.
 * @param {string} repoPath  e.g. /content/dam/sgedsdemo/articles/foo/image.jpg
 * @returns {string} Browser-loadable asset URL.
 */
export function assetUrl(repoPath) { /* body locked from sample */ }

/**
 * Fetch a CF overlay as a hydrated <main> element.
 * Returns null on ANY failure (network, non-OK, HTML body where overlay expected,
 * missing wrapper marker, missing fields). Caller falls back to D-08 empty-state.
 * @param {string} cfPath  e.g. /content/dam/sgedsdemo/articles/my-article
 * @returns {Promise<HTMLElement|null>}
 */
export async function fetchOverlay(cfPath) { /* delegates to loadFragment */ }
```

<!-- From scripts/config.js (Phase 1 lock — read-only here): -->
```javascript
export const DAM_PREFIX = '/content/dam/sgedsdemo/';
```

<!-- From blocks/fragment/fragment.js:21-44 (Phase 1 cleared, null-safe loadFragment): -->
```javascript
export async function loadFragment(path) {
  if (path && path.startsWith('/')) {
    path = path.replace(/(\.plain)?\.html/, '');
    const resp = await fetch(`${path}.plain.html`);
    if (resp.ok) {
      const main = document.createElement('main');
      main.innerHTML = await resp.text();
      // ... media base path reset, decorateMain, loadSections ...
      return main;
    }
  }
  return null;
}
```

<!-- CFO-1 defensive marker (Pitfall 1, Assumption A5): -->
<!-- The Mustache template at cf-templates/article.html (plan 02-04) MUST emit a stable wrapper class. -->
<!-- fetchOverlay asserts presence of `.article-cf` (recommended) OR `.article-hero`/`.article-teaser` -->
<!-- as a CFO-1 defensive check. We use `.article-cf` as the canonical marker so a single check covers -->
<!-- both block flavors and any future CF-driven block. -->
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Capture CF JSON sample + `.plain.html` overlay sample from running infrastructure</name>
  <read_first>
    - .planning/phases/02-content-fragment-overlay/02-01-SUMMARY.md (test CF path from plan 02-01 — e.g., `/content/dam/sgedsdemo/articles/phase-2-spike`)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (OQ-1, OQ-5, Pitfall 1)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`scripts/cf-overlay.js` analog notes)
  </read_first>
  <what-built>
    Claude has prepared the curl commands. Human runs them, pastes responses back. Claude commits them as samples.
  </what-built>
  <how-to-verify>
    Step 1 — Capture raw CF JSON (Author Assets API):
    Use the test CF path from plan 02-01 SUMMARY. Example assumes `/content/dam/sgedsdemo/articles/phase-2-spike`:
    ```bash
    # Re-use $AEM_TOKEN from plan 02-01.
    curl -s 'https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/articles/phase-2-spike.json' \
      -H "Authorization: Bearer $AEM_TOKEN" \
      -H 'Accept: application/json' \
      | tee /tmp/cf-json-sample.json | head -c 4000
    ```
    The expected shape (per AEM Assets HTTP API docs): `{ properties: { "cq:model": "...", "title": "...", elements: { title: { value: "..." }, body: { value: "<p>...</p>" }, image: { ":type": "core/wcm/components/image/v3/image" or similar, "_path": "/content/dam/..." } } } }`. Paste the FULL response body into your reply.

    Step 2 — Capture rendered `.plain.html` (json2html worker output via aem.page edge):
    ```bash
    # Anonymous (no token) — proves the public-read path works.
    curl -s 'https://main--sgedsdemo--nusoli-valtech.aem.page/content/dam/sgedsdemo/articles/phase-2-spike.plain.html' \
      | tee /tmp/cf-overlay-plain-html-sample.html | head -c 4000
    ```
    Also try the `.aem.live` host:
    ```bash
    curl -s 'https://main--sgedsdemo--nusoli-valtech.aem.live/content/dam/sgedsdemo/articles/phase-2-spike.plain.html' \
      | head -c 4000
    ```
    Note in your reply whether (a) both responses match (parity → OQ-1 closed), (b) one returns 404 (parity issue → defer fix to CFO-V2-02 per D-01).

    Step 3 — In your reply, paste:
    - Full CF JSON from Step 1 (or note "404 / 401 / empty response" with hypothesis).
    - Full `.plain.html` body from Step 2 (`.aem.page` flavor).
    - One-line note on `.aem.live` parity (matches / 404 / different).
    - The exact field names that appear under `properties.elements.*` (so plan 02-04 Mustache uses real names).

    Claude on resume:
    - Writes Step 1 response to `.planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json`.
    - Writes Step 2 response to `.planning/phases/02-content-fragment-overlay/samples/cf-overlay-plain-html-sample.html`.
    - If `.plain.html` response does NOT yet contain `<div class="article-cf">` (because the Mustache template is not yet committed — plan 02-04 ships it), that is expected; the SUMMARY records "rendered shape will be verified after plan 02-04 + CF republish."
  </how-to-verify>
  <resume-signal>Reply with both captures, parity note, and the field-names list. Claude writes the files.</resume-signal>
  <acceptance_criteria>
    - File exists: `.planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json`
    - File contains literal `"properties"` (proves a real Assets API response). Verifiable: `grep -l '"properties"' .planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json` returns the file.
    - File exists: `.planning/phases/02-content-fragment-overlay/samples/cf-overlay-plain-html-sample.html`
    - User has confirmed in chat: parity (or non-parity) between `.aem.page` and `.aem.live` for the test CF.
    - User has listed the exact field names from `properties.elements.*` (used by plan 02-04 Mustache template).
  </acceptance_criteria>
  <done>
    Samples landed. OQ-5 closed. OQ-1 documented (parity confirmed or deferred to v2). Field shape locked for plan 02-04.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Write `scripts/cf-overlay.js` with the two locked named exports</name>
  <read_first>
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-03 locked signatures, D-08 empty-state contract)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pattern 1 — `fetchOverlay` body skeleton; Pitfall 1 — CFO-1 defensive marker)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`scripts/cf-overlay.js` analog: `blocks/fragment/fragment.js:21-44` + `getMetadata` + `DAM_PREFIX`; Pattern S1 + S7)
    - .planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json (created by Task 1 — drives `assetUrl` body)
    - .planning/phases/02-content-fragment-overlay/samples/cf-overlay-plain-html-sample.html (created by Task 1 — confirms `.article-cf` wrapper presence or absence)
    - blocks/fragment/fragment.js (the `loadFragment` source — see lines 21-44)
    - scripts/config.js (the `DAM_PREFIX` source — Phase 1 lock)
    - scripts/aem.js (`getMetadata` definition — read-only, vendored framework)
  </read_first>
  <action>
Create the file `scripts/cf-overlay.js` with EXACTLY this content (derive `assetUrl` body from the captured CF JSON sample — see notes after the code block):

```javascript
/*
 * CF Overlay helper.
 *
 * Per D-03 (.planning/phases/02-content-fragment-overlay/02-CONTEXT.md):
 *   Named exports `assetUrl(repoPath)` and `fetchOverlay(cfPath)` — the two
 *   helpers Phase 2 article blocks consume. Delegates to `loadFragment` from
 *   `blocks/fragment/fragment.js` (Pattern S1). DAM_PREFIX comes from
 *   `scripts/config.js` (Phase 1 D-02 lock).
 *
 * Per D-08: returns null on ANY failure class so callers use a single error path.
 * Per CFO-1 (Pitfall 1): defensive marker check — the Mustache template at
 *   `cf-templates/article.html` emits `<div class="article-cf">`; if absent,
 *   we have a 200-OK-with-wrong-page and treat as failure.
 */

// eslint-disable-next-line import/no-cycle
import { loadFragment } from '../blocks/fragment/fragment.js';
import { getMetadata } from './aem.js';
import { DAM_PREFIX } from './config.js';

/**
 * CFO marker class emitted by `cf-templates/article.html`. Used by `fetchOverlay`
 * to detect CFO-1 silent failures (overlay path mismatch returning HTML body of
 * the wrong page — see PITFALLS.md CFO-1).
 */
const CF_OVERLAY_MARKER = '.article-cf';

/**
 * Translate an AEM repository path to a delivery URL the browser can load.
 *
 * Body locked from `samples/cf-json-sample.json` (Wave 1 spike). If the captured
 * sample shows the EDS edge serves DAM assets at the same `/content/dam/...`
 * path (no rewrite needed), this is the identity function. If a rewrite is
 * required (e.g., assets behind `/_assets/...` or with a `?width=` rendition),
 * implement it here in ONE place — never inline transforms in block code.
 *
 * @param {string} repoPath  e.g. /content/dam/sgedsdemo/articles/foo/image.jpg
 * @returns {string} Browser-loadable asset URL (relative to current origin), or
 *   empty string if the input is not a string or is empty.
 */
export function assetUrl(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') return '';
  if (!repoPath.startsWith(DAM_PREFIX)) return '';
  // Wave 1 spike confirmed: EDS edge serves DAM assets at the same path.
  // (If the captured sample contradicts this, replace this body with the
  //  required transform and update the JSDoc above.)
  return repoPath;
}

/**
 * Fetch a CF overlay as a hydrated <main> element.
 *
 * Delegates to `loadFragment` (which already prefixes `.plain.html`, resets media
 * base paths, runs decorateMain + loadSections, and null-guards non-OK responses).
 *
 * Returns null on:
 *   - empty / non-DAM cfPath
 *   - loadFragment returning null (network error, non-OK, missing path)
 *   - response that lacks the `.article-cf` marker (CFO-1 silent failure defence)
 *   - any thrown exception
 *
 * @param {string} cfPath  e.g. /content/dam/sgedsdemo/articles/my-article
 * @returns {Promise<HTMLElement|null>} <main> element with hydrated CF content,
 *   or null if the overlay could not be loaded.
 */
export async function fetchOverlay(cfPath) {
  if (!cfPath || typeof cfPath !== 'string') return null;
  // Honor `getMetadata('cf-endpoint')` if a more specific root is configured at
  // page level; default is the project DAM prefix from scripts/config.js.
  const cfRoot = getMetadata('cf-endpoint') || DAM_PREFIX;
  if (!cfPath.startsWith(cfRoot) && !cfPath.startsWith(DAM_PREFIX)) return null;

  try {
    const fragment = await loadFragment(cfPath);
    if (!fragment || !fragment.firstElementChild) return null;
    // CFO-1 defence: a 200 OK with an HTML body of the WRONG page (e.g., site
    // root) bypasses loadFragment's null-guard. Assert the Mustache marker.
    if (!fragment.querySelector(CF_OVERLAY_MARKER)) return null;
    return fragment;
  } catch (err) {
    return null;
  }
}
```

Notes for the executor:
1. The `// eslint-disable-next-line import/no-cycle` is required — `scripts/scripts.js` already imports from `blocks/fragment/fragment.js` (existing cycle suppression), and our import direction (`scripts/ → blocks/fragment/`) is the same family. ESLint will flag without the disable.
2. The `assetUrl` body is the IDENTITY function based on the assumption that EDS edge serves DAM paths as-is. If `samples/cf-json-sample.json` shows image fields like `_path: "/content/dam/sgedsdemo/articles/foo/image.jpg"` and `samples/cf-overlay-plain-html-sample.html` (or a manual browser load) shows broken images at that exact path, replace the body with the required transform (e.g., prepend `https://main--sgedsdemo--nusoli-valtech.aem.live`). Document the deviation inline in JSDoc.
3. The marker `'.article-cf'` is the canonical wrapper class plan 02-04 will emit. If plan 02-04 deviates, this constant must update — but the canonical name is FIXED HERE so 02-04 conforms.
4. ESLint `import/extensions: js: always` requires `.js` on every relative import — already in the code above.
5. No TypeScript; JSDoc only (CLAUDE.md `## Function Design`).
  </action>
  <verify>
    <automated>npx eslint scripts/cf-overlay.js</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `scripts/cf-overlay.js`
    - `grep -c '^export' scripts/cf-overlay.js` returns at least `2` (the two named exports).
    - `grep -l 'export function assetUrl' scripts/cf-overlay.js` returns the file.
    - `grep -l 'export async function fetchOverlay' scripts/cf-overlay.js` returns the file.
    - `grep -l "from '../blocks/fragment/fragment.js'" scripts/cf-overlay.js` returns the file.
    - `grep -l "from './config.js'" scripts/cf-overlay.js` returns the file.
    - `grep -l "DAM_PREFIX" scripts/cf-overlay.js` returns the file.
    - `grep -l "article-cf" scripts/cf-overlay.js` returns the file (CFO-1 marker present).
    - File does NOT contain `publish-` literal — verifiable: `grep -L 'publish-[a-zA-Z0-9-]*\.adobeaemcloud' scripts/cf-overlay.js` returns the file.
    - `npx eslint scripts/cf-overlay.js` exits 0.
  </acceptance_criteria>
  <done>
    `scripts/cf-overlay.js` ships with both locked exports. ESLint passes. Wave 2 plans 02-05 and 02-06 can `import { fetchOverlay } from '../../scripts/cf-overlay.js'` against this stable contract.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → EDS edge (aem.page / aem.live) | Anonymous public read of `.plain.html` overlay. No browser-side auth. |
| `fetchOverlay` input → block code | Block extracts cfPath from `<a href>` set by UE; treated as untrusted. Validated against `DAM_PREFIX`. |
| `loadFragment` HTTP response → DOM | Already null-guarded by Phase 1 fragment.js; we add CFO-1 marker check on top. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-03-01 | Tampering / Information Disclosure | CFO-1 silent failure (200 OK with wrong page) | mitigate | `fetchOverlay` asserts `.article-cf` marker; absent → returns null. Plan 02-04 Mustache template MUST emit this wrapper. |
| T-02-03-02 | Information Disclosure | cfPath input pointing outside `/content/dam/sgedsdemo/` | mitigate | `fetchOverlay` validates against `DAM_PREFIX` prefix; non-DAM paths return null without fetching. |
| T-02-03-03 | Denial of Service (false-positive renders) | `loadFragment` non-OK or empty `<main>` | mitigate | `if (!fragment || !fragment.firstElementChild) return null;` on top of Phase 1 null-guard. |
| T-02-03-04 | Tampering | Cycle import of `blocks/fragment/fragment.js` triggering double-evaluation | accept | Existing project pattern (`scripts/scripts.js` ↔ `blocks/fragment/fragment.js`); single-direction here. eslint-disable-next-line is required by airbnb config. |
</threat_model>

<verification>
- `npx eslint scripts/cf-overlay.js` passes (airbnb-base + xwalk + import).
- File contains both locked exports with documented JSDoc.
- File imports `loadFragment` from `blocks/fragment/fragment.js` and `DAM_PREFIX` from `scripts/config.js` — never re-implements them.
- Captured CF JSON sample is real (contains `"properties"`).
- OQ-1 / OQ-5 documented as resolved (or deferred to v2).
</verification>

<success_criteria>
CFO-02 + CFO-08 mostly closed (pending consumer wiring in Wave 2). Wave 2 has a stable, documented helper to import. CFO-1 defence baked in at the helper layer.
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-03-SUMMARY.md`. Record:
- Captured CF field names (`properties.elements.<name>` list).
- `.aem.page` vs `.aem.live` parity result (closes OQ-1).
- `assetUrl` body decision (identity function vs transform — closes A8).
- Confirmation that `cf-templates/article.html` (plan 02-04) MUST emit a `<div class="article-cf">` wrapper, otherwise `fetchOverlay` rejects every overlay.
</output>
