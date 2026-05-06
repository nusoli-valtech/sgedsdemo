# SG EDS Demo — AEM Edge Delivery POC

## What This Is

An Adobe AEM Edge Delivery Services (Helix) demo site used as a **proof-of-concept playground** for a future larger AEM EDS project. Each feature is built as a self-contained, fully documented experiment so the team can evaluate approaches and reference patterns later. Authoring runs in **Universal Editor on AEM Cloud Service**; the EDS publish tier is intentionally **not** used.

## Core Value

**Every feature ships with a working implementation _and_ a step-by-step guide in `docs/`** so future projects can reuse the patterns without rediscovery.

## Requirements

### Validated

<!-- Inferred from existing codebase as of 2026-05-06 -->

- ✓ AEM EDS site scaffold based on `@adobe/aem-boilerplate` v1.3.0 — existing
- ✓ Universal Editor wiring with component models (`models/`, `component-*.json`) — existing
- ✓ Block library: `header`, `footer`, `hero`, `cards`, `columns`, `fragment`, `dam-banner`, `article-hero`, `article-teaser` — existing
- ✓ Three-phase loading orchestration (eager / lazy / delayed) via `scripts/scripts.js` and `scripts/aem.js` — existing
- ✓ AEM Author proxy via `fstab.yaml` + Helix RUM via `ot.aem.live` — existing
- ✓ Lint-only CI on Node 24 (ESLint 8 + airbnb-base + xwalk + Stylelint) — existing

### Active

- [ ] **Migrate `article-hero` and `article-teaser` to Content Fragment Overlay** so Content Fragments load through Universal Editor's authoring tier instead of the publish GraphQL endpoint (publish is unavailable on EDS) — ref: <https://www.aem.live/developer/content-fragment-overlay>
- [ ] **Generic placeholder/variable mechanism in any text block** so editors can declare globally-controlled values (e.g. `{{brandName}}`, `{{currentYear}}`) once and have them resolved across all pages — ref: <https://www.aem.live/developer/placeholders>
- [ ] **Adobe Target integration with two demo activities**: (a) banner text variation, (b) page logo variation — using the existing Target account/property — ref: <https://www.aem.live/developer/target-integration>
- [ ] **HTML Fragment API**: an external-facing API that returns a Content Fragment (or page slice) rendered as HTML, callable from a different domain by an external web app
- [ ] **Step-by-step `docs/` guide for every feature**, covering both code changes and any AEM/Target UI configuration (clicks-level detail)

### Out of Scope

- **EDS publish tier features** — publish is intentionally not available in this AEM Cloud setup; every feature must work via Universal Editor + author preview
- **Production hardening of the HTML Fragment API** (rate limiting, multi-tenant key rotation, full IMS/OAuth) — POC will start with public read + CORS allowlist; production-grade auth deferred to the real project
- **Replacing the existing block library or build chain** — vanilla-JS / no-bundler EDS conventions stay; experiments adapt to them, not the other way around
- **Test framework adoption** — POC stays lint-only; testing strategy for the real project is decided later
- **Backfilling documentation for pre-existing blocks** — `docs/` only covers the four POC features
- **Generic CMS i18n / translation tooling** — placeholders are for global text variables, not multilingual content

## Context

**Why this exists.** The team is preparing a larger AEM EDS project. Several capabilities the future project needs aren't trivial on EDS-without-publish, so this repo de-risks them up front. Every successful pattern here becomes a reference implementation.

**Existing codebase signals.** `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js` currently call a hardcoded GraphQL persisted query directly on the AEM Publish tier (see `.planning/codebase/INTEGRATIONS.md`) — that's the broken path being replaced first. `blocks/hero/hero.js` and `scripts/delayed.js` are empty stubs. `scripts/scripts.js` has a `buildAutoBlocks` TODO. DOMPurify is bundled (`scripts/dompurify.min.js`) but not used despite GraphQL responses being interpolated into `innerHTML`.

**Authoring constraint.** All four features must remain editable in Universal Editor. Any new block, model, or component definition must register correctly with `component-definition.json` / `component-models.json` / `component-filters.json` (built from `models/` and per-block `_<name>.json` partials via `merge-json-cli`).

**Documentation as deliverable.** Step-by-step guides live in `docs/` and are first-class deliverables, not afterthoughts. A feature is not done until its guide is written and validated.

## Constraints

- **Tech stack**: Vanilla JS ES modules, no bundler, no transpiler — must follow EDS conventions (`decorate(block)` default-export, `.js` extensions on imports, kebab-case block dirs paired with `_<block>.json`)
- **Authoring tier**: AEM Cloud Service Author with Universal Editor — Author proxy via `fstab.yaml`
- **Publish tier**: **Not available** — every feature must work without it
- **Adobe Target**: Existing Adobe Target account + property to be used (credentials/access provided by user)
- **External API consumer**: HTML Fragment API will be called from an external web app on a different domain — CORS and (eventually) auth must be addressed
- **Security**: Existing XSS risk in article blocks (innerHTML on GraphQL data without DOMPurify) — remediated as part of the CFO migration, not deferred
- **Browser support**: Same as EDS boilerplate (modern evergreen browsers; no legacy IE)
- **Documentation**: Every POC feature ships with a `docs/<feature>.md` step-by-step guide including AEM/Target UI screenshots-level click paths

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Drop Publish tier; rely on Universal Editor + Author + (eventually) the live origin | EDS deployment doesn't include AEM Publish; current architecture must work without it | — Pending |
| Migrate article blocks via Content Fragment Overlay before adding any new feature | Article blocks are currently broken under EDS-no-publish; everything else builds on a working CF integration pattern | — Pending |
| Generic placeholder mechanism in any text block (not block-specific) | Future project needs flexibility; demonstrating the most general pattern de-risks the most use cases | — Pending |
| Adobe Target integration uses existing account + property | User has access; avoids account-creation noise during POC | — Pending |
| HTML Fragment API: public read + CORS allowlist for the POC; production auth (IMS/key) documented as next step but deferred | Keeps POC focused on the rendering pipeline; auth is a known-solution problem | — Pending |
| Step-by-step guides live in `docs/<feature>.md` | Living docs alongside code; avoids parallel wikis going stale | — Pending |
| Build the four features in order: CFO → Placeholders → Target → HTML API | Fix the broken thing first, then add globals, then personalization, then headless API | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-06 after initialization*
