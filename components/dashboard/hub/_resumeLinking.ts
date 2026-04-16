import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';

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
  const q = new URLSearchParams({ contentType: 'resume', limit: '1', skip: '0' });
  const res = await fetch(`${HUB_MANAGEMENT_API}/entries?${q.toString()}`, { cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load resume');
  const first = data?.items?.[0];
  return typeof first?.sys?.id === 'string' ? (first.sys.id as string) : null;
}

export async function fetchEntry(entryId: string): Promise<any> {
  const res = await fetch(`${HUB_MANAGEMENT_API}/entries/${encodeURIComponent(entryId)}`, { cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load entry');
  return data?.item;
}

export function asDateCell(v: string): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  return s;
}

