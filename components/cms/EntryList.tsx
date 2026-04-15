'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import type { ContentfulModelName, ContentfulStore } from '@/lib/store/contentfulStore';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { ensureContentfulModelLoaded } from '@/lib/store/ensureContentfulModelLoaded';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { isEntryPublished } from '@/lib/contentful/isEntryPublished';

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
};

async function fetchEntriesRemote(
  managementApiRoot: string,
  contentTypeId: string,
  limit: number,
  skip: number,
  query?: string,
): Promise<{ items: any[]; total: number }> {
  const q = new URLSearchParams({
    contentType: contentTypeId,
    limit: String(limit),
    skip: String(skip),
  });
  if (query?.trim()) q.set('q', query.trim());
  const res = await fetch(`${managementApiRoot}/entries?${q.toString()}`, { method: 'GET', cache: 'no-store' });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error || 'Failed to load entries');
  const total = typeof data.total === 'number' ? data.total : (data.items?.length ?? 0);
  return { items: data.items || [], total };
}

export function EntryList(props: EntryListProps) {
  const {
    contentTypeId,
    entryLocale,
    managementApiRoot = '/api/contentful',
    cacheModel,
    entityPluralLabel,
    searchPlaceholder = 'Buscar…',
    primaryFieldId = 'title',
    newLabel,
    refreshLabel = 'Refresh',
    refreshingLabel = 'Refreshing…',
    statusPublishedLabel = 'Published',
    statusDraftLabel = 'Draft',
    onNew,
    onEdit,
  } = props;

  const record = useContentfulStore(cacheModel ? recordSelector(cacheModel) : () => EMPTY_RECORD);
  const modelLoaded = useContentfulStore((s) => (cacheModel ? s.loadedModels[cacheModel] : true));

  const [remoteItems, setRemoteItems] = React.useState<any[]>([]);
  const [remoteTotal, setRemoteTotal] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchInput.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) setPage(1);
        return next;
      });
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const loadRemote = React.useCallback(async () => {
    if (cacheModel) return;
    setBusy(true);
    setError(null);
    try {
      const skip = (page - 1) * PAGE_SIZE;
      const data = await fetchEntriesRemote(managementApiRoot, contentTypeId, PAGE_SIZE, skip, debouncedSearch);
      setRemoteItems(data.items || []);
      setRemoteTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entries');
    } finally {
      setBusy(false);
    }
  }, [cacheModel, contentTypeId, managementApiRoot, page, debouncedSearch]);

  React.useEffect(() => {
    if (cacheModel) return;
    void loadRemote();
  }, [cacheModel, loadRemote]);

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
    if (!cacheModel) return remoteItems;
    const skip = (page - 1) * PAGE_SIZE;
    return cacheFiltered.slice(skip, skip + PAGE_SIZE);
  }, [cacheModel, cacheFiltered, page, remoteItems]);

  const total = cacheModel ? cacheFiltered.length : remoteTotal;

  const loadCacheRefresh = React.useCallback(async () => {
    if (!cacheModel) return;
    setBusy(true);
    setError(null);
    try {
      await ensureContentfulModelLoaded(cacheModel, { force: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setBusy(false);
    }
  }, [cacheModel]);

  const load = cacheModel ? loadCacheRefresh : loadRemote;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = compactPageList(page, totalPages);
  const showPagination = total > PAGE_SIZE;

  const cacheWaiting = Boolean(cacheModel && !modelLoaded);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="shrink-0 space-y-3 px-4 pt-0">
        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-neutral-900">
            {entityPluralLabel}
            <span className="ml-2 font-normal text-neutral-500">({total})</span>
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={() => void load()} disabled={busy || cacheWaiting}>
              {busy ? refreshingLabel : refreshLabel}
            </Button>
            <Button type="button" onClick={onNew}>
              {newLabel}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={searchPlaceholder}
            className="max-w-sm min-w-48"
            aria-label="Filtrar entradas"
          />
          {showPagination ? (
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent className="flex-wrap justify-end">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text="Anterior"
                    className={page <= 1 ? 'pointer-events-none opacity-40' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage((p) => p - 1);
                    }}
                  />
                </PaginationItem>
                {pageItems.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`e-${idx}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        href="#"
                        isActive={p === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(p);
                        }}
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text="Siguiente"
                    className={page >= totalPages ? 'pointer-events-none opacity-40' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < totalPages) setPage((p) => p + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          ) : null}
        </div>
      </div>

      <div className="mt-0 min-h-0 flex-1 overflow-auto px-4 pb-0 pt-4">
        {error ? (
          <p className="mb-4 border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <Table className="w-full border-collapse text-left [&_td]:px-4 [&_td]:py-4 [&_td]:text-left [&_th]:px-4 [&_th]:py-4 [&_th]:text-left">
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 border-b border-neutral-200 bg-neutral-100 hover:bg-neutral-100">
                <TableHead className="h-auto text-left text-neutral-700">Title</TableHead>
                <TableHead className="h-auto text-left text-neutral-700">Status</TableHead>
                <TableHead className="h-auto text-left text-neutral-700">Updated</TableHead>
                <TableHead className="h-auto w-12 min-w-12 px-4 text-left text-neutral-700">
                  <span className="sr-only">Abrir detalle</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cacheWaiting ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-neutral-500">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : null}
              {!cacheWaiting &&
                items.map((e) => {
                  const primary = readField(e, primaryFieldId, entryLocale);
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
                      aria-label={`Editar: ${primary || 'entrada'}`}
                    >
                      <TableCell className="text-left font-medium">{primary}</TableCell>
                      <TableCell className="text-left">
                        {isEntryPublished(e.sys) ? (
                          <Badge
                            variant="default"
                            className="border-transparent bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-600"
                          >
                            {statusPublishedLabel}
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="border-amber-200 bg-amber-100 text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-50 dark:hover:bg-amber-950/60"
                          >
                            {statusDraftLabel}
                          </Badge>
                        )}
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
  );
}
