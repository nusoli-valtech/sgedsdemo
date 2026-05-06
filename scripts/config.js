/**
 * Central project configuration.
 *
 * Per D-02 (.planning/phases/01-setup-foundation/01-CONTEXT.md): minimum-viable key set.
 * Add more identifiers as Phase 2-5 require them; do not pre-design future surfaces here.
 *
 * Source of truth:
 * - AEM_AUTHOR_HOST / AEM_INSTANCE_ID / PROJECT_NAME — derived from `fstab.yaml` mountpoint.
 * - CONTENT_PREFIX / DAM_PREFIX                     — derived from `paths.json` mappings.
 */

export const AEM_AUTHOR_HOST = 'https://author-p23458-e585661.adobeaemcloud.com';
export const PROJECT_NAME = 'sgedsdemo';
export const AEM_INSTANCE_ID = 'p23458-e585661';
export const DAM_PREFIX = '/content/dam/sgedsdemo/';
export const CONTENT_PREFIX = '/content/sgedsdemo/';
