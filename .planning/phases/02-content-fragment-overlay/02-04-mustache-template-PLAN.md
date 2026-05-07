---
phase: 02-content-fragment-overlay
plan: 04
type: execute
wave: 3
depends_on: [02-01, 02-02, 02-03]
files_modified:
  - cf-templates/article.html
autonomous: true
requirements: [CFO-03]
must_haves:
  truths:
    - "`cf-templates/article.html` exists in the repo and emits a `<div class=\"article-cf\">` outer wrapper (the CFO-1 marker `fetchOverlay` from `scripts/cf-overlay.js` asserts presence of)."
    - "Plain-text fields use double-brace `{{title}}` (auto-escaped); rich-text body uses triple-brace `{{{body}}}` (unescaped — DOMPurify on consumer side per D-04)."
    - "Template variable names match the field names captured in `samples/cf-json-sample.json` (`properties.elements.<name>` shape)."
  artifacts:
    - path: "cf-templates/article.html"
      provides: "Mustache template that the json2html worker fetches via `/config/<org>/<site>/<branch>` (registered by plan 02-02). Output is a hydrated EDS page."
      contains: "article-cf"
      min_lines: 8
  key_links:
    - from: "cf-templates/article.html"
      to: "scripts/cf-overlay.js"
      via: "wrapper class `.article-cf` is the CFO-1 marker `fetchOverlay` greps for"
      pattern: "class=\"article-cf\""
---

<objective>
Author `cf-templates/article.html` — the Mustache template the json2html worker uses to render `article`-model CFs into EDS-shaped HTML. The template MUST emit a stable outer wrapper `<div class="article-cf">` so the CFO-1 defensive marker check in `fetchOverlay` (plan 02-03) succeeds. Variable names come from the captured CF JSON sample (`samples/cf-json-sample.json`). Plain-text fields use auto-escaped double-brace; rich-text body uses unescaped triple-brace.

Purpose: First Mustache template in the repo. Once committed on `main`, the json2html worker (configured by plan 02-02) will fetch it from this repo's GitHub-backed branch and render it on every CF publish.
Output: One new file (~15-25 lines).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/02-content-fragment-overlay/02-CONTEXT.md
@.planning/phases/02-content-fragment-overlay/02-RESEARCH.md
@.planning/phases/02-content-fragment-overlay/02-PATTERNS.md
@.planning/phases/02-content-fragment-overlay/02-01-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/02-03-SUMMARY.md
@.planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json
@.planning/phases/02-content-fragment-overlay/samples/cf-model-export.json
@CLAUDE.md

<interfaces>
<!-- The json2html worker uses Mustache.js semantics. Per aem.live/developer/json2html: -->
<!--   {{var}}   = HTML-escaped output (use for ALL plain-text fields). -->
<!--   {{{var}}} = raw HTML output (use ONLY for the `body` rich-text field). -->
<!--   {{#section}}...{{/section}} = conditional rendering when value is truthy. -->
<!--   {{^section}}...{{/section}} = inverted conditional (renders when falsy). -->
<!-- The worker exposes the CF payload as the template root context. The exact nesting -->
<!-- depends on the captured `samples/cf-json-sample.json` shape — plan 02-04 task 1 reads -->
<!-- it before writing the template. -->

<!-- CFO-1 marker (locked by plan 02-03 / scripts/cf-overlay.js): -->
<!-- The OUTER wrapper MUST have class `article-cf`. Inner block-flavor classes -->
<!-- (`article-hero`, `article-teaser`) come from authoring-time block selection, NOT -->
<!-- from the template — the template renders the SHARED CF content; the consuming -->
<!-- block (article-hero or article-teaser) wraps it visually via its CSS. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create `cf-templates/article.html` Mustache template</name>
  <read_first>
    - .planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json (CRITICAL — variable names come from `properties.elements.<name>` here)
    - .planning/phases/02-content-fragment-overlay/samples/cf-model-export.json (cross-reference field types)
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-03 — template at `cf-templates/article.html`; specifics — `{{title}}` auto-escaped, `{{{body}}}` unescaped)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pitfall 3 — XSS on `{{{body}}}` is mitigated by DOMPurify on consumer; never use `{{{title}}}`)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`cf-templates/article.html` analog notes — first Mustache template in repo, no in-repo precedent)
    - .planning/phases/02-content-fragment-overlay/02-03-SUMMARY.md (confirms `.article-cf` marker requirement)
  </read_first>
  <action>
Create `cf-templates/article.html` with the following content. **Adapt variable names** to match the actual shape captured in `samples/cf-json-sample.json` — this template assumes the AEM Assets API documented shape `{ properties: { elements: { title: { value }, body: { value }, image: { _path } } } }`. If the captured sample shows a flatter or differently nested shape, adjust accordingly and update inline comments documenting what was changed.

```html
<!--
  Mustache template for `article` Content Fragment model.

  Source of truth for variable names: `.planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json`.
  Worker config registered by plan 02-02 (`json2html-config-PLAN`).
  Outer wrapper class `article-cf` is the CFO-1 marker asserted by `scripts/cf-overlay.js`
  (`fetchOverlay` returns null if absent — see PITFALLS.md CFO-1).

  Mustache rules (D-04 / D-05):
    {{var}}   - HTML-escaped (plain-text fields). Default sanitizer.
    {{{var}}} - raw HTML (rich-text body ONLY). Consumer-side DOMPurify completes the
                XSS mitigation (per `blocks/article-hero/article-hero.js` rewrite in plan 02-05).
-->
<div class="article-cf" data-cf-id="{{properties.path}}">
  {{#properties.elements.image.value}}
    <picture>
      <img src="{{properties.elements.image.value._path}}" alt="{{properties.elements.title.value}}" loading="lazy">
    </picture>
  {{/properties.elements.image.value}}

  <div class="article-cf-header">
    <h2>{{properties.elements.title.value}}</h2>
  </div>

  <div class="body">
    {{{properties.elements.body.value}}}
  </div>
</div>
```

Notes for the executor:
1. **Variable paths**: the snippet above uses `properties.elements.<field>.value` — the AEM Assets HTTP API documented shape. Verify against the actual `samples/cf-json-sample.json` capture. If the worker exposes a flatter context (e.g., `{title, body, image}` directly), simplify accordingly. NEVER guess — follow the sample.
2. **`{{{body}}}` is INTENTIONAL** — the body is rich-text HTML and must render as HTML. Plan 02-05 / 02-06 wire DOMPurify on the consumer side (D-04 wiring point). Triple-brace here, sanitize there. This is the ONLY triple-brace in the file.
3. **`{{title}}` and `{{alt}}` are double-brace** — auto-escaped. NEVER use `{{{title}}}`; that is the XSS path Phase 2 explicitly closes.
4. **Outer wrapper `<div class="article-cf">` is REQUIRED** — `scripts/cf-overlay.js`'s `fetchOverlay` checks `fragment.querySelector('.article-cf')` and returns null if absent.
5. **`data-cf-id`** is informational; `{{properties.path}}` is the AEM repo path of the CF (helps debugging in DevTools).
6. The block-flavor classes (`article-hero`, `article-teaser`) are NOT in this template — they belong on the consumer block element (the `<div class="article-hero">` rendered by the EDS authored page wrapping the `<a>` link). The CFO output is the SHARED CF content. CSS for `.article-hero .article-cf` and `.article-teaser .article-cf` (if needed) lives in the existing block CSS files.
7. **No `<script>`, no inline event handlers** in this template. CSP `script-src 'nonce-aem' 'strict-dynamic'` would block them, and DOMPurify default profile would strip them on the consumer.
8. The directory `cf-templates/` is new — it will be auto-created by the file write. `.hlxignore` does NOT exclude `cf-templates/` (it lists `_*` partials, `test/`, dotfiles, configs — not this dir), so the template ships via Helix delivery. The json2html worker fetches it at CF publish time.
  </action>
  <verify>
    <automated>test -f cf-templates/article.html && grep -c 'article-cf' cf-templates/article.html | grep -q '^[1-9]' && grep -c '{{{' cf-templates/article.html | grep -q '^1$'</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `cf-templates/article.html`.
    - File contains the literal string `class="article-cf"` (CFO-1 marker — verifiable: `grep -l 'class="article-cf"' cf-templates/article.html` returns the file).
    - File contains exactly one `{{{` triple-brace (the `body` field) — verifiable: `grep -o '{{{' cf-templates/article.html | wc -l` returns `1`.
    - File contains at least two `{{` double-brace usages (title + image / id) — verifiable: `grep -o '{{[^{]' cf-templates/article.html | wc -l` returns at least `2`.
    - File does NOT contain `<script` (no inline scripts — verifiable: `grep -L '<script' cf-templates/article.html` returns the file).
    - File does NOT contain `publish-` literal — verifiable: `grep -L 'publish-[a-zA-Z0-9-]*\.adobeaemcloud' cf-templates/article.html` returns the file.
    - File does NOT contain `{{{title}}}` or `{{{alt}}}` (XSS guard — verifiable: `grep -L '{{{title' cf-templates/article.html` AND `grep -L '{{{alt' cf-templates/article.html` both return the file).
  </acceptance_criteria>
  <done>
    Mustache template ships in repo. Once a CF is republished after this commit lands on `main`, the json2html worker (configured by plan 02-02) fetches the template and renders the article CF as an EDS `.plain.html` page with the `article-cf` wrapper. Plan 02-03's `fetchOverlay` will accept the resulting fragment.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CF body (authored content) → rendered HTML | Author-controlled rich text rendered with `{{{body}}}` (unescaped). Defended by consumer-side DOMPurify (plans 02-05/06). |
| CF title (plain text) → rendered HTML | `{{title}}` is auto-escaped by Mustache. No XSS surface. |
| Image `_path` → `<img src=>` | Author-controlled DAM path. Browser fetches via Helix proxy; non-DAM paths cannot exfiltrate auth tokens (no auth in browser). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-04-01 | Tampering / Information Disclosure (XSS) | `{{{body}}}` rendering author rich-text as HTML | mitigate | Triple-brace is INTENTIONAL — DOMPurify on the consumer side (D-04, plans 02-05/06) is the actual mitigation. Acceptance criteria assert exactly ONE `{{{` in the template — if a future edit adds `{{{title}}}` the gate fails. |
| T-02-04-02 | Tampering | `{{title}}` rendered unescaped | mitigate | Mustache double-brace auto-escapes by default. Acceptance criterion forbids `{{{title}}}`. |
| T-02-04-03 | Tampering | CFO-1 silent failure | mitigate | Outer `<div class="article-cf">` is the marker `fetchOverlay` (plan 02-03) asserts. Acceptance criterion requires literal `class="article-cf"`. |
| T-02-04-04 | Elevation of Privilege | Inline `<script>` or `on*=` injected via template | mitigate | Acceptance criterion forbids `<script` substring; Mustache itself does not emit handlers. CSP `script-src 'nonce-aem'` blocks any inline script that did slip through. |
</threat_model>

<verification>
- `cf-templates/article.html` exists and emits `class="article-cf"`.
- Exactly one `{{{` in the file (the rich-text body).
- No `<script>`, no `publish-*` literal.
- Variable names match the captured CF JSON sample (manual verify by reading both files; acceptance criteria above check structural invariants).
</verification>

<success_criteria>
CFO-03 closed (modulo CF republish, which is a content-tier action). Plan 02-05 / 02-06 block rewrites + DOMPurify wiring close the consumer-side XSS surface.
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-04-SUMMARY.md`. Note any deviations from the documented variable shape and the rationale (driven by the captured sample). Flag for plan 02-07 (DOC-01) that the template should be embedded in `## Mustache template authoring` along with the variable shape commentary.
</output>
