'use client';

import * as React from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, X } from 'lucide-react';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';

function toLink(id: string): EntryLink {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

function readTechName(entry: any, locale: string): string {
  const n = readLocalizedField(entry?.fields?.name, locale);
  if (n.trim()) return n;
  const nen = readLocalizedField(entry?.fields?.nameEn, locale);
  if (nen.trim()) return nen;
  return entry?.sys?.id ?? '';
}

async function fetchTechEntries(managementApiRoot: string, limit: number) {
  const q = new URLSearchParams({ contentType: 'tech', limit: String(limit), skip: '0' });
  const res = await fetch(`${managementApiRoot}/entries?${q}`, { cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load tech entries');
  return (data.items || []) as any[];
}

export function ProjectTechsPicker(props: {
  value: EntryLink[];
  onChange: (next: EntryLink[]) => void;
  managementApiRoot?: string;
  entryLocale: string;
}) {
  const { value, onChange, managementApiRoot = '/api/contentful', entryLocale } = props;
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<any[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await fetchTechEntries(managementApiRoot, 500);
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
  }, [managementApiRoot]);

  const selectedIds = React.useMemo(() => new Set(value.map((l) => l.sys.id)), [value]);

  const labelById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of candidates) {
      m[e.sys.id] = readTechName(e, entryLocale);
    }
    return m;
  }, [candidates, entryLocale]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((e) => {
      const lab = readTechName(e, entryLocale).toLowerCase();
      return lab.includes(q) || e.sys.id.toLowerCase().includes(q);
    });
  }, [candidates, entryLocale, query]);

  const toggle = React.useCallback(
    (id: string) => {
      const exists = value.some((l) => l.sys.id === id);
      if (exists) onChange(value.filter((l) => l.sys.id !== id));
      else onChange([...value, toLink(id)]);
    },
    [onChange, value],
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
          <span className="text-xs text-zinc-500">Sin tecnologías seleccionadas.</span>
        ) : (
          value.map((l) => (
            <Badge key={l.sys.id} variant="secondary" className="gap-1 pr-1 font-normal">
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

      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          type="button"
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit gap-2' })}
        >
          Seleccionar techs
          <ChevronDown className="h-4 w-4 opacity-70" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80 p-4" align="start">
          <div className="flex flex-col gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar techs…"
              className="h-8"
              onKeyDown={(e) => e.stopPropagation()}
            />
            {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
            <ScrollArea className="h-48 border border-neutral-200">
              <div className="p-1">
                {filtered.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-zinc-500">No hay coincidencias.</p>
                ) : (
                  filtered.map((e) => {
                    const id = e.sys.id as string;
                    const active = selectedIds.has(id);
                    const lab = readTechName(e, entryLocale);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          toggle(id);
                        }}
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
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
