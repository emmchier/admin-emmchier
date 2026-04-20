import { jsonError, jsonOk, getHubCtx } from '../_shared';

type Preview = {
  entryId: string;
  assetId: string | null;
  url: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  extension: string | null;
  mimeType: string | null;
};

function readAssetFileMeta(asset: any, locale: string) {
  const file =
    asset.fields?.file?.[locale] ??
    asset.fields?.file?.['en-US'] ??
    (asset.fields?.file && typeof asset.fields.file === 'object'
      ? (Object.values(asset.fields.file)[0] as Record<string, unknown> | undefined)
      : undefined);
  if (!file || typeof file !== 'object') {
    return { width: null, height: null, extension: null, mimeType: null };
  }
  const img = (file as { details?: { image?: { width?: number; height?: number } } }).details?.image;
  const width = typeof img?.width === 'number' ? img.width : null;
  const height = typeof img?.height === 'number' ? img.height : null;
  const mimeRaw = (file as { contentType?: string }).contentType;
  const mimeType = typeof mimeRaw === 'string' ? mimeRaw : null;
  const fn = typeof (file as { fileName?: string }).fileName === 'string' ? (file as { fileName: string }).fileName : '';
  let extension: string | null = null;
  const m = /\.([^.]+)$/.exec(fn);
  if (m) extension = m[1].toLowerCase();
  else if (mimeType) {
    const part = mimeType.split('/')[1];
    if (part === 'jpeg') extension = 'jpg';
    else if (part) extension = part;
  }
  return { width, height, extension, mimeType };
}

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
        let width: number | null = null;
        let height: number | null = null;
        let extension: string | null = null;
        let mimeType: string | null = null;
        if (assetId) {
          const asset = await client.asset.get({ spaceId, environmentId, assetId });
          const urlOrPath =
            asset.fields?.file?.[entryLocale]?.url ??
            asset.fields?.file?.['en-US']?.url ??
            (asset.fields?.file ? Object.values(asset.fields.file)[0]?.url : null) ??
            null;
          assetUrl = urlOrPath ? toAbsoluteCdnUrl(urlOrPath) : null;
          const meta = readAssetFileMeta(asset, entryLocale);
          width = meta.width;
          height = meta.height;
          extension = meta.extension;
          mimeType = meta.mimeType;
        }

        items.push({
          entryId,
          assetId,
          url: assetUrl,
          title: title ? String(title) : null,
          width,
          height,
          extension,
          mimeType,
        });
      } catch {
        items.push({
          entryId,
          assetId: null,
          url: null,
          title: null,
          width: null,
          height: null,
          extension: null,
          mimeType: null,
        });
      }
    }

    return jsonOk({ items });
  } catch (e) {
    return jsonError(e, 500);
  }
}
