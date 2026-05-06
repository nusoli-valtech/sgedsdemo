# Codebase Structure

**Analysis Date:** 2026-05-06

## Directory Layout

```
sgedsdemo/
├── .github/
│   └── workflows/
│       ├── main.yaml                    # CI: npm ci + npm run lint on push
│       └── cleanup-on-create.yaml       # One-shot template cleanup on repo creation
├── .husky/                              # Git hooks (managed by husky 9)
├── .planning/
│   └── codebase/                        # GSD-generated codebase analysis docs (this folder)
├── blocks/                              # Authorable UI blocks — feature-sliced
│   ├── article-hero/
│   │   ├── article-hero.js              # decorate(): GraphQL fetch + render
│   │   └── article-hero.css
│   ├── article-teaser/
│   │   ├── article-teaser.js            # decorate(): GraphQL fetch + render
│   │   └── article-teaser.css
│   ├── cards/
│   │   ├── cards.js                     # decorate(): rows → <ul><li>
│   │   ├── cards.css
│   │   └── _cards.json                  # Crosswalk model + filter for Card item
│   ├── columns/
│   │   ├── columns.js                   # decorate(): columns-N-cols class
│   │   ├── columns.css
│   │   └── _columns.json
│   ├── footer/
│   │   ├── footer.js                    # decorate(): loadFragment('/footer')
│   │   └── footer.css
│   ├── fragment/
│   │   ├── fragment.js                  # exports loadFragment + default decorate
│   │   ├── fragment.css
│   │   └── _fragment.json
│   ├── header/
│   │   ├── header.js                    # decorate(): nav + responsive hamburger
│   │   └── header.css
│   └── hero/
│       ├── hero.js                      # EMPTY — CSS-only block
│       ├── hero.css
│       └── _hero.json
├── fonts/                               # Self-hosted Roboto woff2 (bold/medium/regular/condensed-bold)
├── icons/
│   └── search.svg                       # Inline-injected SVG icons (referenced via decorateIcons)
├── models/                              # Crosswalk authoring sources (merged into top-level JSON)
│   ├── _button.json
│   ├── _component-definition.json       # Source for component-definition.json
│   ├── _component-filters.json          # Source for component-filters.json
│   ├── _component-models.json           # Aggregator with glob `../blocks/*/_*.json#/models`
│   ├── _image.json
│   ├── _page.json
│   ├── _section.json
│   ├── _text.json
│   └── _title.json
├── scripts/                             # Runtime JavaScript loaded by every page
│   ├── aem.js                           # EDS framework (738 lines): RUM, decorate*, loadBlock, etc.
│   ├── scripts.js                       # Project orchestration: eager/lazy/delayed phases
│   ├── delayed.js                       # Post-3s hook (currently empty)
│   ├── editor-support.js                # Universal Editor live re-decoration
│   ├── editor-support-rte.js            # Rich-text wrapper grouping
│   └── dompurify.min.js                 # Sanitizer used by editor-support
├── styles/                              # Global stylesheets
│   ├── styles.css                       # Base CSS variables, typography, layout
│   ├── lazy-styles.css                  # Loaded after LCP
│   └── fonts.css                        # @font-face declarations
├── tools/
│   └── sidekick/
│       └── config.json                  # Sidekick (author tool) config
├── 404.html                             # Standalone 404 page
├── .editorconfig                        # 2-space indent, LF, UTF-8
├── .eslintignore
├── .eslintrc.js                         # airbnb-base + json + xwalk plugin
├── .gitignore
├── .hlxignore                           # Files excluded from EDS bundle
├── .renovaterc.json                     # Renovate dependency-update config
├── .stylelintrc.json                    # stylelint-config-standard
├── CODE_OF_CONDUCT.md
├── CONTRIBUTING.md
├── LICENSE                              # Apache 2.0
├── README.md
├── component-definition.json            # COMPILED — merged from models/_component-definition.json
├── component-filters.json               # COMPILED — merged from models/_component-filters.json
├── component-models.json                # COMPILED — merged from models/_component-models.json + blocks/*/_*.json
├── favicon.ico
├── fstab.yaml                           # AEM mountpoint (author URL → /)
├── head.html                            # HTML head fragment merged at edge
├── helix-query.yaml                     # Edge index config (query-index.json)
├── helix-sitemap.yaml                   # Sitemap generator config
├── package.json                         # Lint scripts + JSON merge build
├── package-lock.json
└── paths.json                           # AEM content tree mappings
```

## Directory Purposes

**`blocks/`:**
- Purpose: One subfolder per authorable component. Feature-sliced — JS, CSS, and authoring model live together.
- Contains: `<name>.js` (default-export `decorate`), `<name>.css`, optional `_<name>.json` (Crosswalk model).
- Key files: `blocks/header/header.js`, `blocks/footer/footer.js`, `blocks/fragment/fragment.js` (exports reusable `loadFragment`).

**`scripts/`:**
- Purpose: Browser ES modules loaded by every page.
- Contains: EDS framework (`aem.js`), project orchestration (`scripts.js`), delayed hook (`delayed.js`), editor support (`editor-support*.js`, `dompurify.min.js`).
- Key files: `scripts/aem.js` (do not modify — vendor framework), `scripts/scripts.js` (project entry).

**`styles/`:**
- Purpose: Page-level CSS.
- Contains: `styles.css` (CSS variables + typography), `fonts.css`, `lazy-styles.css`.
- Key files: `styles/styles.css` (CSS custom properties live here).

**`models/`:**
- Purpose: Source JSON fragments for the Crosswalk / Universal Editor component palette.
- Contains: `_component-models.json`, `_component-definition.json`, `_component-filters.json`, plus per-default-component sources (`_button.json`, `_image.json`, `_page.json`, `_section.json`, `_text.json`, `_title.json`).
- Key files: `models/_component-models.json` aggregates with glob `../blocks/*/_*.json#/models`.

**`icons/`:**
- Purpose: SVG icons consumed by `decorateIcons` in `scripts/aem.js`.
- Contains: `search.svg`. Add new icons here as `<name>.svg`; they get inlined when authors write `:name:` in markdown.

**`fonts/`:**
- Purpose: Self-hosted webfonts referenced by `styles/fonts.css`.
- Contains: Four Roboto woff2 files. Loaded lazily after LCP unless on desktop.

**`tools/sidekick/`:**
- Purpose: Adobe Sidekick (browser extension for content authors) configuration.
- Contains: `config.json` (project label + edit URL pattern).

**`.github/workflows/`:**
- Purpose: GitHub Actions CI.
- Contains: `main.yaml` (lint on push), `cleanup-on-create.yaml` (one-shot template cleanup).

**`.husky/`:**
- Purpose: Git hooks installed by `husky` `prepare` script.
- Contains: Hook scripts (e.g., pre-commit lint).

**`.planning/codebase/`:**
- Purpose: GSD codebase mapping outputs (this directory).
- Contains: `ARCHITECTURE.md`, `STRUCTURE.md`, etc.

## Key File Locations

**Entry Points:**
- `head.html`: HTML head fragment injected on every page; loads scripts and base CSS.
- `scripts/scripts.js`: Top-level page driver — `loadPage()` runs eager → lazy → delayed phases.
- `scripts/aem.js`: EDS framework — auto-runs `init()` and `sampleRUM()` on import.
- `404.html`: Standalone 404 page.

**Configuration:**
- `package.json`: npm scripts (`lint`, `lint:fix`, `build:json:*`, `prepare`).
- `.eslintrc.js`: airbnb-base + json + xwalk; `import/extensions: js: always`; `linebreak-style: unix`.
- `.stylelintrc.json`: stylelint-config-standard.
- `.editorconfig`: 2-space indent, LF, UTF-8, trim trailing whitespace.
- `fstab.yaml`: AEM author mountpoint mapping `/` to `https://author-p23458-e585661.adobeaemcloud.com/.../sgedsdemo/main`.
- `paths.json`: Content tree mapping `/content/sgedsdemo/` → `/`; includes DAM at `/content/dam/sgedsdemo/`.
- `helix-query.yaml`: Edge query index spec (writes `/query-index.json`).
- `helix-sitemap.yaml`: Sitemap generator config (`sitemap.xml` from `query-index.json`).
- `head.html`: Site-wide HTML head (CSP, viewport, scripts, base CSS).
- `tools/sidekick/config.json`: Sidekick metadata.

**Authoring Models (sources):**
- `models/_*.json`: Default-component models.
- `blocks/<name>/_<name>.json`: Per-block models.

**Authoring Models (compiled — do not edit by hand):**
- `component-models.json` — built by `npm run build:json:models`.
- `component-definition.json` — built by `npm run build:json:definitions`.
- `component-filters.json` — built by `npm run build:json:filters`.

**Core Logic:**
- `scripts/aem.js`: All decoration primitives, RUM, image optimization.
- `scripts/scripts.js`: Eager/lazy/delayed phases, `decorateMain`, instrumentation move helpers.
- `scripts/editor-support.js` + `scripts/editor-support-rte.js`: Universal Editor in-place re-decoration.
- `blocks/<name>/<name>.js`: Per-block decoration.

**Testing:**
- None. There are no test directories, test runners, or test files committed. `.hlxignore` lists `test/*` for exclusion if added.

## Naming Conventions

**Files:**
- Block source files: `<kebab-case>.js`, `<kebab-case>.css` matching folder name. Examples: `blocks/article-hero/article-hero.js`, `blocks/cards/cards.css`.
- Block model files: `_<kebab-case>.json` (leading underscore marks them as build sources, also excluded from edge bundle by `.hlxignore` `_*` rule). Examples: `blocks/cards/_cards.json`, `blocks/hero/_hero.json`.
- Default-component model sources: `models/_<lower>.json`. Examples: `models/_button.json`, `models/_page.json`.
- Compiled JSON registries: top-level lowercase-kebab. Examples: `component-models.json`, `component-definition.json`.
- Stylesheets in `styles/`: lowercase, `-` separator (`lazy-styles.css`).
- Workflows: lowercase kebab (`cleanup-on-create.yaml`, `main.yaml`).

**Directories:**
- Block directories: `blocks/<kebab-case>/` matching the block name authors type. Examples: `blocks/article-hero/`, `blocks/cards/`.
- All other top-level directories: lowercase, single word where possible.

**JavaScript identifiers (per `scripts/aem.js` and existing blocks):**
- Functions and variables: `camelCase` (e.g., `decorateMain`, `loadFragment`, `moveInstrumentation`).
- Default block export: always `function decorate(block)` named `decorate` even though exported as `default`.
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `GRAPHQL_ENDPOINT` in `blocks/article-hero/article-hero.js:1`).
- Module-private state: `let foo$` suffix for promises (e.g., `promiseChanges$` in `scripts/editor-support.js:14`).
- DOM-class derivation: `toClassName` and `toCamelCase` helpers in `scripts/aem.js:191`/`scripts/aem.js:206`.

**CSS class names:**
- Block-scoped: `.<block-name>` plus child variants like `.<block-name>-card-image`, `.cards-card-body` (`blocks/cards/cards.js:13`).
- State variants: `.columns-<N>-cols` (`blocks/columns/columns.js:3`).
- Section wrappers: `.section`, `.<block>-wrapper`, `.<block>-container` (created by `decorateBlocks`/`decorateSections`).

**CSS custom properties (`styles/styles.css:13-41`):**
- Color: `--background-color`, `--text-color`, `--link-color`, `--link-hover-color`, `--light-color`, `--dark-color`.
- Typography: `--body-font-family`, `--heading-font-family`, `--body-font-size-{xs,s,m}`, `--heading-font-size-{xs,s,m,l,xl,xxl}`.
- Layout: `--nav-height`.

## Where to Add New Code

**New block:**
- Create `blocks/<kebab-name>/`.
- Add `blocks/<kebab-name>/<kebab-name>.js` with `export default function decorate(block) { ... }` (or `async`).
- Add `blocks/<kebab-name>/<kebab-name>.css` with selectors prefixed by `.<block-name>`.
- Add `blocks/<kebab-name>/_<kebab-name>.json` with `definitions`, `models`, `filters` arrays.
- Run `npm run build:json` to regenerate top-level `component-*.json` registries.
- The block becomes available to authors via the Universal Editor palette automatically (via the glob in `models/_component-models.json:21`).

**New default component (rare — usually you want a block):**
- Create `models/_<name>.json`.
- Add a spread reference in `models/_component-models.json` (the file is an array of `{ "...": "./_<name>.json#/models" }`).
- Update `models/_component-definition.json` and `models/_component-filters.json` similarly.
- Run `npm run build:json`.

**Shared helper for multiple blocks:**
- Add to `scripts/scripts.js` as a named export. Existing examples: `moveAttributes`, `moveInstrumentation`, `decorateMain`.
- Do NOT modify `scripts/aem.js` — it is the vendored EDS framework.

**Global styles:**
- CSS variables and base typography → `styles/styles.css`.
- Below-the-fold defaults → `styles/lazy-styles.css`.
- `@font-face` declarations → `styles/fonts.css` (and drop woff2 in `fonts/`).

**Page-wide head changes:**
- Edit `head.html`. Keep nonce-aem on any added inline scripts.

**New icon:**
- Drop `<name>.svg` into `icons/`. Reference inline as `:<name>:` in author content.

**New CI step:**
- Add a workflow file under `.github/workflows/`.

**New authored fragment (e.g., new nav/footer or any reusable section):**
- Author it in AEM, not in code; reference its path via `<meta name="nav" content="/nav">` or via the Fragment block's link.

## Special Directories

**`.git/`:**
- Purpose: Git internals.
- Generated: Yes.
- Committed: No.

**`node_modules/`:**
- Purpose: npm dependencies (lint tooling only — no runtime deps).
- Generated: Yes (`npm ci`).
- Committed: No (covered by `.gitignore`).

**`.husky/`:**
- Purpose: Git hooks installed by `husky` 9.
- Generated: Partially (set up by `prepare` script in `package.json:15`).
- Committed: Yes (hook scripts).

**`.planning/`:**
- Purpose: GSD planning documents.
- Generated: Yes (by GSD commands).
- Committed: Per project policy.

**Compiled JSON at repo root (`component-models.json`, `component-definition.json`, `component-filters.json`):**
- Purpose: Universal Editor / Crosswalk consumes these directly.
- Generated: Yes — `npm run build:json` from `models/` + `blocks/*/_*.json`.
- Committed: Yes (AEM author requires them in the served bundle).

**`.hlxignore`:**
- Purpose: Excludes files from the AEM Edge Delivery bundle (similar to `.gitignore`).
- Notable rules: `_*` (excludes per-block `_*.json` sources), `test/*` (excludes future tests), `.*`, `*.md`, `node_modules/*`.

---

*Structure analysis: 2026-05-06*
