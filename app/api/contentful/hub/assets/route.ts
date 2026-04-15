import { jsonError, jsonOk, getHubCtx } from '../_shared';

type Preview = {
  assetId: string;
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

    for (const assetId of ids) {
      try {
        const asset = await client.asset.get({ spaceId, environmentId, assetId });
        const title =
          asset.fields?.title?.[entryLocale] ??
          asset.fields?.title?.['en-US'] ??
          (asset.fields?.title ? Object.values(asset.fields.title)[0] : null) ??
          null;

        const urlOrPath =
          asset.fields?.file?.[entryLocale]?.url ??
          asset.fields?.file?.['en-US']?.url ??
          (asset.fields?.file ? (Object.values(asset.fields.file)[0] as any)?.url : null) ??
          null;

        items.push({
          assetId,
          title: title ? String(title) : null,
          url: urlOrPath ? toAbsoluteCdnUrl(String(urlOrPath)) : null,
        });
      } catch {
        items.push({ assetId, url: null, title: null });
      }
    }

    return jsonOk({ items });
  } catch (e) {
    return jsonError(e, 500);
  }
}
