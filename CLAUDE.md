<!-- GSD:project-start source:PROJECT.md -->
## Project

**SG EDS Demo — AEM Edge Delivery POC**

An Adobe AEM Edge Delivery Services (Helix) demo site used as a **proof-of-concept playground** for a future larger AEM EDS project. Each feature is built as a self-contained, fully documented experiment so the team can evaluate approaches and reference patterns later. Authoring runs in **Universal Editor on AEM Cloud Service**; the EDS publish tier is intentionally **not** used.

**Core Value:** **Every feature ships with a working implementation _and_ a step-by-step guide in `docs/`** so future projects can reuse the patterns without rediscovery.

### Constraints

- **Tech stack**: Vanilla JS ES modules, no bundler, no transpiler — must follow EDS conventions (`decorate(block)` default-export, `.js` extensions on imports, kebab-case block dirs paired with `_<block>.json`)
- **Authoring tier**: AEM Cloud Service Author with Universal Editor — Author proxy via `fstab.yaml`
- **Publish tier**: **Not available** — every feature must work without it
- **Adobe Target**: Existing Adobe Target account + property to be used (credentials/access provided by user)
- **External API consumer**: HTML Fragment API will be called from an external web app on a different domain — CORS and (eventually) auth must be addressed
- **Security**: Existing XSS risk in article blocks (innerHTML on GraphQL data without DOMPurify) — remediated as part of the CFO migration, not deferred
- **Browser support**: Same as EDS boilerplate (modern evergreen browsers; no legacy IE)
- **Documentation**: Every POC feature ships with a `docs/<feature>.md` step-by-step guide including AEM/Target UI screenshots-level click paths
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- JavaScript (ES Modules) - All runtime/browser code in `scripts/`, `blocks/`, `tools/`. Native ES module syntax (`import` / `export`), no transpilation step at build time.
- CSS - Block and global styles in `blocks/**/*.css` and `styles/*.css`.
- JSON - Component models and definitions in `models/`, generated bundles at `component-definition.json`, `component-models.json`, `component-filters.json`.
- HTML - Static templates: `head.html`, `404.html`.
- YAML - Helix config: `fstab.yaml`, `helix-query.yaml`, `helix-sitemap.yaml`, `.github/workflows/*.yaml`.
- MJS - Husky pre-commit script `.husky/pre-commit.mjs` (Node.js ESM).
## Runtime
- Browser (modern, ES Modules native) - Primary runtime. CSP enforced via `head.html` (`script-src 'nonce-aem' 'strict-dynamic'`).
- Node.js 24 - CI build runner per `.github/workflows/main.yaml` (despite step label "Use Node.js 20").
- Node.js >= 18.3.x - Local dev minimum per `README.md`.
- npm
- Lockfile: present (`package-lock.json`, ~189 KB)
## Frameworks
- Adobe Edge Delivery Services / Helix (AEM Live) - Document-based authoring framework. Project derived from `@adobe/aem-boilerplate` v1.3.0 (`package.json`). Runtime helpers live in `scripts/aem.js`.
- AEM Universal Editor / Crosswalk (XWalk) - Component authoring layer. Editor support in `scripts/editor-support.js`, `scripts/editor-support-rte.js`. Component model JSON in `models/`.
- None detected (no test runner, no `test/` directory present, no test configs).
- `merge-json-cli` 1.0.4 - Merges component model partials (`models/_*.json`) into top-level bundles. Driven by npm scripts `build:json:models|definitions|filters`.
- `npm-run-all` 4.1.5 - Parallel script runner used by `build:json`.
- `husky` 9.1.1 - Git hooks; pre-commit at `.husky/pre-commit` invokes `.husky/pre-commit.mjs` to rebuild bundled JSON when `_*.json` model partials are staged.
- AEM CLI (`@adobe/aem-cli`) - Local dev proxy via `aem up` (installed globally per `README.md`, not a project dependency).
## Key Dependencies
- `eslint` 8.57.1 - JS linting.
- `eslint-config-airbnb-base` 15.0.0 - Base style guide.
- `eslint-plugin-import` 2.32.0 - Import rules; project enforces explicit `.js` extensions.
- `eslint-plugin-json` 3.1.0 - JSON linting.
- `eslint-plugin-xwalk` (github:adobe-rnd/eslint-plugin-xwalk) - AEM Crosswalk-specific rules.
- `@babel/eslint-parser` 7.28.6 - ESLint parser only (no Babel transpile pipeline).
- `stylelint` 17.0.0 + `stylelint-config-standard` 40.0.0 - CSS linting.
- `scripts/aem.js` - AEM/Helix client runtime (vendored from boilerplate). Provides `decorateBlocks`, `decorateSections`, `loadFragment`, `sampleRUM`, etc.
- `scripts/dompurify.min.js` - DOMPurify (vendored). Sanitizes HTML in editor live updates (`scripts/editor-support.js:32-34`).
## Configuration
- No `.env` files present. No runtime env-var consumption observed.
- `fstab.yaml` - Mounts content root to AEM author endpoint (`https://author-p23458-e585661.adobeaemcloud.com/bin/franklin.delivery/nusoli-valtech/sgedsdemo/main`).
- `paths.json` - Path mappings for AEM content (`/content/sgedsdemo/` → `/`) and DAM includes (`/content/dam/sgedsdemo/`).
- `head.html` - Inline Content Security Policy and bootstrap script tags.
- `tools/sidekick/config.json` - AEM Sidekick browser-extension project config.
- `package.json` - npm scripts only (no bundler config).
- `.eslintrc.js` - Airbnb base + JSON + xwalk plugins; enforces unix linebreaks and explicit `.js` import extensions.
- `.eslintignore` - ESLint exclusions.
- `.stylelintrc.json` - extends `stylelint-config-standard`.
- `.editorconfig` - 2-space JS/JSON, 4-space CSS.
- `.hlxignore` - Excludes dot files, markdown, configs, `_*` partials, and `test/` from Helix delivery.
- `.renovaterc.json` - Renovate config; auto-merges devDependency updates with `ignore-psi-check` label.
- `.github/workflows/main.yaml` - On push: `npm ci` then `npm run lint` on Ubuntu / Node 24.
- `.github/workflows/cleanup-on-create.yaml` - Repo bootstrap cleanup workflow.
## Platform Requirements
- Node.js >= 18.3.x (`README.md`).
- AEM CLI (`@adobe/aem-cli`) installed globally for `aem up` local proxy on `http://localhost:3000`.
- AEM Cloud Service release 2024.8 or newer (>= 17465).
- AEM Edge Delivery Services (aem.live).
- Content sourced from AEM author instance `author-p23458-e585661.adobeaemcloud.com` (Adobe Cloud-hosted AEM).
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Block JS/CSS: `kebab-case.js` / `kebab-case.css`, paired in a directory of the same name
- Block model partials: leading underscore `_<block>.json`
- Top-level scripts: lowercase, dot-separated qualifiers
- Styles: lowercase, hyphen-separated
- `camelCase` for all functions
- Default exported decorator is always named `decorate(block)`
- `camelCase` for locals and module-level state
- `UPPER_SNAKE_CASE` for module-level constants
- Trailing `$` suffix for promise-typed module state
- No TypeScript in repo. Types are documented via JSDoc on exported/decorate functions.
- `kebab-case`, prefixed by block name; sub-elements use `<block>-<part>` pattern
- CSS custom properties live on `:root` in `styles/styles.css`, prefixed by domain
## Code Style
- No Prettier or Biome detected. `.editorconfig` is the source of truth (`.editorconfig:1`):
- `eslint-config-airbnb-base` enforces single quotes, trailing commas, semi-colons, max-len
- Linebreaks pinned to unix via custom rule (`.eslintrc.js:19`)
- Tooling pinned in `package.json`:
- Config: `.eslintrc.js` (legacy flat-less config, `root: true`, `env.browser: true`)
- Style config: `.stylelintrc.json` extends `stylelint-config-standard`
- Custom JS rules (`.eslintrc.js:17`):
- Ignored paths (`.eslintignore`): `helix-importer-ui`, `dompurify.min.js`
- Run scripts (`package.json:7-10`):
- CI gate: `.github/workflows/main.yaml` runs `npm ci && npm run lint` on every push
## Import Organization
- None. All imports are relative paths.
- Block-to-block imports cross the `blocks/` boundary explicitly
- `.js` extensions are mandatory on all relative imports (enforced by `import/extensions` rule)
- Known cyclic import is suppressed with comment
- Block files export a default `decorate(block)` function and may also export named helpers
## Error Handling
- Network calls use `try/catch` around `await fetch(...)` and throw on non-OK responses
- Failures are logged to `console.error` then swallowed — block fails silently in production rather than throwing
- Optional features use `try/catch` with empty catch and a `// do nothing` comment
- Auto-block decoration wraps in `try/catch` and logs (`scripts/scripts.js:65-72`)
- `// eslint-disable-next-line no-console` is the convention when intentional console use is required (e.g., `scripts/scripts.js:69`)
- Defensive guards via optional chaining and early returns are preferred over nested ifs
- No Result/Either types. No custom error classes. Plain `Error` only.
## Logging
- Use `console.error` only for unexpected failures inside catch blocks; tag with a feature prefix
- All other `console.*` is forbidden by airbnb-base (`no-console`); intentional usages must carry an `eslint-disable-next-line no-console` comment
- The framework module `scripts/aem.js` (Adobe-vendored, `eslint-env browser`) handles RUM telemetry via `sampleRUM(...)` — do not add ad hoc logging there
## Comments
- File-level banner only on Adobe-vendored files (`scripts/aem.js:1-11`, `styles/styles.css:1-11`)
- Inline comments mark intent for non-obvious decoration steps (e.g., `/* change to ul, li */` in `blocks/cards/cards.js:5`)
- `// TODO:` markers used for planned-but-empty stubs
- ESLint disables must be on a single targeted line and prefer `eslint-disable-next-line <rule>` over file-wide disables
- JSDoc is the documentation convention; required on exported helpers and decorators
- Internal helpers may use JSDoc but commonly skip it (e.g., `closeOnEscape` in `blocks/header/header.js:7`)
## Function Design
- Keep block decorators short and DOM-focused. Headers/editor-support modules are the only files exceeding ~100 lines.
- `scripts/aem.js` is the single large file (738 lines) — Adobe-vendored, treat as read-only.
- Decorators always take a single `block` (`Element`) argument and return either `void` or a `Promise<void>`
- Helpers that toggle UI state accept the target element first, then optional flags with defaults
- Decorators return `undefined` (or `Promise<undefined>`); side effects happen via DOM mutation on `block`
- Loaders return the produced root element or `null`
- Async-state helpers return `Promise<boolean>` to signal "applied vs. fall back to reload"
## Module Design
- Each block exposes exactly one `export default async function decorate(block)`
- Named exports are reserved for utilities consumed by other modules
- `// eslint-disable-next-line import/prefer-default-export` is used when a module exports a single named function
- None. Imports always reference concrete `.js` files.
- `scripts/aem.js` acts as the de facto framework barrel (re-exports nothing — exports a wide flat surface of decorate/load helpers)
## File / Directory Conventions Specific to This Codebase
- New blocks live under `blocks/<block-name>/` with files `<block-name>.js` and `<block-name>.css`
- Optional Universal Editor model partial: `blocks/<block-name>/_<block-name>.json` (auto-merged into `component-models.json` / `component-definition.json` / `component-filters.json` by `npm run build:json`)
- A husky `pre-commit` hook (`.husky/pre-commit.mjs`) detects staged `_*.json` model partials and re-runs the merge then `git add`s the generated artifacts — never edit the merged `component-*.json` files by hand
- Empty `scripts/delayed.js` is intentional — drop deferred (>3s post-load) code there (loaded by `scripts/scripts.js:138`)
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## System Overview
```text
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
- Static-site / serverless: HTML originates from AEM author (`fstab.yaml` mountpoint) and is served by aem.live edge.
- Block-based, feature-sliced: each UI unit lives in `blocks/<name>/` with co-located JS, CSS, and model JSON.
- Decoration pattern: every block module exports `default function decorate(block)` that mutates the DOM in place. No virtual DOM, no JSX, no transpile.
- Three-phase loading: eager (LCP), lazy (rest of page + fonts), delayed (post-3s).
- Native ES modules only (no bundler) — `package.json` has only lint/build-json scripts.
- Authoring duality: same block JS handles both runtime rendering AND in-place re-decoration when authored in Universal Editor (via `scripts/editor-support.js`).
## Layers
- Purpose: First-paint setup, RUM, CSP, base CSS.
- Location: `head.html`, `scripts/aem.js` (init/setup section), `styles/styles.css`.
- Contains: Inline meta + module loaders only.
- Depends on: Nothing.
- Used by: Browser.
- Purpose: Provide decoration primitives reused by every block.
- Location: `scripts/aem.js`.
- Contains: `decorateButtons`, `decorateIcons`, `decorateSections`, `decorateBlocks`, `loadBlock`, `loadSection(s)`, `loadCSS`, `loadScript`, `getMetadata`, `createOptimizedPicture`, `sampleRUM`, `readBlockConfig`, `toClassName`, `toCamelCase`, `waitForFirstImage`, `decorateTemplateAndTheme`, `loadHeader`, `loadFooter`.
- Depends on: Browser globals, `window.hlx`.
- Used by: `scripts/scripts.js`, every block.
- Purpose: Project-specific glue — phases, auto-blocks, instrumentation.
- Location: `scripts/scripts.js`.
- Contains: `loadEager`, `loadLazy`, `loadDelayed`, `loadPage`, `decorateMain`, `loadFonts`, `buildAutoBlocks` (currently empty), `moveInstrumentation`, `moveAttributes`.
- Depends on: `scripts/aem.js`.
- Used by: Loaded directly by `head.html`; imported by `scripts/editor-support.js` and `blocks/fragment/fragment.js`.
- Purpose: Per-component DOM decoration and (optionally) data fetching.
- Location: `blocks/<name>/<name>.js` + `<name>.css`.
- Contains: A `decorate(block)` default export plus block-private helpers.
- Depends on: `scripts/aem.js`, sometimes `scripts/scripts.js` (`moveInstrumentation`), sometimes other blocks (e.g., header/footer use `blocks/fragment/fragment.js` `loadFragment`).
- Used by: `loadBlock` in `scripts/aem.js`, dynamically imported by name.
- Purpose: Keep decorated DOM in sync with author edits.
- Location: `scripts/editor-support.js`, `scripts/editor-support-rte.js`, `scripts/dompurify.min.js`.
- Contains: `aue:content-*` event listeners, MutationObserver for `data-richtext-prop`.
- Depends on: `scripts/aem.js`, `scripts/scripts.js`.
- Used by: Loaded by AEM author runtime when previewing in Universal Editor.
- Purpose: Drive the Universal Editor / Crosswalk component palette.
- Location: `models/_*.json`, `blocks/*/_*.json`, compiled into `component-models.json`, `component-definition.json`, `component-filters.json`.
- Contains: Component definitions, field models, container filters.
- Depends on: `merge-json-cli` build step in `package.json`.
- Used by: AEM author / Universal Editor only — not loaded at runtime.
## Data Flow
### Primary Request Path
### Fragment Embed Flow
### Content Fragment GraphQL Flow (`article-*` blocks)
### Universal Editor Patch Flow
- No application state framework. Transient state lives on:
## Key Abstractions
- Purpose: A self-contained, authorable UI unit.
- Examples: `blocks/hero/`, `blocks/cards/`, `blocks/columns/`, `blocks/fragment/`, `blocks/header/`, `blocks/footer/`, `blocks/article-hero/`, `blocks/article-teaser/`.
- Pattern: Folder named `blocks/<kebab-name>/` containing `<kebab-name>.js` (default-export `decorate(block)`), `<kebab-name>.css` (CSS scoped via class selectors), optional `_<kebab-name>.json` (Crosswalk model + definitions + filters).
- Purpose: Group of blocks separated by horizontal rule in source markdown.
- Examples: Decorated by `decorateSections` in `scripts/aem.js`; `loadSection`/`loadSections` orchestrate block loading per section.
- Pattern: `<div class="section">` with optional style classes from `models/_section.json`.
- Purpose: Reusable content document loaded as `.plain.html`.
- Examples: `/nav`, `/footer`, plus any author-defined Fragment block target.
- Pattern: `blocks/fragment/fragment.js` `loadFragment(path)` — same primitive used by header and footer.
- Purpose: Schema for authorable fields per component.
- Examples: `models/_button.json`, `models/_image.json`, `blocks/hero/_hero.json`, `blocks/cards/_cards.json`.
- Pattern: JSON with `definitions` / `models` / `filters` arrays. `models/_component-models.json` uses spread-import to merge per-block files via glob `../blocks/*/_*.json#/models`.
- Purpose: Function that takes a raw `<div class="block">` and mutates it into final markup.
- Examples: Every `blocks/*/*.js` default export.
- Pattern: `export default function decorate(block) { ... }`. Sync or `async`. No return value used by caller.
- Purpose: Preserve `data-aue-*` and `data-richtext-*` attributes when blocks restructure DOM.
- Examples: `moveInstrumentation` in `scripts/scripts.js:39`, used in `blocks/cards/cards.js:9,19`.
- Pattern: Copy attributes prefixed `data-aue-` / `data-richtext-` from old element to new element.
## Entry Points
- Location: `head.html`
- Triggers: Every page request — concatenated into AEM-served HTML head.
- Responsibilities: Set CSP, load `scripts/aem.js`, `scripts/scripts.js`, `styles/styles.css`.
- Location: `404.html`
- Triggers: 404 responses.
- Responsibilities: Inline error rendering + `sampleRUM('404', ...)` ping.
- Location: `scripts/scripts.js:142` (`loadPage`)
- Triggers: Loaded as ES module from `head.html`.
- Responsibilities: Orchestrates `loadEager` → `loadLazy` → `loadDelayed`.
- Location: e.g. `blocks/hero/hero.js`, `blocks/cards/cards.js`
- Triggers: Dynamic import from `loadBlock` in `scripts/aem.js`.
- Responsibilities: Decorate one block instance.
- Location: `scripts/editor-support.js`
- Triggers: Loaded by AEM author iframe context (Universal Editor preview).
- Responsibilities: Re-decorate DOM on `aue:content-*` events.
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
### Hard-coded environment URL inside block source
### Empty `decorate`-less block module
### Absent `buildAutoBlocks`
## Error Handling
- `try { fetch ... } catch (err) { console.error(...) }` in `blocks/article-hero/article-hero.js:12-32`, `blocks/article-teaser/article-teaser.js:12-28`.
- Soft fail with `return null` / empty block: `blocks/fragment/fragment.js:44`, when no link found.
- Empty try/catch in `loadFonts` (`scripts/scripts.js:55-58`) and around `sessionStorage` access — sandboxed environments tolerated.
- `scripts/editor-support.js:113` falls back to `window.location.reload()` when patch cannot be applied.
- Global handlers attached via `sampleRUM` for `error`, `unhandledrejection`, `securitypolicyviolation` (`scripts/aem.js:67-91`).
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
