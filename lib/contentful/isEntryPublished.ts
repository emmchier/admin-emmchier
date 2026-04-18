/**
 * Whether an entry should show as "published" in the admin UI.
 * Works for CMA entries and Delivery-normalized entries.
 */
export function isEntryPublished(sys: unknown): boolean {
  if (!sys || typeof sys !== 'object') return false;
  const s = sys as Record<string, unknown>;
  // `publishedAt` exists ONLY when the entry is currently published.
  // `firstPublishedAt/publishedVersion/publishedCounter` may exist even after unpublishing.
  return typeof s.publishedAt === 'string' && s.publishedAt.length > 0;
}
