'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { contentfulService } from '@/services/contentfulService';
import { cn } from '@/lib/utils';

export type EntryLink = { sys: { type: 'Link'; linkType: 'Entry'; id: string } };

function toLink(id: string): EntryLink {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

function readEntryLabel(entry: any, locale: string): string {
  const t = readLocalizedField(entry?.fields?.title, locale);
  if (t.trim()) return t;
  const n = readLocalizedField(entry?.fields?.name, locale);
  if (n.trim()) return n;
  const nen = readLocalizedField(entry?.fields?.nameEn, locale);
  if (nen.trim()) return nen;
  const email = readLocalizedField(entry?.fields?.email, locale);
  if (email.trim()) return email;
  const platform = readLocalizedField(entry?.fields?.platform, locale);
  if (platform.trim()) return platform;
  return entry?.sys?.id ?? '';
}

export function EntryReferenceMultiSelect(props: {
  value: EntryLink[];
  onChange: (next: EntryLink[]) => void;
  managementApiRoot?: string;
  sourceContentTypeId: string;
  entryLocale: string;
  /** Category editor: stretch search + list to container width */
  fullWidth?: boolean;
  /** When true, the search input is half width (md+) */
  halfWidthSearch?: boolean;
  searchPlaceholder?: string;
  emptyListHint?: string;
}) {
  const {
    value,
    onChange,
    managementApiRoot = '/api/contentful',
    sourceContentTypeId,
    entryLocale,
    fullWidth = false,
    halfWidthSearch = false,
  searchPlaceholder = 'Search…',
    emptyListHint = 'No hay coincidencias.',
  } = props;

  const [candidates, setCandidates] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const space = contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
        const items = await contentfulService.getEntriesCached({ space, contentTypeId: sourceContentTypeId });
        if (!cancelled) {
          setCandidates(items);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managementApiRoot, sourceContentTypeId]);

  const selectedIds = React.useMemo(() => new Set(value.map((l) => l.sys.id)), [value]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((e) => {
      const label = readEntryLabel(e, entryLocale).toLowerCase();
      return label.includes(q) || e.sys.id.toLowerCase().includes(q);
    });
  }, [candidates, entryLocale, query]);

  const toggle = React.useCallback(
    (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange(Array.from(next, (x) => toLink(x)));
    },
    [onChange, selectedIds],
  );

  return (
    <div className="grid gap-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className={cn(
          fullWidth ? 'w-full' : 'w-60 max-w-full',
          halfWidthSearch && 'w-full md:w-1/2',
        )}
      />

      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}

      <div
        className={cn(
          'w-full min-w-0',
          fullWidth ? 'max-w-none' : 'md:w-3/4',
        )}
      >
        <ScrollArea className="h-[50vh]">
          <div className="flex flex-col gap-1 pr-4">
            {filtered.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">{emptyListHint}</p>
            ) : (
              filtered.map((e) => {
                const id = e.sys.id as string;
                const active = selectedIds.has(id);
                const lab = readEntryLabel(e, entryLocale);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(id)}
                    className={[
                      'flex h-14 w-full shrink-0 items-center gap-3 rounded-md border px-3 text-left text-sm transition',
                      active
                        ? 'border-transparent bg-zinc-200 text-zinc-900'
                        : 'border-neutral-200 text-zinc-800 hover:bg-zinc-50',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      readOnly
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none h-4 w-4 shrink-0 rounded border-zinc-400 accent-zinc-700"
                    />
                    <span className="line-clamp-2 min-w-0 flex-1 whitespace-normal wrap-break-word text-left leading-snug font-medium">
                      {lab || id}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
