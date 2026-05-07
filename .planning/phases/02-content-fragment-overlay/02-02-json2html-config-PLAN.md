---
phase: 02-content-fragment-overlay
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json
autonomous: false
requirements: [CFO-03]
must_haves:
  truths:
    - "json2html worker `/config/nusoli-valtech/sgedsdemo/main` POST has been issued, registering `cf-templates/article.html` as the Mustache template for article CFs."
    - "Worker config response is captured under `.planning/phases/02-content-fragment-overlay/samples/` so DOC-01 (plan 02-07) can paste it verbatim."
  artifacts:
    - path: ".planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json"
      provides: "Helix json2html worker `/config` POST response — confirms worker now points at this repo's `cf-templates/article.html`."
  key_links:
    - from: ".planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json"
      to: "cf-templates/article.html (created by plan 02-04)"
      via: "Worker config carries the relative URL `/cf-templates/article.html`; once the file ships in this repo, the worker will fetch + render it."
      pattern: "cf-templates/article\\.html"
---

<objective>
POST `/config/nusoli-valtech/sgedsdemo/main` to the Adobe-hosted json2html worker (`json2html.adobeaem.workers.dev`) registering `cf-templates/article.html` as the Mustache template for `article`-model CFs. Capture the response into `.planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json` for DOC-01. Per D-02, this is `autonomous: false` — Claude prepares the curl, the human runs it with their AEM/Helix Admin token, pastes back the response. This unblocks plan 02-04 (Mustache template authoring) — once this config is in place, the worker will fetch `cf-templates/article.html` from the GitHub-backed EDS branch when a CF is published. Resolves OQ-2 (Mustache template location).

Purpose: Wave 1 spike — the second of the two Admin API touches (first is plan 02-01 for CFO config). Order-independent with 02-01 within Wave 1.
Output: One captured response sample.
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
@CLAUDE.md

<interfaces>
<!-- Per RESEARCH.md / aem.live/developer/json2html: -->
<!-- POST https://json2html.adobeaem.workers.dev/config/<org>/<site>/<branch> -->
<!-- Body params: template (relative URL), useAEMMapping (bool), relativeURLPrefix (string), templateApiKey (optional) -->
<!-- Worker fetches the template file from the GitHub-backed repo at request-rendering time. -->
<!-- This project's repo is anonymously readable on aem.page/aem.live → templateApiKey is NOT required (per OQ-2 reasoning). -->

From fstab.yaml line 3:
```yaml
mountpoints:
  /: https://author-p23458-e585661.adobeaemcloud.com/bin/franklin.delivery/nusoli-valtech/sgedsdemo/main
```
Implied: `<org> = nusoli-valtech`, `<site> = sgedsdemo`, `<branch> = main`.
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: POST json2html worker config and capture response</name>
  <read_first>
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-02 token contract, D-03 spike artifact layout — `cf-templates/article.html` lives in repo)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pattern §json2html worker config; OQ-2; A3 assumption about template-from-repo fetch)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`cf-templates/article.html` analog notes — first Mustache template in repo)
  </read_first>
  <what-built>
    Claude has prepared the exact `curl` invocation below. The human operator runs it with their Helix Admin / IMS token, pastes the response back, Claude commits it.
  </what-built>
  <how-to-verify>
    Step 1 — Re-use `$AEM_TOKEN` from plan 02-01 Task 2 (same Helix Admin session).

    Step 2 — POST json2html `/config`:
    ```bash
    curl -i -X POST 'https://json2html.adobeaem.workers.dev/config/nusoli-valtech/sgedsdemo/main' \
      -H "Authorization: token $AEM_TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{
        "models": {
          "article": {
            "template": "/cf-templates/article.html",
            "useAEMMapping": true,
            "relativeURLPrefix": ""
          }
        }
      }'
    ```
    Capture the FULL response (status line + headers + JSON body). Paste into your reply.

    Step 3 (Claude on resume): Write the response to `.planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json` exactly as captured.

    NOTE: If the worker rejects with a hint about schema, the body shape may have changed since the 2026-05-07 research. The required fields per aem.live/developer/json2html are: `template` (relative URL), and one of `useAEMMapping` or explicit `models` mapping. If `templateApiKey` is required (site-auth'd), capture the error and check at https://www.aem.live/docs/authentication-setup-site — but THIS project's repo is anonymously readable, so `templateApiKey` should not be needed.

    Pre-flight (recommended): `curl -i 'https://json2html.adobeaem.workers.dev/config/nusoli-valtech/sgedsdemo/main' -H "Authorization: token $AEM_TOKEN"` — read existing config (likely empty / 404) to model POST against.

    Expected outcome: 200/201 response confirming the worker now associates `article` model with `/cf-templates/article.html` for this repo branch. Worker will fetch the template at CF-publish-time once plan 02-04 commits the file.
  </how-to-verify>
  <resume-signal>Reply with the captured response (status line + headers + body) in a fenced code block. Claude writes it into `samples/json2html-config-response.json`.</resume-signal>
  <acceptance_criteria>
    - File exists: `.planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json`
    - File contains the literal string `cf-templates/article.html` (proves the template path was registered).
    - File contains `HTTP/` (status line — `grep -l 'HTTP/' .planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json` returns the file).
    - File does NOT contain a long token-shaped string in the request echo (sanity): `grep -L 'token [a-zA-Z0-9_-]\{20,\}' .planning/phases/02-content-fragment-overlay/samples/json2html-config-response.json` returns the file.
  </acceptance_criteria>
  <done>
    Worker config registered. Plan 02-04 (Mustache template authoring) can ship `cf-templates/article.html`; once it lands on the `main` branch and a CF is republished, the worker renders it.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Local shell → json2html worker | Operator-authenticated POST. Token short-lived, never persisted in repo. |
| json2html worker → GitHub-backed repo | Worker fetches `/cf-templates/article.html` anonymously (this project is publicly readable on aem.live). |
| Captured response → repo | Sample committed under `.planning/`; must not contain secrets. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-02-01 | Information Disclosure | json2html-config-response.json | mitigate | Acceptance criterion greps for long token-shaped strings; D-02 commits placeholder commands only. |
| T-02-02-02 | Tampering | Worker config registering a wrong template path | mitigate | Curl body literal `/cf-templates/article.html` matches the path that plan 02-04 commits. Pre-flight GET recommended to confirm. |
| T-02-02-03 | Information Disclosure | Worker fetching template from repo without auth | accept | This project's repo is anonymously readable on aem.live by design (CFO-2 / CFO-2 trust boundary documented in RESEARCH §Security Domain). Template content has no secrets. |
</threat_model>

<verification>
- Worker config response captured to `samples/json2html-config-response.json`.
- Path `/cf-templates/article.html` is the registered template — confirmed in response body grep.
- No token leakage.
</verification>

<success_criteria>
CFO-03 partially closed: json2html worker now knows `<org>/<site>/<branch>` ↔ `/cf-templates/article.html`. Plan 02-04 commits the file. Plan 02-03 spike can then trigger a CF republish to observe end-to-end rendering.
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-02-SUMMARY.md`. Note: the json2html worker only renders content once a CF is republished AFTER both this config AND `cf-templates/article.html` (plan 02-04) are in place. Plan 02-03 spike validates the round-trip.
</output>
