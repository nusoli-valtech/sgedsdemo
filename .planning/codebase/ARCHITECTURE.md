<!-- refreshed: 2026-05-06 -->
# Architecture

**Analysis Date:** 2026-05-06

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       AEM Edge Delivery Services                         │
│            (server-rendered .plain.html + sitemaps from author)          │
│           `fstab.yaml` mountpoint → adobeaemcloud.com author             │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │  HTML markup served to browser
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Browser Bootstrap (head.html)                      │
│   `head.html`  loads:  /scripts/aem.js  →  /scripts/scripts.js           │
│                        /styles/styles.css                                │
└─────────────────────────┬───────────────────────────────────────────────┘
                          │  loadPage() = eager → lazy → delayed
                          ▼
┌──────────────────┬──────────────────────┬──────────────────────────────┐
│  Eager Phase     │     Lazy Phase       │     Delayed Phase            │
│  `scripts.js`    │     `scripts.js`     │     `delayed.js`             │
│  loadEager()     │     loadLazy()       │     (post-3s, side-effects)  │
│  decorateMain()  │     loadHeader/      │                              │
│  + first section │     loadFooter,      │                              │
│  + waitForLCP    │     all sections,    │                              │
│                  │     fonts.css,       │                              │
│                  │     lazy-styles.css  │                              │
└────────┬─────────┴───────────┬──────────┴──────────────┬───────────────┘
         │                     │                          │
         ▼                     ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Decoration Pipeline (`scripts/aem.js`)                  │
│   decorateButtons → decorateIcons → buildAutoBlocks                      │
│        → decorateSections → decorateBlocks → loadSection(s) → loadBlock  │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │  per-block dynamic import
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   Block Modules (`blocks/<name>/<name>.js`)              │
│                                                                          │
│  hero, header, footer, cards, columns, fragment,                         │
│  article-hero, article-teaser                                            │
│                                                                          │
│  Each exports `default function decorate(block)` and ships its own .css  │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │  some blocks fetch
                              ▼
┌──────────────────────────┬──────────────────────────────────────────────┐
│  Fragments (.plain.html) │  AEM GraphQL Persisted Query                 │
│  via `loadFragment(path)`│  publish-p23458-e585661.adobeaemcloud.com    │
│  in `blocks/fragment/`   │  /graphql/execute.json/sgedsdemo/article-by- │
│                          │  path                                         │
└──────────────────────────┴──────────────────────────────────────────────┘
                              ▲
                              │  authoring round-trip
┌─────────────────────────────┴───────────────────────────────────────────┐
│                Universal Editor Support (optional, in-author)            │
│   `scripts/editor-support.js` + `scripts/editor-support-rte.js`          │
│   listens for aue:content-* events → re-decorates patched DOM            │
│   `scripts/dompurify.min.js` sanitizes patched HTML                      │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| HTML head bootstrap | Inject CSP, load entry scripts, base stylesheet | `head.html` |
| EDS framework | RUM, helpers, decorate*, loadBlock/Section, createOptimizedPicture | `scripts/aem.js` |
| Project orchestration | Eager/lazy/delayed phases, `decorateMain`, instrumentation move | `scripts/scripts.js` |
| Delayed loader | Post-LCP work (currently empty hook) | `scripts/delayed.js` |
| Editor live-patching | Re-decorate DOM in response to AUE events from Universal Editor | `scripts/editor-support.js` |
| RTE editor support | Group rich-text siblings under shared editable wrapper | `scripts/editor-support-rte.js` |
| HTML sanitizer | Sanitize Universal Editor patches | `scripts/dompurify.min.js` |
| Hero block | Empty stub (CSS-driven hero shell) | `blocks/hero/hero.js`, `blocks/hero/hero.css` |
| Header block | Loads `/nav` fragment, builds responsive nav with mobile toggle | `blocks/header/header.js` |
| Footer block | Loads `/footer` fragment | `blocks/footer/footer.js` |
| Cards block | Convert table rows to `<ul>/<li>` + optimized pictures | `blocks/cards/cards.js` |
| Columns block | Apply `columns-N-cols` class, mark image-only columns | `blocks/columns/columns.js` |
| Fragment block | Fetch `.plain.html`, decorate as embedded section | `blocks/fragment/fragment.js` |
| Article hero | Fetch persisted GraphQL query, render hero from Content Fragment | `blocks/article-hero/article-hero.js` |
| Article teaser | Fetch persisted GraphQL query, render title + body | `blocks/article-teaser/article-teaser.js` |
| Component registry (compiled) | Top-level files consumed by Universal Editor / Crosswalk | `component-definition.json`, `component-models.json`, `component-filters.json` |
| Component registry (sources) | Per-component sources merged into top-level registries | `models/_*.json`, `blocks/*/_*.json` |
| Sidekick config | Editor sidekick metadata | `tools/sidekick/config.json` |

## Pattern Overview

**Overall:** Adobe AEM Edge Delivery Services (EDS / "Helix" / "Franklin") boilerplate — content-first, document-driven web architecture. No Node server, no framework runtime, no bundler. Vanilla browser ES modules decorate server-rendered HTML in three phases (eager / lazy / delayed). Each "block" is a feature-sliced folder of `<name>.js` + `<name>.css` + optional `_<name>.json` model definition. Configuration is split into per-block JSON sources under `models/` and `blocks/*/_*.json`, merged at build time into top-level registries via `merge-json-cli`.

**Key Characteristics:**
- Static-site / serverless: HTML originates from AEM author (`fstab.yaml` mountpoint) and is served by aem.live edge.
- Block-based, feature-sliced: each UI unit lives in `blocks/<name>/` with co-located JS, CSS, and model JSON.
- Decoration pattern: every block module exports `default function decorate(block)` that mutates the DOM in place. No virtual DOM, no JSX, no transpile.
- Three-phase loading: eager (LCP), lazy (rest of page + fonts), delayed (post-3s).
- Native ES modules only (no bundler) — `package.json` has only lint/build-json scripts.
- Authoring duality: same block JS handles both runtime rendering AND in-place re-decoration when authored in Universal Editor (via `scripts/editor-support.js`).

## Layers

**Bootstrap layer:**
- Purpose: First-paint setup, RUM, CSP, base CSS.
- Location: `head.html`, `scripts/aem.js` (init/setup section), `styles/styles.css`.
- Contains: Inline meta + module loaders only.
- Depends on: Nothing.
- Used by: Browser.

**Framework layer (Helix/EDS runtime):**
- Purpose: Provide decoration primitives reused by every block.
- Location: `scripts/aem.js`.
- Contains: `decorateButtons`, `decorateIcons`, `decorateSections`, `decorateBlocks`, `loadBlock`, `loadSection(s)`, `loadCSS`, `loadScript`, `getMetadata`, `createOptimizedPicture`, `sampleRUM`, `readBlockConfig`, `toClassName`, `toCamelCase`, `waitForFirstImage`, `decorateTemplateAndTheme`, `loadHeader`, `loadFooter`.
- Depends on: Browser globals, `window.hlx`.
- Used by: `scripts/scripts.js`, every block.

**Project orchestration layer:**
- Purpose: Project-specific glue — phases, auto-blocks, instrumentation.
- Location: `scripts/scripts.js`.
- Contains: `loadEager`, `loadLazy`, `loadDelayed`, `loadPage`, `decorateMain`, `loadFonts`, `buildAutoBlocks` (currently empty), `moveInstrumentation`, `moveAttributes`.
- Depends on: `scripts/aem.js`.
- Used by: Loaded directly by `head.html`; imported by `scripts/editor-support.js` and `blocks/fragment/fragment.js`.

**Block layer:**
- Purpose: Per-component DOM decoration and (optionally) data fetching.
- Location: `blocks/<name>/<name>.js` + `<name>.css`.
- Contains: A `decorate(block)` default export plus block-private helpers.
- Depends on: `scripts/aem.js`, sometimes `scripts/scripts.js` (`moveInstrumentation`), sometimes other blocks (e.g., header/footer use `blocks/fragment/fragment.js` `loadFragment`).
- Used by: `loadBlock` in `scripts/aem.js`, dynamically imported by name.

**Editor-support layer (in-author only):**
- Purpose: Keep decorated DOM in sync with author edits.
- Location: `scripts/editor-support.js`, `scripts/editor-support-rte.js`, `scripts/dompurify.min.js`.
- Contains: `aue:content-*` event listeners, MutationObserver for `data-richtext-prop`.
- Depends on: `scripts/aem.js`, `scripts/scripts.js`.
- Used by: Loaded by AEM author runtime when previewing in Universal Editor.

**Authoring config layer:**
- Purpose: Drive the Universal Editor / Crosswalk component palette.
- Location: `models/_*.json`, `blocks/*/_*.json`, compiled into `component-models.json`, `component-definition.json`, `component-filters.json`.
- Contains: Component definitions, field models, container filters.
- Depends on: `merge-json-cli` build step in `package.json`.
- Used by: AEM author / Universal Editor only — not loaded at runtime.

## Data Flow

### Primary Request Path

1. Browser requests page → AEM Edge Delivery serves HTML (`fstab.yaml`).
2. `head.html` injects `/scripts/aem.js` (`scripts/aem.js:1`) and `/scripts/scripts.js` (`scripts/scripts.js:1`).
3. `loadPage()` runs (`scripts/scripts.js:142`): `loadEager` → `loadLazy` → `loadDelayed`.
4. `loadEager` (`scripts/scripts.js:92`) sets `<html lang>`, calls `decorateTemplateAndTheme`, then `decorateMain(main)` (`scripts/scripts.js:79`) which runs `decorateButtons` → `decorateIcons` → `buildAutoBlocks` → `decorateSections` → `decorateBlocks`.
5. First section is loaded eagerly (`loadSection(main.querySelector('.section'), waitForFirstImage)`) so LCP image is ready.
6. `loadLazy` (`scripts/scripts.js:116`) loads header fragment, remaining sections, footer fragment, `lazy-styles.css`, fonts.
7. For each block in each section, `loadBlock` in `scripts/aem.js` dynamically imports `blocks/<name>/<name>.js` + `<name>.css` and calls its `decorate(block)`.
8. `loadDelayed` (`scripts/scripts.js:136`) imports `scripts/delayed.js` after 3 seconds.

### Fragment Embed Flow

1. `blocks/fragment/fragment.js` `decorate(block)` reads first `<a>` href.
2. `loadFragment(path)` fetches `${path}.plain.html` (`blocks/fragment/fragment.js:25`).
3. Response wrapped in synthetic `<main>`, base URLs reset for `./media_*` assets.
4. `decorateMain(main)` and `loadSections(main)` run on the fragment.
5. First `.section` of fragment replaces block content; classes merged.
6. Same `loadFragment` is reused by `blocks/header/header.js:114` (loading `/nav`) and `blocks/footer/footer.js:12` (loading `/footer`).

### Content Fragment GraphQL Flow (`article-*` blocks)

1. `decorate(block)` reads `<a>` href; expects `/content/dam/...` Content Fragment path.
2. Fetches `https://publish-p23458-e585661.adobeaemcloud.com/graphql/execute.json/sgedsdemo/article-by-path;path=<cfPath>` (`blocks/article-hero/article-hero.js:1`, `blocks/article-teaser/article-teaser.js:1`).
3. Reads `data.articleByPath.item` from JSON response.
4. Renders block via `block.innerHTML = ...` template literal.
5. Errors logged to console; block is left empty on failure.

### Universal Editor Patch Flow

1. AEM author dispatches `aue:content-patch|update|add|move|remove|copy` event on `<main>`.
2. `attachEventListeners` in `scripts/editor-support.js:101` queues `applyChanges`.
3. Patched HTML pulled from `event.detail.response.updates[0].content`.
4. `dompurify.min.js` sanitizes content (loaded on demand).
5. New element targeted by `[data-aue-resource="..."]`; replaced in DOM.
6. Re-decorated through `decorateBlock`/`decorateButtons`/`decorateIcons`/`decorateSections` and `loadBlock`/`loadSections`.
7. Falls back to full reload if no matching resource.

**State Management:**
- No application state framework. Transient state lives on:
  - `window.hlx` (codeBasePath, RUM info, lighthouse flag) — `scripts/aem.js:154`.
  - `sessionStorage['fonts-loaded']` — `scripts/scripts.js:55`.
  - DOM attributes (`aria-expanded`, `data-aue-*`, `data-richtext-*`).
  - Module-scoped `let promiseChanges$` in `scripts/editor-support.js:14` for serializing edit applications.

## Key Abstractions

**Block:**
- Purpose: A self-contained, authorable UI unit.
- Examples: `blocks/hero/`, `blocks/cards/`, `blocks/columns/`, `blocks/fragment/`, `blocks/header/`, `blocks/footer/`, `blocks/article-hero/`, `blocks/article-teaser/`.
- Pattern: Folder named `blocks/<kebab-name>/` containing `<kebab-name>.js` (default-export `decorate(block)`), `<kebab-name>.css` (CSS scoped via class selectors), optional `_<kebab-name>.json` (Crosswalk model + definitions + filters).

**Section:**
- Purpose: Group of blocks separated by horizontal rule in source markdown.
- Examples: Decorated by `decorateSections` in `scripts/aem.js`; `loadSection`/`loadSections` orchestrate block loading per section.
- Pattern: `<div class="section">` with optional style classes from `models/_section.json`.

**Fragment:**
- Purpose: Reusable content document loaded as `.plain.html`.
- Examples: `/nav`, `/footer`, plus any author-defined Fragment block target.
- Pattern: `blocks/fragment/fragment.js` `loadFragment(path)` — same primitive used by header and footer.

**Component Model (Crosswalk):**
- Purpose: Schema for authorable fields per component.
- Examples: `models/_button.json`, `models/_image.json`, `blocks/hero/_hero.json`, `blocks/cards/_cards.json`.
- Pattern: JSON with `definitions` / `models` / `filters` arrays. `models/_component-models.json` uses spread-import to merge per-block files via glob `../blocks/*/_*.json#/models`.

**Decoration:**
- Purpose: Function that takes a raw `<div class="block">` and mutates it into final markup.
- Examples: Every `blocks/*/*.js` default export.
- Pattern: `export default function decorate(block) { ... }`. Sync or `async`. No return value used by caller.

**Instrumentation:**
- Purpose: Preserve `data-aue-*` and `data-richtext-*` attributes when blocks restructure DOM.
- Examples: `moveInstrumentation` in `scripts/scripts.js:39`, used in `blocks/cards/cards.js:9,19`.
- Pattern: Copy attributes prefixed `data-aue-` / `data-richtext-` from old element to new element.

## Entry Points

**Page bootstrap (`head.html`):**
- Location: `head.html`
- Triggers: Every page request — concatenated into AEM-served HTML head.
- Responsibilities: Set CSP, load `scripts/aem.js`, `scripts/scripts.js`, `styles/styles.css`.

**404 page (`404.html`):**
- Location: `404.html`
- Triggers: 404 responses.
- Responsibilities: Inline error rendering + `sampleRUM('404', ...)` ping.

**Top-level page driver (`scripts/scripts.js`):**
- Location: `scripts/scripts.js:142` (`loadPage`)
- Triggers: Loaded as ES module from `head.html`.
- Responsibilities: Orchestrates `loadEager` → `loadLazy` → `loadDelayed`.

**Block module (`blocks/<name>/<name>.js`):**
- Location: e.g. `blocks/hero/hero.js`, `blocks/cards/cards.js`
- Triggers: Dynamic import from `loadBlock` in `scripts/aem.js`.
- Responsibilities: Decorate one block instance.

**Editor support (`scripts/editor-support.js`):**
- Location: `scripts/editor-support.js`
- Triggers: Loaded by AEM author iframe context (Universal Editor preview).
- Responsibilities: Re-decorate DOM on `aue:content-*` events.

**CI build (`.github/workflows/main.yaml`):**
- Location: `.github/workflows/main.yaml`
- Triggers: `push` events on any branch.
- Responsibilities: `npm ci` + `npm run lint`.

## Architectural Constraints

- **No bundler / no transpile:** Code in `blocks/` and `scripts/` ships as-is to browsers. Anything that needs a build step is forbidden. ESLint enforces `import/extensions: js: always`.
- **Browser-only environment:** ESLint config (`.eslintrc.js:8`) sets `env.browser` only. No Node, no DOM polyfills, no SSR.
- **Single-threaded event loop:** No workers used.
- **Global state:** `window.hlx` is the only sanctioned global; populated by `setup()` in `scripts/aem.js:153`. RUM also writes `window.hlx.rum`.
- **Circular import (intentional):** `blocks/fragment/fragment.js` imports `decorateMain` from `scripts/scripts.js`, while `scripts/scripts.js` is what kicks off block loading. Suppressed with `// eslint-disable-next-line import/no-cycle` in `blocks/fragment/fragment.js:7` and `scripts/scripts.js:137`.
- **CSP nonce-based:** `head.html` uses `nonce-aem` with strict-dynamic. Inline scripts must carry that nonce.
- **No external runtime CSS framework:** Only project CSS in `styles/` plus per-block `<name>.css`.
- **Hard-coded GraphQL endpoint:** `article-hero` and `article-teaser` blocks hard-code `https://publish-p23458-e585661.adobeaemcloud.com/...` — environment-specific.
- **Empty hero block:** `blocks/hero/hero.js` is a 0-line file. Hero rendering is purely CSS-driven over default content; there is no `decorate` export.

## Anti-Patterns

### `innerHTML` with unescaped Content Fragment data

**What happens:** `blocks/article-hero/article-hero.js:23` and `blocks/article-teaser/article-teaser.js:20` use template-literal `block.innerHTML = ...` with values from `articleByPath.item.title`, `item.body.html`, `item.image._path`. No escaping.
**Why it's wrong:** Title and image path can contain attacker-controlled HTML if the Content Fragment is editable. Body is intentionally HTML, but title and `_path` are not.
**Do this instead:** Build the DOM imperatively (`document.createElement`, `textContent`) the way `blocks/cards/cards.js` and `blocks/header/header.js` do, or pass through the same `dompurify.min.js` already shipping in `scripts/`.

### Hard-coded environment URL inside block source

**What happens:** Both `article-hero.js:1` and `article-teaser.js:1` declare `const GRAPHQL_ENDPOINT = 'https://publish-p23458-e585661.adobeaemcloud.com/...'`.
**Why it's wrong:** Same constant duplicated in two places; cannot be overridden per environment; ties code to one AEM tenant.
**Do this instead:** Read endpoint from `<meta>` via `getMetadata('graphql-endpoint')` (already used for nav/footer paths in `blocks/header/header.js:112`) and centralize the helper in `scripts/scripts.js`.

### Empty `decorate`-less block module

**What happens:** `blocks/hero/hero.js` is empty. `loadBlock` will still register the `.css` file via convention, but there is no decoration entry point.
**Why it's wrong:** Future maintainers expect every block module to export `default function decorate`. An empty file is ambiguous — is this intentional or a mistake?
**Do this instead:** Either delete the file (CSS-only blocks are acceptable in EDS but the JS file should not exist) or add `export default function decorate() {}` with a comment explaining the no-op.

### Absent `buildAutoBlocks`

**What happens:** `scripts/scripts.js:65` declares `buildAutoBlocks` with only a `// TODO` body.
**Why it's wrong:** Stub function that swallows exceptions; future code added inside the try will be silently caught.
**Do this instead:** Remove the function until needed, or scope the try/catch to the specific auto-block call once added.

## Error Handling

**Strategy:** Per-block try/catch around fetches; failures log to console and degrade silently. Page-level errors are caught by `sampleRUM` (`scripts/aem.js:67-91`) and pinged as RUM error checkpoints.

**Patterns:**
- `try { fetch ... } catch (err) { console.error(...) }` in `blocks/article-hero/article-hero.js:12-32`, `blocks/article-teaser/article-teaser.js:12-28`.
- Soft fail with `return null` / empty block: `blocks/fragment/fragment.js:44`, when no link found.
- Empty try/catch in `loadFonts` (`scripts/scripts.js:55-58`) and around `sessionStorage` access — sandboxed environments tolerated.
- `scripts/editor-support.js:113` falls back to `window.location.reload()` when patch cannot be applied.
- Global handlers attached via `sampleRUM` for `error`, `unhandledrejection`, `securitypolicyviolation` (`scripts/aem.js:67-91`).

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.debug` directly. RUM checkpoints via `sampleRUM(name, data)` (`scripts/aem.js:14`) — sent to `https://ot.aem.live/.rum/...` via `navigator.sendBeacon`.

**Validation:** None at runtime. Authoring-side validation lives in component models (e.g., `validation.rootPath` in `models/_component-models.json:226`).

**Authentication:** No auth in this codebase; AEM author handles it upstream.

**Performance instrumentation:** `window.hlx.rum` collects telemetry from page load through user interactions. `sampleRUM.enhance()` lazy-loads `helix-rum-enhancer` from edge.

**Internationalization:** Hard-coded `document.documentElement.lang = 'en'` in `scripts/scripts.js:93`.

**Asset optimization:** `createOptimizedPicture` in `scripts/aem.js` produces responsive `<picture>` with WebP + fallback `<img>`; used by `blocks/cards/cards.js:18`.

---

*Architecture analysis: 2026-05-06*
