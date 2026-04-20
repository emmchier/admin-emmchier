'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cmsChipToggleClassName } from '@/components/cms/chipStyles';
import { Check, Loader2, X } from 'lucide-react';
import type { EntryLink } from '@/components/cms/EntryReferenceMultiSelect';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { dedupeEntryLinks } from '@/lib/utils/dedupeEntryLinks';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { ensureContentfulModelLoaded } from '@/lib/store/ensureContentfulModelLoaded';
import { contentfulService } from '@/services/contentfulService';
import { cn } from '@/lib/utils';

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

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '');
}

/** Inline add row: compact width aligned with standard form controls (e.g. slug/title inputs). */
const ADD_INPUT_MAX_CLASS = 'w-full max-w-[240px]';

export function ProjectTechsPicker(props: {
  /** Field label row (left side); add-tech input renders on the right */
  heading: React.ReactNode;
  value: EntryLink[];
  onChange: (next: EntryLink[]) => void;
  managementApiRoot?: string;
  entryLocale: string;
}) {
  const { heading, value, onChange, managementApiRoot = '/api/contentful', entryLocale } = props;
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [quickAddError, setQuickAddError] = React.useState<string | null>(null);
  const [addInput, setAddInput] = React.useState('');
  const [creating, setCreating] = React.useState(false);

  const normalizedValue = React.useMemo(() => dedupeEntryLinks(value), [value]);

  const safeOnChange = React.useCallback(
    (next: EntryLink[]) => {
      onChange(dedupeEntryLinks(next));
    },
    [onChange],
  );

  const techRecord = useContentfulStore((s) => s.techs);
  const techLoaded = useContentfulStore((s) => s.loadedModels.tech);
  const candidates = React.useMemo(() => Object.values(techRecord) as any[], [techRecord]);

  const knownTechIds = React.useMemo(() => new Set(Object.keys(techRecord)), [techRecord]);

  /** Stale links (e.g. deleted tech entries) break publish with CMA `notResolvable` on `fields.techs`. */
  const [orphanTechsNote, setOrphanTechsNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!techLoaded) return;
    /** Without any tech in the catalog we cannot tell orphans from "not loaded yet". */
    if (knownTechIds.size === 0) return;
    const kept = normalizedValue.filter((l) => knownTechIds.has(l.sys.id));
    if (kept.length === normalizedValue.length) return;
    const removed = normalizedValue.length - kept.length;
    setOrphanTechsNote(
      removed === 1
        ? 'Se quitó 1 tech que ya no existe en este espacio (enlace roto en Contentful). Guarda para persistir.'
        : `Se quitaron ${removed} techs que ya no existen en este espacio. Guarda para persistir.`,
    );
    safeOnChange(kept);
  }, [techLoaded, knownTechIds, normalizedValue, safeOnChange]);

  React.useEffect(() => {
    let cancelled = false;
    if (techLoaded) return;
    void ensureContentfulModelLoaded('tech').catch((e) => {
      if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Error');
    });
    return () => {
      cancelled = true;
    };
  }, [techLoaded]);

  const selectedIds = React.useMemo(() => new Set(normalizedValue.map((l) => l.sys.id)), [normalizedValue]);

  const sortedCandidates = React.useMemo(() => {
    return [...candidates].sort((a, b) =>
      readTechName(a, entryLocale).localeCompare(readTechName(b, entryLocale), undefined, {
        sensitivity: 'base',
      }),
    );
  }, [candidates, entryLocale]);

  const toggle = React.useCallback(
    (id: string) => {
      const exists = normalizedValue.some((l) => l.sys.id === id);
      if (exists) safeOnChange(normalizedValue.filter((l) => l.sys.id !== id));
      else safeOnChange([...normalizedValue, toLink(id)]);
    },
    [normalizedValue, safeOnChange],
  );

  const findTechByTypedName = React.useCallback(
    (raw: string) => {
      const q = raw.trim().toLowerCase();
      if (!q) return undefined;
      return sortedCandidates.find((e) => readTechName(e, entryLocale).trim().toLowerCase() === q);
    },
    [sortedCandidates, entryLocale],
  );

  const createTechQuick = React.useCallback(
    async (nameRaw: string) => {
      const name = nameRaw.trim();
      const slug = slugifyTitle(name);
      if (!name || !slug) throw new Error('Nombre inválido');

      const space = contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
      const created = await contentfulService.createEntry({
        space,
        contentTypeId: 'tech',
        fields: { name, slug },
      });
      const id = String(created?.sys?.id ?? '');
      if (!id) throw new Error('Missing tech id');
      await contentfulService.publishEntry({ space, entryId: id });

      useContentfulStore.getState().upsertTech({
        sys: {
          id,
          contentType: { sys: { id: 'tech' } },
          updatedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        },
        fields: {
          name: { [entryLocale]: name },
          slug: { [entryLocale]: slug },
          order: { [entryLocale]: undefined },
        },
      } as any);

      return id;
    },
    [managementApiRoot, entryLocale],
  );

  const hasAddText = Boolean(addInput.trim());
  const canSubmitAdd = hasAddText && !creating;

  const commitAddInput = React.useCallback(async () => {
    const q = addInput.trim();
    if (!q || creating) return;

    const found = findTechByTypedName(q);
    if (found) {
      const id = found.sys.id as string;
      if (!selectedIds.has(id)) safeOnChange([...normalizedValue, toLink(id)]);
      setAddInput('');
      setQuickAddError(null);
      return;
    }

    setCreating(true);
    setQuickAddError(null);
    try {
      const id = await createTechQuick(q);
      safeOnChange([...normalizedValue, toLink(id)]);
      setAddInput('');
    } catch (e) {
      setQuickAddError(e instanceof Error ? e.message : 'No se pudo crear el tech');
    } finally {
      setCreating(false);
    }
  }, [
    addInput,
    creating,
    createTechQuick,
    findTechByTypedName,
    normalizedValue,
    safeOnChange,
    selectedIds,
  ]);

  const clearInput = React.useCallback(() => {
    setAddInput('');
    setQuickAddError(null);
  }, []);

  return (
    <div className="grid gap-4">
      {orphanTechsNote ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          {orphanTechsNote}
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 shrink">{heading}</div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex flex-nowrap items-center justify-end gap-2">
            <div className={cn('relative shrink-0', ADD_INPUT_MAX_CLASS)}>
              <Input
                value={addInput}
                onChange={(e) => {
                  setAddInput(e.target.value);
                  if (quickAddError) setQuickAddError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (canSubmitAdd) void commitAddInput();
                  }
                }}
                placeholder="Add tech"
                disabled={creating}
                className={cn('h-9', addInput.length > 0 ? 'pr-9' : 'pr-3')}
                aria-label="Add tech"
              />
              {addInput.length > 0 ? (
                <button
                  type="button"
                  className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                  aria-label="Clear"
                  onClick={clearInput}
                  disabled={creating}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              aria-label="Add tech to selection"
              disabled={!canSubmitAdd}
              onClick={() => void commitAddInput()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
          </div>
          {quickAddError ? <p className="max-w-[min(100%,320px)] text-right text-xs text-red-600">{quickAddError}</p> : null}
        </div>
      </div>

      <div className="grid gap-2">
        {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
        <div className="max-h-56 overflow-y-auto">
          <div className="flex flex-wrap gap-2">
            {!techLoaded ? (
              <p className="w-full py-6 text-center text-xs text-zinc-500">Cargando techs…</p>
            ) : sortedCandidates.length === 0 ? (
              <p className="w-full py-6 text-center text-xs text-zinc-500">No hay techs en el espacio.</p>
            ) : (
              sortedCandidates.map((e) => {
                const id = e.sys.id as string;
                const selected = selectedIds.has(id);
                const lab = readTechName(e, entryLocale);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(id)}
                    className={cmsChipToggleClassName(selected)}
                  >
                    <span className="min-w-0 truncate">{lab || id}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
