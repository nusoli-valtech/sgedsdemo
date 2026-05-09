---
phase: 02-content-fragment-overlay
plan: 02
status: complete
completed: 2026-05-09
requirements: [CFO-03]
---

# 02-02 SUMMARY — json2html worker config

## Outcome

`/cf-templates/article.html` registered as the Mustache template for `/articles/*` URLs in the json2html worker for `nusoli-valtech/sgedsdemo/main`.

## What was registered

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

Verified via GET to the same endpoint — the array persisted exactly as POSTed.

## Plan-time deviation (RESEARCH was wrong about the body shape)

The plan body assumed `models: { article: { template: "...", useAEMMapping: true, relativeURLPrefix: "" } }`. The worker rejected this with `Invalid config data. You must provide an array of configs`.

The actual shape per [aem.live/developer/json2html](https://www.aem.live/developer/json2html) is an **array of {path, endpoint, regex, template} objects**. The corrected POST landed cleanly.

This deviation should be reflected in:
- DOC-01 (plan 02-07) — show the array shape, not the object shape
- 02-RESEARCH.md or a follow-up note — flag that the original research source for json2html was speculative

## Notes for downstream plans

- **Plan 02-04 (Mustache):** `/cf-templates/article.html` is now the registered template. Once that file commits to `main`, the worker fetches it from the GitHub-backed repo at request time. No worker re-config needed when the template content changes.
- **Plan 02-03 (spike):** the worker will hit `https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/articles/phase-2-spike.json` to fetch JSON. That's the URL the spike must capture — NOT the GraphQL endpoint used in 02-01.
- **`useAEMMapping: true`:** the worker rewrites links per `/config.json`. No `relativeURLPrefix` needed for our setup.
- **No `templateApiKey`:** the project repo is anonymously readable on aem.live, so the worker fetches the template without auth.

## Acceptance criteria — verified

- [x] `samples/json2html-config-response.json` exists.
- [x] Contains literal `cf-templates/article.html` (3 hits — proves template path persisted).
- [x] Contains `HTTP/` status line (`HTTP/1.1 200 OK`).
- [x] No long token-shaped strings.
- [x] Pre-commit guard accepts file.
