# Technology Stack

**Analysis Date:** 2026-05-06

## Languages

**Primary:**
- JavaScript (ES Modules) - All runtime/browser code in `scripts/`, `blocks/`, `tools/`. Native ES module syntax (`import` / `export`), no transpilation step at build time.
- CSS - Block and global styles in `blocks/**/*.css` and `styles/*.css`.
- JSON - Component models and definitions in `models/`, generated bundles at `component-definition.json`, `component-models.json`, `component-filters.json`.

**Secondary:**
- HTML - Static templates: `head.html`, `404.html`.
- YAML - Helix config: `fstab.yaml`, `helix-query.yaml`, `helix-sitemap.yaml`, `.github/workflows/*.yaml`.
- MJS - Husky pre-commit script `.husky/pre-commit.mjs` (Node.js ESM).

## Runtime

**Environment:**
- Browser (modern, ES Modules native) - Primary runtime. CSP enforced via `head.html` (`script-src 'nonce-aem' 'strict-dynamic'`).
- Node.js 24 - CI build runner per `.github/workflows/main.yaml` (despite step label "Use Node.js 20").
- Node.js >= 18.3.x - Local dev minimum per `README.md`.

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`, ~189 KB)

## Frameworks

**Core:**
- Adobe Edge Delivery Services / Helix (AEM Live) - Document-based authoring framework. Project derived from `@adobe/aem-boilerplate` v1.3.0 (`package.json`). Runtime helpers live in `scripts/aem.js`.
- AEM Universal Editor / Crosswalk (XWalk) - Component authoring layer. Editor support in `scripts/editor-support.js`, `scripts/editor-support-rte.js`. Component model JSON in `models/`.

**Testing:**
- None detected (no test runner, no `test/` directory present, no test configs).

**Build/Dev:**
- `merge-json-cli` 1.0.4 - Merges component model partials (`models/_*.json`) into top-level bundles. Driven by npm scripts `build:json:models|definitions|filters`.
- `npm-run-all` 4.1.5 - Parallel script runner used by `build:json`.
- `husky` 9.1.1 - Git hooks; pre-commit at `.husky/pre-commit` invokes `.husky/pre-commit.mjs` to rebuild bundled JSON when `_*.json` model partials are staged.
- AEM CLI (`@adobe/aem-cli`) - Local dev proxy via `aem up` (installed globally per `README.md`, not a project dependency).

## Key Dependencies

**Critical (devDependencies — no runtime dependencies declared):**
- `eslint` 8.57.1 - JS linting.
- `eslint-config-airbnb-base` 15.0.0 - Base style guide.
- `eslint-plugin-import` 2.32.0 - Import rules; project enforces explicit `.js` extensions.
- `eslint-plugin-json` 3.1.0 - JSON linting.
- `eslint-plugin-xwalk` (github:adobe-rnd/eslint-plugin-xwalk) - AEM Crosswalk-specific rules.
- `@babel/eslint-parser` 7.28.6 - ESLint parser only (no Babel transpile pipeline).
- `stylelint` 17.0.0 + `stylelint-config-standard` 40.0.0 - CSS linting.

**Infrastructure (vendored, not in package.json):**
- `scripts/aem.js` - AEM/Helix client runtime (vendored from boilerplate). Provides `decorateBlocks`, `decorateSections`, `loadFragment`, `sampleRUM`, etc.
- `scripts/dompurify.min.js` - DOMPurify (vendored). Sanitizes HTML in editor live updates (`scripts/editor-support.js:32-34`).

## Configuration

**Environment:**
- No `.env` files present. No runtime env-var consumption observed.
- `fstab.yaml` - Mounts content root to AEM author endpoint (`https://author-p23458-e585661.adobeaemcloud.com/bin/franklin.delivery/nusoli-valtech/sgedsdemo/main`).
- `paths.json` - Path mappings for AEM content (`/content/sgedsdemo/` → `/`) and DAM includes (`/content/dam/sgedsdemo/`).
- `head.html` - Inline Content Security Policy and bootstrap script tags.
- `tools/sidekick/config.json` - AEM Sidekick browser-extension project config.

**Build:**
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

**Development:**
- Node.js >= 18.3.x (`README.md`).
- AEM CLI (`@adobe/aem-cli`) installed globally for `aem up` local proxy on `http://localhost:3000`.
- AEM Cloud Service release 2024.8 or newer (>= 17465).

**Production:**
- AEM Edge Delivery Services (aem.live).
  - Preview: `https://main--{repo}--{owner}.aem.page/`
  - Live: `https://main--{repo}--{owner}.aem.live/`
- Content sourced from AEM author instance `author-p23458-e585661.adobeaemcloud.com` (Adobe Cloud-hosted AEM).

---

*Stack analysis: 2026-05-06*
