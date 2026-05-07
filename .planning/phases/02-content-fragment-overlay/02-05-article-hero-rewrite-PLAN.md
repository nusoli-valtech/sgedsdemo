---
phase: 02-content-fragment-overlay
plan: 05
type: execute
wave: 4
depends_on: [02-03, 02-04]
files_modified:
  - blocks/article-hero/article-hero.js
  - blocks/article-hero/_article-hero.json
autonomous: true
requirements: [CFO-04, CFO-05, CFO-06, CFO-07, CFO-09]
must_haves:
  truths:
    - "`blocks/article-hero/article-hero.js` no longer contains the `publish-p23458-*` GraphQL endpoint literal — pre-commit guard from Phase 1 enforces this going forward."
    - "`blocks/article-hero/article-hero.js` uses `fetchOverlay` from `scripts/cf-overlay.js` instead of direct `fetch` to the GraphQL endpoint."
    - "Rich-text body container is sanitized with `DOMPurify.sanitize(body.innerHTML)` BEFORE insertion (D-04 wiring point — closes existing CP-2 XSS in the same PR)."
    - "On any error class (404, 401, missing wrapper marker, network), block logs `console.error('article-hero: missing CF', cfPath)` and calls `block.replaceChildren()` — block element + UE `data-aue-*` instrumentation preserved (D-08)."
    - "`moveInstrumentation(srcLink, fragmentWrapper)` is called BEFORE `block.replaceChildren(...)` so UE click-to-edit survives DOM swap (CP-3 closure)."
    - "`blocks/article-hero/_article-hero.json` exposes ONE field — `cfReference` of `component: aem-content-fragment, valueType: string, required: true` (D-06)."
  artifacts:
    - path: "blocks/article-hero/article-hero.js"
      provides: "Rewritten block decorator using fetchOverlay + DOMPurify + moveInstrumentation."
      min_lines: 25
      contains: "fetchOverlay"
    - path: "blocks/article-hero/_article-hero.json"
      provides: "UE component-model partial — auto-merged into component-models.json/component-definition.json/component-filters.json by husky pre-commit hook."
      contains: "cfReference"
  key_links:
    - from: "blocks/article-hero/article-hero.js"
      to: "scripts/cf-overlay.js"
      via: "named import { fetchOverlay }"
      pattern: "import\\s*\\{[^}]*fetchOverlay[^}]*\\}\\s*from\\s*['\"]\\.\\./\\.\\./scripts/cf-overlay\\.js['\"]"
    - from: "blocks/article-hero/article-hero.js"
      to: "scripts/dompurify.min.js"
      via: "default import DOMPurify; called as DOMPurify.sanitize(body.innerHTML)"
      pattern: "DOMPurify\\.sanitize"
    - from: "blocks/article-hero/article-hero.js"
      to: "scripts/scripts.js"
      via: "named import { moveInstrumentation }"
      pattern: "moveInstrumentation\\("
---

<objective>
Rewrite `blocks/article-hero/article-hero.js` to consume `fetchOverlay(cfPath)` from `scripts/cf-overlay.js` (plan 02-03), sanitize the rich-text body container with DOMPurify (D-04 — closes CP-2 XSS in the SAME PR as the migration, non-negotiable per `security_block_on: high`), preserve UE `data-aue-*` instrumentation via `moveInstrumentation` (CP-3 closure), and degrade to an empty container with a single `console.error` when the CF reference is missing or fails (D-08). Add `blocks/article-hero/_article-hero.json` with a single `cfReference` field per D-06 — husky pre-commit auto-rebuilds the component-*.json bundles.

This plan deletes the existing `GRAPHQL_ENDPOINT = 'https://publish-p23458-...'` literal at line 1 of the existing file (Phase 1 D-04 carve-out for this exact deletion) and the `block.innerHTML = template-literal` body that was the XSS sink.

Purpose: First Wave 2 block rewrite. Closes CFO-04 / CFO-05 / CFO-06 / CFO-07 / CFO-09 for the hero block.
Output: One rewritten file (~25-35 LOC) + one new model partial (~30 LOC). Husky regenerates `component-*.json` automatically.
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
@.planning/phases/02-content-fragment-overlay/02-03-SUMMARY.md
@CLAUDE.md
@scripts/cf-overlay.js
@scripts/scripts.js
@scripts/dompurify.min.js
@blocks/article-hero/article-hero.js
@blocks/article-hero/article-hero.css
@blocks/cards/cards.js
@blocks/header/header.js
@blocks/fragment/_fragment.json
@blocks/hero/_hero.json

<interfaces>
<!-- LOCKED contracts (per CONTEXT D-04, D-06, D-08; PATTERNS.md Pattern S2/S3/S4): -->

From scripts/cf-overlay.js (plan 02-03):
```javascript
export async function fetchOverlay(cfPath: string): Promise<HTMLElement | null>;
export function assetUrl(repoPath: string): string;
```

From scripts/scripts.js:39-47 (Phase 1 stable):
```javascript
export function moveInstrumentation(from, to) {
  // copies data-aue-* and data-richtext-* attributes from `from` to `to`.
}
```

From scripts/dompurify.min.js (vendored UMD 3.4.2 — Phase 1 D-09):
```javascript
// Default export available; called as: DOMPurify.sanitize(html)
import DOMPurify from '../../scripts/dompurify.min.js';
```

From blocks/cards/cards.js (analog for moveInstrumentation usage):
```javascript
// Line 9:
moveInstrumentation(row, li);
// Line 19:
moveInstrumentation(img, optimizedPic.querySelector('img'));
```

CFO-1 marker emitted by cf-templates/article.html (plan 02-04):
```html
<div class="article-cf" data-cf-id="{{properties.path}}">
  ...
  <div class="body">{{{body}}}</div>
</div>
```
The `.body` element inside `.article-cf` is the DOMPurify target (D-04).

EXISTING file blocks/article-hero/article-hero.js (DELETE everything — full rewrite):
```javascript
const GRAPHQL_ENDPOINT = 'https://publish-p23458-e585661.adobeaemcloud.com/graphql/execute.json/sgedsdemo/article-by-path';
// ... 33 more lines, including block.innerHTML = template-literal at lines 23-30 (CP-2 XSS sink)
```
(Pre-commit guard `.husky/pre-commit.mjs` rejects re-introduction of `publish-*adobeaemcloud.com` strings.)

Existing UE component-model partial pattern from blocks/fragment/_fragment.json:
```json
{
  "definitions": [{
    "title": "Fragment",
    "id": "fragment",
    "plugins": {
      "xwalk": {
        "page": {
          "resourceType": "core/franklin/components/block/v1/block",
          "template": { "name": "Fragment", "model": "fragment" }
        }
      }
    }
  }],
  "models": [{
    "id": "fragment",
    "fields": [{ "component": "aem-content", "name": "reference", "label": "Reference" }]
  }],
  "filters": []
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rewrite `blocks/article-hero/article-hero.js`</name>
  <read_first>
    - blocks/article-hero/article-hero.js (CURRENT — read to confirm what is being replaced; line 1 has the publish-host literal)
    - blocks/article-hero/article-hero.css (existing selectors `.article-hero`, `.article-hero-overlay` — confirms which classes the rewritten block emits)
    - blocks/cards/cards.js (Pattern S3 — `moveInstrumentation` call sites)
    - blocks/header/header.js (Pattern S1 — `loadFragment` + null-guard skeleton; lines 110-115)
    - scripts/cf-overlay.js (the `fetchOverlay` contract this block consumes)
    - scripts/scripts.js (the `moveInstrumentation` source — see lines 39-47)
    - scripts/editor-support.js (lines 32-34 — DOMPurify default-profile call shape)
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-04 DOMPurify wiring point, D-08 empty-state contract)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pattern 2 — full block decorator skeleton; Pitfall 2/3 — CP-2/CP-3 closure)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (block decorator composite analog notes; Pattern S2/S3/S4)
  </read_first>
  <action>
**REPLACE THE ENTIRE FILE** `blocks/article-hero/article-hero.js` with the following content. The existing file's line-1 publish-host literal MUST be deleted (Phase 1 D-04 carve-out); the existing `block.innerHTML = ...` body at lines 23-30 MUST be deleted (CP-2 XSS sink closure).

```javascript
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchOverlay } from '../../scripts/cf-overlay.js';
import DOMPurify from '../../scripts/dompurify.min.js';

/**
 * Article Hero block — Content Fragment Overlay consumer.
 *
 * Replaces the legacy GraphQL fetch (Phase 1 D-04 carve-out: `publish-*` literal
 * deleted) with `fetchOverlay(cfPath)` (plan 02-03 / D-03), sanitizes the
 * rich-text body container with DOMPurify (D-04, default profile per D-05 — closes
 * CP-2 XSS in the same PR as the migration), and preserves UE `data-aue-*`
 * instrumentation via `moveInstrumentation` (CP-3 closure, mirrors `blocks/cards/cards.js:9,19`).
 *
 * On any error class (no link, non-DAM cfPath, fetch failure, missing wrapper
 * marker, missing fields), the block degrades to an empty container with a single
 * `console.error` (D-08). Block element + UE attrs preserved so authors can re-pick
 * the CF in the UE side panel; saving triggers `applyChanges` → in-place re-render.
 *
 * Expected CF schema (see DOC-01 `## CF model` and `samples/cf-model-export.json`):
 *   - title: text
 *   - body:  rich-text
 *   - image: image-ref
 *
 * @param {Element} block The block root element with a `<a href="/content/dam/...">` child.
 */
export default async function decorate(block) {
  const link = block.querySelector('a');
  if (!link) return;
  const cfPath = link.getAttribute('href').replace(/\.html$/, '');

  const fragment = await fetchOverlay(cfPath);
  if (!fragment) {
    // eslint-disable-next-line no-console
    console.error('article-hero: missing CF', cfPath);
    block.replaceChildren();
    return;
  }

  // D-04 wiring point: sanitize the rich-text body container ONLY (never
  // fragment-wide — would strip data-aue-* from the wrapper). Default profile
  // (D-05) matches scripts/editor-support.js:32-34.
  const body = fragment.querySelector('.body');
  if (body) body.innerHTML = DOMPurify.sanitize(body.innerHTML);

  // CP-3 closure: move UE instrumentation from the source <a> (which UE injected
  // with data-aue-* attrs identifying the cfReference field) to the new wrapper
  // so click-to-edit survives the DOM swap.
  const wrapper = fragment.firstElementChild;
  if (wrapper) moveInstrumentation(link, wrapper);

  block.replaceChildren(...fragment.childNodes);
}
```

Notes for the executor:
1. **Line 1 must NOT be the GRAPHQL_ENDPOINT literal** — pre-commit guard at `.husky/pre-commit.mjs:26,40-63` rejects any commit reintroducing `publish-[a-zA-Z0-9-]+\.adobeaemcloud\.com`. The rewritten file has imports on line 1.
2. The inline `// eslint-disable-next-line no-console` is mandatory — airbnb-base forbids `console.*` otherwise. Pattern S4 from PATTERNS.md, also visible at `scripts/scripts.js:69`.
3. `block.replaceChildren()` (no args) empties children but keeps the block element (and its `data-aue-*` attrs) — D-08 contract. NEVER use `block.remove()`.
4. The `wrapper` may be the `<div class="article-cf">` from the Mustache template OR (if `decorateMain` wraps it in a section) a `.section` div. Either way, `firstElementChild` is the right target for `moveInstrumentation`.
5. `block.replaceChildren(...fragment.childNodes)` spreads the children (NOT `fragment` itself — `fragment` is a `<main>`, we want its children).
6. **Do NOT modify `blocks/article-hero/article-hero.css`** in this task. Existing selectors `.article-hero`, `.article-hero-overlay` apply to the block wrapper rendered by EDS authoring (the outer `<div class="article-hero">` containing the `<a>`). The CFO content rendered inside is shaped by `cf-templates/article.html` (plan 02-04). If layout breaks at smoke-test time (plan 02-08), CSS adjustments are scoped to a follow-up task — NOT this one.
  </action>
  <verify>
    <automated>npx eslint blocks/article-hero/article-hero.js</automated>
  </verify>
  <acceptance_criteria>
    - `blocks/article-hero/article-hero.js` does NOT contain `publish-p23458` — verifiable: `grep -L 'publish-p23458' blocks/article-hero/article-hero.js` returns the file.
    - `blocks/article-hero/article-hero.js` does NOT contain `GRAPHQL_ENDPOINT` — verifiable: `grep -L 'GRAPHQL_ENDPOINT' blocks/article-hero/article-hero.js` returns the file.
    - File contains literal `import { fetchOverlay } from '../../scripts/cf-overlay.js'` — verifiable: `grep -l "import { fetchOverlay } from '../../scripts/cf-overlay.js'" blocks/article-hero/article-hero.js` returns the file.
    - File contains `DOMPurify.sanitize` — verifiable: `grep -l 'DOMPurify\.sanitize' blocks/article-hero/article-hero.js` returns the file.
    - File contains `moveInstrumentation(` — verifiable: `grep -l 'moveInstrumentation(' blocks/article-hero/article-hero.js` returns the file.
    - File contains `console.error('article-hero: missing CF'` — verifiable: `grep -l "console.error('article-hero: missing CF'" blocks/article-hero/article-hero.js` returns the file.
    - File contains `block.replaceChildren()` (no-args call somewhere) — verifiable: `grep -l 'block\.replaceChildren()' blocks/article-hero/article-hero.js` returns the file.
    - File default-exports an async function — verifiable: `grep -l 'export default async function decorate' blocks/article-hero/article-hero.js` returns the file.
    - File does NOT contain `block.innerHTML` (XSS sink removed) — verifiable: `grep -L 'block\.innerHTML' blocks/article-hero/article-hero.js` returns the file.
    - `npx eslint blocks/article-hero/article-hero.js` exits 0.
  </acceptance_criteria>
  <done>
    Rewrite ships. CFO-04 / CFO-05 / CFO-07 / CFO-09 closed for the hero block. CP-2 XSS sink closed. CP-3 UE instrumentation preserved.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create `blocks/article-hero/_article-hero.json` UE component model partial</name>
  <read_first>
    - blocks/fragment/_fragment.json (analog — single-field reference block model)
    - blocks/hero/_hero.json (mixed-field-type cross-reference)
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-06 — single `cfReference` field; per-instance overrides explicitly deferred to v2)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pattern 3 — `aem-content-fragment` vs `reference` component decision; A1)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`_article-hero.json` analog notes — verbatim shape from `_fragment.json`)
    - .husky/pre-commit.mjs (lines 16-22 — confirms staged `_*.json` partials trigger `npm run build:json` automatically)
  </read_first>
  <action>
Create `blocks/article-hero/_article-hero.json` with the following content. Field component is `aem-content-fragment` per Pattern 3 / A1 (try first; if UE rejects in plan 02-08 smoke testing, a follow-up swaps to `reference` with `valueType: string` + the same other props).

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

Notes for the executor:
1. The shape mirrors `blocks/fragment/_fragment.json` exactly except for the field component, name, label, and validation root path. `resourceType` is verbatim `"core/franklin/components/block/v1/block"` (do not change).
2. `validation.rootPath` scopes the UE picker to article CFs — keeps authors from accidentally picking nav/footer fragments.
3. **Do NOT manually edit `component-models.json`, `component-definition.json`, or `component-filters.json`** — the husky pre-commit hook (`.husky/pre-commit.mjs:16-22`) detects staged `_*.json` partials matching `(^|/)_.*.json` and runs `npm run build:json --silent`, then `git add`s the regenerated bundles.
4. The hook only runs when partials are STAGED — staging this file via `git add blocks/article-hero/_article-hero.json` and committing will trigger the rebuild. (Plan 02-06 ships the symmetrical teaser partial; both rebuild together.)
5. ESLint with `eslint-plugin-json` validates JSON syntax. `npx eslint blocks/article-hero/_article-hero.json` should pass.
  </action>
  <verify>
    <automated>node -e "JSON.parse(require('fs').readFileSync('blocks/article-hero/_article-hero.json','utf8'))" && npx eslint blocks/article-hero/_article-hero.json</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `blocks/article-hero/_article-hero.json`.
    - JSON parses successfully (verify command above).
    - File contains literal `"id": "article-hero"` — verifiable: `grep -l '"id": "article-hero"' blocks/article-hero/_article-hero.json` returns the file.
    - File contains `"name": "cfReference"` — verifiable: `grep -l '"name": "cfReference"' blocks/article-hero/_article-hero.json` returns the file.
    - File contains `"required": true` — verifiable: `grep -l '"required": true' blocks/article-hero/_article-hero.json` returns the file.
    - File contains `/content/dam/sgedsdemo/articles` (validation root) — verifiable: `grep -l '/content/dam/sgedsdemo/articles' blocks/article-hero/_article-hero.json` returns the file.
    - File contains `"resourceType": "core/franklin/components/block/v1/block"` — verifiable: `grep -l 'core/franklin/components/block/v1/block' blocks/article-hero/_article-hero.json` returns the file.
    - `npx eslint blocks/article-hero/_article-hero.json` exits 0.
  </acceptance_criteria>
  <done>
    UE component model committed. Husky pre-commit hook will regenerate the merged `component-*.json` bundles when this is staged with plan 02-06's teaser partial. CFO-06 closed for the hero block.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Mustache-rendered HTML → block DOM | Rich-text body is author-controlled. DOMPurify default profile applied (D-04/D-05). |
| `<a href>` cfPath input → fetchOverlay | UE-injected, validated against `DAM_PREFIX` inside `fetchOverlay`. |
| UE patch event → re-decoration | `applyChanges` (Phase 1 null-guarded) re-runs `decorate(block)`. D-08 empty-state preserves block element + UE attrs across patch failures. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-05-01 | Tampering / Information Disclosure (XSS, CP-2) | `body.innerHTML = body.innerHTML` after `{{{body}}}` Mustache output | mitigate | `body.innerHTML = DOMPurify.sanitize(body.innerHTML)` BEFORE insertion. Acceptance criterion grep enforces presence. Default profile strips `<script>`, `on*=`, `javascript:`, `<iframe>`, `<object>`. Plan 02-08 smoke test verifies XSS payload renders inert. |
| T-02-05-02 | Tampering (CP-3) | UE `data-aue-*` lost on DOM swap | mitigate | `moveInstrumentation(link, wrapper)` before `block.replaceChildren(...)`. Acceptance criterion grep enforces presence. |
| T-02-05-03 | Information Disclosure | Hardcoded publish host regression | mitigate | `.husky/pre-commit.mjs:26,40-63` rejects any commit containing `publish-[a-zA-Z0-9-]+\.adobeaemcloud\.com`. Acceptance criterion grep enforces absence. |
| T-02-05-04 | Denial of Service / Tampering (CFO-1) | 200 OK with wrong page body | mitigate | `fetchOverlay` (plan 02-03) asserts `.article-cf` marker; returns null → block degrades to D-08 empty-state. |
| T-02-05-05 | Denial of Service | Throw inside decorate crashing block render | mitigate | `fetchOverlay` returns null on any error class — never throws. Decorate has no try/catch (none needed); soft-fails per D-08. |
</threat_model>

<verification>
- `npx eslint blocks/article-hero/article-hero.js blocks/article-hero/_article-hero.json` exits 0.
- All acceptance-criterion greps in both tasks pass.
- Husky pre-commit hook rebuilds `component-*.json` (verified by reading post-commit `git status` — no untracked component-*.json changes).
- Pre-commit publish-host scanner accepts the rewrite (no `publish-*adobeaemcloud.com` strings).
</verification>

<success_criteria>
CFO-04 + CFO-05 + CFO-06 + CFO-07 + CFO-09 closed for `article-hero`. CP-2 XSS sink for the hero block closed. CP-3 instrumentation preserved.
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-05-SUMMARY.md`. Note any deviations from `aem-content-fragment` field component (e.g., if UE smoke testing in plan 02-08 forces a swap to `reference` + `valueType: string`).
</output>
