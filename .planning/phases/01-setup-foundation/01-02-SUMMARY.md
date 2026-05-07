---
phase: 01-setup-foundation
plan: 02
subsystem: foundation
tags:
  - eds
  - config
  - identifier-coupling
  - foundation
requires: []
provides:
  - scripts/config.js
  - module: AEM_AUTHOR_HOST, PROJECT_NAME, AEM_INSTANCE_ID, DAM_PREFIX, CONTENT_PREFIX
affects:
  - blocks/article-hero/article-hero.js (Phase 2 — not modified here per D-03)
  - blocks/article-teaser/article-teaser.js (Phase 2 — not modified here per D-03)
tech-stack:
  added: []
  patterns:
    - vanilla-esm
    - named-exports-only
    - leaf-module-no-imports
    - .js-extension-mandatory
key-files:
  created:
    - scripts/config.js
  modified: []
decisions:
  - "Named exports only (D-01) — zero default exports allowed; consumers import each constant explicitly."
  - "Minimum-viable key set (D-02) — five constants only; future identifiers added when Phase 2-5 require them, not pre-designed."
  - "Phase 1 establishes the module only (D-03) — Phase 2 (CFO migration) deletes the publish-host literals in blocks/article-hero/ and blocks/article-teaser/, NOT this plan."
metrics:
  duration: ~5m
  completed: 2026-05-06
  tasks-completed: 2
  files-created: 1
  files-modified: 0
  commits: 1
---

# Phase 01 Plan 02: scripts/config.js central module Summary

Central `scripts/config.js` ESM module shipped with five named-export constants for AEM Author host, project codename, instance ID, and DAM/content path prefixes — foundational for Phase 2-5 to import instead of hardcoding.

## What Changed

Created one new vanilla ESM file at the repo root scripts directory. No existing files modified. The module is a pure data leaf — zero imports, zero side effects, zero runtime I/O.

## File Created

**`scripts/config.js`** (16 lines, LF, UTF-8):

```js
/**
 * Central project configuration.
 *
 * Per D-02 (.planning/phases/01-setup-foundation/01-CONTEXT.md): minimum-viable key set.
 * Add more identifiers as Phase 2-5 require them; do not pre-design future surfaces here.
 *
 * Source of truth:
 * - AEM_AUTHOR_HOST / AEM_INSTANCE_ID / PROJECT_NAME — derived from `fstab.yaml` mountpoint.
 * - CONTENT_PREFIX / DAM_PREFIX                     — derived from `paths.json` mappings.
 */

export const AEM_AUTHOR_HOST = 'https://author-p23458-e585661.adobeaemcloud.com';
export const PROJECT_NAME = 'sgedsdemo';
export const AEM_INSTANCE_ID = 'p23458-e585661';
export const DAM_PREFIX = '/content/dam/sgedsdemo/';
export const CONTENT_PREFIX = '/content/sgedsdemo/';
```

## Source-of-Truth Mapping

| Constant | Value | Source |
|----------|-------|--------|
| `AEM_AUTHOR_HOST` | `https://author-p23458-e585661.adobeaemcloud.com` | `fstab.yaml` mountpoint (origin only) |
| `AEM_INSTANCE_ID` | `p23458-e585661` | `fstab.yaml` host subdomain |
| `PROJECT_NAME` | `sgedsdemo` | `fstab.yaml` franklin.delivery path segment |
| `CONTENT_PREFIX` | `/content/sgedsdemo/` | `paths.json` mappings entry |
| `DAM_PREFIX` | `/content/dam/sgedsdemo/` | `paths.json` includes entry |

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create scripts/config.js with five named-export constants | `fdc87a2` | `scripts/config.js` (new) |
| 2 | Smoke-import via Node ESM (no files committed — verification only) | n/a | (ephemeral) |

## Verification Results

### Task 1 acceptance (all pass)

```text
EXIST: ok
export-count: 5
host: ok
project: ok
instance: ok
dam: ok
content: ok
default-count: 0
import-count: 0
file: Unicode text, UTF-8 text  (no CRLF)
eslint scripts/config.js: exit 0 (zero issues)
```

### Task 2 smoke import

Command:
```bash
node --input-type=module -e "import { AEM_AUTHOR_HOST, PROJECT_NAME, AEM_INSTANCE_ID, DAM_PREFIX, CONTENT_PREFIX } from './scripts/config.js'; const ok = AEM_AUTHOR_HOST === 'https://author-p23458-e585661.adobeaemcloud.com' && PROJECT_NAME === 'sgedsdemo' && AEM_INSTANCE_ID === 'p23458-e585661' && DAM_PREFIX === '/content/dam/sgedsdemo/' && CONTENT_PREFIX === '/content/sgedsdemo/'; if (!ok) { console.error('mismatch'); process.exit(1); } console.log('config.js smoke OK');"
```

Output: `config.js smoke OK` (exit 0).

Note: Node emits a `MODULE_TYPELESS_PACKAGE_JSON` advisory because the project `package.json` has no `"type": "module"`. This is Node-specific and irrelevant — the module is consumed by the browser via native ESM and `head.html` already loads `scripts/aem.js` and `scripts/scripts.js` as ES modules without that field. The smoke test correctly proved the file's syntactic validity as ESM.

### `git status --porcelain` immediately before commit

```text
?? scripts/config.js
```

Single new file under tracked paths. No other repo modifications.

## Decisions Made

- **D-01 honored:** Named exports only. `grep -c "export default" scripts/config.js` returns 0.
- **D-02 honored:** Exactly five constants — the minimum-viable set the team agreed to. Resisted scope creep (e.g., did not pre-add `PUBLISH_HOST`, `GRAPHQL_ENDPOINT`, etc. — those will be added by Phase 2 when first needed, per CONTEXT.md).
- **D-03 honored:** No call sites refactored. `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js` still hold their hardcoded publish-host literals. They are Phase 2 (CFO migration) work.

## Phase 2 Hand-off

Per D-03, the following call sites are scheduled for replacement in Phase 2 (CFO migration). They are NOT touched by this plan:

| File | Current Hardcoded Literal | Phase 2 Action |
|------|---------------------------|----------------|
| `blocks/article-hero/article-hero.js` | `https://publish-p23458-e585661.adobeaemcloud.com/...` (line ~12) | Replace with computed constant derived from `AEM_AUTHOR_HOST` (or new `PUBLISH_HOST` once defined). Migration to CF endpoint will eliminate publish-tier dependency entirely. |
| `blocks/article-teaser/article-teaser.js` | `https://publish-p23458-e585661.adobeaemcloud.com/...` (line ~12) | Same as above. |

Phase 2 importer pattern from these blocks (depth `blocks/<name>/<name>.js`):
```js
import { AEM_AUTHOR_HOST } from '../../scripts/config.js';
```

## Deviations from Plan

None — plan executed exactly as written. Source-of-truth values matched `fstab.yaml` and `paths.json` verbatim. ESLint passed cleanly on the new file. ESM smoke import succeeded on first try.

## Deferred Items (Out of Scope)

Pre-existing ESLint findings exposed when running the full repo lint (NOT introduced by this plan, NOT this plan's scope per D-03):

- `blocks/article-hero/article-hero.js:20:23` — `no-underscore-dangle` (existing)
- `blocks/article-hero/article-hero.js:34:2` — `eol-last` (existing)
- `blocks/article-hero/article-hero.js:32:5` — `no-console` warning (existing, intentional)
- `blocks/article-teaser/article-teaser.js:29:2` — `eol-last` (existing)
- `blocks/article-teaser/article-teaser.js:27:5` — `no-console` warning (existing, intentional)

These will be addressed by Phase 2 (CFO migration) when those files are rewritten to remove publish-host coupling and adopt DOMPurify (per CLAUDE.md "Existing XSS risk in article blocks").

## Threat Surface Scan

No new threat surface introduced. The single new file is a static-data ESM module with zero I/O, zero network calls, zero DOM access, zero side effects. `AEM_AUTHOR_HOST` is already public information (committed in `fstab.yaml`). Threat register from PLAN.md:

- T-01-02-01 (Information Disclosure of host): accept — value is public.
- T-01-02-02 (Tampering with constants): mitigate — verified by exact-string `grep -F` against canonical sources.
- T-01-02-03 (Repudiation): n/a — no logging, no side effects.

No threat flags to add.

## Self-Check: PASSED

- File exists: `FOUND: scripts/config.js`
- Commit exists: `FOUND: fdc87a2` (`feat(01-02): add scripts/config.js with five named-export constants`)
- All five exports present and matching canonical values.
- Lint clean for `scripts/config.js` (exit 0).
- ESM import smoke test passed.
- No other repo files modified.
