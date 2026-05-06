---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Roadmap approved; awaiting first plan
last_updated: "2026-05-06T15:11:45.274Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: SG EDS Demo POC

**Initialized:** 2026-05-06
**Last Updated:** 2026-05-06 (post-roadmap)

---

## Project Reference

**Core Value:** Every feature ships with a working implementation **and** a step-by-step `docs/<feature>.md` guide so future projects can reuse the patterns without rediscovery.

**Current Focus:** Phase 1 — Setup & Foundation. Mechanical pre-feature fixes that unblock every subsequent capability (UE patch null-guard, hostname centralization, no-Publish guard, DOMPurify 3.4.2 upgrade).

**Build order (locked):** SETUP → CFO → Placeholders → Target → HTML Fragment API

---

## Current Position

**Phase:** 1 — Setup & Foundation
**Plan:** none yet (run `/gsd-plan-phase 1`)
**Status:** Roadmap approved; awaiting first plan
**Progress:** [□□□□□] 0% — 0 of 5 phases complete

**Phase progress detail:**

| Phase | Status | Plans | Notes |
|-------|--------|-------|-------|
| 1. Setup & Foundation | Not started | 0/0 | Next up |
| 2. Content Fragment Overlay | Not started | 0/0 | Blocked on P1 |
| 3. Placeholders | Not started | 0/0 | Blocked on P2 |
| 4. Adobe Target Integration | Not started | 0/0 | Blocked on P2 + P3 |
| 5. HTML Fragment API | Not started | 0/0 | Linearly after P4; can parallelize with P2-P3 if bandwidth |

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 requirements total | 44 |
| Requirements mapped to phases | 44 (100%) |
| Phases defined | 5 |
| Phases complete | 0 |
| Open spike questions | 6 (OQ-1..OQ-6, mapped to phases) |

---

## Accumulated Context

### Key Decisions (carried from PROJECT.md)

- **Drop Publish tier** — every feature works via Universal Editor + Author + (eventually) the live origin. Pre-commit grep guard enforces this in Phase 1 (SET-03).
- **Migrate article blocks via CFO before any new feature** — Phase 2 closes the broken GraphQL path AND the inherited XSS in the same PR.
- **Generic placeholder mechanism** (not block-specific) — Phase 3 walker runs over any text node + attribute allowlist.
- **Adobe Target uses existing account + property** — credentials/access provided by user; spike OQ-3 on day 1 of Phase 4 to confirm Datastream provisioning.
- **HTML Fragment API: public read + CORS allowlist** for the POC; production auth deferred (documented as next step in Phase 5).
- **Step-by-step guides live in `docs/<feature>.md`** — DOC-01..05 are owned by each feature phase, not a separate phase.

### Open Questions Pending Spike

| ID | Question | Owning Phase |
|----|----------|--------------|
| OQ-1 | Does `*.aem.page` preview invoke json2html the same way as `*.aem.live`? | Phase 2 |
| OQ-2 | Mustache template location: `cf-templates/` in repo vs worker-config record? | Phase 2 |
| OQ-3 | Existing Target property has Datastream + WebSDK orgId, or new one needed? | Phase 4 |
| OQ-4 | Exact `headers.json` Admin API payload shape for CORS — validate against aem.live custom-headers doc | Phase 5 |
| OQ-5 | Raw shape of CF Overlay JSON vs Publish GraphQL — `_publishUrl`/`_dynamicUrl` absence | Phase 2 |
| OQ-6 | Placeholder spreadsheet path: site-root vs locale-scoped — drives `fetchPlaceholders()` prefix arg | Phase 3 |

### Carry-Forward Risks (from research/PITFALLS.md)

- **CRITICAL — CP-1**: No-Publish constraint forgotten → enforced by pre-commit grep guard in Phase 1 (SET-03).
- **CRITICAL — CP-2**: Existing XSS in article blocks → closed in same Phase 2 PR as the CFO migration (CFO-05).
- **CRITICAL — CFO-1**: Overlay path mismatch returning HTML body where JSON is expected → mitigated by `Content-Type` check + smoke page in Phase 2 docs.
- **HIGH — TGT-2**: alloy.js LCP regression → preload hints + 1.5s timeout + per-page activation gate in Phase 4.
- **HIGH — API-2**: CORS misconfiguration → explicit allowlist (never `*`) + `Vary: Origin` + spike OQ-4 in Phase 5.

### Active Todos

- Run `/gsd-plan-phase 1` when ready to begin Phase 1.

### Blockers

None.

---

## Session Continuity

**Last session:** 2026-05-06T15:11:45.268Z

**Next session:** Begin Phase 1 by running `/gsd-plan-phase 1` to decompose Setup & Foundation into executable plans.

**Files of record:**

- `.planning/PROJECT.md` — core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — 44 v1 requirements with traceability table mapping each REQ-ID to its phase
- `.planning/ROADMAP.md` — 5-phase plan with goal-backward success criteria
- `.planning/research/SUMMARY.md` — synthesized research findings (start here for stack/architecture/pitfalls)
- `.planning/research/STACK.md` — pinned versions, libraries, config files
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flow, eager/lazy/delayed wiring
- `.planning/research/PITFALLS.md` — severity-ranked pitfalls per capability
- `.planning/research/FEATURES.md` — full feature inventory with dependencies
- `.planning/codebase/ARCHITECTURE.md` — existing EDS scaffold patterns
- `.planning/codebase/CONCERNS.md` — pre-existing tech debt, bugs, security issues to address

---

*State initialized: 2026-05-06*
