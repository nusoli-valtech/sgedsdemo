---
phase: 02-content-fragment-overlay
plan: 07
type: execute
wave: 5
depends_on: [02-01, 02-02, 02-03, 02-04, 02-05, 02-06]
files_modified:
  - docs/content-fragment-overlay.md
autonomous: true
requirements: [CFO-10, DOC-01]
must_haves:
  truths:
    - "`docs/content-fragment-overlay.md` exists and contains the seven required sections (Setup, CF model, Mustache template authoring, UE wiring, Reference responses, Smoke test, Error states) per CONTEXT specifics."
    - "Setup section embeds VERBATIM `curl` commands from plans 02-01 and 02-02 with `$AEM_TOKEN` placeholders — no real tokens."
    - "CF model section embeds the JSON export from `samples/cf-model-export.json`."
    - "Mustache template authoring section embeds `cf-templates/article.html` and explains `{{var}}` (auto-escape) vs `{{{var}}}` (raw HTML — DOMPurify on consumer)."
    - "UE wiring section embeds the `models[0].fields` array from both `_article-hero.json` and `_article-teaser.json`."
    - "Reference responses section embeds the captured response samples (`samples/cfo-public-response.json`, `samples/cfo-content-response.json`, `samples/json2html-config-response.json`, `samples/cf-json-sample.json`, `samples/cf-overlay-plain-html-sample.html`)."
    - "Smoke test section documents the XSS payload step (Success Criterion #2) — CF body containing `<img src=x onerror=alert(1)>` must render inert."
    - "Error states section documents the D-08 recoverable empty-container contract."
    - "First line of the doc reminds readers: this project does NOT use the AEM Publish tier."
  artifacts:
    - path: "docs/content-fragment-overlay.md"
      provides: "End-to-end CFO setup + authoring + smoke-test guide. First entry in the `docs/` tree — establishes house style for DOC-02..05 in later phases."
      min_lines: 80
      contains: "Content Fragment Overlay"
  key_links:
    - from: "docs/content-fragment-overlay.md"
      to: "samples/cf-model-export.json"
      via: "embedded JSON code block in `## CF model` section"
      pattern: "## CF model"
    - from: "docs/content-fragment-overlay.md"
      to: "cf-templates/article.html"
      via: "embedded HTML code block in `## Mustache template authoring` section"
      pattern: "## Mustache template authoring"
---

<objective>
Author the project's first feature documentation file: `docs/content-fragment-overlay.md`. This is the DOC-01 deliverable — a step-by-step end-to-end guide a new contributor can follow to reproduce the CFO setup from a fresh clone. It also serves as the canonical "## Reference responses" repository (per D-03) for the captured Admin API + CF JSON samples — these never live in transient SPIKE-LOG.md files; they live where future contributors will read them.

Per CLAUDE.md `## Project`: "Every feature ships with a working implementation **and** a step-by-step guide in `docs/` so future projects can reuse the patterns without rediscovery." This plan ships the implementation's documentation half. Per CLAUDE.md `## Constraints`: include AEM/Target UI screenshots-level click paths.

Purpose: Closes DOC-01 + CFO-10 (verification artifact path documented).
Output: One new file (~120-200 lines).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-content-fragment-overlay/02-CONTEXT.md
@.planning/phases/02-content-fragment-overlay/02-RESEARCH.md
@.planning/phases/02-content-fragment-overlay/02-PATTERNS.md
@.planning/phases/02-content-fragment-overlay/02-01-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/02-02-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/02-03-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/02-04-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/02-05-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/02-06-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/samples/cf-model-export.json
@.planning/phases/02-content-fragment-overlay/samples/cfo-public-response.json
@.planning/phases/02-content-fragment-overlay/samples/cfo-content-response.json
@.planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json
@.planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json
@.planning/phases/02-content-fragment-overlay/samples/cf-overlay-plain-html-sample.html
@cf-templates/article.html
@blocks/article-hero/_article-hero.json
@blocks/article-teaser/_article-teaser.json
@blocks/article-hero/article-hero.js
@blocks/article-teaser/article-teaser.js
@scripts/cf-overlay.js
@head.html
@CLAUDE.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Author `docs/content-fragment-overlay.md` end-to-end guide</name>
  <read_first>
    - All files listed in <context> above. The doc embeds verbatim content from each.
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (`<specifics>` enumerates required sections (a)-(g))
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`docs/content-fragment-overlay.md` notes — required sections, format conventions)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Reference responses sourcing; XSS smoke step)
  </read_first>
  <action>
Create `docs/content-fragment-overlay.md` with the structure below. Embed **verbatim** content from the source files where indicated — do NOT paraphrase the captured Admin API responses or the curl commands. Future contributors must be able to copy the curl invocations and paste-replay them; they must be able to see the actual JSON shape that was captured.

Required structure:

```markdown
# Content Fragment Overlay

> **Constraint:** This project does **not** use the AEM Publish tier. Every CF
> fetch goes through the Author tier via the Helix delivery proxy
> (`fstab.yaml` mountpoint) and the json2html worker. Pre-commit guard rejects
> any new `publish-*adobeaemcloud.com` reference. See `.planning/PROJECT.md`.

This guide walks you through the Phase 2 CFO setup end-to-end:

1. Verify or create the `article` Content Fragment model in AEM Author.
2. POST CFO Admin API config (`public.json` + `content.json`).
3. POST json2html worker config registering `cf-templates/article.html`.
4. Author + publish a Content Fragment.
5. Reference it from an `article-hero` or `article-teaser` block in Universal Editor.
6. Verify rendering on aem.page / aem.live.
7. Run the XSS smoke test.

---

## Setup

### 1. Verify-or-create the `article` CF model

Sign in to https://author-p23458-e585661.adobeaemcloud.com.

Tools (hammer icon) → Configuration Browser → `sgedsdemo` (root config) → Content Fragment Models. If `article` exists, skip to step 2; otherwise create it with:

- `title` — Single line text
- `body` — Multi line text, Default Type: Rich text
- `image` — Content Reference (image)

(Idempotent — re-running just verifies. See `## CF model` section below for the full JSON export.)

### 2. POST CFO Admin API config

Obtain a Helix Admin API token: sign in once at https://admin.hlx.page with the same Adobe identity that has Author access. Capture session cookie or IMS `x-auth-token`:

```bash
export AEM_TOKEN="<your-token-here>"
```

POST `public.json`:

[EMBED VERBATIM the curl command from plan 02-01 Task 2]

POST `content.json`:

[EMBED VERBATIM the second curl command from plan 02-01 Task 2]

Captured responses are in `## Reference responses` below.

### 3. POST json2html worker config

[EMBED VERBATIM the curl command from plan 02-02 Task 1]

### 4. Author + publish a CF

In AEM Author Content Fragments console, create a new fragment of model `article` under `/content/dam/sgedsdemo/articles/`. Fill in `title`, `body` (rich text), and `image` (DAM image). Click **Publish**.

### 5. Reference from a block in UE

Open any page in Universal Editor on AEMaaCS. From the component palette, drop an **Article Hero** or **Article Teaser** block. In the side panel, the **Article Content Fragment** field shows a CF picker scoped to `/content/dam/sgedsdemo/articles`. Pick your published CF. Save.

### 6. Verify rendering

The page should render the CF content. Open DevTools Network tab and confirm:

- ZERO requests to `publish-p23458-*.adobeaemcloud.com`.
- One request to `${cfPath}.plain.html` returning HTML wrapped in `<div class="article-cf">`.

---

## CF model

JSON export of the `article` model (verbatim from `.planning/phases/02-content-fragment-overlay/samples/cf-model-export.json`):

```json
[EMBED VERBATIM contents of samples/cf-model-export.json]
```

---

## Mustache template authoring

The template `cf-templates/article.html` is fetched by the json2html worker at CF-publish time. The worker is registered against this repo branch via the `/config/<org>/<site>/<branch>` POST in step 3.

```html
[EMBED VERBATIM contents of cf-templates/article.html]
```

**Mustache rules**:

- `{{title}}` — auto-escaped. Use for ALL plain-text fields.
- `{{{body}}}` — raw HTML, NO escape. Use ONLY for the `body` rich-text field. Consumer-side DOMPurify (in `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js`) sanitizes the `<div class="body">` after fetch.
- The outer wrapper `<div class="article-cf">` is the marker `scripts/cf-overlay.js`'s `fetchOverlay` checks for. If absent, `fetchOverlay` returns null and the block degrades to D-08 empty-state — keep this class on the outermost element.

---

## UE wiring

Each block exposes one field — `cfReference`.

`blocks/article-hero/_article-hero.json`:
```json
[EMBED ONLY the models[0].fields array from blocks/article-hero/_article-hero.json — the cfReference field excerpt]
```

`blocks/article-teaser/_article-teaser.json`: same shape, `id: "article-teaser"`.

The husky pre-commit hook (`.husky/pre-commit.mjs:16-22`) auto-merges these `_*.json` partials into `component-models.json`, `component-definition.json`, `component-filters.json` whenever they are staged. **Never hand-edit the merged top-level files.**

The `cf-endpoint` metadata read by `scripts/cf-overlay.js`'s `getMetadata('cf-endpoint')` consumer comes from `head.html`:

```html
<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>
```

---

## Reference responses

Captured during the Wave 1 spike (plans 02-01, 02-02, 02-03). Stored under `.planning/phases/02-content-fragment-overlay/samples/` for traceability.

### CFO `public.json` POST response

```
[EMBED VERBATIM contents of samples/cfo-public-response.json]
```

### CFO `content.json` POST response

```
[EMBED VERBATIM contents of samples/cfo-content-response.json]
```

### json2html `/config` POST response

```
[EMBED VERBATIM contents of samples/json2html-config-response.json]
```

### CF JSON sample (raw Author Assets API response)

```json
[EMBED VERBATIM contents of samples/cf-json-sample.json]
```

### `.plain.html` overlay sample (rendered by json2html worker)

```html
[EMBED VERBATIM contents of samples/cf-overlay-plain-html-sample.html]
```

**`aem.page` vs `aem.live` parity** (OQ-1 outcome): [paste the result from plan 02-03 SUMMARY — either "Both contexts return identical responses" OR "Parity not present; preview ingestion behaviour differs — fix deferred to CFO-V2-02"].

---

## Smoke test

### Test 1 — Zero publish-host requests

Open the article page in Chrome / Firefox DevTools → Network. Filter URL: `publish-`. Expected: ZERO matches. (If any match, Phase 1 D-04 pre-commit guard let a regression through; investigate.)

### Test 2 — XSS payload renders inert

In AEM Author, edit a CF and set the `title` field to:

```
<img src=x onerror=alert(1)>
```

Republish. Visit the article page. EXPECTED: the literal text `<img src=x onerror=alert(1)>` appears (Mustache `{{title}}` auto-escapes), OR the title slot is empty after DOMPurify on the body — either way, NO alert dialog. If the alert fires, DOMPurify wiring (D-04) is broken — file a bug.

Now set the CF `body` to:

```
<p>Hello</p><img src=x onerror=alert(2)>
```

Republish. Visit the page. EXPECTED: paragraph "Hello" renders, the `<img src=x onerror=...>` is stripped by DOMPurify default profile (the `onerror` handler is removed; the broken-image icon may show or not depending on browser image-loading defaults). NO alert dialog.

### Test 3 — Missing CF reference

Delete or unpublish the referenced CF. Visit the page. EXPECTED:

- Block element is in the DOM (open DevTools, find `<div class="block article-hero">`).
- Block has zero children.
- Console shows exactly one `console.error` line: `article-hero: missing CF /content/dam/sgedsdemo/articles/<id>` (or `article-teaser: ...`).
- Rest of the page renders normally.

### Test 4 — UE re-decoration

Open the page in Universal Editor. Click the article block. The side panel shows the `Article Content Fragment` field with the current cfPath. Pick a different CF, save. EXPECTED: block re-renders in place with the new CF content; no full page reload (`window.location.reload()` is the fallback path; if you see the page flash, the `applyChanges` re-decoration failed — investigate `scripts/editor-support.js`).

---

## Error states

Per **D-08** (`.planning/phases/02-content-fragment-overlay/02-CONTEXT.md`), every error class — 404, 401/403, HTML-body-where-overlay-expected (CFO-1), missing wrapper marker, network failure — produces the same recoverable empty container:

```javascript
if (!fragment) {
  console.error('article-hero: missing CF', cfPath);
  block.replaceChildren();
  return;
}
```

- Published page: invisible (block has no children).
- Universal Editor: still clickable; the `cfReference` field is editable in the side panel; re-saving with a valid CF triggers `applyChanges` → in-place re-render.
- The block element + `data-aue-*` attrs survive — `block.replaceChildren()` is intentional, NOT `block.remove()`.

There is intentionally no inline UE-only debug message. If authors hit broken refs and find the silence confusing, the deferred CFO-V2 enhancement re-introduces a UE-iframe-only badge.

---

## See also

- `.planning/REQUIREMENTS.md` `## Content Fragment Overlay (CFO)` — full requirement text (CFO-01..CFO-10).
- `.planning/phases/02-content-fragment-overlay/02-CONTEXT.md` — locked decisions D-01..D-08.
- `.planning/phases/02-content-fragment-overlay/02-RESEARCH.md` — architecture, pitfalls, OQ resolutions.
- aem.live docs: https://www.aem.live/developer/content-fragment-overlay, https://www.aem.live/developer/json2html.
```

Notes for the executor:
1. **Embed verbatim, do not paraphrase.** Every `[EMBED VERBATIM contents of …]` placeholder must be replaced with the literal file contents inside an appropriately-fenced code block. Use ` ```json` for JSON, ` ```html` for HTML, ` ```bash` for curl, ` ``` ` (no language) for raw HTTP responses.
2. The `[EMBED VERBATIM the curl command from plan 02-01 Task 2]` placeholders refer to the curl invocations in the `<how-to-verify>` sections of the corresponding plans — copy the bash code blocks unchanged (with `$AEM_TOKEN` placeholders).
3. The `[paste the result from plan 02-03 SUMMARY]` placeholder for OQ-1 parity must be replaced with the actual outcome captured in `02-03-SUMMARY.md`.
4. The doc lives at `docs/content-fragment-overlay.md`. There is no existing `docs/` precedent in this repo — this is the first feature doc. Future plans for DOC-02..05 reuse this house style.
5. The `docs/` directory is NOT under the pre-commit `isRuntimeCodePath` allowlist (`.husky/pre-commit.mjs:28-38`), so the publish-host scanner skips it. Any documentation reference to `publish-*` URLs (e.g., when explaining "what we deleted") is allowed here.
6. No special markdown tooling — plain GitHub-flavored markdown.
  </action>
  <verify>
    <automated>test -f docs/content-fragment-overlay.md && [ "$(wc -l < docs/content-fragment-overlay.md)" -ge 80 ] && grep -q "## Setup" docs/content-fragment-overlay.md && grep -q "## CF model" docs/content-fragment-overlay.md && grep -q "## Mustache template authoring" docs/content-fragment-overlay.md && grep -q "## UE wiring" docs/content-fragment-overlay.md && grep -q "## Reference responses" docs/content-fragment-overlay.md && grep -q "## Smoke test" docs/content-fragment-overlay.md && grep -q "## Error states" docs/content-fragment-overlay.md</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `docs/content-fragment-overlay.md`.
    - File contains at least 80 lines — verifiable: `[ "$(wc -l < docs/content-fragment-overlay.md)" -ge 80 ]`.
    - File contains all seven required section headings — verifiable for each: `grep -l '## Setup' docs/content-fragment-overlay.md`, `grep -l '## CF model' ...`, `grep -l '## Mustache template authoring' ...`, `grep -l '## UE wiring' ...`, `grep -l '## Reference responses' ...`, `grep -l '## Smoke test' ...`, `grep -l '## Error states' ...` — each returns the file.
    - File contains the no-Publish constraint reminder near the top — verifiable: `head -30 docs/content-fragment-overlay.md | grep -l 'Publish tier'` returns the file.
    - File contains `$AEM_TOKEN` placeholder (proves curl commands are documented with placeholders, not real tokens) — verifiable: `grep -l '\$AEM_TOKEN' docs/content-fragment-overlay.md` returns the file.
    - File embeds `cf-templates/article.html` (proves Mustache template embed) — verifiable: `grep -l 'class="article-cf"' docs/content-fragment-overlay.md` returns the file.
    - File mentions XSS smoke payload — verifiable: `grep -l 'onerror=alert' docs/content-fragment-overlay.md` returns the file.
    - File mentions `D-08` empty-state contract — verifiable: `grep -l 'D-08' docs/content-fragment-overlay.md` returns the file.
    - File does NOT contain a real-looking IMS token (sanity: long hex/base64-ish string after `token`) — verifiable: `grep -L 'token [a-zA-Z0-9_-]\{40,\}' docs/content-fragment-overlay.md` returns the file.
  </acceptance_criteria>
  <done>
    DOC-01 ships. CFO-10 verification artifact path documented (the smoke-test page section). Future contributors can reproduce the CFO setup from a clean clone using only this doc.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Curl commands in docs → secrets | Must use `$AEM_TOKEN` placeholder; never embed real tokens. |
| Captured response samples → docs body | Samples were already token-scrubbed during capture (plan 02-01/02/03 acceptance criteria); embedding here propagates that. |
| Reader running curl → AEM Author | Reader must obtain own `$AEM_TOKEN`; doc tells them how. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-07-01 | Information Disclosure | Real IMS token leaking into committed docs | mitigate | D-02 mandates `$AEM_TOKEN` placeholder; acceptance criterion greps for token-shaped strings. Pre-commit guard at `.husky/pre-commit.mjs` does not currently scan for IMS-token formats; future hardening is out-of-scope (deferred). |
| T-02-07-02 | Tampering (architectural drift) | Stale doc divergent from code | accept | All embeds are verbatim from current files — at commit time they match. Future drift is a doc-maintenance concern, mitigated by code review. |
| T-02-07-03 | Information Disclosure | Doc reveals Author host / DAM tree structure publicly | accept | Information is reproducible by anyone with Author access. The path conventions match `fstab.yaml` and `paths.json` which already commit publicly. No PII. |
</threat_model>

<verification>
- All required sections present.
- All embeds reference real source files (not placeholders).
- No real tokens in committed file.
- File ≥ 80 lines.
</verification>

<success_criteria>
DOC-01 closed. CFO-10 documented (the smoke-test path under `## Smoke test` is the verification artifact path). Phase 2 documentation deliverable shipped.
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-07-SUMMARY.md`. Note that DOC-02..05 in later phases (Placeholders, Target, HTML Fragment API, README index) should mirror this house style.
</output>
