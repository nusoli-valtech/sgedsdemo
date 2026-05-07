---
phase: 02-content-fragment-overlay
plan: 08
type: execute
wave: 6
depends_on: [02-05, 02-06, 02-07]
files_modified:
  - .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md
autonomous: false
requirements: [CFO-10]
must_haves:
  truths:
    - "Smoke test 1 passes: zero requests to `publish-p23458-*.adobeaemcloud.com` during article block rendering (DevTools Network filter)."
    - "Smoke test 2 passes: a CF whose body contains `<img src=x onerror=alert(1)>` renders inert (NO alert dialog) — DOMPurify wiring proven (CP-2 closure verified)."
    - "Smoke test 3 passes: a missing CF reference yields an empty container with exactly one `console.error('article-{hero,teaser}: missing CF', cfPath)` line; rest of page renders normally (D-08 contract verified)."
    - "Smoke test 4 passes: editing the CF reference in Universal Editor re-decorates the block in place, no full page reload, UE click-to-edit still works on the re-rendered block (CP-3 closure verified)."
  artifacts:
    - path: ".planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md"
      provides: "Captured smoke-test outcomes (pass/fail per test, screenshots links if any, browser+OS context, CF path used) — feeds VERIFICATION.md and unblocks phase completion."
      contains: "Smoke test"
  key_links:
    - from: ".planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md"
      to: "docs/content-fragment-overlay.md"
      via: "results validate the smoke-test procedure documented in DOC-01 — outcomes paste into the doc if any are FAIL"
      pattern: "Smoke test"
---

<objective>
Manually execute the four smoke tests documented in `docs/content-fragment-overlay.md` `## Smoke test` against a running local AEM instance (`aem up`) and the AEMaaCS Author tier. These verify the four critical Phase 2 success criteria from ROADMAP:

1. Zero Publish-tier requests during rendering (Success Criterion #1).
2. XSS payload renders inert (Success Criterion #2 — non-negotiable, CP-2 closure).
3. Missing CF degrades gracefully (Success Criterion #3 — D-08 contract).
4. UE re-decoration works in place (Success Criterion #4 — CP-3 closure).

These tests CANNOT be automated — they require a running browser, devtools network panel, the Universal Editor iframe, and human judgment about whether an alert fires or content renders correctly. Per `<downstream_consumer>` they are `autonomous: false`.

Purpose: Phase 2 verification gate. Without this, Phase 2 cannot be marked complete.
Output: One results file capturing per-test pass/fail and any deviations.
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
@docs/content-fragment-overlay.md
@blocks/article-hero/article-hero.js
@blocks/article-teaser/article-teaser.js
@scripts/cf-overlay.js
@cf-templates/article.html
@CLAUDE.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Smoke test 1 — Zero publish-host requests during rendering</name>
  <read_first>
    - docs/content-fragment-overlay.md `## Smoke test` Test 1 section
    - .planning/ROADMAP.md Phase 2 Success Criterion #1
  </read_first>
  <what-built>
    Plans 02-05 / 02-06 deleted the `GRAPHQL_ENDPOINT = 'https://publish-p23458-...'` literals and rewired the article blocks to use `fetchOverlay` (which delegates to `loadFragment` → goes through aem.page / aem.live edge, never directly to publish). This test verifies no regression at runtime.
  </what-built>
  <how-to-verify>
    1. Start the local dev server in a terminal at the repo root:
       ```bash
       aem up
       ```
       (Requires `@adobe/aem-cli` installed globally.)
    2. Open Chrome / Firefox to `http://localhost:3000/<page-with-article-block>` — use any page that has at least one `article-hero` or `article-teaser` block referencing a published CF (the Phase 2 spike CF from plan 02-01 works).
    3. Open DevTools → Network tab. Click the "filter URLs" input. Type: `publish-`.
    4. Reload the page (Cmd+Shift+R / Ctrl+Shift+R for a hard reload).
    5. EXPECTED: the Network tab filtered view shows ZERO entries.
    6. ALSO check: the unfiltered Network tab shows at least one request to `*.plain.html` (the CFO overlay) — confirms the new pipeline is doing the work.
    7. Repeat the same checks against the live aem.page deployment (if reachable) and aem.live.
  </how-to-verify>
  <resume-signal>Reply with: PASS or FAIL. If FAIL, paste the URL(s) that matched the `publish-` filter — Claude will diagnose.</resume-signal>
  <acceptance_criteria>
    - Human reports: PASS (zero `publish-` URLs in DevTools Network filter on local + at least one cloud context).
    - Result captured to `.planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md` under `## Test 1` section.
  </acceptance_criteria>
  <done>
    Phase 2 Success Criterion #1 verified.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Smoke test 2 — XSS payload renders inert (CP-2 closure verification)</name>
  <read_first>
    - docs/content-fragment-overlay.md `## Smoke test` Test 2 section
    - .planning/ROADMAP.md Phase 2 Success Criterion #2 (non-negotiable per `security_block_on: high`)
    - blocks/article-hero/article-hero.js (the `DOMPurify.sanitize(body.innerHTML)` line — this is what's being tested)
  </read_first>
  <what-built>
    Plans 02-05 / 02-06 wired `DOMPurify.sanitize(body.innerHTML)` BEFORE insertion (D-04 wiring point). Plan 02-04's Mustache template uses `{{title}}` (auto-escaped) for plain-text and `{{{body}}}` (raw) only for rich-text — DOMPurify is the consumer-side safety net.
  </what-built>
  <how-to-verify>
    Test 2a — Title (auto-escape via Mustache):
    1. In AEM Author, edit the test CF created in plan 02-01.
    2. Set the `title` field to (literally): `<img src=x onerror=alert(1)>`
    3. Save and Publish.
    4. Visit the article page (local via `aem up`, OR aem.page).
    5. EXPECTED: the literal text `<img src=x onerror=alert(1)>` appears as plain text, OR appears truncated. NO `alert(1)` dialog.
    6. If an alert dialog fires, FAIL — the Mustache template is using `{{{title}}}` (triple-brace) somewhere, which is the XSS path Phase 2 closes. Inspect `cf-templates/article.html`.
    Test 2b — Body (DOMPurify sanitize on consumer):
    1. In AEM Author, edit the test CF.
    2. Set the `body` rich-text field to include both safe content AND a payload: `<p>Hello</p><img src=x onerror=alert(2)>`
    3. Save and Publish.
    4. Visit the article page.
    5. EXPECTED: paragraph "Hello" renders. The `<img>` MAY render (broken icon) but the `onerror=alert(2)` handler is stripped by DOMPurify default profile. NO `alert(2)` dialog.
    6. Inspect rendered DOM: open DevTools Elements panel. Find the `.body` element. Check the `<img>` (if present): the `onerror` attribute should be absent.
    7. If an alert dialog fires, FAIL — DOMPurify wiring is broken. Inspect `blocks/article-hero/article-hero.js` (`body.innerHTML = DOMPurify.sanitize(body.innerHTML)` must run BEFORE insertion).
    Cleanup: revert the test CF body and title back to safe content + republish.
  </how-to-verify>
  <resume-signal>Reply with: PASS (both 2a and 2b) or FAIL with which subtest fired the alert. If FAIL, paste the rendered DOM excerpt for the affected field.</resume-signal>
  <acceptance_criteria>
    - Human reports: PASS for both 2a (title auto-escape) and 2b (body DOMPurify).
    - Result captured to `.planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md` under `## Test 2` section.
    - Cleanup confirmed: test CF reverted to safe content.
  </acceptance_criteria>
  <done>
    CP-2 XSS closure verified end-to-end. Phase 2 Success Criterion #2 met. The non-negotiable security gate (`security_block_on: high`) for this phase passes.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Smoke test 3 — Missing CF reference degrades gracefully (D-08 contract)</name>
  <read_first>
    - docs/content-fragment-overlay.md `## Smoke test` Test 3 section
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-08 empty-state contract)
    - blocks/article-hero/article-hero.js (the `if (!fragment) { console.error... block.replaceChildren(); return; }` path)
  </read_first>
  <what-built>
    Plan 02-05 / 02-06 implemented D-08: on any error class (404, 401, missing wrapper marker, network), the block logs ONE `console.error` and calls `block.replaceChildren()` (empty children, keep block element + UE attrs).
  </what-built>
  <how-to-verify>
    Setup — pick a way to break the CF reference:
    Option A: in AEM Author, unpublish the test CF (Publish menu → Unpublish).
    Option B: edit the page in UE, set the article block's `cfReference` field to a path that does not exist (e.g., `/content/dam/sgedsdemo/articles/never-existed`). Save.

    Then:
    1. Open the article page in Chrome / Firefox at `http://localhost:3000/<page>` (or aem.page).
    2. Open DevTools → Console.
    3. Reload the page.
    4. EXPECTED:
       a. The page loads without crashing.
       b. The article block element is in the DOM (DevTools Elements: find `<div class="block article-hero">` or `<div class="block article-teaser">`). Its children are empty (no inner content).
       c. The `data-aue-*` attributes on the block element are still present (right-pane in Elements panel).
       d. The Console shows EXACTLY ONE line per missing-block: either `article-hero: missing CF /content/dam/sgedsdemo/articles/<bad-path>` OR `article-teaser: missing CF ...`. No other errors related to this block.
       e. The rest of the page renders normally (other blocks unaffected).
    5. FAIL conditions: page crashes / blank, console flooded with errors, block element removed entirely from DOM (D-08 violation), or no console.error at all (D-08 violation).
    Cleanup: re-publish the test CF or restore the cfReference field to a valid path.
  </how-to-verify>
  <resume-signal>Reply with: PASS or FAIL. If FAIL, paste the console output and the DOM excerpt of the block element.</resume-signal>
  <acceptance_criteria>
    - Human reports: PASS — block element present, children empty, exactly one `console.error` line, rest of page works, `data-aue-*` attrs preserved.
    - Result captured to `.planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md` under `## Test 3` section.
    - Cleanup confirmed.
  </acceptance_criteria>
  <done>
    CFO-09 + D-08 verified. Phase 2 Success Criterion #3 met.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Smoke test 4 — UE re-decoration preserves block in place (CP-3 closure)</name>
  <read_first>
    - docs/content-fragment-overlay.md `## Smoke test` Test 4 section
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (CP-3 carry-forward)
    - blocks/article-hero/article-hero.js (`moveInstrumentation(link, wrapper)` line — what's being tested)
    - scripts/editor-support.js (Phase 1 `applyChanges` null-guard — re-decoration entry point)
  </read_first>
  <what-built>
    Plans 02-05 / 02-06 included `moveInstrumentation(link, wrapper)` BEFORE `block.replaceChildren(...)` so UE `data-aue-*` attrs survive the DOM swap. `scripts/editor-support.js` (Phase 1) re-runs `decorate(block)` on `aue:content-patch`. This test verifies the round-trip works without a full page reload.
  </what-built>
  <how-to-verify>
    1. Open Universal Editor on AEMaaCS for a page containing the article block. Confirm UE iframe loads (`*.aem.page` should be the rendering host).
    2. Confirm authoring works: click on the article block; the side panel highlights `cfReference` field showing the current cfPath.
    3. Pick a DIFFERENT published CF in the side panel field. Click Save (or it auto-saves).
    4. EXPECTED:
       a. Block re-renders in place with the new CF content (different title / body / image).
       b. NO full page reload (the UE iframe URL bar does not flicker; if you had DevTools open, the network tab does not show a top-level navigation, only the `.plain.html` overlay fetch).
       c. Click again on the re-rendered block — side panel STILL highlights `cfReference` correctly. UE click-to-edit survived the DOM swap.
       d. The Console may show one log from re-decoration; should not show errors.
    5. FAIL conditions:
       - Page reloads completely (then `applyChanges` fell back to `window.location.reload()` — the re-decorate path failed; check `scripts/editor-support.js` apply path and `moveInstrumentation` call).
       - Click-to-edit no longer works on the re-rendered block (UE attrs were lost — `moveInstrumentation` was not called or was called on the wrong element).
       - Block disappears or is duplicated.
  </how-to-verify>
  <resume-signal>Reply with: PASS or FAIL. If FAIL, describe which subcondition failed and paste any console output.</resume-signal>
  <acceptance_criteria>
    - Human reports: PASS for all four sub-checks.
    - Result captured to `.planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md` under `## Test 4` section.
  </acceptance_criteria>
  <done>
    CP-3 verified end-to-end. Phase 2 Success Criterion #4 met. CFO-07 closed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Capture smoke-test results into `.planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md`</name>
  <read_first>
    - The four prior tasks' resume responses (PASS/FAIL outcomes — read from chat history during this task)
    - .planning/ROADMAP.md (Phase 2 Success Criteria text — embed as section headers in the results file)
  </read_first>
  <action>
Create `.planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md` with this structure, populating each section from the human's PASS/FAIL responses to tasks 1-4:

```markdown
# Phase 2 Smoke Test Results

**Tested:** [DATE]
**Tester:** [USER NAME]
**Browser:** [e.g. Chrome 124 on macOS 15]
**Local server:** `aem up` running at http://localhost:3000
**Cloud context:** [aem.page URL tested OR "local-only"]
**Test CF path:** [path used for tests, e.g. /content/dam/sgedsdemo/articles/phase-2-spike]

---

## Test 1 — Zero publish-host requests (Success Criterion #1)

**Result:** [PASS / FAIL]

**Notes:**
[Verbatim from human's resume reply, including any URLs that matched the `publish-` filter if FAIL.]

---

## Test 2 — XSS payload renders inert (Success Criterion #2, CP-2 closure)

### 2a. Title `<img src=x onerror=alert(1)>` (Mustache auto-escape)

**Result:** [PASS / FAIL]

**Notes:**
[Verbatim from human's resume reply.]

### 2b. Body containing `<img src=x onerror=alert(2)>` (DOMPurify default profile)

**Result:** [PASS / FAIL]

**Notes:**
[Verbatim. Include rendered DOM excerpt if FAIL.]

**Cleanup:** [Confirm test CF reverted to safe content.]

---

## Test 3 — Missing CF degrades gracefully (Success Criterion #3, D-08 contract)

**Result:** [PASS / FAIL]

**Notes:**
[Verbatim. Include console output + DOM excerpt if FAIL.]

**Cleanup:** [Confirm test CF restored / cfReference fixed.]

---

## Test 4 — UE re-decoration preserves block in place (Success Criterion #4, CP-3 closure)

**Result:** [PASS / FAIL]

**Notes:**
[Verbatim. Describe sub-condition failure if FAIL.]

---

## Summary

[All four PASS → "Phase 2 verification gate passes; ready for VERIFICATION.md and phase-complete commit."]
[Any FAIL → list which tests failed, link to the diagnostic notes, and capture follow-up tasks needed before phase complete.]
```

Notes for the executor:
1. Read each PASS/FAIL response from the prior tasks' resume signals (in chat history).
2. Embed the human's resume notes verbatim — do not paraphrase. The tester's exact words are the canonical record.
3. If ANY task returned FAIL, the file's `## Summary` MUST list the failures and STOP — do NOT mark the phase complete. Plan a follow-up gap closure plan via `/gsd-plan-phase 02-content-fragment-overlay --gaps`.
  </action>
  <verify>
    <automated>test -f .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md && grep -q '## Test 1' .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md && grep -q '## Test 2' .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md && grep -q '## Test 3' .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md && grep -q '## Test 4' .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md && grep -q '## Summary' .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md</automated>
  </verify>
  <acceptance_criteria>
    - File exists: `.planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md`.
    - File contains all four `## Test N` headers + `## Summary` — verifiable via grep above.
    - File contains either `PASS` or `FAIL` literal in each test section — verifiable: `grep -c '\*\*Result:\*\* \(PASS\|FAIL\)' .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md` returns at least `5` (test 2 has two subtests + tests 1, 3, 4).
    - File contains the test CF path used — verifiable: `grep -l '/content/dam/sgedsdemo/articles/' .planning/phases/02-content-fragment-overlay/02-08-SMOKE-RESULTS.md` returns the file.
  </acceptance_criteria>
  <done>
    Smoke test results captured. If all PASS, Phase 2 is verification-complete and ready for `/gsd-complete-phase` or equivalent. If any FAIL, follow-up gap closure plan is needed (do NOT mark phase complete).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Test CF authoring → live published content | Test CFs containing XSS payloads must be reverted post-test. Tasks 2 + 3 include cleanup steps. |
| Smoke results file → public docs | Results live under `.planning/`, not `docs/`. No public exposure. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-08-01 | Information Disclosure | Test XSS payload left in published CF | mitigate | Tasks 2/3 explicitly include "Cleanup" steps; results file acceptance criterion records cleanup confirmation. |
| T-02-08-02 | Tampering | False-positive PASS report (test was run incorrectly) | mitigate | Each `<how-to-verify>` block enumerates EXACT DevTools clicks and expected dialog/no-dialog outcomes; the human follows the script verbatim. |
| T-02-08-03 | Tampering | Phase marked complete with failing smoke tests | mitigate | Task 5 instructs the executor to STOP and request a `--gaps` plan if any FAIL. Acceptance criterion's `## Summary` requires explicit pass/fail listing. |
</threat_model>

<verification>
- All four smoke tests PASS (or follow-up gap closure plan filed if any FAIL).
- Results file captured.
- Test CFs cleaned up (no XSS payloads left in live content).
</verification>

<success_criteria>
Phase 2 verification gate passes. CFO-10 verification artifact (a working article page authored end-to-end via the new pipeline) demonstrably works. Ready for phase completion.
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-08-SUMMARY.md` recording the four smoke-test outcomes (one line each) and pointing at `02-08-SMOKE-RESULTS.md` for full details.
</output>
