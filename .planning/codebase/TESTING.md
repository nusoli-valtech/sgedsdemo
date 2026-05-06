# Testing Patterns

**Analysis Date:** 2026-05-06

## Test Framework

**Runner:** None.

- No test runner is installed. `package.json:27-39` lists no `jest`, `vitest`, `mocha`, `ava`, `playwright`, `cypress`, `karma`, or `@web/test-runner` dependency.
- No `test`, `test:*`, `e2e`, or `coverage` scripts exist in `package.json:6-16`. The only quality gate scripts are `lint:js`, `lint:css`, `lint`, and `lint:fix`.

**Assertion Library:** None installed.

**Run Commands:**
```bash
# No test commands exist. The closest quality gates are:
npm run lint        # eslint (.json,.js,.mjs) + stylelint (blocks/**/*.css, styles/*.css)
npm run lint:fix    # auto-fix variant
```

## Test File Organization

**Location:** No test files in repo.

**Search results (2026-05-06):**
```bash
find . -type f \( -name "*.test.*" -o -name "*.spec.*" \) -not -path "*/node_modules/*"
# (no matches)

find . -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "spec" \) -not -path "*/node_modules/*"
# (no matches)
```

**Naming:** Not applicable.

**Structure:** Not applicable.

## Test Structure

Not applicable — no tests in repo.

## Mocking

Not applicable — no test infrastructure.

**For future test work, the candidates that would need mocking:**
- `fetch` — used at `blocks/article-hero/article-hero.js:13`, `blocks/article-teaser/article-teaser.js:13`, `blocks/fragment/fragment.js:25`
- `window.hlx` global — set up in `scripts/aem.js:18` (RUM/Helix runtime state)
- `window.matchMedia` — used at `blocks/header/header.js:5`
- `window.DOMPurify` — loaded dynamically in `scripts/editor-support.js:32-34`
- DOM (`document`, `MutationObserver`) — pervasive across all `blocks/*` decorators

## Fixtures and Factories

Not applicable.

**Where realistic fixtures would live (proposed convention):**
- HTML fixtures resembling the AEM `decorateBlocks` input shape (`<div class="block"><div><div>...`) — would need to mirror what `scripts/aem.js` produces before calling the block's `decorate(block)`
- JSON fixtures matching the GraphQL response shape for article blocks: `{ data: { articleByPath: { item: { title, body: { html }, image: { _path } } } } }` (see `blocks/article-hero/article-hero.js:17`)

## Coverage

**Requirements:** None enforced.

- No coverage tool installed.
- `.gitignore:2` does ignore a `coverage/*` directory, indicating intent for future coverage tooling — but nothing currently writes to it.

**View Coverage:** Not available.

## Test Types

**Unit Tests:** None.

**Integration Tests:** None.

**E2E Tests:** None.

- No Playwright, Cypress, Puppeteer, or WebDriver dependency.
- No headless browser harness configured.

## CI

`.github/workflows/main.yaml` is the only CI pipeline. It runs lint only:

```yaml
- run: npm ci
- run: npm run lint
```

There is no test step in CI. Adding a test runner would also require adding the corresponding workflow step.

## Pre-commit Quality Gates

`.husky/pre-commit` invokes `.husky/pre-commit.mjs`, which only:
1. Detects staged `_*.json` model partials
2. Runs `npm run build:json` to regenerate `component-models.json`, `component-definition.json`, `component-filters.json`
3. `git add`s the regenerated files

The hook does NOT run lint or tests before commit.

## Common Patterns (For Future Tests)

**Async Testing:**
- All block decorators are `async function decorate(block)`. Tests would need to `await decorate(block)` and then assert on `block.innerHTML` or descendant queries.

**Error Testing:**
- Decorators swallow errors via `try/catch` + `console.error`. To assert error paths, tests would need to spy on `console.error` and on `fetch` rejection/non-OK responses (see `blocks/article-hero/article-hero.js:14`, `blocks/article-teaser/article-teaser.js:14`).

**DOM Setup:**
- Block decorators expect a `block` element with the AEM-decorated structure (rows of `<div>` produced by `scripts/aem.js#decorateBlocks`). Tests would need a JSDOM environment plus a fixture builder, since `scripts/aem.js` is heavily browser-coupled (`eslint-env browser`, uses `crypto.randomUUID`, `MutationObserver`, `window.performance`).

## Recommendation Summary

This codebase has **no automated tests**. If introducing tests:
- Vitest + JSDOM is the lightest fit for this ESM-only, browser-targeted codebase (matches the `import` / `.js`-extension style enforced by `.eslintrc.js:18`).
- Place tests beside source as `<name>.test.js` (e.g., `blocks/cards/cards.test.js`) — this matches the existing co-location of `.js` and `.css` per block.
- Add `npm test` to `package.json:6` and a `- run: npm test` step to `.github/workflows/main.yaml` after the existing `npm run lint` step.

---

*Testing analysis: 2026-05-06*
