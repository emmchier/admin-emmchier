'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { dedupeEntryLinks } from '@/lib/utils/dedupeEntryLinks';
import { contentfulService } from '@/services/contentfulService';

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

  const metaById = React.useMemo(() => {
    const m: Record<string, { label: string; contentTypeId: string }> = {};
    for (const { entry, contentTypeId } of rows) {
      m[entry.sys.id] = { label: readEntryLabel(entry, entryLocale), contentTypeId };
    }
    return m;
  }, [rows, entryLocale]);

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

  const remove = React.useCallback(
    (id: string) => {
      safeOnChange(normalizedValue.filter((l) => l.sys.id !== id));
    },
    [normalizedValue, safeOnChange],
  );

  return (
    <div className="grid gap-2">
      <div className="flex min-h-9 flex-wrap gap-2">
        {normalizedValue.length === 0 ? (
          <span className="text-xs text-zinc-500">Ninguno seleccionado.</span>
        ) : (
          normalizedValue.map((l, idx) => {
            const meta = metaById[l.sys.id];
            const lab = meta?.label ?? l.sys.id;
            const tl = meta ? typeLabel(meta.contentTypeId) : '';
            return (
              <Badge key={`${l.sys.id}-${idx}`} variant="secondary" className="gap-1 pr-1 font-normal">
                {tl ? (
                  <span className="rounded bg-zinc-300/80 px-1 text-[10px] font-medium text-zinc-800">{tl}</span>
                ) : null}
                <span className="max-w-[200px] truncate">{lab}</span>
                <button
                  type="button"
                  className="rounded p-0.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                  aria-label={`Quitar ${lab}`}
                  onClick={() => remove(l.sys.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            );
          })
        )}
      </div>

      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />

      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}

      <ScrollArea className="h-52 border border-neutral-200">
        <div className="p-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">{emptyListHint}</p>
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
                  onClick={() => toggle(id)}
                  className={[
                    'flex w-full items-center gap-2 rounded-md px-4 py-4 text-left text-sm transition',
                    active ? 'bg-zinc-900 text-white' : 'text-zinc-800 hover:bg-zinc-100',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                      active ? 'bg-white/20 text-white' : 'bg-zinc-200 text-zinc-700',
                    ].join(' ')}
                  >
                    {tl}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{lab || id}</span>
                  <span className="shrink-0 font-mono text-[10px] opacity-70">{active ? '✓' : '+'}</span>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
