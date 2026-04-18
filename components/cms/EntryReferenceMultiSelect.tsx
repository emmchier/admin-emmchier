'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { contentfulService } from '@/services/contentfulService';

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
  searchPlaceholder?: string;
  emptyListHint?: string;
}) {
  const {
    value,
    onChange,
    managementApiRoot = '/api/contentful',
    sourceContentTypeId,
    entryLocale,
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

  const labelById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of candidates) {
      m[e.sys.id] = readEntryLabel(e, entryLocale);
    }
    return m;
  }, [candidates, entryLocale]);

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

  const remove = React.useCallback(
    (id: string) => {
      onChange(value.filter((l) => l.sys.id !== id));
    },
    [onChange, value],
  );

  return (
    <div className="grid gap-2">
      <div className="flex min-h-9 flex-wrap gap-2">
        {value.length === 0 ? (
          <span className="text-xs text-zinc-500">Ninguno seleccionado.</span>
        ) : (
          value.map((l, idx) => (
            <Badge key={`${l.sys.id}-${idx}`} variant="secondary" className="gap-1 pr-1 font-normal">
              <span className="max-w-[220px] truncate">{labelById[l.sys.id] || l.sys.id}</span>
              <button
                type="button"
                className="rounded p-0.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
                aria-label={`Quitar ${labelById[l.sys.id] || l.sys.id}`}
                onClick={() => remove(l.sys.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))
        )}
      </div>

      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} />

      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}

      <ScrollArea className="h-48 border border-neutral-200">
        <div className="p-1">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-zinc-500">{emptyListHint}</p>
          ) : (
            filtered.map((e) => {
              const id = e.sys.id as string;
              const active = selectedIds.has(id);
              const lab = readEntryLabel(e, entryLocale);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggle(id)}
                  className={[
                    'flex w-full items-center justify-between gap-2 rounded-md px-4 py-4 text-left text-sm transition',
                    active ? 'bg-zinc-900 text-white' : 'text-zinc-800 hover:bg-zinc-100',
                  ].join(' ')}
                >
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
