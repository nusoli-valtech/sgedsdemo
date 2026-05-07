---
phase: 02-content-fragment-overlay
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/02-content-fragment-overlay/samples/cf-model-export.json
  - .planning/phases/02-content-fragment-overlay/samples/cfo-public-response.json
  - .planning/phases/02-content-fragment-overlay/samples/cfo-content-response.json
autonomous: false
requirements: [CFO-01, CFO-02]
must_haves:
  truths:
    - "An `article` Content Fragment model exists in AEM Author with fields {title: text, body: rich-text, image: image-ref}."
    - "CFO Admin API `public.json` and `content.json` POSTs have been issued for `<org>/sgedsdemo/main`, mapping the article CF model to overlay paths."
    - "Raw response bodies from the verify-or-create + Admin API POSTs are captured under `.planning/phases/02-content-fragment-overlay/samples/` so downstream plans (02-04 Mustache, 02-07 DOC-01) can paste them verbatim."
  artifacts:
    - path: ".planning/phases/02-content-fragment-overlay/samples/cf-model-export.json"
      provides: "AEM `article` CF model JSON export — feeds DOC-01 `## CF model` and pins template variable shape for 02-04."
    - path: ".planning/phases/02-content-fragment-overlay/samples/cfo-public-response.json"
      provides: "Helix Admin API `public.json` POST response — feeds DOC-01 `## Reference responses` and confirms CFO config landed."
    - path: ".planning/phases/02-content-fragment-overlay/samples/cfo-content-response.json"
      provides: "Helix Admin API `content.json` POST response — same."
  key_links:
    - from: ".planning/phases/02-content-fragment-overlay/samples/cf-model-export.json"
      to: "cf-templates/article.html (created by plan 02-04)"
      via: "Mustache variable names locked from `properties.elements.<fieldName>` shape in the export"
      pattern: "\"name\":\\s*\"(title|body|image)\""
    - from: ".planning/phases/02-content-fragment-overlay/samples/cfo-public-response.json"
      to: "blocks/article-hero/article-hero.js (rewrite in plan 02-05)"
      via: "Confirms overlay path mapping; rewrite assumes `loadFragment(cfPath)` resolves to a published article page."
      pattern: "\"status\":\\s*200"
---

<objective>
Verify or create the AEM `article` Content Fragment model on the Author tier, then POST the CFO Admin API config (`public.json` + `content.json`) for `<org>/sgedsdemo/main` so the json2html pipeline knows how to translate `/content/dam/sgedsdemo/articles/...` CFs into delivered EDS pages. Capture raw responses into `.planning/phases/02-content-fragment-overlay/samples/` so downstream plans (02-04 Mustache template, 02-05/06 block rewrites, 02-07 DOC-01) reference real, verbatim payloads. Per D-02 this is a `autonomous: false` human task — Claude prepares the curl commands; the human runs them with their own AEM Author session / IMS token and pastes responses back. Per D-07, model verify-or-create is idempotent: re-running just confirms.

Purpose: Wave 1 spike — convert OQ-5 (raw CF JSON shape) and Assumption A7 (Helix Admin API endpoint shape) from `[ASSUMED]` to verified before Wave 2 block rewrites begin. Without this, Wave 2 blocks the rest of the phase.
Output: Three captured response samples committed under `.planning/phases/02-content-fragment-overlay/samples/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/02-content-fragment-overlay/02-CONTEXT.md
@.planning/phases/02-content-fragment-overlay/02-RESEARCH.md
@.planning/phases/02-content-fragment-overlay/02-PATTERNS.md
@CLAUDE.md

<interfaces>
<!-- D-02 contract: Admin API POSTs are autonomous:false. Plans ship the exact curl with $AEM_TOKEN placeholders. -->
<!-- D-07 contract: model verify-or-create idempotent. -->
<!-- A7: org = GitHub owner of deployed repo; for this project verify by looking at fstab.yaml (`nusoli-valtech`). -->

From scripts/config.js (Phase 1 lock — DO NOT modify):
```javascript
export const AEM_AUTHOR_HOST = 'https://author-p23458-e585661.adobeaemcloud.com';
export const PROJECT_NAME = 'sgedsdemo';
export const DAM_PREFIX = '/content/dam/sgedsdemo/';
```

From fstab.yaml line 3 (Author proxy mountpoint — truth for `<org>/<site>/<branch>` Admin API path):
```yaml
mountpoints:
  /: https://author-p23458-e585661.adobeaemcloud.com/bin/franklin.delivery/nusoli-valtech/sgedsdemo/main
```

Implied: `<org> = nusoli-valtech`, `<site> = sgedsdemo`, `<branch> = main`.

Helix Admin API CFO endpoints (per A7 + aem.live/developer/content-fragment-overlay):
- `POST https://admin.hlx.page/config/<org>/sites/<site>/public.json`
- `POST https://admin.hlx.page/config/<org>/sites/<site>/content.json`

AEM Author Assets API (per OQ-5 + AEM Assets HTTP API docs):
- `GET <author-host>/api/assets/sgedsdemo/articles/<test-article>.json`
- Response shape: `{ properties: { "cq:model": "...", title, elements: { fieldName: { value } } } }`
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Verify-or-create the `article` CF model in AEM Author and capture the JSON export</name>
  <read_first>
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-07 verify-or-create contract; D-06 single-field block model)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pattern 3, OQ-5, Assumptions A1, A4)
    - .planning/phases/02-content-fragment-overlay/02-PATTERNS.md (`_article-hero.json` field shape will be derived from this model export)
    - fstab.yaml (line 3 confirms `<org>/<site>/<branch>` = `nusoli-valtech/sgedsdemo/main`)
  </read_first>
  <what-built>
    Claude has prepared this checkpoint description; the human operator runs the AEM Author UI clicks + curl, then pastes the JSON export back into a sample file.
  </what-built>
  <how-to-verify>
    Step 1 — Verify or create model in AEM Author UI:
    1. Sign in to https://author-p23458-e585661.adobeaemcloud.com.
    2. Navigate: Tools (hammer icon) → Configuration Browser → `sgedsdemo` (or root config).
    3. In the configuration, open Content Fragment Models.
    4. CHECK: does an `article` model already exist?
       - YES → click it; confirm fields exist with EXACT names+types:
         - `title` of data type `Single line text`
         - `body` of data type `Multi line text` with `Default Type: Rich text` enabled
         - `image` of data type `Content Reference` (or `Fragment Reference`) restricted to images
       - NO → click `Create`, name it `article`, model name `article`, then add the three fields above. Save.
    5. With the `article` model open, click `Properties` (top-right) → `Export JSON` (or use the actions menu → `Export`). Copy the entire JSON payload.

    Step 2 — Save the export to the repo (Claude will do this once you paste the JSON in your reply):
    - Target file: `.planning/phases/02-content-fragment-overlay/samples/cf-model-export.json`
    - Content: the JSON payload from step 1.5, exactly as exported.

    Step 3 — Author one test CF instance (needed by Wave 1 plan 02-03 spike + Wave 3 smoke tests):
    1. AEM Author → Content Fragments → `/content/dam/sgedsdemo/articles/` (create the `articles` folder if missing).
    2. Create new fragment of model `article`. Name: `phase-2-spike` (or any path under `/content/dam/sgedsdemo/articles/`).
    3. Fill in: `title = "Phase 2 Spike Article"`, `body = "<p>Hello from the Phase 2 CF spike.</p>"`, pick any DAM image for `image`.
    4. Click `Publish` (so it is reachable through the Helix delivery proxy).
    5. Note the full repo path (e.g., `/content/dam/sgedsdemo/articles/phase-2-spike`) — paste it back in your reply for plan 02-03.

    Expected outcome:
    - JSON export captured into `samples/cf-model-export.json`.
    - One published test CF exists at `/content/dam/sgedsdemo/articles/phase-2-spike` (or similar).
    - Decision recorded: did the model already exist (verify) or was it created fresh?
  </how-to-verify>
  <resume-signal>Reply with: (a) the full JSON export pasted in a fenced code block, (b) the exact published CF path, (c) "verify" or "create" indicating which branch ran. Claude will write the JSON to `samples/cf-model-export.json`.</resume-signal>
  <acceptance_criteria>
    - File exists: `.planning/phases/02-content-fragment-overlay/samples/cf-model-export.json`
    - File contains the literal string `"article"` (the model id) and one of: `"title"`, `"body"`, `"image"` (validates real export, not stub).
    - `grep -c '"name"' .planning/phases/02-content-fragment-overlay/samples/cf-model-export.json` returns at least `3` (one match per field title/body/image).
    - User has confirmed in chat: the published test CF path under `/content/dam/sgedsdemo/articles/`.
  </acceptance_criteria>
  <done>
    Real CF model export landed in `samples/`. Test CF authored + published at a known repo path. Wave 1 plans 02-02 / 02-03 / 02-04 can now reference real model field names instead of placeholders.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: POST Helix Admin API CFO config (`public.json` + `content.json`) and capture responses</name>
  <read_first>
    - .planning/phases/02-content-fragment-overlay/02-CONTEXT.md (D-02: $AEM_TOKEN placeholder, no secrets in repo)
    - .planning/phases/02-content-fragment-overlay/02-RESEARCH.md (Pitfall 1 / CFO-1 — overlay path mismatch; Architectural Responsibility Map)
    - .planning/phases/02-content-fragment-overlay/samples/cf-model-export.json (created by Task 1; model id = `article`)
    - fstab.yaml (confirms `<org>/<site>/<branch>` = `nusoli-valtech/sgedsdemo/main`)
  </read_first>
  <what-built>
    Claude has prepared the exact `curl` invocations below. The human operator runs them with their own IMS / AEM Author session token, pastes the response bodies back, and Claude writes them into the sample files. NO secrets are committed.
  </what-built>
  <how-to-verify>
    Step 1 — Obtain a Helix Admin API token:
    - Sign in at https://admin.hlx.page once via the same Adobe identity that has Author access.
    - Capture the session cookie OR an IMS-issued `x-auth-token`. Export to a shell variable:
      `export AEM_TOKEN="<your-token-here>"`

    Step 2 — POST `public.json` (registers CFO config under sgedsdemo / main):
    ```bash
    curl -i -X POST 'https://admin.hlx.page/config/nusoli-valtech/sites/sgedsdemo/public.json' \
      -H "Authorization: token $AEM_TOKEN" \
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
    Capture the FULL response body (status line + headers + JSON body). Paste into your reply.

    Step 3 — POST `content.json` (CFO content-tier mapping):
    ```bash
    curl -i -X POST 'https://admin.hlx.page/config/nusoli-valtech/sites/sgedsdemo/content.json' \
      -H "Authorization: token $AEM_TOKEN" \
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
    Capture the FULL response. Paste into your reply.

    Step 4 (Claude does this on resume):
    - Write Step 2 response to `.planning/phases/02-content-fragment-overlay/samples/cfo-public-response.json`.
    - Write Step 3 response to `.planning/phases/02-content-fragment-overlay/samples/cfo-content-response.json`.

    NOTE on payload shape: the exact JSON body for `public.json` may need to be adjusted based on the response from `GET https://admin.hlx.page/config/nusoli-valtech/sites/sgedsdemo/public.json` (run that GET first if unsure). aem.live docs at https://www.aem.live/developer/content-fragment-overlay may have updated since 2026-05-07; the human operator should use their judgment if the API rejects with a hint about the schema. Document any deviation in the response capture so DOC-01 picks it up.

    Pre-flight (run if uncertain): `curl -i 'https://admin.hlx.page/config/nusoli-valtech/sites/sgedsdemo/public.json' -H "Authorization: token $AEM_TOKEN"` — read the existing config to model the POST body after.
  </how-to-verify>
  <resume-signal>Reply with both response captures (status line + headers + body), in fenced code blocks labelled `## public.json` and `## content.json`. Claude writes them into the two sample files and commits.</resume-signal>
  <acceptance_criteria>
    - File exists: `.planning/phases/02-content-fragment-overlay/samples/cfo-public-response.json`
    - File exists: `.planning/phases/02-content-fragment-overlay/samples/cfo-content-response.json`
    - Both files contain `HTTP/` (status line indicating the captured response) — verifiable via `grep -l 'HTTP/' .planning/phases/02-content-fragment-overlay/samples/cfo-*-response.json`.
    - Neither file contains the literal string of `$AEM_TOKEN` value (sanity check that no token leaked) — verifiable: `grep -L 'token [a-zA-Z0-9_-]\{20,\}' .planning/phases/02-content-fragment-overlay/samples/cfo-*-response.json` returns BOTH files (i.e., no long token strings present).
    - Pre-commit guard passes on a `git status` of these new files (samples/ is under `.planning/`, NOT in publish-host scanner allowlist per `.husky/pre-commit.mjs:33-38`).
  </acceptance_criteria>
  <done>
    CFO Admin API config landed for `nusoli-valtech/sgedsdemo/main`. Response samples captured. The aem.page / aem.live edge now knows how to render `/content/dam/sgedsdemo/articles/<id>` CFs as overlay pages — Wave 1 plan 02-03 will hit `/content/dam/sgedsdemo/articles/phase-2-spike.plain.html` and prove it.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Author UI → Configuration Browser | Authenticated authoring user creating/editing CF models. Adobe-managed authorization. |
| Local shell → Helix Admin API | Human operator runs curl with `$AEM_TOKEN` (IMS/session). Token never persisted to repo. |
| Repo → committed sample files | Captured response bodies become referenceable artifacts; must NOT include secrets. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-01-01 | Information Disclosure | Captured Admin API response samples | mitigate | D-02: `$AEM_TOKEN` is a placeholder; raw token never appears in payload. Acceptance criterion greps for long token strings before commit. |
| T-02-01-02 | Information Disclosure | `cf-model-export.json` containing model definition | accept | Model JSON is intentionally documentation-grade; contains field names/types, no PII. Reproducible by anyone with Author access. |
| T-02-01-03 | Tampering | CFO Admin API config registering wrong source URL | mitigate | Curl body in Task 2 hard-codes `author-p23458-e585661.adobeaemcloud.com` (matches `AEM_AUTHOR_HOST` in `scripts/config.js`). Pre-flight GET recommended to compare with existing config. |
| T-02-01-04 | Spoofing | `<org>` value in Admin API path | mitigate | `<org>` derived from `fstab.yaml:3` mountpoint (`nusoli-valtech`), not guessed. Documented inline in Task 2. |
</threat_model>

<verification>
- `samples/cf-model-export.json` exists and contains the three required field names (title, body, image).
- `samples/cfo-public-response.json` and `samples/cfo-content-response.json` exist with HTTP status lines.
- One published test CF exists at a known path under `/content/dam/sgedsdemo/articles/` (recorded in chat for plan 02-03).
- No secrets pasted into repo files (`grep` check in acceptance criteria).
- Pre-commit guard accepts the new files (under `.planning/` — outside `isRuntimeCodePath`).
</verification>

<success_criteria>
Wave 1 plan 02-03 (spike + helper) and plan 02-04 (Mustache template) can now reference real CF field names + real overlay endpoint behavior, NOT placeholders. CFO-01 + CFO-02 partially closed (Admin API config landed; CF JSON path proven by published test CF).
</success_criteria>

<output>
After completion, create `.planning/phases/02-content-fragment-overlay/02-01-SUMMARY.md`. Include the captured CF model field names verbatim (so plan 02-04 Mustache template can use them) and the published test CF path (so plan 02-03 spike can curl it).
</output>
