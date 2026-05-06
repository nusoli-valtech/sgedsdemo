# Phase 1: Setup & Foundation - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the repo safe to build features on. Four surgical, mechanical edits — no new capability:

1. **SET-01** — Null-guard `applyChanges` in `scripts/editor-support.js` so Universal Editor patches stop swallowing on new blocks. Bundle the related fragment-null-guards in `header.js` / `footer.js` listed under CF-EXISTING-3.
2. **SET-02** — Centralize the AEM Author host and project codename in `scripts/config.js` so feature code (Phase 2-5) imports rather than hardcodes.
3. **SET-03** — Add a pre-commit guard that blocks any new `publish-*adobeaemcloud.com` reference in runtime code, enforcing the no-Publish constraint by tooling.
4. **SET-04** — Replace the vendored `scripts/dompurify.min.js` with the npm 3.4.2 build, prepend a header comment with version + source URL + integrity hash, ready for Phase 2 to wire into the CFO render path.

Boundaries: this phase delivers no user-visible feature. New capabilities (CFO migration, placeholders, Target, HTML Fragment API) belong to Phases 2-5.

</domain>

<decisions>
## Implementation Decisions

### Config module (SET-02)
- **D-01:** New file `scripts/config.js` with **named exports** (one `export const` per identifier). Tree-shake-friendly, greppable per-key, allows future imports like `import { AEM_AUTHOR_HOST } from '../../scripts/config.js'`.
- **D-02:** **Minimum-viable key set** — only the identifiers currently hardcoded or about to be needed. Add more as Phase 2-5 require them; do not pre-design Phase 2-5 surfaces here.
  - `AEM_AUTHOR_HOST` — `https://author-p23458-e585661.adobeaemcloud.com`
  - `PROJECT_NAME` — `sgedsdemo`
  - `AEM_INSTANCE_ID` — `p23458-e585661`
  - `DAM_PREFIX` — `/content/dam/sgedsdemo/`
  - `CONTENT_PREFIX` — `/content/sgedsdemo/`
- **D-03:** Phase 1 does **not** refactor existing call sites that hardcode publish hosts (e.g., the GraphQL endpoint constants in `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js`). Those are publish-host references and will be removed entirely in Phase 2 as part of the CFO migration. Phase 1 makes the config module exist and exposes the author-side identifiers; Phase 2 deletes the publish-host literals.

### Pre-commit guard (SET-03)
- **D-04:** Pattern: `publish-*adobeaemcloud.com` (broader than the literal `publish-p23458-`). Catches accidental copy-paste from any AEM Cloud publish hostname, not just this instance.
- **D-05:** Scope: **runtime code only** — staged files in `blocks/`, `scripts/`, top-level `*.html`, top-level `*.json`. Skip `.planning/`, `docs/`, `.github/`, `node_modules/`, `tools/`. Documentation and research notes legitimately reference publish hosts (the constraint itself is documented there) and must not be blocked.
- **D-06:** Wire into the existing `.husky/pre-commit.mjs` (already an ESM script). Add a second check after the model-partials block. Fail with an explicit message naming the file + line + matched string so the author can fix or document a deliberate exception.

### DOMPurify packaging (SET-04)
- **D-07:** **Vendored** — replace contents of `scripts/dompurify.min.js` with the official DOMPurify 3.4.2 minified build. No npm dependency, no build step. Matches the existing repo pattern (no bundler) and the roadmap success criterion verbatim.
- **D-08:** Prepend a header comment block recording:
  - Version (`3.4.2`)
  - Source URL used to fetch it (e.g., `https://cdn.jsdelivr.net/npm/dompurify@3.4.2/dist/purify.min.js`)
  - SHA-256 integrity hash of the downloaded file (computed at fetch time)
  - `Last verified: 2026-05-06`
- **D-09:** File must remain `import`-friendly — confirm the 3.4.2 minified build exposes `DOMPurify` such that `import DOMPurify from '../scripts/dompurify.min.js'` works. If the minified UMD doesn't, fall back to the ESM build (`purify.es.mjs`) and rename accordingly; document which build was chosen in the header comment.

### applyChanges null-guards (SET-01)
- **D-10:** Bundle **all CF-EXISTING-3 null-guards** in this phase. The four edits are surgical and same-character; leaving 3 of them for later means Phase 2 (CFO blocks rendering, potentially missing fragments) is more likely to trip them.
  - `scripts/editor-support.js` — `if (!updates || !updates.length) return false;` in `applyChanges` before `updates.length` access (CONCERNS line 38-44).
  - `blocks/header/header.js` — `if (!fragment) return;` after `loadFragment(navPath)` and before `while (fragment.firstElementChild)` at line ~114.
  - `blocks/footer/footer.js` — same `if (!fragment) return;` guard after `loadFragment(footerPath)` (lines 12-17).
  - `blocks/fragment/fragment.js` — confirm the existing `if (fragment)` guard is already correct; no change unless verification finds a gap.
- **D-11:** No inline error UI in this phase. Authors who hit a missing fragment will see a silent skip, which matches the existing soft-fail pattern. An author-visible error placeholder is a separate decision deferred to a later phase if it becomes a usability problem.

### Claude's Discretion
- Internal helper names inside `scripts/config.js` (none expected for the minimum-viable set, but if any helpers emerge they may be inlined or named at planning time).
- Exact wording of pre-commit guard error message (must name file, matched pattern, and a one-line "why" — the words can be picked at implementation time).
- Whether to add `dompurify` to `package.json` only as a `devDependency` to enable Renovate/Dependabot tracking without installing into runtime — Claude can decide at planning if this adds value without violating the vendored-only decision.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — core value (every feature ships with docs), constraints (no Publish tier, no bundler, vanilla ES modules), key decisions.
- `.planning/REQUIREMENTS.md` §`Setup (pre-Phase-1 fixes)` — full text of SET-01, SET-02, SET-03, SET-04.
- `.planning/ROADMAP.md` §`Phase 1: Setup & Foundation` — phase goal, success criteria, dependencies.
- `.planning/STATE.md` — current position, session continuity.

### Risk and pitfalls (must read before implementation)
- `.planning/codebase/CONCERNS.md` §`Known Bugs` — `applyChanges` undefined-`updates` crash, header/footer fragment null crash, exact line numbers and proposed fixes.
- `.planning/codebase/CONCERNS.md` §`Dependencies at Risk` — DOMPurify vendored copy entry; rationale for documenting source URL + version in header comment.
- `.planning/research/PITFALLS.md` §`CF-EXISTING-3` — null-guard family writeup.
- `.planning/research/PITFALLS.md` §`CF-EXISTING-4` — project-name coupling rationale for the central config module.
- `.planning/research/PITFALLS.md` §`API-1` — context for why DOMPurify upgrade matters downstream (Phase 5 server-side sanitization).
- `.planning/research/PITFALLS.md` §`CP-2` — context for why DOMPurify must be wired into Phase 2 CFO render path.

### Files this phase will edit
- `scripts/editor-support.js:26-27` — add `applyChanges` null-guard.
- `blocks/header/header.js:114` — add fragment null-guard.
- `blocks/footer/footer.js:12-17` — add fragment null-guard (same pattern).
- `blocks/fragment/fragment.js:44` — verify existing null-handling is sufficient.
- `scripts/dompurify.min.js` — replace with 3.4.2 build + header comment.
- `.husky/pre-commit.mjs` — add publish-host guard alongside existing model-partials check.

### Files this phase will create
- `scripts/config.js` — new central config module (named exports, minimum-viable keys).

### Boilerplate / framework references (read-only)
- `scripts/aem.js` — Adobe-vendored EDS framework. Treat as read-only; never edit. Provides `decorateBlocks`, `loadFragment`, `sampleRUM`, etc.
- `head.html` — CSP nonce-aem + entry script tags. Phase 1 does not modify; downstream agents must respect the CSP when adding any inline.
- `fstab.yaml` — current Author host of record (`author-p23458-e585661.adobeaemcloud.com`). Source of truth for `AEM_AUTHOR_HOST` value.
- `paths.json` — `/content/sgedsdemo/` ↔ `/` mapping; source of truth for `CONTENT_PREFIX` and `DAM_PREFIX`.

### External documentation (read on demand)
- DOMPurify 3.4.2 release notes — `https://github.com/cure53/DOMPurify/releases/tag/3.4.2` — for verifying the minified UMD vs ESM build choice.
- Husky v9 docs — for confirming `.husky/pre-commit.mjs` invocation pattern (already in use in this repo, not expected to change).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.husky/pre-commit.mjs`** — already ESM, already runs `git diff --cached --name-only --diff-filter=ACMR`. SET-03 extends this same script with a second filter pass over staged files.
- **CSP `nonce-aem` infrastructure** — `head.html` already enforces `script-src 'nonce-aem' 'strict-dynamic'`. New `scripts/config.js` is loaded as an ES module via standard import — no inline scripts, no new CSP work.
- **`window.hlx` global** — populated by `setup()` in `scripts/aem.js:153`. Phase 1 does **not** put project config there (rejected option) because module-init order can't depend on it. The new `scripts/config.js` is a static module instead.

### Established Patterns
- **Vanilla ESM, no bundler** — every imported file must exist on disk with a `.js` extension. `scripts/config.js` follows this pattern; downstream Phase 2-5 imports look like `import { ... } from '../../scripts/config.js'`.
- **`.js` extension required by ESLint** (`import/extensions` rule, `.eslintrc.js:17`). All new imports honor this.
- **Soft-fail pattern** — blocks log errors and return rather than throw (e.g., `blocks/article-hero/article-hero.js:12-32`). Null-guards in SET-01 follow this — `return false;` / `return;` rather than throwing.
- **Sequential block loading** — `loadSection` awaits blocks one at a time. Phase 1 does not change this; the null-guards are inert when fragments load successfully.

### Integration Points
- **Phase 2 (CFO migration)** will import from `scripts/config.js` for `AEM_AUTHOR_HOST` and rewrite the GraphQL endpoint constants in `blocks/article-hero/` and `blocks/article-teaser/` to use the central config + DOMPurify-sanitized render path. Phase 1 must leave both files functional (no broken imports) for Phase 2 to refactor cleanly.
- **Phase 5 (HTML Fragment API)** will import the same DOMPurify build for server-side sanitization. The vendored 3.4.2 file is the single source of truth for both consumers.
- **Editor live-patching path** — `aue:content-*` events flow through `applyChanges` in `scripts/editor-support.js`. The null-guard there is the highest-leverage fix in this phase: every Phase 2-5 block patch goes through this code.

</code_context>

<specifics>
## Specific Ideas

- Roadmap success criterion #4 specifies "header comment records version + source URL". User confirmed this verbatim — header comment must include version and source URL. Integrity hash and `Last verified` date were added during discussion (not in original roadmap text) for defense against silent vendor file tampering.
- User picked the broader `publish-*adobeaemcloud.com` regex over the strict literal `publish-p23458-` so accidental copy-paste from other AEM projects is also caught.
- User picked code-only scan paths (`blocks/`, `scripts/`, top-level `*.html`/`*.json`) explicitly so `.planning/` and `docs/` references to publish hosts (which are intentional documentation of the constraint) are never blocked.

</specifics>

<deferred>
## Deferred Ideas

- **Inline author-visible error UI when fragment is missing** — considered alongside SET-01 null-guards but rejected for this phase. Soft-fail (silent skip) matches the existing pattern. Revisit if Phase 2-5 authors hit missing fragments and find the silence confusing.
- **Migration of hardcoded publish-host references in `blocks/article-hero/` and `blocks/article-teaser/`** — these references will be removed entirely in Phase 2 (CFO migration). Phase 1 only stands up the config module; Phase 2 deletes the publish literals as part of moving the GraphQL endpoint to the Author proxy.
- **ESLint 9 / airbnb-base maintenance migration (CF-EXISTING-1)** — flagged in CONCERNS but explicitly out of scope for the four POC capabilities. Documented for the production project that follows.
- **`buildAutoBlocks` / empty `delayed.js` / empty `hero.js` cleanup (CF-EXISTING-2)** — pre-existing tech debt unrelated to the four POC capabilities. Not blocking; deferred to a future cleanup phase if it becomes a friction point.
- **Pin Node version in CI (resolve "Use Node.js 20" label vs Node 24 install mismatch)** — CONCERNS line 180. Cosmetic; CI is currently green. Defer.
- **Adding `dompurify` to `package.json` as a tracked dependency** — captured under "Claude's Discretion" above. May be done as a `devDependency` for Renovate visibility without violating the vendored-only delivery decision.

</deferred>

---

*Phase: 1-Setup & Foundation*
*Context gathered: 2026-05-06*
