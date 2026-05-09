---
phase: 02-content-fragment-overlay
plan: 04
status: complete
completed: 2026-05-09
requirements: [CFO-03]
---

# 02-04 SUMMARY — cf-templates/article.html Mustache template

## Outcome

`cf-templates/article.html` ships in repo. The json2html worker (configured in plan 02-02) will fetch it from the GitHub-backed `main` branch on the next CF publish.

## Variable shape — adapted from sample

The plan's reference snippet assumed `image.value._path` (nested object). The captured sample (`samples/cf-json-sample.json`) shows image is a **bare DAM-path string**:

```
properties.elements.image.value === "/content/dam/sgedsdemo/headless-is-here.png"
```

Template adjusted accordingly: `<img src="{{properties.elements.image.value}}">`.

All other fields follow the same `properties.elements.<name>.value` shape.

## Plan-time deviation — comment scrubbing

The plan's reference content included literal `{{{var}}}` and `{{var}}` examples in a leading HTML comment. **Mustache.js does not respect HTML comments** — it tokenizes the entire file. Those literal braces would have:
1. Been interpreted as Mustache tags (rendering empty since `var` is undefined).
2. Tripped the acceptance criterion "exactly one `{{{` in the file".

Rewrote the comment as brace-free verbal description while preserving the same intent (plain-text → double-brace; rich-text body → triple-brace; only the body uses triple-brace).

## Output structure

```html
<div class="article-cf" data-cf-id="...">
  {{#image-conditional}}
    <picture><img loading="lazy"></picture>
  {{/image-conditional}}
  <div class="article-cf-header"><h2>{{title}}</h2></div>
  <div class="body">{{{body}}}</div>
</div>
```

- Outer wrapper class `article-cf` (CFO-1 marker — `fetchOverlay` asserts presence).
- Inner classes `article-cf-header` and `body` are styling hooks for plans 02-05 / 02-06.
- The block-flavor classes (`article-hero`, `article-teaser`) are NOT in this template — they belong on the consumer EDS block. The CFO output is the SHARED CF content; CSS scopes it via `.article-hero .article-cf` etc.

## Acceptance criteria — verified

- [x] `cf-templates/article.html` exists.
- [x] Contains literal `class="article-cf"` (CFO-1 marker — 1 hit).
- [x] Exactly **1** `{{{` triple-brace (the body field).
- [x] **8** double-brace usages (title, image, header, alt, etc.).
- [x] No `<script` tag.
- [x] No `publish-*.adobeaemcloud` literal.
- [x] No `{{{title}}}` or `{{{alt}}}` (XSS guard).

## Notes for downstream plans

- **Plan 02-05 (article-hero) + 02-06 (article-teaser):** when DOMPurify runs, target the `.body` div content for sanitization — that's where `{{{body}}}` outputs raw HTML. Other elements are already escaped by Mustache.
- **Plan 02-07 (DOC-01):** embed this template verbatim in the `## Mustache template authoring` section. Document the `{{{var}}}`-in-comments pitfall so future templates avoid it.
- **Plan 02-08 (smoke test):** the live `.plain.html` should now contain `<div class="article-cf">…` after the CF is republished. The sample `cf-overlay-plain-html-sample.html` will be replaced post-republish.
- **Republish trigger:** committing this file to `main` does NOT auto-republish CFs. The author must manually republish `phase-2-spike` (or any article CF) via Sidekick → Publish for the worker to fetch the new template and emit the rendered output. Document in DOC-01.
