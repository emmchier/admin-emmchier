import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { dedupeEntryLinks } from '@/lib/utils/dedupeEntryLinks';

/**
 * Drop tech entry links that are not present in the Art tech cache.
 * Stale IDs (deleted tech entries) cause CMA publish to fail with `notResolvable` on `fields.techs`.
 */
export function sanitizeArtProjectTechLinksForSave(
  fields: Record<string, unknown>,
  knownTechIds: Set<string>,
): Record<string, unknown> {
  if (knownTechIds.size === 0) return fields;
  const raw = fields.techs;
  if (!Array.isArray(raw)) return fields;
  const filtered = dedupeEntryLinks(raw as EntryLink[]).filter((l) =>
    knownTechIds.has(String(l?.sys?.id ?? '')),
  );
  return { ...fields, techs: filtered };
}
