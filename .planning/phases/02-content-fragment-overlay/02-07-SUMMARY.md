---
phase: 02-content-fragment-overlay
plan: 07
status: complete
completed: 2026-05-09
requirements: [CFO-10, DOC-01]
---

# 02-07 SUMMARY — DOC-01 setup + smoke-test guide

## Outcome

`docs/content-fragment-overlay.md` ships (432 lines, 7 required sections + extras). First feature doc in this repo — establishes house style for DOC-02..05 in later phases.

## Sections

1. **Setup** — 6 numbered steps from sign-in to verify rendering. Embeds the three POST curls (CFO public, CFO content, json2html worker) verbatim with `$AEM_TOKEN` placeholders.
2. **CF model** — runtime JSON shape with `properties.elements.<name>.value` access path locked from sample.
3. **Mustache template authoring** — `cf-templates/article.html` embedded verbatim + the Mustache rules + the "no literal braces in HTML comments" pitfall.
4. **UE wiring** — the `cfReference` field excerpt for both block partials + husky auto-rebuild note + the DOMPurify UMD `loadScript` pattern (deviation rationale from plan).
5. **Reference responses** — five captured samples (CFO public, CFO content, json2html, CF JSON, .plain.html) embedded verbatim.
6. **Smoke test** — five tests (zero publish-host, XSS payload, missing CF, UE re-decoration, post-template edge parity).
7. **Error states** — D-08 empty-container contract documented with code snippet + UE re-pick recovery path.

## Plan-time deviations recorded in the doc

- **`admin.hlx.page` root returns 404** — flagged in step 2 so future readers don't think the host is dead. The endpoints under `/config/` and `/status/` are the real surface.
- **json2html worker body shape** — array of configs (NOT the `models: { article: { ... } }` object that 02-RESEARCH guessed). Documented with the rejection error so future template authors can recognize it.
- **DOMPurify UMD load pattern** — `loadScript` + `window.DOMPurify` documented with rationale (`scripts/dompurify.min.js` is UMD-only, no ES export). Future block authors won't try `import DOMPurify from ...` and silently get `undefined`.
- **Mustache + HTML comments pitfall** — literal `{{var}}` examples in comment blocks render empty and trip the "exactly one triple-brace" gate. Plan 02-04 hit this; documented for re-use.

## Acceptance criteria — verified

- [x] `docs/content-fragment-overlay.md` exists.
- [x] 432 lines (≥ 80 required).
- [x] All 7 section headings present.
- [x] No-Publish constraint reminder in first 30 lines.
- [x] `$AEM_TOKEN` placeholder appears (4 hits — confirms curl commands are documented with placeholders, not real tokens).
- [x] `class="article-cf"` embedded (5 hits — Mustache template + UE wrapper assertions).
- [x] `onerror=alert` XSS smoke payload documented (3 hits across body + title + dialog mention).
- [x] `D-08` empty-state contract referenced (3 hits).
- [x] No long token-shaped strings.

## Notes for downstream

- **Plan 02-08 (smoke test):** the smoke-test section in this doc is the canonical script — plan 02-08 just runs Tests 1-5 and records results in `02-08-SMOKE-RESULTS.md`. Test 5 (post-template edge parity) is the one that closes OQ-1 once the CF re-publishes.
- **DOC-02..05** (later phases): mirror this structure — Setup, model/spec, integration code, Reference responses, Smoke test, Error states, See also.
- The doc lives at `docs/content-fragment-overlay.md` — outside the pre-commit `isRuntimeCodePath` allowlist, so the publish-host scanner skips it. References to `publish-*` URLs in the doc body (e.g. when explaining what was deleted) are allowed.
