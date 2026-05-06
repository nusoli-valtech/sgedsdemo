# Phase 1: Setup & Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 1-Setup & Foundation
**Areas discussed:** Config module shape (SET-02), Pre-commit guard scope (SET-03), DOMPurify packaging (SET-04), applyChanges fix scope (SET-01)

---

## Gray-area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Config module shape (SET-02) | Where it lives, how it exports | ✓ |
| Pre-commit guard scope (SET-03) | Pattern + paths to scan | ✓ |
| DOMPurify packaging (SET-04) | npm dep vs vendored | ✓ |
| applyChanges fix scope (SET-01) | One-line guard or bundle CF-EXISTING-3 | ✓ |

**User's choice:** All four — every deliverable has a real shape decision to lock.

---

## Config module — file + export style

| Option | Description | Selected |
|--------|-------------|----------|
| `scripts/config.js`, named exports | Tree-shake-friendly, greppable per-key | ✓ |
| `scripts/config.js`, single default object | One import line, but ties unrelated values | |
| Constants on `window.hlx` | Matches EDS pattern but couples to runtime init order | |
| Constants block in `scripts/scripts.js` top | Avoids new file, but mixes concerns | |

**User's choice:** `scripts/config.js`, named exports.
**Notes:** Recommended option taken. Aligns with existing ESLint `import/extensions` enforcement and lets Phase 2-5 blocks import only the keys they need.

---

## Config module — key surface

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum viable | Only currently-needed identifiers (host, project name, instance ID, DAM/content prefixes) | ✓ |
| Minimum + computed helpers | + `graphqlEndpoint(name)`, `damUrl(path)` etc. | |
| Full surface up-front | All Phase 2-5 keys we can foresee | |

**User's choice:** Minimum viable.
**Notes:** Avoids pre-designing Phase 2-5 surfaces in Phase 1. Add keys as later phases need them.

---

## Pre-commit guard — pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Strict `publish-p23458-` literal | Fast, zero false positives, project-specific | |
| Broader `publish-*adobeaemcloud.com` | Catches any AEM Cloud publish host | ✓ |
| Pattern-based `publish-` host prefix | Most paranoid, risks blocking legitimate strings | |

**User's choice:** Broader `publish-*adobeaemcloud.com`.
**Notes:** User picked the broader form over the recommended literal — explicitly wants to catch copy-paste from other AEM projects, not only this instance ID.

---

## Pre-commit guard — scope

| Option | Description | Selected |
|--------|-------------|----------|
| Code only: blocks/ + scripts/ + top-level *.html / *.json | Skips docs/research dirs that legitimately reference publish hosts | ✓ |
| Whole repo with explicit allowlist | Catches accidents in unexpected places, needs maintenance | |
| Whole repo, flag only new lines | `git diff -G` filter on staged additions | |

**User's choice:** Code only.
**Notes:** Recommended option. `.planning/` and `docs/` are documentation surfaces and must remain free to reference publish hosts when explaining the constraint.

---

## DOMPurify packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Vendored: replace `scripts/dompurify.min.js` + header comment | Matches roadmap wording, no bundler needed | ✓ |
| npm dep `dompurify@3.4.2` | Adds infrastructure for one dep; node_modules not on served path | |
| Hybrid: npm dep + vendoring script | Renovate visibility + served file | |

**User's choice:** Vendored.
**Notes:** Recommended option. Matches the roadmap success criterion verbatim. Header comment will record version, source URL, SHA-256, and verification date.

---

## applyChanges fix — scope

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle all CF-EXISTING-3 null-guards | applyChanges + header + footer + fragment.js verify | ✓ |
| SET-01 only (just the updates guard) | Strict-to-requirement, leaves 3 related landmines | |
| Bundle + inline error UI in non-prod | Author-visible placeholder when fragment missing | |

**User's choice:** Bundle all CF-EXISTING-3 null-guards.
**Notes:** Recommended option. Same surgical character as the original requirement; closes the whole null-guard family before Phase 2 (CFO blocks) starts rendering through these paths.

---

## Claude's Discretion

- Internal helper names inside `scripts/config.js` (none expected for the minimum-viable set).
- Exact wording of pre-commit guard error message (must name file, matched pattern, and a one-line "why").
- Whether to add `dompurify` to `package.json` as a `devDependency` for Renovate tracking without breaking the vendored-only delivery decision.

## Deferred Ideas

- Inline author-visible error UI when fragment is missing — soft-fail pattern preserved for now.
- Migration of hardcoded publish-host literals in `blocks/article-hero/` and `blocks/article-teaser/` — handled by Phase 2 CFO migration.
- ESLint 9 / airbnb-base migration (CF-EXISTING-1).
- `buildAutoBlocks` / empty `delayed.js` / empty `hero.js` cleanup (CF-EXISTING-2).
- Pin Node version in CI to resolve label/version mismatch.
