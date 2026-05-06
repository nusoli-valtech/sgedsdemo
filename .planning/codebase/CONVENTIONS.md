# Coding Conventions

**Analysis Date:** 2026-05-06

## Naming Patterns

**Files:**
- Block JS/CSS: `kebab-case.js` / `kebab-case.css`, paired in a directory of the same name
  - Example: `blocks/article-hero/article-hero.js`, `blocks/article-hero/article-hero.css`
- Block model partials: leading underscore `_<block>.json`
  - Example: `blocks/cards/_cards.json`, `blocks/hero/_hero.json`
- Top-level scripts: lowercase, dot-separated qualifiers
  - Example: `scripts/aem.js`, `scripts/editor-support.js`, `scripts/editor-support-rte.js`
- Styles: lowercase, hyphen-separated
  - Example: `styles/lazy-styles.css`, `styles/fonts.css`

**Functions:**
- `camelCase` for all functions
  - Examples: `decorate`, `loadFragment`, `decorateMain`, `moveInstrumentation`, `toggleAllNavSections`
- Default exported decorator is always named `decorate(block)`
  - Pattern: `export default async function decorate(block) { ... }` (e.g., `blocks/header/header.js:110`)

**Variables:**
- `camelCase` for locals and module-level state
  - Example: `navMeta`, `navPath`, `fragmentSection`, `cfPath`
- `UPPER_SNAKE_CASE` for module-level constants
  - Example: `GRAPHQL_ENDPOINT` in `blocks/article-hero/article-hero.js:1`
- Trailing `$` suffix for promise-typed module state
  - Example: `let promiseChanges$ = Promise.resolve();` in `scripts/editor-support.js:14`

**Types:**
- No TypeScript in repo. Types are documented via JSDoc on exported/decorate functions.
  - Example: `@param {Element} block The header block element` in `blocks/header/header.js:108`

**CSS classes:**
- `kebab-case`, prefixed by block name; sub-elements use `<block>-<part>` pattern
  - Example: `.cards-card-image`, `.cards-card-body`, `.article-hero-overlay`
- CSS custom properties live on `:root` in `styles/styles.css`, prefixed by domain
  - Example: `--background-color`, `--heading-font-size-xl`, `--nav-height`

## Code Style

**Formatting:**
- No Prettier or Biome detected. `.editorconfig` is the source of truth (`.editorconfig:1`):
  - JS indent: 2 spaces
  - CSS indent: 4 spaces
  - JSON indent: 2 spaces
- `eslint-config-airbnb-base` enforces single quotes, trailing commas, semi-colons, max-len
- Linebreaks pinned to unix via custom rule (`.eslintrc.js:19`)

**Linting:**
- Tooling pinned in `package.json`:
  - `eslint` 8.57.1 with `@babel/eslint-parser` 7.28.6
  - `eslint-config-airbnb-base` 15.0.0
  - `eslint-plugin-import` 2.32.0, `eslint-plugin-json` 3.1.0
  - `eslint-plugin-xwalk` (Adobe AEM cross-walk plugin)
  - `stylelint` 17.0.0 with `stylelint-config-standard` 40.0.0
- Config: `.eslintrc.js` (legacy flat-less config, `root: true`, `env.browser: true`)
- Style config: `.stylelintrc.json` extends `stylelint-config-standard`
- Custom JS rules (`.eslintrc.js:17`):
  - `import/extensions` set to `error` with `{ js: 'always' }` — explicit `.js` extensions required in imports
  - `linebreak-style: ['error', 'unix']`
  - `no-param-reassign: [2, { props: false }]` — allows mutating param properties (used by decorators)
- Ignored paths (`.eslintignore`): `helix-importer-ui`, `dompurify.min.js`
- Run scripts (`package.json:7-10`):
  - `npm run lint:js` — eslint over `.json,.js,.mjs`
  - `npm run lint:css` — stylelint over `blocks/**/*.css` and `styles/*.css`
  - `npm run lint` — runs both
  - `npm run lint:fix` — auto-fix variant
- CI gate: `.github/workflows/main.yaml` runs `npm ci && npm run lint` on every push

## Import Organization

**Order:**
1. Imports from `scripts/aem.js` (framework primitives)
2. Imports from `scripts/scripts.js` (project utilities)
3. Imports from sibling/peer blocks (e.g., `../fragment/fragment.js`)

**Path Aliases:**
- None. All imports are relative paths.
- Block-to-block imports cross the `blocks/` boundary explicitly
  - Example: `import { loadFragment } from '../fragment/fragment.js';` in `blocks/header/header.js:2`
- `.js` extensions are mandatory on all relative imports (enforced by `import/extensions` rule)
- Known cyclic import is suppressed with comment
  - Example: `// eslint-disable-next-line import/no-cycle` in `blocks/fragment/fragment.js:7` and `scripts/scripts.js:137`

**Module shape:**
- Block files export a default `decorate(block)` function and may also export named helpers
  - Example: `blocks/fragment/fragment.js` exports both `loadFragment` (named) and `decorate` (default)

## Error Handling

**Patterns:**
- Network calls use `try/catch` around `await fetch(...)` and throw on non-OK responses
  - Pattern from `blocks/article-hero/article-hero.js:12-33`:
    ```js
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
      const data = await resp.json();
      const item = data?.data?.articleByPath?.item;
      if (!item) throw new Error('No item in response');
      // ... render ...
    } catch (err) {
      console.error('Article hero failed:', err);
    }
    ```
- Failures are logged to `console.error` then swallowed — block fails silently in production rather than throwing
- Optional features use `try/catch` with empty catch and a `// do nothing` comment
  - Example: font/session-storage block in `scripts/scripts.js:54-58` and `scripts/scripts.js:107-109`
- Auto-block decoration wraps in `try/catch` and logs (`scripts/scripts.js:65-72`)
- `// eslint-disable-next-line no-console` is the convention when intentional console use is required (e.g., `scripts/scripts.js:69`)
- Defensive guards via optional chaining and early returns are preferred over nested ifs
  - Example: `if (!link) return;` and `data?.data?.articleByPath?.item` in `blocks/article-teaser/article-teaser.js:5`
- No Result/Either types. No custom error classes. Plain `Error` only.

## Logging

**Framework:** None — `console.*` only.

**Patterns:**
- Use `console.error` only for unexpected failures inside catch blocks; tag with a feature prefix
  - Example: `console.error('Article hero failed:', err);` in `blocks/article-hero/article-hero.js:32`
- All other `console.*` is forbidden by airbnb-base (`no-console`); intentional usages must carry an `eslint-disable-next-line no-console` comment
- The framework module `scripts/aem.js` (Adobe-vendored, `eslint-env browser`) handles RUM telemetry via `sampleRUM(...)` — do not add ad hoc logging there

## Comments

**When to Comment:**
- File-level banner only on Adobe-vendored files (`scripts/aem.js:1-11`, `styles/styles.css:1-11`)
- Inline comments mark intent for non-obvious decoration steps (e.g., `/* change to ul, li */` in `blocks/cards/cards.js:5`)
- `// TODO:` markers used for planned-but-empty stubs
  - Example: `// TODO: add auto block, if needed` in `scripts/scripts.js:67`
- ESLint disables must be on a single targeted line and prefer `eslint-disable-next-line <rule>` over file-wide disables
  - Common rules disabled: `no-param-reassign`, `no-use-before-define`, `import/no-cycle`, `import/prefer-default-export`, `no-console`

**JSDoc/TSDoc:**
- JSDoc is the documentation convention; required on exported helpers and decorators
  - Pattern: short summary + `@param` for each argument, `@returns` when non-void
  - Example: `blocks/fragment/fragment.js:16-20`
    ```js
    /**
     * Loads a fragment.
     * @param {string} path The path to the fragment
     * @returns {HTMLElement} The root element of the fragment
     */
    ```
- Internal helpers may use JSDoc but commonly skip it (e.g., `closeOnEscape` in `blocks/header/header.js:7`)

## Function Design

**Size:**
- Keep block decorators short and DOM-focused. Headers/editor-support modules are the only files exceeding ~100 lines.
- `scripts/aem.js` is the single large file (738 lines) — Adobe-vendored, treat as read-only.

**Parameters:**
- Decorators always take a single `block` (`Element`) argument and return either `void` or a `Promise<void>`
- Helpers that toggle UI state accept the target element first, then optional flags with defaults
  - Example: `toggleMenu(nav, navSections, forceExpanded = null)` in `blocks/header/header.js:71`

**Return Values:**
- Decorators return `undefined` (or `Promise<undefined>`); side effects happen via DOM mutation on `block`
- Loaders return the produced root element or `null`
  - Example: `loadFragment` returns `HTMLElement | null` (`blocks/fragment/fragment.js:21-45`)
- Async-state helpers return `Promise<boolean>` to signal "applied vs. fall back to reload"
  - Example: `applyChanges(event)` in `scripts/editor-support.js:16-99`

## Module Design

**Exports:**
- Each block exposes exactly one `export default async function decorate(block)`
- Named exports are reserved for utilities consumed by other modules
  - Example: `export function moveAttributes`, `export function moveInstrumentation`, `export function decorateMain` in `scripts/scripts.js`
- `// eslint-disable-next-line import/prefer-default-export` is used when a module exports a single named function
  - Example: `scripts/scripts.js:78`

**Barrel Files:**
- None. Imports always reference concrete `.js` files.
- `scripts/aem.js` acts as the de facto framework barrel (re-exports nothing — exports a wide flat surface of decorate/load helpers)

## File / Directory Conventions Specific to This Codebase

- New blocks live under `blocks/<block-name>/` with files `<block-name>.js` and `<block-name>.css`
- Optional Universal Editor model partial: `blocks/<block-name>/_<block-name>.json` (auto-merged into `component-models.json` / `component-definition.json` / `component-filters.json` by `npm run build:json`)
- A husky `pre-commit` hook (`.husky/pre-commit.mjs`) detects staged `_*.json` model partials and re-runs the merge then `git add`s the generated artifacts — never edit the merged `component-*.json` files by hand
- Empty `scripts/delayed.js` is intentional — drop deferred (>3s post-load) code there (loaded by `scripts/scripts.js:138`)

---

*Convention analysis: 2026-05-06*
