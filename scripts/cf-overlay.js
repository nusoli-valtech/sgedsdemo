/*
 * CF Overlay helper.
 *
 * Per D-03 (.planning/phases/02-content-fragment-overlay/02-CONTEXT.md):
 *   Named exports `assetUrl(repoPath)` and `fetchOverlay(cfPath)` — the two
 *   helpers Phase 2 article blocks consume. Delegates to `loadFragment` from
 *   `blocks/fragment/fragment.js` (Pattern S1). DAM_PREFIX comes from
 *   `scripts/config.js` (Phase 1 D-02 lock).
 *
 * Per D-08: returns null on ANY failure class so callers use a single error path.
 * Per CFO-1 (Pitfall 1): defensive marker check — the Mustache template at
 *   `cf-templates/article.html` emits `<div class="article-cf">`; if absent,
 *   we have a 200-OK-with-wrong-page and treat as failure.
 */

// eslint-disable-next-line import/no-cycle
import { loadFragment } from '../blocks/fragment/fragment.js';
import { getMetadata } from './aem.js';
import { DAM_PREFIX } from './config.js';

/**
 * CFO marker class emitted by `cf-templates/article.html`. Used by `fetchOverlay`
 * to detect CFO-1 silent failures (overlay path mismatch returning HTML body of
 * the wrong page — see PITFALLS.md CFO-1).
 */
const CF_OVERLAY_MARKER = '.article-cf';

/**
 * Translate an AEM repository path to a delivery URL the browser can load.
 *
 * Body locked from `samples/cf-json-sample.json` (Wave 1 spike): image fields
 * are stored as bare DAM paths (e.g. `/content/dam/sgedsdemo/headless-is-here.png`),
 * and the EDS edge serves DAM assets at the same path — identity transform.
 * If a future asset class needs rewriting (renditions, dynamic media), implement
 * it here in ONE place — never inline transforms in block code.
 *
 * @param {string} repoPath  e.g. /content/dam/sgedsdemo/articles/foo/image.jpg
 * @returns {string} Browser-loadable asset URL (relative to current origin), or
 *   empty string if the input is not a string or is empty / outside DAM_PREFIX.
 */
export function assetUrl(repoPath) {
  if (!repoPath || typeof repoPath !== 'string') return '';
  if (!repoPath.startsWith(DAM_PREFIX)) return '';
  return repoPath;
}

/**
 * Fetch a CF overlay as a hydrated <main> element.
 *
 * Delegates to `loadFragment` (which already prefixes `.plain.html`, resets media
 * base paths, runs decorateMain + loadSections, and null-guards non-OK responses).
 *
 * Returns null on:
 *   - empty / non-DAM cfPath
 *   - loadFragment returning null (network error, non-OK, missing path)
 *   - response that lacks the `.article-cf` marker (CFO-1 silent failure defence)
 *   - any thrown exception
 *
 * @param {string} cfPath  e.g. /content/dam/sgedsdemo/articles/my-article
 * @returns {Promise<HTMLElement|null>} <main> element with hydrated CF content,
 *   or null if the overlay could not be loaded.
 */
export async function fetchOverlay(cfPath) {
  if (!cfPath || typeof cfPath !== 'string') return null;
  const cfRoot = getMetadata('cf-endpoint') || DAM_PREFIX;
  if (!cfPath.startsWith(cfRoot) && !cfPath.startsWith(DAM_PREFIX)) return null;

  try {
    const fragment = await loadFragment(cfPath);
    if (!fragment || !fragment.firstElementChild) return null;
    if (!fragment.querySelector(CF_OVERLAY_MARKER)) return null;
    return fragment;
  } catch (err) {
    return null;
  }
}
