'use client';

import * as React from 'react';
import { ChevronRight, ClipboardList } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from '@/lib/ui/snackbar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import type { HubModelName } from '@/lib/store/hubStore';
import { useHubStore } from '@/lib/store/hubStore';

function readField(entry: any, fieldId: string, locale: string): string {
  if (fieldId === '__entryId__') return entry?.sys?.id ? String(entry.sys.id) : '';
  return readLocalizedField(entry?.fields?.[fieldId], locale);
}

function sortByUpdatedDesc<T extends { sys?: { updatedAt?: string } }>(a: T, b: T): number {
  const ta = Date.parse(a.sys?.updatedAt ?? '') || 0;
  const tb = Date.parse(b.sys?.updatedAt ?? '') || 0;
  return tb - ta;
}

function selectRecord(model: HubModelName) {
  return (s: any) => {
    switch (model) {
      case 'contact':
        return s.contacts;
      case 'socialNetwork':
        return s.socialNetworks;
      case 'experience':
        return s.experiences;
      case 'course':
        return s.courses;
      case 'study':
        return s.studies;
      case 'language':
        return s.languages;
      case 'tech':
        return s.techs;
    }
  };
}

export function HubCachedEntryList(props: {
  model: HubModelName;
  contentTypeId: string;
  entryLocale: string;
  entityPluralLabel: string;
  primaryFieldId: string;
  newLabel?: string;
  onNew?: () => void;
  headerRight?: React.ReactNode;
  headerBelowTitle?: React.ReactNode;
  searchInputClassName?: string;
  newButtonPlacement?: 'title' | 'search';
  newButtonClassName?: string;
  onEdit: (id: string) => void;
  onDeleteMany?: (entryIds: string[]) => void | Promise<void>;
  /** When true, render without its own centered page layout (for embedding inside another centered container). */
  embedded?: boolean;
  /**
   * When set (including `[]`), only these entry IDs are listed, in this order (e.g. Resume references).
   * When omitted, all cached entries of the model are shown.
   */
  restrictToEntryIds?: string[];
  /** Copy for the illustration empty state (resume-linked sections). */
  emptyStateTitle?: string;
  emptyStateDescription?: string;
  /** Use CV-specific empty copy (resume-linked sections). Otherwise generic list copy (e.g. Contacts). */
  emptyCopyScope?: 'resume' | 'generic';
}) {
  const {
    model,
    entryLocale,
    entityPluralLabel,
    primaryFieldId,
    newLabel,
    onNew,
    headerRight,
    headerBelowTitle,
    searchInputClassName,
    newButtonPlacement = 'title',
    newButtonClassName,
    onEdit,
    onDeleteMany,
    embedded = false,
    restrictToEntryIds,
    emptyStateTitle,
    emptyStateDescription,
    emptyCopyScope = 'generic',
  } = props;
  const record = useHubStore(selectRecord(model));
  const loaded = useHubStore((s) => s.loaded[model]);

  const [error, setError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchInput.trim();
      setDebouncedSearch((prev) => {
        return next;
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // IMPORTANT: this list never triggers loading on mount.
  // The dashboard layer must call `contentfulService` on navigation/mutations (Zustand-first).

  const allSorted = React.useMemo(() => {
    const arr = Object.values(record) as any[];
    arr.sort(sortByUpdatedDesc);
    return arr;
  }, [record]);

  const scopeSorted = React.useMemo(() => {
    if (restrictToEntryIds === undefined) return allSorted;
    const uniqueIds = [...new Set(restrictToEntryIds)];
    const byId = new Map(allSorted.map((e) => [String((e as any)?.sys?.id ?? ''), e]));
    return uniqueIds.map((id) => byId.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));
  }, [allSorted, restrictToEntryIds]);

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return scopeSorted;
    return scopeSorted.filter((e) => readField(e, primaryFieldId, entryLocale).toLowerCase().includes(q));
  }, [scopeSorted, debouncedSearch, entryLocale, primaryFieldId]);

  const total = filtered.length;
  const items = filtered;

  const sectionEmpty = loaded && scopeSorted.length === 0;
  const emptyTitle = emptyStateTitle ?? 'Esta sección está vacía';
  const emptyDesc =
    emptyStateDescription ??
    (emptyCopyScope === 'resume'
      ? newLabel
        ? `No hay ${entityPluralLabel} vinculados al CV. Pulsa «${newLabel}» para añadir el primero.`
        : `No hay ${entityPluralLabel} vinculados al CV.`
      : newLabel
        ? `No hay ${entityPluralLabel}. Pulsa «${newLabel}» para crear el primero.`
        : `No hay ${entityPluralLabel}.`);

  const showToolbarSearch = loaded && scopeSorted.length > 0;

  const allVisibleIds = React.useMemo(
    () => items.map((e) => String((e as any)?.sys?.id ?? '')).filter(Boolean),
    [items],
  );
  const allVisibleSelected =
    allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    allVisibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  const headerCheckboxRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = someVisibleSelected;
  }, [someVisibleSelected]);

  React.useEffect(() => {
    const exists = new Set(Object.keys(record));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (exists.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [record]);

  const inner = (
    <>
      <div className={embedded ? 'shrink-0 space-y-3 px-0 pt-0' : 'shrink-0 space-y-3 px-4 pt-0'}>
            <div className="flex flex-row flex-wrap items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">
                {entityPluralLabel}
                <span className="ml-2 font-normal text-neutral-500">({total})</span>
              </h2>
              {headerRight ? (
                <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
              ) : onNew && newLabel && newButtonPlacement === 'title' ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Button type="button" onClick={onNew} className={newButtonClassName}>
                    {newLabel}
                  </Button>
                </div>
              ) : null}
            </div>

            {headerBelowTitle ? <div className="mt-6">{headerBelowTitle}</div> : null}

            {showToolbarSearch ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search…"
                  className={searchInputClassName ?? 'max-w-sm min-w-48'}
                  aria-label="Filter entries"
                />

                <div className="flex items-center gap-2">
                  {onDeleteMany && selectedIds.size > 0 ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setConfirmDeleteOpen(true)}
                    >
                      Delete
                    </Button>
                  ) : null}

                  {onNew && newLabel && newButtonPlacement === 'search' ? (
                    <Button
                      type="button"
                      onClick={onNew}
                      className={newButtonClassName}
                    >
                      {newLabel}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

      <div className="mt-4 min-h-0 flex-1 pt-0">
        <div className={embedded ? 'px-0' : 'px-4'}>
            {error ? <p className="mb-4 border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</p> : null}

            {sectionEmpty ? (
              <div
                className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-14 text-center"
                role="status"
                aria-label={emptyTitle}
              >
                <div className="relative mb-6 text-neutral-300" aria-hidden>
                  <svg
                    viewBox="0 0 200 140"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-[140px] w-[200px] max-w-full"
                  >
                    <rect x="14" y="18" width="172" height="104" rx="10" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M34 46h132M34 66h92M34 86h116" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
                    <rect x="150" y="34" width="36" height="36" rx="18" fill="currentColor" fillOpacity="0.08" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center pt-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200/80">
                      <ClipboardList className="h-5 w-5 text-neutral-500" strokeWidth={1.75} aria-hidden />
                    </span>
                  </div>
                </div>
                <p className="text-sm font-semibold text-neutral-900">{emptyTitle}</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-neutral-600">{emptyDesc}</p>
              </div>
            ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <Table className="w-full border-collapse text-left [&_td]:px-4 [&_td]:py-4 [&_td]:text-left [&_th]:px-4 [&_th]:py-4 [&_th]:text-left">
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 border-b border-neutral-200 bg-neutral-100 hover:bg-neutral-100">
                    <TableHead className="h-auto w-12 min-w-12 px-4 text-left text-neutral-700">
                      <input
                        ref={headerCheckboxRef}
                        type="checkbox"
                        role="checkbox"
                        className="h-4 w-4 cursor-pointer accent-neutral-900"
                        checked={allVisibleSelected}
                        aria-label="Select all"
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            for (const id of allVisibleIds) {
                              if (checked) next.add(id);
                              else next.delete(id);
                            }
                            return next;
                          });
                        }}
                      />
                    </TableHead>
                    <TableHead className="h-auto text-left text-neutral-700">Title</TableHead>
                    <TableHead className="h-auto text-left text-neutral-700">Status</TableHead>
                    <TableHead className="h-auto text-left text-neutral-700">Updated</TableHead>
                    <TableHead className="h-auto w-12 min-w-12 px-4 text-left text-neutral-700">
                      <span className="sr-only">Open details</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loaded ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-neutral-500">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {loaded && items.length === 0 && scopeSorted.length > 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-neutral-500">
                        No hay resultados para tu búsqueda.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {loaded &&
                    items.map((e) => {
                      const primary = readField(e, primaryFieldId, entryLocale);
                      const id = String((e as any)?.sys?.id ?? '');
                      const checked = Boolean(id && selectedIds.has(id));
                      return (
                        <TableRow
                          key={e.sys.id}
                          tabIndex={0}
                          className="cursor-pointer border-x-0 border-t-0 border-b border-neutral-200 hover:bg-neutral-50/80 last:border-b-0"
                          onClick={() => onEdit(e.sys.id)}
                          onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                              ev.preventDefault();
                              onEdit(e.sys.id);
                            }
                          }}
                          aria-label={`Edit: ${primary || 'entry'}`}
                        >
                          <TableCell className="w-12 min-w-12 px-4 text-left">
                            <input
                              type="checkbox"
                              role="checkbox"
                              className="h-4 w-4 cursor-pointer accent-neutral-900"
                              checked={checked}
                              aria-label={`Select ${primary || 'entry'}`}
                              onClick={(ev) => ev.stopPropagation()}
                              onChange={(ev) => {
                                const nextChecked = ev.target.checked;
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (!id) return next;
                                  if (nextChecked) next.add(id);
                                  else next.delete(id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-left font-medium">{primary}</TableCell>
                          <TableCell className="text-left">
                            <StatusBadge entry={e} />
                          </TableCell>
                          <TableCell className="text-left text-sm text-neutral-600">{new Date(e.sys.updatedAt).toLocaleString()}</TableCell>
                          <TableCell className="w-12 min-w-12 px-4 text-left text-neutral-400">
                            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            )}
        </div>
      </div>
    </>
  );

  const dialog = onDeleteMany ? (
    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete entries?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {selectedIds.size} selected item(s).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void (async () => {
                const ids = Array.from(selectedIds);
                try {
                  await onDeleteMany(ids);
                  toast.success('Deleted');
                  setSelectedIds(new Set());
                  setConfirmDeleteOpen(false);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to delete');
                }
              })();
            }}
            className="bg-red-600 hover:bg-red-600/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  return embedded ? (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {inner}
      {dialog}
    </div>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="grid min-h-0 flex-1 grid-cols-12">
        <div className="col-span-12 flex min-h-0 flex-1 flex-col lg:col-start-3 lg:col-span-8">
          {inner}
          {dialog}
        </div>
      </div>
    </div>
  );
}

