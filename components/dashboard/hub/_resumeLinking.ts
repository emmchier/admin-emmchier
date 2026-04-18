import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { contentfulService } from '@/services/contentfulService';

export const HUB_MANAGEMENT_API = '/api/contentful/hub';

export function toLink(id: string): EntryLink {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

export function unwrapLocaleCell(raw: any, locale: string) {
  return raw?.[locale] ?? raw?.['en-US'] ?? raw;
}

export function readLinks(raw: any): EntryLink[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as EntryLink[];
  if (typeof raw === 'object' && raw?.sys?.type === 'Link') return [raw as EntryLink];
  return [];
}

export function mergeLink(existingCell: any, newId: string): { nextLinks: EntryLink[]; valueToPersist: any } {
  const existing = readLinks(existingCell);
  const nextLinks = existing.some((l) => l.sys.id === newId) ? existing : [...existing, toLink(newId)];
  const valueToPersist = Array.isArray(existingCell) ? nextLinks : nextLinks[0] ?? null;
  return { nextLinks, valueToPersist };
}

export async function fetchFirstResumeId(): Promise<string | null> {
  const items = await contentfulService.getEntriesCached({ space: 'hub', contentTypeId: 'resume' });
  const first = items?.[0] as any;
  return typeof first?.sys?.id === 'string' ? String(first.sys.id) : null;
}

export async function fetchEntry(entryId: string): Promise<any> {
  return await contentfulService.getEntryById({ space: 'hub', entryId });
}

export function asDateCell(v: string): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  return s;
}

