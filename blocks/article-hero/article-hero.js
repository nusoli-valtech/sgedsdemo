const GRAPHQL_ENDPOINT = 'https://publish-p23458-e585661.adobeaemcloud.com/graphql/execute.json/sgedsdemo/article-by-path';
const PUBLISH_BASE = 'https://publish-p23458-e585661.adobeaemcloud.com';

export default async function decorate(block) {
  const link = block.querySelector('a');
  if (!link) return;

  const cfPath = link.getAttribute('href').replace(/\.html$/, '');
  if (!cfPath.startsWith('/content/dam/')) return;

  const url = `${GRAPHQL_ENDPOINT};path=${cfPath}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);

    const data = await resp.json();
    const item = data?.data?.articleByPath?.item;
    if (!item) throw new Error('No item in response');

    const imageRelPath = item.image?._path ?? '';
    const imageUrl = imageRelPath.startsWith('/content/')
      ? `${PUBLISH_BASE}${imageRelPath}`
      : imageRelPath;
    const title = item.title ?? '';
    const body = item.body?.html ?? '';

    block.innerHTML = `
      <div class="article-hero-centered">
        ${imageUrl ? `<img src="${imageUrl}" alt="${title}">` : ''}
        <div class="article-hero-centered-overlay">
          <div class="article-hero-centered-content">
            <h2>${title}</h2>
            <div class="body">${body}</div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Article hero centered failed:', err);
  }
}