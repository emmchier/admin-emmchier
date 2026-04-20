'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { dedupeEntryLinks } from '@/lib/utils/dedupeEntryLinks';
import { contentfulService } from '@/services/contentfulService';
import { cn } from '@/lib/utils';

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

const DEFAULT_TYPE_LABEL: Record<string, string> = {
  project: 'Project',
  navigationGroup: 'Navigation group',
  tech: 'Tech',
  imageAsset: 'Image',
};

type Row = { entry: any; contentTypeId: string };

export function EntryReferenceMultiTypeSelect(props: {
  value: EntryLink[];
  onChange: (next: EntryLink[]) => void;
  managementApiRoot?: string;
  sourceContentTypeIds: string[];
  entryLocale: string;
  fullWidth?: boolean;
  halfWidthSearch?: boolean;
  typeLabels?: Record<string, string>;
  searchPlaceholder?: string;
  emptyListHint?: string;
}) {
  const {
    value,
    onChange,
    managementApiRoot = '/api/contentful',
    sourceContentTypeIds,
    entryLocale,
    fullWidth = false,
    halfWidthSearch = false,
    typeLabels,
  searchPlaceholder = 'Search…',
    emptyListHint = 'No hay coincidencias.',
  } = props;

  const [rows, setRows] = React.useState<Row[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const normalizedValue = React.useMemo(() => dedupeEntryLinks(value), [value]);
  const safeOnChange = React.useCallback(
    (next: EntryLink[]) => {
      onChange(dedupeEntryLinks(next));
    },
    [onChange],
  );

  const typeLabel = React.useCallback(
    (ctId: string) => typeLabels?.[ctId] ?? DEFAULT_TYPE_LABEL[ctId] ?? ctId,
    [typeLabels],
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const space = contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
        const chunks = await Promise.all(
          sourceContentTypeIds.map(async (ctId) => {
            const items = await contentfulService.getEntriesCached({ space, contentTypeId: ctId });
            return items.map((entry) => ({ entry, contentTypeId: ctId } as Row));
          }),
        );
        if (!cancelled) {
          setRows(chunks.flat());
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managementApiRoot, sourceContentTypeIds]);

  const selectedIds = React.useMemo(() => new Set(normalizedValue.map((l) => l.sys.id)), [normalizedValue]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ entry, contentTypeId }) => {
      const label = readEntryLabel(entry, entryLocale).toLowerCase();
      const tlab = typeLabel(contentTypeId).toLowerCase();
      return label.includes(q) || entry.sys.id.toLowerCase().includes(q) || tlab.includes(q);
    });
  }, [rows, entryLocale, query, typeLabel]);

  const toggle = React.useCallback(
    (id: string) => {
      const exists = normalizedValue.some((l) => l.sys.id === id);
      if (exists) safeOnChange(normalizedValue.filter((l) => l.sys.id !== id));
      else safeOnChange([...normalizedValue, toLink(id)]);
    },
    [normalizedValue, safeOnChange],
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
              filtered.map(({ entry, contentTypeId }) => {
                const id = entry.sys.id as string;
                const active = selectedIds.has(id);
                const lab = readEntryLabel(entry, entryLocale);
                const tl = typeLabel(contentTypeId);
                return (
                  <button
                    key={`${contentTypeId}-${id}`}
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
                    <span
                      className={[
                        'inline-flex h-8 shrink-0 items-center rounded-md border bg-transparent px-3 text-sm font-medium',
                        active
                          ? 'border-zinc-500 text-zinc-900'
                          : 'border-neutral-300 text-zinc-800',
                      ].join(' ')}
                    >
                      {tl}
                    </span>
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
