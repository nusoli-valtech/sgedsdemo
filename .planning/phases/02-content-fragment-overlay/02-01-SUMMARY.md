---
phase: 02-content-fragment-overlay
plan: 01
status: complete
completed: 2026-05-09
requirements: [CFO-01, CFO-02]
---

# 02-01 SUMMARY — CF model verify/create + Helix Admin CFO config

## Outcome

Wave 1 spike unblocked: real CF field shape captured, CFO config landed for `nusoli-valtech/sgedsdemo/main`.

## Captured artifacts

| File | Source | Key facts locked |
|------|--------|------------------|
| `samples/cf-model-export.json` | AEM Author GraphQL `articleByPath` query (verified — model already existed) | Model fields: `title` (string), `body` (rich-text with `markdown`/`json`/`plaintext`/`html` variants), `image` (Content Reference). Model path: `/conf/sgedsdemo/settings/dam/cfm/models/article`. |
| `samples/cfo-public-response.json` | `POST https://admin.hlx.page/config/nusoli-valtech/sites/sgedsdemo/public.json` → `200 OK` | CFO config registered. Source URL: `https://author-p23458-e585661.adobeaemcloud.com/api/assets/sgedsdemo/{path}.json`. Overlay type: `json2html` keyed on `nusoli-valtech/sgedsdemo/main`. Models: `["article"]`. |
| `samples/cfo-content-response.json` | `POST .../content.json` (Admin reconciled body) | Existing markup-mode source kept (`/bin/franklin.delivery/...` + `.html` suffix). The CFO routing lives in the `cf-overlay` branch of `public.json`, not `content.json`. |

## Test fragment

Published at: `/content/dam/sgedsdemo/articles/phase-2-spike`
- title: "Phase 2 Spike Article"
- body (rich-text): "&lt;p&gt;Hello from the Phase 2 CF spike.&lt;/p&gt;"
- image: `/content/dam/sgedsdemo/headless-is-here.png` (PNG, 750×500)

This fragment is the live target for plan 02-03 spike (`fetchOverlay` end-to-end test).

## Branch decision

**verify** — `article` model already existed with the three required fields. No create-path needed. D-07 idempotency contract upheld.

## Notes for downstream plans

- **Plan 02-03 (spike + helper):** the captured JSON is GraphQL-shaped, NOT the Assets API JSON the CFO source URL actually fetches. The spike MUST also `curl` the Assets API directly to capture the runtime-truth shape — these may differ in structure (`elements.<field>.value` vs flat `title` etc.), and `cf-overlay.js` + the Mustache template (02-04) must agree on the runtime shape, not the GraphQL shape.
- **Plan 02-04 (Mustache):** template variable names are `title`, `body`, `image` — but the access path (`{{title}}` vs `{{elements.title.value}}`) depends on the Assets-API shape locked in 02-03.
- **Plan 02-07 (DOC-01):** Helix admin reconciles POST bodies — the `content.json` body shipped in this plan was rejected/replaced by the existing config. Document that `content.json` is read-mostly; CFO behavior is driven by `public.json` cf-overlay only.

## Token-handling note (D-02)

- Token never committed.
- Sourced from AEM Sidekick browser session (Sidekick → DevTools → Network → copy `x-auth-token` request header).
- `Authorization: token $T` and `x-auth-token: $T` are interchangeable per Admin API docs.

## Acceptance criteria — verified

- [x] `samples/cf-model-export.json` exists, contains literal `article` (model id) and the field names `title`/`body`/`image` (9 hits).
- [x] `samples/cfo-public-response.json` exists, contains `HTTP/2 200` status line, no token leakage.
- [x] `samples/cfo-content-response.json` exists, JSON-valid, no token leakage.
- [x] Test CF published at `/content/dam/sgedsdemo/articles/phase-2-spike`.
- [x] Pre-commit guard accepts files (`samples/` is under `.planning/`, outside `isRuntimeCodePath`).
