---
phase: 02-content-fragment-overlay
plan: 06
type: execute
wave: 4
depends_on: [02-03, 02-04]
files_modified:
  - blocks/article-teaser/article-teaser.js
  - blocks/article-teaser/_article-teaser.json
  - head.html
autonomous: true
requirements: [CFO-04, CFO-05, CFO-06, CFO-07, CFO-08, CFO-09]
must_haves:
  truths:
    - "`blocks/article-teaser/article-teaser.js` no longer contains the `publish-p23458-*` GraphQL endpoint literal."
    - "`blocks/article-teaser/article-teaser.js` uses `fetchOverlay` from `scripts/cf-overlay.js` and sanitizes the rich-text body container with DOMPurify (D-04, default profile)."
    - "On error, block logs `console.error('article-teaser: missing CF', cfPath)` and calls `block.replaceChildren()` (D-08)."
    - "`moveInstrumentation(srcLink, fragmentWrapper)` preserves UE `data-aue-*` attrs across DOM swap."
    - "`blocks/article-teaser/_article-teaser.json` exposes the same single `cfReference` field shape as `_article-hero.json` (D-06)."
    - "`head.html` contains `<meta name=\"cf-endpoint\" content=\"/content/dam/sgedsdemo\"/>` (CFO-08 — `getMetadata('cf-endpoint')` consumer in `scripts/cf-overlay.js` reads this)."
  artifacts:
    - path: "blocks/article-teaser/article-teaser.js"
      provides: "Rewritten teaser block decorator — symmetric to article-hero."
      min_lines: 25
      contains: "fetchOverlay"
    - path: "blocks/article-teaser/_article-teaser.json"
      provides: "UE component-model partial for the teaser block."
      contains: "cfReference"
    - path: "head.html"
      provides: "Page-level CFO endpoint metadata declaration."
      contains: "cf-endpoint"
  key_links:
    - from: "blocks/article-teaser/article-teaser.js"
      to: "scripts/cf-overlay.js"
      via: "named import { fetchOverlay }"
      pattern: "import\\s*\\{[^}]*fetchOverlay[^}]*\\}\\s*from\\s*['\"]\\.\\./\\.\\./scripts/cf-overlay\\.js['\"]"
    - from: "head.html"
      to: "scripts/cf-overlay.js"
      via: "getMetadata('cf-endpoint') reads <meta name=\"cf-endpoint\">"
      pattern: "name=\"cf-endpoint\""
---

<objective>
Symmetric rewrite of `blocks/article-teaser/article-teaser.js` against the same `fetchOverlay` + DOMPurify + `moveInstrumentation` pattern locked in plan 02-05. Add `blocks/article-teaser/_article-teaser.json` with the same single `cfReference` field shape. Add the `<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>` line to `head.html` (CFO-08 — the `getMetadata('cf-endpoint')` consumer is already present in `scripts/cf-overlay.js` from plan 02-03; this plan injects the metadata it reads).

Purpose: Second Wave 2 block rewrite + cf-endpoint metadata wiring. Closes CFO-04/05/06/07/09 for the teaser block AND closes CFO-08 site-wide.
Output: One rewritten file, one new model partial, one modified line in `head.html`. Husky regenerates `component-*.json` automatically when staged together with plan 02-05's hero partial.
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
@scripts/cf-overlay.js
@scripts/scripts.js
@scripts/dompurify.min.js
@blocks/article-teaser/article-teaser.js
@blocks/article-teaser/article-teaser.css
@blocks/article-hero/article-hero.js
@blocks/fragment/_fragment.json
@head.html

<interfaces>
<!-- Same locked contracts as plan 02-05. The teaser is a symmetric rewrite. -->

EXISTING file blocks/article-teaser/article-teaser.js (DELETE everything — full rewrite):
```javascript
const GRAPHQL_ENDPOINT = 'https://publish-p23458-e585661.adobeaemcloud.com/graphql/execute.json/sgedsdemo/article-by-path';
// ... 28 lines, including block.innerHTML = template-literal at lines 20-25 (CP-2 XSS sink)
```

EXISTING head.html (current — 9 lines):
```html
<meta http-equiv="Content-Security-Policy" content="script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; base-uri 'self'; object-src 'none';" move-to-http-header="true">
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script nonce="aem" src="/scripts/aem.js" type="module"></script>
<script nonce="aem" src="/scripts/scripts.js" type="module"></script>
<link rel="stylesheet" href="/styles/styles.css"/>
```

cf-endpoint value (per A2 / RESEARCH §Pattern 4): the DAM root prefix `/content/dam/sgedsdemo`. Consumer is `scripts/cf-overlay.js` which reads via `getMetadata('cf-endpoint') || DAM_PREFIX`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Rewrite `blocks/article-teaser/article-teaser.js`</name>
  <read_first>
    - blocks/article-teaser/article-teaser.js (CURRENT — read line 1 has publish-host literal; lines 20-25 have innerHTML XSS sink)
    - blocks/article-teaser/article-teaser.css (existing selectors `.article-teaser`, `.article-teaser .body`)
    - blocks/article-hero/article-hero.js (the SAME-PR sibling rewrite from plan 02-05 — share imports + skeleton)
    - scripts/cf-overlay.js (the `fetchOverlay` contract)
    - scripts/scripts.js (lines 39-47 — `moveInstrumentation`)
    - scripts/editor-support.js (lines 32-34 — DOMPurify pattern)
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-04 / D-08)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pattern 2)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (article-teaser symmetric rewrite notes)
  </read_first>
  <action>
**REPLACE THE ENTIRE FILE** `blocks/article-teaser/article-teaser.js` with the following content. The existing file's line-1 publish-host literal MUST be deleted; the existing `block.innerHTML = ...` body at lines 20-25 MUST be deleted.

```javascript
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchOverlay } from '../../scripts/cf-overlay.js';
import DOMPurify from '../../scripts/dompurify.min.js';

/**
 * Article Teaser block — Content Fragment Overlay consumer.
 *
 * Symmetric to `blocks/article-hero/article-hero.js`. Replaces the legacy
 * GraphQL fetch (Phase 1 D-04 carve-out: `publish-*` literal deleted) with
 * `fetchOverlay(cfPath)`, sanitizes the rich-text body container with
 * DOMPurify default profile (D-04/D-05 — closes CP-2 XSS), and preserves
 * UE `data-aue-*` instrumentation via `moveInstrumentation` (CP-3 closure).
 *
 * On any error class, the block degrades to an empty container with a single
 * `console.error` (D-08) — block element + UE attrs preserved.
 *
 * @param {Element} block The block root with a `<a href="/content/dam/...">` child.
 */
export default async function decorate(block) {
  const link = block.querySelector('a');
  if (!link) return;
  const cfPath = link.getAttribute('href').replace(/\.html$/, '');

  const fragment = await fetchOverlay(cfPath);
  if (!fragment) {
    // eslint-disable-next-line no-console
    console.error('article-teaser: missing CF', cfPath);
    block.replaceChildren();
    return;
  }

  // D-04 wiring point: sanitize rich-text body container ONLY.
  const body = fragment.querySelector('.body');
  if (body) body.innerHTML = DOMPurify.sanitize(body.innerHTML);

  // CP-3 closure: preserve UE click-to-edit across DOM swap.
  const wrapper = fragment.firstElementChild;
  if (wrapper) moveInstrumentation(link, wrapper);

  block.replaceChildren(...fragment.childNodes);
}
```

Notes for the executor:
1. Same constraints as plan 02-05 Task 1: no `GRAPHQL_ENDPOINT`, no `block.innerHTML = ...`, no `publish-` literals, mandatory `// eslint-disable-next-line no-console`, default-export async.
2. Only difference from `article-hero.js`: the `console.error` prefix is `'article-teaser: missing CF'`.
3. **Do NOT modify `blocks/article-teaser/article-teaser.css`** in this task — existing `.article-teaser` and `.article-teaser .body` selectors should match the rendered fragment shape (the `.body` div is emitted by `cf-templates/article.html` from plan 02-04). If layout breaks at smoke-test time, CSS is a follow-up.
  </action>
  <verify>
    <automated>npx eslint blocks/article-teaser/article-teaser.js</automated>
  </verify>
  <acceptance_criteria>
    - File does NOT contain `publish-p23458` — verifiable: `grep -L 'publish-p23458' blocks/article-teaser/article-teaser.js` returns the file.
    - File does NOT contain `GRAPHQL_ENDPOINT` — verifiable: `grep -L 'GRAPHQL_ENDPOINT' blocks/article-teaser/article-teaser.js` returns the file.
    - File contains `import { fetchOverlay } from '../../scripts/cf-overlay.js'` — verifiable: `grep -l "import { fetchOverlay } from '../../scripts/cf-overlay.js'" blocks/article-teaser/article-teaser.js` returns the file.
    - File contains `DOMPurify.sanitize` — verifiable: `grep -l 'DOMPurify\.sanitize' blocks/article-teaser/article-teaser.js` returns the file.
    - File contains `moveInstrumentation(` — verifiable: `grep -l 'moveInstrumentation(' blocks/article-teaser/article-teaser.js` returns the file.
    - File contains `console.error('article-teaser: missing CF'` — verifiable: `grep -l "console.error('article-teaser: missing CF'" blocks/article-teaser/article-teaser.js` returns the file.
    - File does NOT contain `block.innerHTML` — verifiable: `grep -L 'block\.innerHTML' blocks/article-teaser/article-teaser.js` returns the file.
    - `npx eslint blocks/article-teaser/article-teaser.js` exits 0.
  </acceptance_criteria>
  <done>
    Teaser block rewrite ships. CFO-04/05/07/09 closed for teaser. CP-2 XSS sink closed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Create `blocks/article-teaser/_article-teaser.json` UE component model partial</name>
  <read_first>
    - blocks/article-hero/_article-hero.json (the sibling partial from plan 02-05 — copy shape, swap identifiers)
    - blocks/fragment/_fragment.json (analog)
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-06)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`_article-teaser.json` notes — same shape as hero)
    - .husky/pre-commit.mjs (lines 16-22 — auto-merge of `_*.json`)
  </read_first>
  <action>
Create `blocks/article-teaser/_article-teaser.json` with this exact content (only differences from `_article-hero.json` are the title/id/template fields — `Article Hero` → `Article Teaser`, `article-hero` → `article-teaser`):

```json
{
  "definitions": [
    {
      "title": "Article Teaser",
      "id": "article-teaser",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/block/v1/block",
            "template": {
              "name": "Article Teaser",
              "model": "article-teaser"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "article-teaser",
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
1. **Do NOT manually edit `component-models.json` / `component-definition.json` / `component-filters.json`** — husky pre-commit auto-rebuilds.
2. Staging this partial together with plan 02-05's `_article-hero.json` triggers ONE rebuild covering both, avoiding interleaved bundle conflicts.
3. JSON syntax must validate via `eslint-plugin-json`.
  </action>
  <verify>
    <automated>node -e "JSON.parse(require('fs').readFileSync('blocks/article-teaser/_article-teaser.json','utf8'))" && npx eslint blocks/article-teaser/_article-teaser.json</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `blocks/article-teaser/_article-teaser.json`.
    - JSON parses successfully.
    - File contains `"id": "article-teaser"` — verifiable: `grep -l '"id": "article-teaser"' blocks/article-teaser/_article-teaser.json` returns the file.
    - File contains `"name": "cfReference"` — verifiable: `grep -l '"name": "cfReference"' blocks/article-teaser/_article-teaser.json` returns the file.
    - File contains `/content/dam/sgedsdemo/articles` validation rootPath — verifiable: `grep -l '/content/dam/sgedsdemo/articles' blocks/article-teaser/_article-teaser.json` returns the file.
    - `npx eslint blocks/article-teaser/_article-teaser.json` exits 0.
  </acceptance_criteria>
  <done>
    UE component model committed for teaser. Combined with plan 02-05's hero partial, husky pre-commit will regenerate the merged `component-*.json` bundles in one go. CFO-06 closed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Add `<meta name="cf-endpoint">` to `head.html` (CFO-08)</name>
  <read_first>
    - head.html (CURRENT — 9 lines, see <interfaces> above)
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (CFO-08 carry-forward — endpoint sourced from `getMetadata('cf-endpoint')`)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pattern 4 — meta tag value is DAM root prefix, not full host URL)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (head.html analog — append a single `<meta>` line)
    - scripts/cf-overlay.js (consumer — `getMetadata('cf-endpoint') || DAM_PREFIX`)
    - .husky/pre-commit.mjs (lines 33-38 — `head.html` is in `isRuntimeCodePath`; the value `/content/dam/sgedsdemo` does NOT match the publish-host regex, so the guard accepts)
  </read_first>
  <action>
Edit `head.html` and add the following line immediately after the existing `<meta name="viewport" .../>` line (currently line 6). The new file should look like:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; base-uri 'self'; object-src 'none';"
  move-to-http-header="true"
>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>
<script nonce="aem" src="/scripts/aem.js" type="module"></script>
<script nonce="aem" src="/scripts/scripts.js" type="module"></script>
<link rel="stylesheet" href="/styles/styles.css"/>
```

Notes for the executor:
1. The value is the DAM root prefix (without trailing slash, matching `DAM_PREFIX` in `scripts/config.js` minus trailing slash — both `getMetadata` consumer in `scripts/cf-overlay.js` and any future CFO consumer can `startsWith`-check uniformly).
2. **Do NOT use a host URL** like `https://author-...adobeaemcloud.com` — that would expose the Author host to anonymous browsers and could trigger CFO-2 (CORS / credentials misconfiguration). The path-only value is correct per Pattern 4 / A2.
3. **Do NOT add CSP changes** — `<meta>` is metadata, not a script. CSP at line 1-5 already covers script loading.
4. Pre-commit guard at `.husky/pre-commit.mjs:26,40-63` scans `head.html` for `publish-[a-zA-Z0-9-]+\.adobeaemcloud\.com` — the value `/content/dam/sgedsdemo` does not match → guard accepts.
5. The new line is exactly: `<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>` — note the self-closing slash matches the existing `viewport` meta line style.
  </action>
  <verify>
    <automated>grep -l 'name="cf-endpoint" content="/content/dam/sgedsdemo"' head.html</automated>
  </verify>
  <acceptance_criteria>
    - `head.html` contains the literal line `<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>` — verifiable: `grep -l 'name="cf-endpoint" content="/content/dam/sgedsdemo"' head.html` returns the file.
    - `head.html` does NOT contain `publish-` — verifiable: `grep -L 'publish-[a-zA-Z0-9-]*\.adobeaemcloud' head.html` returns the file.
    - `head.html` line count increased by exactly 1 vs the prior 9-line baseline (10 lines now, including the new meta) — verifiable: `wc -l < head.html` returns `10`.
    - File still contains the `Content-Security-Policy` meta — verifiable: `grep -l 'Content-Security-Policy' head.html` returns the file.
  </acceptance_criteria>
  <done>
    CFO-08 closed. `getMetadata('cf-endpoint')` in `scripts/cf-overlay.js` now reads `/content/dam/sgedsdemo` page-side. The hardcoded persisted-query path that lived in the old article blocks (line 1 of each) is gone (deleted by tasks above) AND replaced with the metadata-driven config — exactly the CFO-08 requirement.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Mustache-rendered HTML → teaser block DOM | Same as article-hero — DOMPurify default profile on `.body`. |
| `head.html` `<meta name="cf-endpoint">` → `getMetadata` consumer | Static page-time configuration. Path-only value (no host URL) eliminates Author-host exposure. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-06-01 | Tampering / Information Disclosure (CP-2 XSS) | teaser `body.innerHTML` after Mustache `{{{body}}}` | mitigate | Same `DOMPurify.sanitize` wiring as 02-05. Smoke test in 02-08. |
| T-02-06-02 | Tampering (CP-3) | UE `data-aue-*` lost on DOM swap | mitigate | Same `moveInstrumentation` wiring as 02-05. |
| T-02-06-03 | Information Disclosure | Author-host URL exposed via cf-endpoint meta | mitigate | Value is DAM root prefix `/content/dam/sgedsdemo` — path only, no host. Acceptance criterion enforces exact value. |
| T-02-06-04 | Tampering | publish-host regression in head.html | mitigate | Pre-commit guard `.husky/pre-commit.mjs:26,40-63` scans top-level `*.html`; acceptance criterion grep enforces absence. |
</threat_model>

<verification>
- `npx eslint blocks/article-teaser/article-teaser.js blocks/article-teaser/_article-teaser.json` exits 0.
- `head.html` contains the new `cf-endpoint` meta line and no publish-host literals.
- All acceptance criteria pass.
- After staging + commit, husky regenerates `component-*.json` bundles automatically.
</verification>

<success_criteria>
CFO-04/05/06/07/09 closed for teaser block; CFO-08 closed site-wide. Both article block flavors now consume the CFO pipeline.
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-06-SUMMARY.md`. Note: this completes the runtime code surface for Phase 2. Wave 3 plans 02-07 (DOC-01) and 02-08 (smoke tests) verify behavior end-to-end.
</output>
