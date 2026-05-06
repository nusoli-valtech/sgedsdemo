# External Integrations

**Analysis Date:** 2026-05-06

## APIs & External Services

**Content Delivery (AEM Edge Delivery / Helix):**
- AEM Author Instance - Source of authored content fetched via Helix delivery proxy.
  - Endpoint: `https://author-p23458-e585661.adobeaemcloud.com/bin/franklin.delivery/nusoli-valtech/sgedsdemo/main`
  - Configured at: `fstab.yaml` (`mountpoints./.url`)
  - Auth: None at code level (Helix-side).
- aem.live runtime - Hosts the published site. Project served from `*.aem.page` (preview) and `*.aem.live` (live) per `README.md`.

**AEM GraphQL Content Fragments:**
- AEM Publish GraphQL - Persisted-query endpoint queried directly from browser blocks for Content Fragment data.
  - Endpoint: `https://publish-p23458-e585661.adobeaemcloud.com/graphql/execute.json/sgedsdemo/article-by-path`
  - Used by: `blocks/article-hero/article-hero.js:1`, `blocks/article-teaser/article-teaser.js:1`
  - Call style: `fetch(\`${GRAPHQL_ENDPOINT};path=${cfPath}\`)` - persisted-query GET with path parameter.
  - Auth: None (anonymous public publish endpoint).
  - Filters paths to `/content/dam/` only before requesting.

**Real User Monitoring (RUM):**
- Adobe Helix RUM Collector - Anonymous performance/error telemetry.
  - Endpoint: `https://ot.aem.live` (default `RUM_BASE`, see `scripts/aem.js:93`).
  - SDK: Inline `sampleRUM` implementation in `scripts/aem.js`.
  - Sampled at runtime; rate configurable via `?rum=` query param or `window.SAMPLE_PAGEVIEWS_AT_RATE`.

**Fragment Loading:**
- Same-origin Helix `.plain.html` fragment fetches via `blocks/fragment/fragment.js:25` (`fetch(\`${path}.plain.html\`)`). Not external — served by Edge Delivery.

## Data Storage

**Databases:**
- None directly accessed by the codebase. Content storage is delegated to AEM Author / DAM through the Helix delivery proxy.

**Content Repository (read-only via APIs):**
- AEM Sites pages - Mounted at `/content/sgedsdemo/` (`paths.json`).
- AEM DAM - Includes `/content/dam/sgedsdemo/` (`paths.json`); Content Fragments referenced by DAM paths in `article-hero` and `article-teaser` blocks.

**File Storage:**
- AEM DAM (Adobe Experience Manager Digital Asset Management). Image and Content Fragment paths under `/content/dam/`.

**Caching:**
- Browser `sessionStorage` - `fonts-loaded` flag in `scripts/scripts.js:55` to skip font reload.
- Edge Delivery CDN caching is handled by aem.live infrastructure (no application-level cache code).

## Authentication & Identity

**Auth Provider:**
- None at runtime - Site is anonymous public delivery. No user login flows in the codebase.
- Authoring auth: Handled outside this repo by Adobe IMS / AEM Sidekick (browser extension, configured via `tools/sidekick/config.json`).
- AEM Code Sync GitHub App syncs this repo to AEM (per `README.md`).

## Monitoring & Observability

**Error Tracking:**
- Helix RUM `error` checkpoint - `window.error` and `unhandledrejection` listeners in `scripts/aem.js:67-81` forward error data to RUM.
- CSP violation reporting - `securitypolicyviolation` listener (`scripts/aem.js:83-91`) reports `helix-rum-enhancer` blocks.

**Logs:**
- `console.error` for block fetch failures (e.g., `blocks/article-hero/article-hero.js:32`, `blocks/article-teaser/article-teaser.js:27`).
- No external log aggregation.

**Performance Telemetry:**
- Helix RUM checkpoints throughout `scripts/aem.js` (page views, LCP, etc.).

## CI/CD & Deployment

**Hosting:**
- aem.live (Adobe Edge Delivery Services) - Auto-deployed via the AEM Code Sync GitHub App watching this repo.

**CI Pipeline:**
- GitHub Actions
  - `.github/workflows/main.yaml` - Build job: checkout, Node 24 setup, `npm ci`, `npm run lint`. Runs on every push.
  - `.github/workflows/cleanup-on-create.yaml` - Boilerplate-cleanup workflow on repo creation.

**Dependency Management:**
- Renovate Bot (`.renovaterc.json`) - Auto-merges devDependency PRs.

**Git Hooks:**
- Husky pre-commit (`.husky/pre-commit` → `.husky/pre-commit.mjs`) rebuilds bundled component JSON when `_*.json` model partials change and re-stages outputs.

## Environment Configuration

**Required env vars:**
- None. No `process.env` reads, no `.env` template, no `.env*` files in repo. All endpoints are hardcoded.

**Hardcoded service URLs:**
- AEM Author proxy: `fstab.yaml`
- AEM Publish GraphQL: `blocks/article-hero/article-hero.js:1`, `blocks/article-teaser/article-teaser.js:1` (duplicated literal — debt risk)
- RUM base: `scripts/aem.js:93` (`https://ot.aem.live`)

**Secrets location:**
- No secrets in repo. AEM Code Sync GitHub App credentials and AEM author auth managed externally by Adobe.

## Webhooks & Callbacks

**Incoming:**
- AEM Universal Editor postMessage events - Handled in `scripts/editor-support.js` (`applyChanges`, `attachEventListeners`). Editor sends content patches; client redecorates in place. Not HTTP webhooks but cross-frame messaging from the editor host.

**Outgoing:**
- RUM beacons to `ot.aem.live` (see `scripts/aem.js:95+` `sendPing`).
- GraphQL persisted-query GETs to AEM publish (article blocks).
- `*.plain.html` fragment fetches (same-origin, Helix-served).

---

*Integration audit: 2026-05-06*
