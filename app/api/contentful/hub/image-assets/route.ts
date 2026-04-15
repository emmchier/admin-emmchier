import { jsonError, jsonOk, getHubCtx } from '../_shared';

type Preview = {
  entryId: string;
  assetId: string | null;
  url: string | null;
  title: string | null;
};

function toAbsoluteCdnUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('//')) return `https:${urlOrPath}`;
  return urlOrPath;
}

export async function GET(req: Request) {
  try {
    const { client, spaceId, environmentId, entryLocale } = getHubCtx();
    const url = new URL(req.url);
    const ids = (url.searchParams.get('ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 100);

    if (ids.length === 0) return jsonOk({ items: [] satisfies Preview[] });

    const items: Preview[] = [];

    for (const entryId of ids) {
      try {
        const entry = await client.entry.get({ spaceId, environmentId, entryId });
        const title =
          entry.fields?.title?.[entryLocale] ??
          entry.fields?.title?.['en-US'] ??
          (entry.fields?.title ? Object.values(entry.fields.title)[0] : null) ??
          null;

        const assetId: string | null =
          entry.fields?.image?.[entryLocale]?.sys?.id ??
          entry.fields?.image?.['en-US']?.sys?.id ??
          null;

        let assetUrl: string | null = null;
        if (assetId) {
          const asset = await client.asset.get({ spaceId, environmentId, assetId });
          const urlOrPath =
            asset.fields?.file?.[entryLocale]?.url ??
            asset.fields?.file?.['en-US']?.url ??
            (asset.fields?.file ? Object.values(asset.fields.file)[0]?.url : null) ??
            null;
          assetUrl = urlOrPath ? toAbsoluteCdnUrl(urlOrPath) : null;
        }

        items.push({ entryId, assetId, url: assetUrl, title: title ? String(title) : null });
      } catch {
        items.push({ entryId, assetId: null, url: null, title: null });
      }
    }

    return jsonOk({ items });
  } catch (e) {
    return jsonError(e, 500);
  }
}
