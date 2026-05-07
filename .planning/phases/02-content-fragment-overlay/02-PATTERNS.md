# Phase 2: Content Fragment Overlay — Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** 11 (7 net-new repo files + 4 modified) — plus 1 out-of-repo (CF model JSON pasted into DOC-01)
**Analogs found:** 11 / 11 (every new file has a strong existing analog in this repo)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `scripts/cf-overlay.js` | helper module (named exports) | request-response (GET overlay → `<main>`) | `blocks/fragment/fragment.js:21-44` (`loadFragment`) | exact (delegates to it) |
| `cf-templates/article.html` | Mustache template (server-side rendered by json2html worker) | transform (CF JSON → HTML) | NONE — first Mustache template in repo (greenfield) | no analog (use Adobe json2html docs + D-03/specifics) |
| `blocks/article-hero/article-hero.js` (REWRITE) | block decorator | request-response + DOM swap | `blocks/header/header.js:110-115` (loadFragment + null-guard) + `blocks/cards/cards.js:1-23` (moveInstrumentation) + `scripts/editor-support.js:32-34` (DOMPurify) | exact composite |
| `blocks/article-teaser/article-teaser.js` (REWRITE) | block decorator | request-response + DOM swap | same as article-hero | exact composite |
| `blocks/article-hero/_article-hero.json` (NEW) | UE component-model partial | build-time (merged into `component-*.json`) | `blocks/fragment/_fragment.json` | exact (single-reference field block) |
| `blocks/article-teaser/_article-teaser.json` (NEW) | UE component-model partial | build-time | `blocks/fragment/_fragment.json` | exact |
| `blocks/article-hero/article-hero.css` (POSSIBLE EDIT) | block stylesheet | n/a | existing file in same dir | self-analog |
| `blocks/article-teaser/article-teaser.css` (POSSIBLE EDIT) | block stylesheet | n/a | existing file in same dir | self-analog |
| `head.html` (MODIFIED) | bootstrap markup | static metadata | existing `<meta name="viewport">` line | self-analog (additive line) |
| `docs/content-fragment-overlay.md` (NEW) | feature documentation | n/a | NO existing `docs/` precedent in repo | no analog (first docs entry — establish house style) |
| Smoke-test page under `/test-cfo` (NEW, authored in AEM) | content authoring artifact | n/a | NONE in repo (lives in AEM Author tier) | out-of-repo |

**Out-of-repo artifacts (not files committed here, but managed via Admin API per D-02):**
- AEM `article` CF model — verified-or-created in AEM Author Tools → Configuration Browser; JSON export pasted into `docs/content-fragment-overlay.md` `## CF model` section.
- CFO Admin API config — `public.json` + `content.json` POSTs to `admin.hlx.page`; responses pasted into `docs/content-fragment-overlay.md` `## Reference responses`.
- json2html `/config` POST — body referencing `cf-templates/article.html`; response captured in DOC-01.

---

## Pattern Assignments

### `scripts/cf-overlay.js` (helper module, request-response)

**Analog:** `blocks/fragment/fragment.js:21-44` (the `loadFragment` primitive header & footer already use)

**Imports pattern** (model after `blocks/fragment/fragment.js:7-14` + `blocks/footer/footer.js:1-2`):
```javascript
// Mandatory .js extension. Relative paths only. No barrel imports.
import { loadFragment } from '../blocks/fragment/fragment.js';
import { getMetadata } from './aem.js';
import { DAM_PREFIX } from './config.js';
```

Project conventions enforced here:
- ESLint `import/extensions: js: always` — every relative import ends in `.js`.
- `scripts/config.js` is the single source of truth for `AEM_AUTHOR_HOST` / `DAM_PREFIX` (Phase 1 D-02 lock).
- `scripts/aem.js` is Adobe-vendored — read-only, used as a flat re-export surface.

**Core delegation pattern** (template — exact body finalized in Wave 1 plan-02-03):
```javascript
/**
 * @param {string} cfPath e.g. /content/dam/sgedsdemo/articles/foo
 * @returns {Promise<HTMLElement|null>}
 */
export async function fetchOverlay(cfPath) {
  if (!cfPath || !cfPath.startsWith(DAM_PREFIX)) return null;
  try {
    const fragment = await loadFragment(cfPath);
    // CFO-1 defensive: 200-OK-with-wrong-page check.
    if (!fragment || !fragment.firstElementChild) return null;
    return fragment;
  } catch (err) {
    return null;
  }
}

export function assetUrl(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') return '';
  // Body locked Wave 1 plan-02-03 by inspecting captured CF JSON shape.
  return repoPath;
}
```

**Soft-fail pattern** (lines mirror `blocks/fragment/fragment.js:44` — return `null` on any failure path; never throw to caller).

**Why `loadFragment` is the right primitive:** it already
- prefixes `.plain.html`,
- resets media base paths (`./media_*` → absolute URLs) at lines 31-37,
- runs `decorateMain(main)` at line 39,
- runs `loadSections(main)` at line 40,
- returns `null` on non-OK at line 44.

D-04 explicitly forbids modifying `blocks/fragment/fragment.js` (would risk stripping `data-aue-*` from nav/footer). `cf-overlay.js` consumes it, never extends it.

---

### `blocks/article-hero/article-hero.js` (block decorator, request-response + DOM swap) — REWRITE

**Composite analog:**
1. `blocks/header/header.js:110-115` — `loadFragment` + null-guard skeleton.
2. `blocks/cards/cards.js:1-23` — `moveInstrumentation` import & call sites.
3. `scripts/editor-support.js:32-34` — `DOMPurify.sanitize(html)` default profile.
4. `blocks/article-hero/article-hero.js:3-8` (current) — `block.querySelector('a').getAttribute('href').replace(/\.html$/, '')` cfPath extraction (KEEP this idiom; the rest of the file is replaced).

**Imports pattern** (mandatory shape):
```javascript
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchOverlay } from '../../scripts/cf-overlay.js';
import DOMPurify from '../../scripts/dompurify.min.js';
```

Project conventions:
- `.js` extensions mandatory.
- DOMPurify import path is `../../scripts/dompurify.min.js` — Phase 1 D-09 lock; the UMD self-attaches to `window.DOMPurify` and also exports a default. Same import style as `scripts/editor-support.js` would use if it imported instead of `loadScript`.
- `moveInstrumentation` lives in `scripts/scripts.js:39-47` — only sanctioned helper for `data-aue-*` / `data-richtext-*` carry-over.

**cfPath extraction pattern** (KEEP from current `article-hero.js:4-7` — it works):
```javascript
const link = block.querySelector('a');
if (!link) return; // soft-fail: no CF authored
const cfPath = link.getAttribute('href').replace(/\.html$/, '');
```

**Empty-state pattern** (D-08 contract; mirrors soft-fail in `blocks/fragment/fragment.js:51`):
```javascript
const fragment = await fetchOverlay(cfPath);
if (!fragment) {
  // eslint-disable-next-line no-console
  console.error('article-hero: missing CF', cfPath);
  block.replaceChildren(); // empties children; preserves block + data-aue-*
  return;
}
```

`console.error` is the ONLY sanctioned `console.*` per CLAUDE.md `## Logging`; airbnb-base `no-console` requires the inline `eslint-disable-next-line` comment exactly as shown (project style — see `scripts/scripts.js:69`).

**DOMPurify wiring point** (D-04 — body container only, never fragment-wide):
```javascript
const body = fragment.querySelector('.body');
if (body) body.innerHTML = DOMPurify.sanitize(body.innerHTML);
```

This mirrors the `scripts/editor-support.js:32-34` excerpt:
```javascript
// scripts/editor-support.js:32-34 (Phase 1 verified, default profile)
await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
const sanitizedContent = window.DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
```

D-05 simplifies to `DOMPurify.sanitize(html)` (default profile, no options object). Plain-text fields (title, alt, image src) are emitted via `{{title}}` (auto-escaped) in the Mustache template; never sanitized in JS — they arrive as `textContent` already.

**UE instrumentation preservation** (CP-3 closure; mirrors `blocks/cards/cards.js:9` and `:19`):
```javascript
const wrapper = fragment.firstElementChild;
moveInstrumentation(link, wrapper);
block.replaceChildren(...fragment.childNodes);
```

`moveInstrumentation(from, to)` body (`scripts/scripts.js:39-47`):
```javascript
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}
```

**Carry-forward deletes (Phase 1 D-03/D-04 enforcement):**
- DELETE line 1 of current `article-hero.js`: `const GRAPHQL_ENDPOINT = 'https://publish-p23458-...';` — pre-commit guard (`.husky/pre-commit.mjs:26,40-63`) now rejects any `publish-*adobeaemcloud.com` reference.
- DELETE the `block.innerHTML = template-literal` body at lines 23-30 — that is the CP-2 XSS sink.

---

### `blocks/article-teaser/article-teaser.js` (block decorator, request-response + DOM swap) — REWRITE

**Same composite analog as article-hero.** Symmetric rewrite.

**Difference notes:**
- The Mustache template renders an `<article>` element wrapping `<h2>` + `<div class="body">` (matches the existing CSS at `blocks/article-teaser/article-teaser.css:1-8` selector `.article-teaser`). `fragment.querySelector('.body')` is the DOMPurify target, identical to article-hero.
- `console.error('article-teaser: missing CF', cfPath)` — different prefix only.
- DELETE line 1 (`GRAPHQL_ENDPOINT`) and lines 20-25 (`block.innerHTML = ...`).

---

### `blocks/article-hero/_article-hero.json` (UE component-model partial, build-time) — NEW

**Analog:** `blocks/fragment/_fragment.json` (single-field reference block, exact same intent).

**Full reference excerpt** (`blocks/fragment/_fragment.json:1-32`):
```json
{
  "definitions": [
    {
      "title": "Fragment",
      "id": "fragment",
      "plugins": {
        "xwalk": {
          "page": {
            "resourceType": "core/franklin/components/block/v1/block",
            "template": {
              "name": "Fragment",
              "model": "fragment"
            }
          }
        }
      }
    }
  ],
  "models": [
    {
      "id": "fragment",
      "fields": [
        {
          "component": "aem-content",
          "name": "reference",
          "label": "Reference"
        }
      ]
    }
  ],
  "filters": []
}
```

**What to copy verbatim:**
- Top-level shape (`definitions[]` + `models[]` + `filters[]`).
- `plugins.xwalk.page.resourceType`: `"core/franklin/components/block/v1/block"` — exact string, do not change.
- `template.name` matches `definitions[].title`.

**What changes per D-06:**
- `definitions[0].title`: `"Article Hero"`
- `definitions[0].id`: `"article-hero"`
- `template.name`: `"Article Hero"`, `template.model`: `"article-hero"`
- `models[0].id`: `"article-hero"`
- `models[0].fields[0]`:
  - `component`: `"aem-content-fragment"` (try this first per Pattern 3 / Assumption A1; fall back to `"reference"` + `"valueType": "string"` if UE rejects in Wave 1).
  - `name`: `"cfReference"` (CONTEXT D-06)
  - `label`: `"Article Content Fragment"`
  - `valueType`: `"string"`
  - `validation.rootPath`: `"/content/dam/sgedsdemo/articles"` (scopes the CF picker)
  - `required`: `true`

**Mixed-field-type cross-reference** (in case the asset picker needs richer config — `blocks/hero/_hero.json:22-43`): shows `component: "reference"` with `valueType: "string"` and `multi: false` for an image picker — same shape used as the fallback for the cfReference field if `aem-content-fragment` is rejected by the running UE.

**Build pipeline:** `.husky/pre-commit.mjs:16-22` detects staged `_*.json` files matching `(^|\/)_.*.json` and runs `npm run build:json --silent`, then `git add component-models.json component-definition.json component-filters.json`. **Never hand-edit the merged top-level files** (CLAUDE.md `## File / Directory Conventions Specific to This Codebase`).

---

### `blocks/article-teaser/_article-teaser.json` (UE component-model partial) — NEW

**Same analog and shape as `_article-hero.json`.** Field is identical (single `cfReference`, same `validation.rootPath`). Identifiers swap `article-hero` → `article-teaser`, title `Article Hero` → `Article Teaser`.

**Discretionary call (D-03 / Claude's Discretion):** Both blocks COULD share a partial under `models/_article.json` — but existing repo pattern is co-located per-block partial (`blocks/<name>/_<name>.json`), and `blocks/fragment/_fragment.json` confirms the convention. Recommend co-located.

---

### `blocks/article-hero/article-hero.css` + `blocks/article-teaser/article-teaser.css` (block stylesheets) — POSSIBLE EDIT

**Self-analogs.** Existing files at `blocks/article-hero/article-hero.css:1-43` and `blocks/article-teaser/article-teaser.css:1-28` already use `.article-hero`, `.article-hero-overlay`, `.article-teaser`, `.article-teaser .body` selectors.

**If the Mustache template emits the same outer wrapper class** (`<div class="article-hero">` and `<article class="article-teaser">`), no CSS changes are needed — selectors already match.

**Conventions** (CLAUDE.md `## Naming Patterns`):
- kebab-case classes prefixed by block name (`article-hero-overlay`, not `articleHeroOverlay`).
- 4-space indent in CSS per `.editorconfig`.
- Stylelint `stylelint-config-standard` — single quotes, lowercase hex, etc.

---

### `head.html` (bootstrap markup) — MODIFIED

**Self-analog.** Append a single `<meta>` line, model after the existing `<meta name="viewport">` at `head.html:6`.

**Current file** (`head.html:1-9`):
```html
<meta http-equiv="Content-Security-Policy" ...>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<script nonce="aem" src="/scripts/aem.js" type="module"></script>
<script nonce="aem" src="/scripts/scripts.js" type="module"></script>
<link rel="stylesheet" href="/styles/styles.css"/>
```

**Add** (CFO-08 consumer, exact value locked Wave 1 plan-02-01 per A2):
```html
<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>
```

**No CSP work needed** — `<meta>` is metadata, not a script. CSP at line 3 already covers nonce-based script loading; json2html worker output is server-rendered HTML, no inline `<script>` introduced.

**Pre-commit guard relevance:** `head.html` is a top-level `.html` file → matched by `.husky/pre-commit.mjs:33-34` `isRuntimeCodePath`. The new meta tag value (`/content/dam/sgedsdemo`) does NOT match `publish-*adobeaemcloud.com` → guard accepts.

---

### `cf-templates/article.html` (Mustache template, server-side rendered) — NEW (NO REPO ANALOG)

**No analog in this repo** — this is the first Mustache template committed. Use Adobe `aem.live/developer/json2html` docs as the anchor.

**Template variable shape locked at Wave 1 plan-02-03** (depends on captured CF JSON — Assumption A4). Anticipated shape per CONTEXT specifics:

```mustache
<div class="article-hero" data-cf-id="{{id}}">
  {{#image}}<img src="{{_path}}" alt="{{title}}">{{/image}}
  <div class="article-hero-overlay">
    <h2>{{title}}</h2>
  </div>
  <div class="body">{{{body}}}</div>
</div>
```

**Hard rules** (CONTEXT specifics + Pitfall 3):
- `{{title}}` and other plain-text fields: ALWAYS double-brace (auto-escaped). Never `{{{title}}}`.
- `{{{body}}}` ONLY: triple-brace required because `body` is rich-text HTML. DOMPurify on consumer side (D-04) is the safety net.
- Outer wrapper class is the marker `fetchOverlay`'s defensive `Content-Type` check looks for (Pitfall 1 / A5).

**Conventions:**
- File lives under `cf-templates/` at repo root (Pattern §json2html / OQ-2). Worker fetches via configured `/config/<org>/<site>/<branch>` relative URL.
- `.hlxignore` already excludes dotfiles, markdown, configs, `_*` partials, and `test/` — `cf-templates/` is NOT excluded by default. Verify in Wave 1 whether the directory needs to ship via Helix delivery (yes — that is how json2html worker fetches it).

---

### `docs/content-fragment-overlay.md` (DOC-01) — NEW (NO REPO ANALOG)

**No `docs/` precedent in this repo.** This is the first feature doc — establish house style aligned with CLAUDE.md `## Project` ("Every feature ships with a working implementation _and_ a step-by-step guide in `docs/`").

**Required sections** (CONTEXT specifics):
1. `## Setup` — Admin API curl commands with `$AEM_TOKEN` placeholders (D-02). Verbatim copy of plan-02-01 / plan-02-02 commands.
2. `## CF model` — JSON schema export from AEM Author (D-07).
3. `## Mustache template authoring` — embed contents of `cf-templates/article.html` + commentary on `{{var}}` vs `{{{var}}}`.
4. `## UE wiring` — excerpt of `_article-hero.json` and `_article-teaser.json` `models[0].fields` arrays.
5. `## Reference responses` — captured CF JSON from Wave 1 plan-02-03 + CFO Admin API responses.
6. `## Smoke test` — XSS payload step from Success Criterion #2 (`<img src=x onerror=alert(1)>` as title; confirm inert render).
7. `## Error states` — D-08 recoverable-empty-container contract.

**Format conventions:** Markdown only, no special tooling. AEM/Target UI screenshots-level click paths per CLAUDE.md `## Constraints`. Code blocks use triple-backtick fenced blocks.

**Pre-commit guard relevance:** `docs/content-fragment-overlay.md` is under `docs/` → NOT in the `isRuntimeCodePath` allowlist (`.husky/pre-commit.mjs:28-38`). Documentation may freely reference `publish-p23458-*` URLs (e.g., when explaining what is being deleted) — guard skips this path. CONTEXT D-02 explicitly relies on this: curl examples that show Author hosts paste freely into DOC-01.

---

## Shared Patterns

### Pattern S1 — `loadFragment` reuse for any CF/page fetch

**Source:** `blocks/fragment/fragment.js:21-44`
**Apply to:** `scripts/cf-overlay.js` (`fetchOverlay` body delegates here)
**Used by analogs:** `blocks/header/header.js:114-115`, `blocks/footer/footer.js:12-13`

```javascript
// blocks/header/header.js:112-115
const navMeta = getMetadata('nav');
const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
const fragment = await loadFragment(navPath);
if (!fragment) return;
```

The `getMetadata(name) || fallback` + `loadFragment(path)` + `if (!fragment) return` triad is the canonical shape. Phase 2 inherits it unchanged.

---

### Pattern S2 — DOMPurify default-profile sanitize on rich-text body

**Source:** `scripts/editor-support.js:32-34`
**Apply to:** Both rewritten article blocks (D-04 wiring point)

```javascript
// scripts/editor-support.js:32-34 (Phase 1 verified)
await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
const sanitizedContent = window.DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
```

Phase 2 simplifies to `DOMPurify.sanitize(html)` (D-05 — default profile is equivalent for our use). Imports DOMPurify directly via `import DOMPurify from '../../scripts/dompurify.min.js'` instead of `loadScript`-then-window-global, because the article blocks are themselves dynamically loaded by `loadBlock` and run after CSP-allowed module loading.

**Critical:** scope to `body` element only — NEVER fragment-wide (D-04). Sanitizing a fragment that contains `data-aue-*`-instrumented elements risks stripping the attributes UE relies on.

---

### Pattern S3 — `moveInstrumentation` for UE attribute carry-over

**Source:** `scripts/scripts.js:39-47`
**Apply to:** Both rewritten article blocks (CP-3 closure)
**Used by analog:** `blocks/cards/cards.js:9` and `:19`

```javascript
// blocks/cards/cards.js:9 (row→li carry-over)
const li = document.createElement('li');
moveInstrumentation(row, li);
```

```javascript
// blocks/cards/cards.js:19 (img→optimizedPic carry-over)
moveInstrumentation(img, optimizedPic.querySelector('img'));
```

Phase 2 article blocks use the same call shape: `moveInstrumentation(srcLink, fragmentWrapper)` before `block.replaceChildren(...)`.

---

### Pattern S4 — Soft-fail with `console.error` + early return

**Source:** Codebase-wide convention (CLAUDE.md `## Error Handling` + `## Logging`)
**Examples:**
- `scripts/scripts.js:69` — `// eslint-disable-next-line no-console\n      console.error('Auto Blocking failed', error);`
- `blocks/fragment/fragment.js:44` / `:51` — return null on missing data, never throw.

**Apply to:** Both rewritten article blocks (D-08 empty-state contract).

```javascript
if (!fragment) {
  // eslint-disable-next-line no-console
  console.error('article-hero: missing CF', cfPath);
  block.replaceChildren();
  return;
}
```

The inline `eslint-disable-next-line no-console` is mandatory — airbnb-base `no-console` rule otherwise fails CI (`.github/workflows/main.yaml`).

---

### Pattern S5 — Husky pre-commit auto-merge of `_*.json` partials

**Source:** `.husky/pre-commit.mjs:12-22`
**Apply to:** Both new `_<block>.json` partials (no Phase 2 code change — pipeline is automatic).

```javascript
// .husky/pre-commit.mjs:16-22
const modifledPartials = modifiedFiles.filter((file) => file.match(/(^|\/)_.*.json/));
if (modifledPartials.length > 0) {
  const output = await run('npm run build:json --silent');
  // eslint-disable-next-line no-console
  console.log(output);
  await run('git add component-models.json component-definition.json component-filters.json');
}
```

**Implication for the planner:** Plans that add `_article-hero.json` / `_article-teaser.json` MUST NOT also stage edits to `component-models.json` / `component-definition.json` / `component-filters.json`. The hook re-stages those automatically. Manual edits create merge conflicts with the next pre-commit run.

---

### Pattern S6 — Pre-commit publish-host guard

**Source:** `.husky/pre-commit.mjs:24-80` (Phase 1 SET-03 deliverable)
**Apply to:** Article-block rewrites (deletion of `GRAPHQL_ENDPOINT` literal at line 1 of each file is enforced by this guard going forward).

```javascript
// .husky/pre-commit.mjs:26
const PUBLISH_HOST_RE = /publish-[A-Za-z0-9-]+\.adobeaemcloud\.com/;

const isRuntimeCodePath = (file) => {
  if (file.startsWith('blocks/')) return true;
  if (file.startsWith('scripts/')) return true;
  if (!file.includes('/')) {
    if (file.endsWith('.html')) return true;
    if (file.endsWith('.json')) return true;
  }
  return false;
};
```

**Implication:** any reintroduction of `publish-*adobeaemcloud.com` in `blocks/`, `scripts/`, top-level `*.html`, or top-level `*.json` aborts the commit. Documentation under `docs/` and planning under `.planning/` are explicitly skipped. `cf-templates/article.html` is NOT in the allowlist (it is under `cf-templates/`, not at top level) → the guard does NOT scan it. If a publish-host literal is needed inside the Mustache template (it should not be), revisit the allowlist.

---

### Pattern S7 — `getMetadata(name)` consumer (CFO-08)

**Source:** `scripts/aem.js` (Adobe-vendored; consumed in `blocks/header/header.js:112` and `blocks/footer/footer.js:10`)

```javascript
// blocks/header/header.js:112-113
const navMeta = getMetadata('nav');
const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
```

**Apply to:** `scripts/cf-overlay.js` — read `cf-endpoint` once at module init or per-call, with `DAM_PREFIX` from `scripts/config.js` as the fallback.

```javascript
const cfRoot = getMetadata('cf-endpoint') || DAM_PREFIX;
```

---

### Pattern S8 — JSDoc on exported helpers + decorators

**Source:** `blocks/fragment/fragment.js:16-20`, `scripts/scripts.js:34-38`, `blocks/header/header.js:106-109`

```javascript
/**
 * Loads a fragment.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement} The root element of the fragment
 */
export async function loadFragment(path) { /* ... */ }
```

**Apply to:** `scripts/cf-overlay.js` exports (`fetchOverlay`, `assetUrl`) — JSDoc is the project documentation convention for exported surfaces (CLAUDE.md `## Comments`).

---

## Cross-Cutting Notes

### Block-to-block import boundary

`scripts/cf-overlay.js` imports `loadFragment` from `blocks/fragment/fragment.js` — this **is** allowed by repo convention. CLAUDE.md `## Import Organization`: "Block-to-block imports cross the `blocks/` boundary explicitly" and "scripts/scripts.js imports from blocks/fragment/fragment.js" already exists with `// eslint-disable-next-line import/no-cycle`. Phase 2's `scripts/cf-overlay.js → blocks/fragment/fragment.js` is a single direction (no cycle), so no `eslint-disable` needed.

### Async block decoration

All Phase 2 blocks must use `export default async function decorate(block)` because `fetchOverlay` returns a Promise. Aligns with `blocks/header/header.js:110` and `blocks/footer/footer.js:8`. `scripts/aem.js`'s `loadBlock` awaits the decorator, so `loadSection` correctly serializes.

### Editor live-patch survival (CFO-07)

`scripts/editor-support.js:54-69` re-runs `decorateBlock` + `loadBlock` on `aue:content-patch`. As long as the rewritten article blocks (a) keep `data-aue-*` on the block element via `replaceChildren()` (not `block.remove()` — D-08), and (b) the `cfReference` field is editable in the UE side panel, save → re-decoration round-trip is automatic. The `applyChanges` null-guard at line 27 (Phase 1 D-10) means a missing CF during re-decoration falls through cleanly.

### Module declaration in `_*.json` vs runtime decorate

Universal Editor maps the JSON's `models[0].id` (`article-hero`) to the block-folder name (`blocks/article-hero/`) by convention. The `template.name` (`Article Hero`) is the human-readable label in the UE component palette. Any mismatch between `id` and folder name silently disables the block in UE — verify in Wave 2 plan-02-04/05.

---

## No Analog Found

Files with no close repo precedent (planner uses RESEARCH.md or Adobe docs):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `cf-templates/article.html` | Mustache template (server-side) | transform | First Mustache template in repo. Adobe `aem.live/developer/json2html` docs are the anchor. Variable shape locked Wave 1 plan-02-03. |
| `docs/content-fragment-overlay.md` | feature documentation | n/a | First entry in `docs/`. Section list is in CONTEXT specifics; format is plain Markdown per CLAUDE.md. |
| Smoke-test page under `/test-cfo` | content artifact | n/a | Lives in AEM Author tier, not in this repo. Path locked at Wave 3 plan-02-08. |

---

## Out-of-Repo Artifacts (Tracked via DOC-01)

These are managed via Admin API per D-02 `autonomous: false` flow — never committed to repo, but their canonical state lives in `docs/content-fragment-overlay.md`:

| Artifact | Owner | Captured Where |
|----------|-------|----------------|
| AEM `article` CF model JSON export | AEM Author Tools → Configuration Browser | DOC-01 `## CF model` |
| CFO Admin API `public.json` | `https://admin.hlx.page/config/<org>/sites/<site>/public.json` | DOC-01 `## Reference responses` |
| CFO Admin API `content.json` | same host | DOC-01 `## Reference responses` |
| json2html `/config` POST body + response | `https://json2html.adobeaem.workers.dev/config/<org>/<site>/<branch>` | DOC-01 `## Reference responses` |
| Captured CF JSON sample (Wave 1 plan-02-03) | `<author-host>/api/assets/sgedsdemo/articles/<test>.json` | DOC-01 `## Reference responses` |

`paths.json` does NOT need updating — `/content/dam/sgedsdemo/` is already in `includes` (`paths.json:7`), which is sufficient for CFO delivery URLs to resolve through the existing Helix proxy.

---

## Metadata

**Analog search scope:** `blocks/`, `scripts/`, top-level `head.html`, `paths.json`, `fstab.yaml`, `.husky/`, `.eslintrc.js`, `.editorconfig`.
**Files read in this session:** `blocks/fragment/fragment.js`, `blocks/article-hero/article-hero.js` (current), `blocks/article-teaser/article-teaser.js` (current), `blocks/cards/cards.js`, `blocks/fragment/_fragment.json`, `blocks/hero/_hero.json`, `scripts/scripts.js`, `scripts/editor-support.js`, `scripts/config.js`, `blocks/header/header.js`, `blocks/article-hero/article-hero.css`, `blocks/article-teaser/article-teaser.css`, `head.html`, `.husky/pre-commit.mjs`, `paths.json`, `blocks/footer/footer.js`.
**Pattern extraction date:** 2026-05-07
