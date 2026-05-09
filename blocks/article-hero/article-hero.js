import { loadScript } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchOverlay } from '../../scripts/cf-overlay.js';

/**
 * Article Hero block — Content Fragment Overlay consumer.
 *
 * Replaces the legacy GraphQL fetch (Phase 1 D-04 carve-out: `publish-*` literal
 * deleted) with `fetchOverlay(cfPath)` (plan 02-03 / D-03), sanitizes the
 * rich-text body container with DOMPurify (D-04, default profile per D-05 — closes
 * CP-2 XSS in the same PR as the migration), and preserves UE `data-aue-*`
 * instrumentation via `moveInstrumentation` (CP-3 closure, mirrors `blocks/cards/cards.js:9,19`).
 *
 * On any error class (no link, non-DAM cfPath, fetch failure, missing wrapper
 * marker, missing fields), the block degrades to an empty container with a single
 * `console.error` (D-08). Block element + UE attrs preserved so authors can re-pick
 * the CF in the UE side panel; saving triggers `applyChanges` → in-place re-render.
 *
 * @param {Element} block The block root element with a `<a href="/content/dam/...">` child.
 */
export default async function decorate(block) {
  const link = block.querySelector('a');
  if (!link) return;
  const cfPath = link.getAttribute('href').replace(/\.html$/, '');

  const fragment = await fetchOverlay(cfPath);
  if (!fragment) {
    // eslint-disable-next-line no-console
    console.error('article-hero: missing CF', cfPath);
    block.replaceChildren();
    return;
  }

  // D-04 wiring point: sanitize the rich-text body container ONLY (never
  // fragment-wide — would strip data-aue-* from the wrapper). Default profile
  // (D-05) matches scripts/editor-support.js:34 — the vendored UMD only
  // attaches to window, so loadScript + window.DOMPurify is the in-tree pattern.
  const body = fragment.querySelector('.body');
  if (body) {
    await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
    body.innerHTML = window.DOMPurify.sanitize(body.innerHTML, { USE_PROFILES: { html: true } });
  }

  // CP-3 closure: move UE instrumentation from the source <a> (which UE injected
  // with data-aue-* attrs identifying the cfReference field) to the new wrapper
  // so click-to-edit survives the DOM swap.
  const wrapper = fragment.firstElementChild;
  if (wrapper) moveInstrumentation(link, wrapper);

  block.replaceChildren(...fragment.childNodes);
}
