'use client';

import * as React from 'react';
import { ChevronDown, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetScrollBody,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { buttonVariants } from '@/components/ui/button';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { dedupeEntryLinks } from '@/lib/utils/dedupeEntryLinks';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { useHubStore } from '@/lib/store/hubStore';
import { ensureHubModelLoaded } from '@/lib/store/ensureHubModelLoaded';
import { upsertHubEntryFromManagementApi } from '@/lib/store/syncHubEntryFromManagement';
import { contentfulService } from '@/services/contentfulService';

function toLink(id: string): EntryLink {
  return { sys: { type: 'Link', linkType: 'Entry', id } };
}

function readTechLabel(entry: any, locale: string): string {
  const n = readLocalizedField(entry?.fields?.nameEn, locale);
  if (n.trim()) return n;
  const es = readLocalizedField(entry?.fields?.nameEs, locale);
  if (es.trim()) return es;
  return entry?.sys?.id ?? '';
}

export function HubTechsPicker(props: {
  value: EntryLink[];
  onChange: (next: EntryLink[]) => void;
  entryLocale: string;
  managementApiRoot?: string;
}) {
  const { value, onChange, entryLocale, managementApiRoot = '/api/contentful/hub' } = props;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [newNameEn, setNewNameEn] = React.useState('');
  const [newNameEs, setNewNameEs] = React.useState('');

  const techRecord = useHubStore((s) => s.techs);
  const techLoaded = useHubStore((s) => s.loaded.tech);

  React.useEffect(() => {
    let cancelled = false;
    if (techLoaded) return;
    void ensureHubModelLoaded('tech').catch((e) => {
      if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error');
    });
    return () => {
      cancelled = true;
    };
  }, [techLoaded]);

  const candidates = React.useMemo(() => Object.values(techRecord) as any[], [techRecord]);

  const normalizedValue = React.useMemo(() => dedupeEntryLinks(value), [value]);
  const selectedIds = React.useMemo(() => new Set(normalizedValue.map((l) => l.sys.id)), [normalizedValue]);

  const labelById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of candidates) m[e.sys.id] = readTechLabel(e, entryLocale);
    return m;
  }, [candidates, entryLocale]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((e) => {
      const lab = readTechLabel(e, entryLocale).toLowerCase();
      return lab.includes(q) || String(e?.sys?.id ?? '').toLowerCase().includes(q);
    });
  }, [candidates, entryLocale, query]);

  const safeOnChange = React.useCallback(
    (next: EntryLink[]) => {
      onChange(dedupeEntryLinks(next));
    },
    [onChange],
  );

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
          normalizedValue.map((l, idx) => (
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

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger type="button" className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-fit gap-2' })}>
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
              <ScrollArea className="h-56 border border-neutral-200">
                <div className="p-1">
                  {!techLoaded ? (
                    <p className="px-4 py-6 text-center text-xs text-zinc-500">Cargando techs…</p>
                  ) : filtered.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-zinc-500">No hay coincidencias.</p>
                  ) : (
                    filtered.map((e) => {
                      const id = String(e?.sys?.id ?? '');
                      if (!id) return null;
                      const active = selectedIds.has(id);
                      const lab = readTechLabel(e, entryLocale);
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
          </DropdownMenuContent>
        </DropdownMenu>

        <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
          + Crear Tech
        </Button>
      </div>

      <Sheet
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) {
            setNewNameEn('');
            setNewNameEs('');
            setLoadError(null);
          }
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Crear Tech</SheetTitle>
            <SheetDescription>Creación inline para continuar el flujo de Experience.</SheetDescription>
          </SheetHeader>
          <SheetScrollBody className="space-y-4 pt-2">
            <div className="grid gap-2">
              <Label htmlFor="hub-tech-name-en">Name EN</Label>
              <Input id="hub-tech-name-en" value={newNameEn} onChange={(e) => setNewNameEn(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hub-tech-name-es">Name ES</Label>
              <Input id="hub-tech-name-es" value={newNameEs} onChange={(e) => setNewNameEs(e.target.value)} />
            </div>
            {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
          </SheetScrollBody>
          <SheetFooter className="flex-row flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={creating || !newNameEn.trim() || !newNameEs.trim()}
              onClick={async () => {
                if (creating) return;
                const nameEn = newNameEn.trim();
                const nameEs = newNameEs.trim();
                if (!nameEn || !nameEs) return;
                setCreating(true);
                setLoadError(null);
                try {
                  const space = contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
                  const created = await contentfulService.createEntry({ space, contentTypeId: 'tech', fields: { nameEn, nameEs } });
                  const id = String(created?.sys?.id ?? '');
                  if (!id) throw new Error('Missing tech id');

                  await contentfulService.publishEntry({ space, entryId: id });

                  await upsertHubEntryFromManagementApi('tech', id);

                  safeOnChange([...normalizedValue, toLink(id)]);
                  setCreateOpen(false);
                } catch (e) {
                  setLoadError(e instanceof Error ? e.message : 'Error');
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

