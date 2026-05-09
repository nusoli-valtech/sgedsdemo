import { loadScript } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchOverlay } from '../../scripts/cf-overlay.js';

/**
 * Article Teaser block — Content Fragment Overlay consumer.
 *
 * Symmetric to `blocks/article-hero/article-hero.js`. Replaces the legacy
 * GraphQL fetch (Phase 1 D-04 carve-out: `publish-*` literal deleted) with
 * `fetchOverlay(cfPath)`, sanitizes the rich-text body container with
 * DOMPurify default profile (D-04/D-05 — closes CP-2 XSS), and preserves
 * UE `data-aue-*` instrumentation via `moveInstrumentation` (CP-3 closure).
 *
 * On any error class, the block degrades to an empty container with a single
 * `console.error` (D-08) — block element + UE attrs preserved.
 *
 * @param {Element} block The block root with a `<a href="/content/dam/...">` child.
 */
export default async function decorate(block) {
  const link = block.querySelector('a');
  if (!link) return;
  const cfPath = link.getAttribute('href').replace(/\.html$/, '');

  const fragment = await fetchOverlay(cfPath);
  if (!fragment) {
    // eslint-disable-next-line no-console
    console.error('article-teaser: missing CF', cfPath);
    block.replaceChildren();
    return;
  }

  // D-04 wiring point: sanitize rich-text body container ONLY.
  // Vendored DOMPurify is UMD (window.DOMPurify) — same loadScript pattern as
  // scripts/editor-support.js:32-34 (idempotent — repeat decorate calls are cheap).
  const body = fragment.querySelector('.body');
  if (body) {
    await loadScript(`${window.hlx.codeBasePath}/scripts/dompurify.min.js`);
    body.innerHTML = window.DOMPurify.sanitize(body.innerHTML, { USE_PROFILES: { html: true } });
  }

  // CP-3 closure: preserve UE click-to-edit across DOM swap.
  const wrapper = fragment.firstElementChild;
  if (wrapper) moveInstrumentation(link, wrapper);

  block.replaceChildren(...fragment.childNodes);
}
