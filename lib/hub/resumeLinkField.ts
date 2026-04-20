/**
 * Read reference links stored on the Resume entry so the dashboard mirrors Contentful:
 * counts and lists follow the linked IDs for the active locale, not every entry in the space.
 */

export function pickCanonicalResumeEntry<T extends { sys?: { updatedAt?: string; id?: string } }>(
  entries: readonly T[],
): T | null {
  if (!entries.length) return null;
  return [...entries].sort((a, b) => {
    const ua = Date.parse(String(a?.sys?.updatedAt ?? '')) || 0;
    const ub = Date.parse(String(b?.sys?.updatedAt ?? '')) || 0;
    return ub - ua;
  })[0];
}

/** Same cell unwrap as HubResumeDashboard countLinks (CMA shape). */
export function unwrapResumeReferenceCell(raw: unknown, entryLocale: string): unknown {
  if (raw == null) return null;
  const cell = (raw as Record<string, unknown>)?.[entryLocale] ?? (raw as Record<string, unknown>)?.['en-US'] ?? raw;
  return cell ?? null;
}

function linkIdFromItem(item: unknown): string | null {
  if (!item || typeof item !== 'object') return null;
  const o = item as { sys?: { type?: string; linkType?: string; id?: string } };
  if (o.sys?.type === 'Link' && o.sys.linkType === 'Entry' && o.sys.id) return String(o.sys.id);
  return null;
}

function dedupeIdsPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Entry ids linked on the resume field, in array order (References, many). Duplicates are removed (Contentful may repeat links). */
export function readResumeLinkIdsFromResumeFields(
  fields: Record<string, unknown> | undefined,
  fieldId: string,
  entryLocale: string,
): string[] {
  const raw = fields?.[fieldId];
  const cell = unwrapResumeReferenceCell(raw, entryLocale);
  if (cell == null) return [];
  if (Array.isArray(cell)) {
    const ids: string[] = [];
    for (const item of cell) {
      const id = linkIdFromItem(item);
      if (id) ids.push(id);
    }
    return dedupeIdsPreserveOrder(ids);
  }
  const one = linkIdFromItem(cell);
  return one ? [one] : [];
}
