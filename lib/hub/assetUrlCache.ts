type Preview = { assetId: string; url: string | null; title: string | null };

const cache = new Map<string, Preview>();
const inflight = new Map<string, Promise<Preview>>();

export async function getHubAssetPreview(assetId: string): Promise<Preview> {
  const id = (assetId || '').trim();
  if (!id) return { assetId: '', url: null, title: null };

  const cached = cache.get(id);
  if (cached) return cached;

  const pending = inflight.get(id);
  if (pending) return pending;

  const run = (async () => {
    const res = await fetch(`/api/contentful/hub/assets?ids=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const data = (await res.json()) as any;
    const item = (data?.items?.[0] ?? null) as Preview | null;
    const normalized: Preview = item && item.assetId ? item : { assetId: id, url: null, title: null };
    cache.set(id, normalized);
    return normalized;
  })();

  inflight.set(id, run);
  try {
    return await run;
  } finally {
    inflight.delete(id);
  }
}

