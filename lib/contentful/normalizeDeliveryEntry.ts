/**
 * Content Delivery API returns published snapshots, but some SDK / JSON shapes omit
 * `sys.publishedAt` while still being published content. The web app uses `publishedAt`
 * for badges — align with Contentful by stamping when missing.
 *
 * Preview / drafts: if `publishedCounter === 0` or `publishedVersion === 0`, leave as-is.
 */
export function normalizeDeliveryEntry<T extends { sys?: Record<string, unknown> }>(item: T): T {
  const sys = item?.sys;
  if (!sys || typeof sys !== 'object') return item;
  if (typeof sys.publishedAt === 'string' && sys.publishedAt.length > 0) return item;

  if (sys.publishedCounter === 0) return item;
  if (sys.publishedVersion === 0) return item;

  const fallback =
    (typeof sys.firstPublishedAt === 'string' && sys.firstPublishedAt) ||
    (typeof sys.updatedAt === 'string' && sys.updatedAt) ||
    (typeof sys.createdAt === 'string' && sys.createdAt);
  if (!fallback) return item;

  return {
    ...item,
    sys: {
      ...sys,
      publishedAt: fallback,
    },
  } as T;
}
