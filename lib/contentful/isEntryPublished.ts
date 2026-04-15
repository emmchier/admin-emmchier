/**
 * Whether an entry should show as "published" in the admin UI.
 * Works for CMA entries and Delivery-normalized entries.
 */
export function isEntryPublished(sys: unknown): boolean {
  if (!sys || typeof sys !== 'object') return false;
  const s = sys as Record<string, unknown>;
  if (typeof s.publishedAt === 'string' && s.publishedAt.length > 0) return true;
  if (typeof s.firstPublishedAt === 'string' && s.firstPublishedAt.length > 0) return true;
  if (typeof s.publishedCounter === 'number' && s.publishedCounter > 0) return true;
  if (typeof s.publishedVersion === 'number' && s.publishedVersion > 0) return true;
  return false;
}
