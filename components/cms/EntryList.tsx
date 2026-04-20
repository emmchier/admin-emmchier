'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
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
import type { ContentfulModelName, ContentfulStore } from '@/lib/store/contentfulStore';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';

const PAGE_SIZE = 10;

function readField(entry: any, fieldId: string, locale: string): string {
  if (fieldId === '__entryId__') return entry?.sys?.id ? String(entry.sys.id) : '';
  return readLocalizedField(entry?.fields?.[fieldId], locale);
}

function compactPageList(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const s = new Set<number>([1, totalPages, current, current - 1, current + 1]);
  const sorted = [...s].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}

function recordSelector(model: ContentfulModelName) {
  return (s: ContentfulStore) => {
    switch (model) {
      case 'project':
        return s.projects;
      case 'category':
        return s.categories;
      case 'navigationGroup':
        return s.navigationGroups;
      case 'tech':
        return s.techs;
    }
  };
}

const EMPTY_RECORD: Record<string, never> = {};

function sortByUpdatedDesc<T extends { sys?: { updatedAt?: string } }>(a: T, b: T): number {
  const ta = Date.parse(a.sys?.updatedAt ?? '') || 0;
  const tb = Date.parse(b.sys?.updatedAt ?? '') || 0;
  return tb - ta;
}

export type EntryListProps = {
  contentTypeId: string;
  entryLocale: string;
  /** Management API base path (ART default). */
  managementApiRoot?: string;
  /** When set, list is driven by Zustand + Delivery cache (no list GET on mount/navigation). */
  cacheModel?: ContentfulModelName;
  /** Plural heading, e.g. "Projects", "Categories" */
  entityPluralLabel: string;
  searchPlaceholder?: string;
  /** Field id used for the Title column (e.g. `title`, `name`) */
  primaryFieldId?: string;
  newLabel: string;
  refreshLabel?: string;
  refreshingLabel?: string;
  statusPublishedLabel?: string;
  statusDraftLabel?: string;
  onNew: () => void;
  onEdit: (entryId: string) => void;
  onDeleteMany?: (entryIds: string[]) => void | Promise<void>;
};

export function EntryList(props: EntryListProps) {
  const {
    contentTypeId,
    entryLocale,
    managementApiRoot = '/api/contentful',
    cacheModel,
    entityPluralLabel,
    searchPlaceholder = 'Search…',
    primaryFieldId = 'title',
    newLabel,
    refreshLabel = 'Refresh',
    refreshingLabel = 'Refreshing…',
    statusPublishedLabel = 'Published',
    statusDraftLabel = 'Draft',
    onNew,
    onEdit,
    onDeleteMany,
  } = props;

  const record = useContentfulStore(cacheModel ? recordSelector(cacheModel) : () => EMPTY_RECORD);
  const modelLoaded = useContentfulStore((s) => (cacheModel ? s.loadedModels[cacheModel] : true));

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
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  // IMPORTANT: This component never triggers model loading on mount.
  // The dashboard layer must call `contentfulService` on navigation/mutations.

  const cacheAllSorted = React.useMemo(() => {
    if (!cacheModel) return [];
    const arr = Object.values(record) as any[];
    arr.sort(sortByUpdatedDesc);
    return arr;
  }, [cacheModel, record]);

  const cacheFiltered = React.useMemo(() => {
    if (!cacheModel) return [];
    const q = debouncedSearch.toLowerCase();
    if (!q) return cacheAllSorted;
    return cacheAllSorted.filter((e) => {
      const primary = readField(e, primaryFieldId, entryLocale).toLowerCase();
      return primary.includes(q);
    });
  }, [cacheModel, cacheAllSorted, debouncedSearch, entryLocale, primaryFieldId]);

  const items = React.useMemo(() => {
    const data = cacheModel ? cacheFiltered : [];
    return data;
  }, [cacheFiltered, cacheModel]);

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
    if (!cacheModel) return;
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
  }, [cacheModel, record]);

  const total = cacheModel ? cacheFiltered.length : 0;

  // Refresh is global (header). Lists are cache-first + on-demand only.

  const showPagination = false;

  const cacheWaiting = Boolean(cacheModel && !modelLoaded);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="grid min-h-0 flex-1 grid-cols-12">
        <div className="col-span-12 flex min-h-0 flex-1 flex-col lg:col-start-3 lg:col-span-8">
          <div className="shrink-0 space-y-3 px-4 pt-0">
            <div className="flex flex-row flex-wrap items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-neutral-900">
                {entityPluralLabel}
                <span className="ml-2 font-normal text-neutral-500">({total})</span>
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <Button type="button" onClick={onNew}>
                  {newLabel}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={searchPlaceholder}
                className="max-w-sm min-w-48"
                aria-label="Filter entries"
              />
              {onDeleteMany && selectedIds.size > 0 ? (
                <div className="flex w-full items-center justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-0 min-h-0 flex-1 pt-0">
            <div className="px-4">
            {error ? (
              <p className="mb-4 border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</p>
            ) : null}

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
                  {cacheWaiting ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-neutral-500">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!cacheWaiting &&
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
                          <TableCell className="text-left text-sm text-neutral-600">
                            {new Date(e.sys.updatedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="w-12 min-w-12 px-4 text-left text-neutral-400">
                            <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
            </div>
          </div>
        </div>
      </div>
      {onDeleteMany ? (
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
      ) : null}
    </div>
  );
}
