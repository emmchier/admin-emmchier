export type IdRecord<T> = Record<string, T>;

export type Identified = { sys: { id: string } };

export function toIdRecord<T extends Identified>(items: readonly T[]): IdRecord<T> {
  const out: IdRecord<T> = {};
  for (let i = 0; i < items.length; i += 1) {
    const it = items[i]!;
    out[it.sys.id] = it;
  }
  return out;
}

export function uniqueIds(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i] ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Given an ID->Entry cache and a list of ids, returns the ids that are missing.
 * The output preserves input order (deduped).
 */
export function getMissingIds<T>(cache: IdRecord<T>, ids: readonly string[]): string[] {
  const uniq = uniqueIds(ids);
  const missing: string[] = [];
  for (let i = 0; i < uniq.length; i += 1) {
    const id = uniq[i]!;
    if (cache[id] == null) missing.push(id);
  }
  return missing;
}

/**
 * Returns cached entries for `ids` (deduped), skipping missing ones.
 * Preserves the order of first appearance in `ids`.
 */
export function pickCachedByIds<T>(cache: IdRecord<T>, ids: readonly string[]): T[] {
  const uniq = uniqueIds(ids);
  const out: T[] = [];
  for (let i = 0; i < uniq.length; i += 1) {
    const id = uniq[i]!;
    const v = cache[id];
    if (v != null) out.push(v);
  }
  return out;
}

/**
 * Smart cache validation:
 * - Checks cache first
 * - Fetches only missing ids
 * - Merges fetched results into cache via `setCache`
 * - Dedupes concurrent requests for the same `cacheKey` + missing-id set
 */
const inflight = new Map<string, Promise<void>>();

export async function ensureCachedByIds<T extends Identified>(args: {
  /** Stable key for the cache slice, e.g. `asset`, `project`, `imageAsset` */
  cacheKey: string;
  ids: readonly string[];
  getCache: () => IdRecord<T>;
  /** Merge a partial id-record into your store/cache */
  setCache: (patch: IdRecord<T>) => void;
  /** Fetch ONLY the missing ids and return them (array or id-record) */
  fetchMissing: (missingIds: string[]) => Promise<readonly T[] | IdRecord<T>>;
}): Promise<{ cached: T[]; missingIds: string[] }> {
  const ids = uniqueIds(args.ids);
  const cache0 = args.getCache();
  const missingIds = getMissingIds(cache0, ids);
  const cached0 = pickCachedByIds(cache0, ids);
  if (missingIds.length === 0) return { cached: cached0, missingIds };

  const inflightKey = `${args.cacheKey}:${missingIds.join(',')}`;
  const existing = inflight.get(inflightKey);
  if (existing) {
    await existing;
    const cache1 = args.getCache();
    return { cached: pickCachedByIds(cache1, ids), missingIds: getMissingIds(cache1, ids) };
  }

  const run = (async () => {
    const result = await args.fetchMissing(missingIds);
    const patch = Array.isArray(result) ? toIdRecord(result as readonly T[]) : (result as IdRecord<T>);
    args.setCache(patch);
  })();

  inflight.set(inflightKey, run);
  try {
    await run;
  } finally {
    inflight.delete(inflightKey);
  }

  const cache2 = args.getCache();
  return { cached: pickCachedByIds(cache2, ids), missingIds: getMissingIds(cache2, ids) };
}

