# Phase 2 Discussion Log

**Phase:** 2 — Content Fragment Overlay
**Date:** 2026-05-07
**Mode:** discuss (default, single-question turns)
**Anchor doc set by user:** Adobe aem.live official docs (https://www.aem.live/developer/*)

This log is a human-readable record of the discuss-phase Q&A. Downstream agents read `02-CONTEXT.md`, not this file.

---

## Gray-area selection

**Question:** Which gray areas to discuss for Phase 2?

**Selected:** All four —
1. Spike sequencing (OQ-1/OQ-2/OQ-5)
2. DOMPurify wiring point
3. UE component model surface (CFO-06)
4. Empty/error state UE behavior (CFO-09)

**Anchor source clarification:** User picked **Adobe aem.live official docs** as the tiebreaker when options conflict. Researcher (next phase) will fetch and reconcile these before planning.

---

## Area 1 — Spike sequencing (OQ-1, OQ-2, OQ-5)

### Q1.1 — Wave structure
- **Options:** (A) Wave 1 = spike + scaffolding; Wave 2 = block rewrites; Wave 3 = docs + verification. (B) Single wave; discover during execution. (C) Spike outside the phase.
- **Selected:** A — Wave 1 = spike + scaffolding (Recommended).
- **Captured as:** D-01.

### Q1.2 — Admin API auth handling
- **Options:** (A) Document curl commands; human runs them (`autonomous: false`). (B) Script the POSTs with env-var auth. (C) Defer config setup; spike on existing CFs only.
- **Selected:** A — Document curl commands; human runs them.
- **Captured as:** D-02.

### Q1.3 — Wave 1 artifact layout
- **Options:** (A) New `scripts/cf-overlay.js` + `cf-templates/article.html` + spike notes folded into DOC-01. (B) Extend `scripts/config.js` with CFO helpers. (C) Separate `02-SPIKE-LOG.md` artifact.
- **Selected:** A — separate module, template, and spike notes inline in the contributor-facing doc.
- **Captured as:** D-03.

---

## Area 2 — DOMPurify wiring point

### Q2.1 — Where in the pipeline does DOMPurify run?
- **Options:** (A) Per-block, post-`loadFragment`, on the rich-text body field only. (B) Inside `loadFragment` — fragment-wide policy. (C) Pre-Mustache, server-side via worker config.
- **Selected:** A — per-block, post-loadFragment, body-only.
- **Captured as:** D-04.

### Q2.2 — DOMPurify allowlist profile
- **Options:** (A) Default. (B) Strict allowlist (`USE_PROFILES.html: true`). (C) Custom `ALLOWED_TAGS` list.
- **Selected:** A — Default profile (matches `scripts/editor-support.js:32-34`).
- **Captured as:** D-05.

---

## Area 3 — UE component model surface (CFO-06)

### Q3.1 — Model field design
- **Options:** (A) Single `cfReference` field. (B) `cfReference` + per-instance overrides (title/image). (C) `cfReference` + display variant enum.
- **Selected:** A — single CF reference field; CF is source of truth.
- **Captured as:** D-06. Display variants explicitly deferred to v2 (CFO-V2-01).

### Q3.2 — CF model schema in AEM (upstream of overlay config)
- **Options:** (A) Phase 2 includes a 'verify-or-create' human task. (B) Assume the model already exists. (C) Phase 2 creates the model via Admin API curl.
- **Selected:** A — verify-or-create human task in Wave 1 plan-02-01; model JSON pasted into DOC-01.
- **Captured as:** D-07.

---

## Area 4 — Empty/error state UE behavior (CFO-09)

### Q4.1 — UE behavior on missing/broken CF
- **Options:** (A) Empty container preserves UE instrumentation; recoverable in-place. (B) Empty container + UE-only debug message. (C) Block disappears entirely (`block.remove()`).
- **Selected:** A — recoverable empty container; data-aue-* preserved on the block wrapper; author can re-pick CF in UE side panel; re-saving triggers re-render via `applyChanges`.
- **Captured as:** D-08. UE-only debug message explicitly deferred.

---

## Summary of locked decisions (D-01..D-08)

See `02-CONTEXT.md` `<decisions>` block for full text. One-line summaries:

| ID | Category | Locked decision |
|---|---|---|
| D-01 | Spike sequencing | 3-wave structure: spike+scaffolding → block rewrites → docs+verification |
| D-02 | Admin API auth | `autonomous: false` human curl tasks; no secrets in repo; commands published to DOC-01 |
| D-03 | Spike artifacts | New `scripts/cf-overlay.js` + `cf-templates/article.html`; reference responses inline in DOC-01 |
| D-04 | DOMPurify wiring | Per-block, post-`loadFragment`, body-only sanitization |
| D-05 | DOMPurify config | Default profile (matches `scripts/editor-support.js:32-34`) |
| D-06 | UE model fields | Single `cfReference` field; no per-instance overrides; variants deferred to v2 |
| D-07 | CF model schema | Wave 1 verify-or-create human task; model JSON exported to DOC-01 |
| D-08 | Error state | Recoverable empty container; UE instrumentation preserved; silent fail on published page |

---

## Deferred ideas (preserved, not lost)

- CF model variants (CFO-V2-01)
- aem.page/aem.live live-preview parity (CFO-V2-02)
- Multi-locale CF reference resolution (CFO-V2-03)
- Per-instance overrides on the block model
- UE-only inline debug message on broken CF
- Single Playwright smoke test (X-V2-01)
- Generic CF→HTML universal renderer

---

*Discussion log written: 2026-05-07*
