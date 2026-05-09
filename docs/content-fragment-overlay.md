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

**Tools** (hammer icon) → **Configuration Browser** → `sgedsdemo` (root config) → **Content Fragment Models**. If `article` exists, skip to step 2; otherwise click **Create**, name it `article`, and add three fields:

- `title` — Single line text
- `body` — Multi line text, Default Type: Rich text
- `image` — Content Reference (image)

(Idempotent — re-running just verifies. See `## CF model` section below for the full JSON export.)

### 2. POST CFO Admin API config

Obtain a Helix Admin API token. Easiest path: install AEM Sidekick, sign in once on any page, open DevTools → Network → click any Sidekick action (e.g. **Preview**) → copy the `x-auth-token` request header from the request to `admin.hlx.page`. Export it:

```bash
export AEM_TOKEN="<your-token-here>"
```

> Note: the admin API root (`https://admin.hlx.page/`) returns 404 — there is no landing page. The endpoints under `/config/...` and `/status/...` are the real surface.

POST `public.json` (registers CFO config):

```bash
curl -i -X POST 'https://admin.hlx.page/config/nusoli-valtech/sites/sgedsdemo/public.json' \
  -H "x-auth-token: $AEM_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "public": {
      "cf-overlay": {
        "source": {
          "type": "json",
          "url": "https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/{path}.json"
        },
        "overlay": {
          "type": "json2html",
          "config": "nusoli-valtech/sgedsdemo/main"
        },
        "models": ["article"]
      }
    }
  }'
```

POST `content.json` (the admin service may reconcile your body against the existing markup-mode source — that's fine; the `cf-overlay` branch in `public.json` does the routing):

```bash
curl -i -X POST 'https://admin.hlx.page/config/nusoli-valtech/sites/sgedsdemo/content.json' \
  -H "x-auth-token: $AEM_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "content": {
      "source": {
        "type": "markup",
        "url": "https://author-p23458-e585661.adobeaemcloud.com/bin/franklin.delivery/nusoli-valtech/sgedsdemo/main/{path}.html"
      }
    }
  }'
```

Captured responses are in `## Reference responses` below.

### 3. POST json2html worker config

The worker registers `cf-templates/article.html` as the Mustache template for `/articles/*` URLs. **The body must be an array of configs** (not a `{models: {...}}` object — the worker rejects that with `Invalid config data. You must provide an array of configs`):

```bash
curl -i -X POST 'https://json2html.adobeaem.workers.dev/config/nusoli-valtech/sgedsdemo/main' \
  -H "x-auth-token: $AEM_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<'DATA'
[
  {
    "path": "/articles/",
    "endpoint": "https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/articles/{{id}}.json",
    "regex": "/[^/]+$/",
    "template": "/cf-templates/article.html",
    "useAEMMapping": true
  }
]
DATA
```

Verify by re-fetching:

```bash
curl -s -X GET 'https://json2html.adobeaem.workers.dev/config/nusoli-valtech/sgedsdemo/main' \
  -H "x-auth-token: $AEM_TOKEN"
```

### 4. Author + publish a CF

In AEM Author **Content Fragments** console, navigate to `/content/dam/sgedsdemo/articles/` (create the folder if missing). Click **Create**, choose model `article`, name it (e.g. `phase-2-spike`). Fill in `title`, `body` (rich text), and `image` (DAM image). Click **Publish**.

### 5. Reference from a block in UE

Open any page in Universal Editor on AEMaaCS. From the component palette, drop an **Article Hero** or **Article Teaser** block. In the side panel, the **Article Content Fragment** field shows a CF picker scoped to `/content/dam/sgedsdemo/articles`. Pick your published CF. Save.

### 6. Verify rendering

The page should render the CF content. Open DevTools Network tab and confirm:

- ZERO requests to `publish-p23458-*.adobeaemcloud.com`.
- One request to `${cfPath}.plain.html` returning HTML wrapped in `<div class="article-cf">`.

If either fails, see `## Smoke test` below for diagnostics.

---

## CF model

Runtime JSON for the published `article` CF (verbatim from `.planning/phases/02-content-fragment-overlay/samples/cf-model-export.json`). Field shape: `properties.elements.<name>.value`.

```json
{
  "_runtime_shape": {
    "title_path": "properties.elements.title.value",
    "body_path": "properties.elements.body.value",
    "image_path": "properties.elements.image.value"
  },
  "properties": {
    "elementsOrder": ["title", "body", "image"],
    "elements": {
      "title": { ":type": "string",    "dataType": "string", "value": "Phase 2 Spike Article" },
      "body":  { ":type": "text/html", "dataType": "string", "value": "<p>Hello from the Phase 2 CF spike.</p>" },
      "image": { ":type": "string",    "dataType": "string", "value": "/content/dam/sgedsdemo/headless-is-here.png" }
    },
    "cq:model": { "path": "/conf/sgedsdemo/settings/dam/cfm/models/article" }
  }
}
```

(Full sample with metadata, links, references etc. is in `.planning/phases/02-content-fragment-overlay/samples/cf-model-export.json` and `samples/cf-json-sample.json`.)

---

## Mustache template authoring

The template `cf-templates/article.html` is fetched by the json2html worker at CF-publish time. The worker is registered against this repo branch via the `/config/<org>/<site>/<branch>` POST in step 3.

```html
<!--
  Mustache template for `article` Content Fragment model.

  Source of truth for variable names: .planning/phases/02-content-fragment-overlay/samples/cf-json-sample.json
  Worker config registered by plan 02-02 (json2html-config-PLAN).
  Outer wrapper class `article-cf` is the CFO-1 marker asserted by scripts/cf-overlay.js
  (fetchOverlay returns null if absent — see PITFALLS.md CFO-1).

  Mustache rules (D-04 / D-05):
    Plain-text fields use double-brace (HTML-escaped by default).
    Rich-text body uses triple-brace (unescaped). Consumer-side DOMPurify
    completes the XSS mitigation (see blocks/article-hero/article-hero.js
    rewrite in plan 02-05). The body field is the ONLY triple-brace use in
    this file — adding more would re-open the XSS surface Phase 2 closes.

  Variable-shape note: the captured sample shows `properties.elements.<name>` is a
  metadata envelope ({:type, dataType, title, value, ...}) and the actual content
  lives in `.value`. Image fields are bare DAM-path strings (NOT nested {_path}
  objects), so the <img src> reads `{{properties.elements.image.value}}`.
-->
<div class="article-cf" data-cf-id="{{properties.path}}">
  {{#properties.elements.image.value}}
    <picture>
      <img src="{{properties.elements.image.value}}" alt="{{properties.elements.title.value}}" loading="lazy">
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

**Mustache rules:**

- Plain-text fields use **double-brace** (`{{var}}`) — auto-escaped. Use for ALL plain-text fields.
- Rich-text body uses **triple-brace** (`{{{var}}}`) — raw HTML, NO escape. Use ONLY for the `body` rich-text field.
- Consumer-side DOMPurify (in `blocks/article-hero/article-hero.js` and `blocks/article-teaser/article-teaser.js`) sanitizes the `<div class="body">` after fetch.
- The outer wrapper `<div class="article-cf">` is the marker `scripts/cf-overlay.js`'s `fetchOverlay` checks for. If absent, `fetchOverlay` returns null and the block degrades to D-08 empty-state — keep this class on the outermost element.
- **Pitfall:** Mustache tokenizes inside HTML comments. Do NOT include literal `{{var}}` examples in comment blocks — they will render empty and trip the "exactly one triple-brace" gate. Describe rules verbally instead.

---

## UE wiring

Each block exposes one field — `cfReference` — wired to the AEM CF picker via the `aem-content-fragment` component.

`blocks/article-hero/_article-hero.json` (the field model excerpt):

```json
{
  "id": "article-hero",
  "fields": [
    {
      "component": "aem-content-fragment",
      "name": "cfReference",
      "label": "Article Content Fragment",
      "valueType": "string",
      "validation": {
        "rootPath": "/content/dam/sgedsdemo/articles"
      },
      "required": true
    }
  ]
}
```

`blocks/article-teaser/_article-teaser.json`: same shape, `id: "article-teaser"`.

The husky pre-commit hook (`.husky/pre-commit.mjs:16-22`) auto-merges these `_*.json` partials into `component-models.json`, `component-definition.json`, `component-filters.json` whenever they are staged. **Never hand-edit the merged top-level files.**

The `cf-endpoint` metadata read by `scripts/cf-overlay.js`'s `getMetadata('cf-endpoint')` consumer comes from `head.html`:

```html
<meta name="cf-endpoint" content="/content/dam/sgedsdemo"/>
```

### DOMPurify import note

The vendored DOMPurify (`scripts/dompurify.min.js`) is a UMD bundle that attaches to `window.DOMPurify` — it has **no ES export**. Block consumers (and `scripts/editor-support.js`) load it via `loadScript()` and call `window.DOMPurify.sanitize(...)`:

```javascript
import { loadScript } from '../../scripts/aem.js';
// ...
await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
body.innerHTML = window.DOMPurify.sanitize(body.innerHTML, { USE_PROFILES: { html: true } });
```

`loadScript` is idempotent (checks for an existing `<script src=>` before injecting), so repeat decorate calls in UE patch flows cost essentially nothing. Don't try `import DOMPurify from '../../scripts/dompurify.min.js'` — it resolves to `undefined`.

---

## Reference responses

Captured during the Wave 1 spike (plans 02-01, 02-02, 02-03). Stored under `.planning/phases/02-content-fragment-overlay/samples/` for traceability.

### CFO `public.json` POST response

```
HTTP/2 200
content-type: application/json
date: Sat, 09 May 2026 09:28:41 GMT
content-length: 347

{
  "public": {
    "cf-overlay": {
      "source": {
        "type": "json",
        "url": "https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/{path}.json"
      },
      "overlay": {
        "type": "json2html",
        "config": "nusoli-valtech/sgedsdemo/main"
      },
      "models": ["article"]
    }
  }
}
```

### CFO `content.json` POST response

```json
{
  "source": {
    "url": "https://author-p23458-e585661.adobeaemcloud.com/bin/franklin.delivery/nusoli-valtech/sgedsdemo/main",
    "type": "markup",
    "suffix": ".html"
  },
  "contentBusId": "342d4b97ec3d84048a19dce996fd85a04e2c13fb820260ca85d00fb7972"
}
```

The admin service reconciled the POSTed body against the existing markup-mode source — it kept the existing flat URL + suffix shape rather than the `{path}.html` template the curl proposed. CFO routing comes from the `cf-overlay` branch of `public.json` (above), so this is fine.

### json2html `/config` POST response

Verified via GET after the POST landed. Body is the persisted array:

```json
[
  {
    "path": "/articles/",
    "endpoint": "https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/articles/{{id}}.json",
    "regex": "/[^/]+$/",
    "template": "/cf-templates/article.html",
    "useAEMMapping": true
  }
]
```

### CF JSON sample (raw Author Assets API response)

```json
{
  "links": [
    { "rel": ["self"],   "href": "https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/articles/phase-2-spike.json" },
    { "rel": ["parent"], "href": "https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/articles.json" }
  ],
  "class": ["assets/asset"],
  "properties": {
    "publishedBy": "NICOLAS.USOLI@VALTECH.COM",
    "title": "phase-2-spike",
    "contentFragment": true,
    "elementsOrder": ["title", "body", "image"],
    "elements": {
      "title": { ":type": "string",    "dataType": "string", "value": "Phase 2 Spike Article" },
      "body":  { ":type": "text/html", "dataType": "string", "value": "<p>&lt;p&gt;Hello from the Phase 2 CF spike.&lt;/p&gt;</p>" },
      "image": { ":type": "string",    "dataType": "string", "value": "/content/dam/sgedsdemo/headless-is-here.png" }
    },
    "cq:model": { "path": "/conf/sgedsdemo/settings/dam/cfm/models/article" }
  }
}
```

### `.plain.html` overlay sample (rendered by json2html worker)

Pre-template state captured 2026-05-09 — both edges return 404 because `cf-templates/article.html` had not yet shipped. The follow-up smoke test (`## Smoke test` Test 1 + Test 5) replaces this sample with the post-template render:

```
GET https://main--sgedsdemo--nusoli-valtech.aem.page/content/dam/sgedsdemo/articles/phase-2-spike.plain.html → 404
GET https://main--sgedsdemo--nusoli-valtech.aem.live/content/dam/sgedsdemo/articles/phase-2-spike.plain.html → 404
```

**`aem.page` vs `aem.live` parity** (OQ-1 outcome): parity holds at 404 (both edges return the same status). Final post-template parity check is part of the Wave 6 smoke test — once `cf-templates/article.html` is on `main` and the test CF is republished, both edges should return rendered HTML wrapping `<div class="article-cf">`.

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

Open the page in Universal Editor. Click the article block. The side panel shows the **Article Content Fragment** field with the current cfPath. Pick a different CF, save. EXPECTED: block re-renders in place with the new CF content; no full page reload (`window.location.reload()` is the fallback path; if you see the page flash, the `applyChanges` re-decoration failed — investigate `scripts/editor-support.js`).

### Test 5 — Edge parity (post-template)

After `cf-templates/article.html` ships on `main` and the test CF is republished, re-curl both edges:

```bash
curl -si 'https://main--sgedsdemo--nusoli-valtech.aem.page/content/dam/sgedsdemo/articles/phase-2-spike.plain.html'
curl -si 'https://main--sgedsdemo--nusoli-valtech.aem.live/content/dam/sgedsdemo/articles/phase-2-spike.plain.html'
```

EXPECTED: both return 200 with HTML containing `<div class="article-cf">`. Parity divergence (one 200, one 404) defers to a v2 fix per D-01.

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
- aem.live docs: <https://www.aem.live/developer/content-fragment-overlay>, <https://www.aem.live/developer/json2html>.
