import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';

/**
 * Guarantees unique `sys.id` while preserving first-seen order.
 * This prevents React key collisions and avoids sending duplicated links to Contentful.
 */
export function dedupeEntryLinks(value: EntryLink[]): EntryLink[] {
  const seen = new Set<string>();
  const out: EntryLink[] = [];
  for (const l of value ?? []) {
    const id = l?.sys?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(l);
  }
  return out;
}

