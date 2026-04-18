const GRAPHQL_ENDPOINT = 'https://publish-p23458-e585661.adobeaemcloud.com/graphql/execute.json/sgedsdemo/article-by-path';

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

    const imagePath = item.image?._path ?? '';
    const title = item.title ?? '';

    block.innerHTML = `
      <div class="article-hero">
        ${imagePath ? `<img src="${imagePath}" alt="${title}">` : ''}
        <div class="article-hero-overlay">
          <h2>${title}</h2>
        </div>
      </div>
    `;
  } catch (err) {
    console.error('Article hero failed:', err);
  }
}