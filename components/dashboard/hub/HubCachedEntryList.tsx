'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import type { HubModelName } from '@/lib/store/hubStore';
import { useHubStore } from '@/lib/store/hubStore';

const PAGE_SIZE = 8;

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
  newLabel: string;
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const { model, entryLocale, entityPluralLabel, primaryFieldId, newLabel, onNew, onEdit } = props;
  const record = useHubStore(selectRecord(model));
  const loaded = useHubStore((s) => s.loaded[model]);

  const [error, setError] = React.useState<string | null>(null);
  const [searchInput, setSearchInput] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchInput.trim();
      setDebouncedSearch((prev) => {
        if (prev !== next) setPage(1);
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

  const filtered = React.useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    if (!q) return allSorted;
    return allSorted.filter((e) => readField(e, primaryFieldId, entryLocale).toLowerCase().includes(q));
  }, [allSorted, debouncedSearch, entryLocale, primaryFieldId]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageItems = React.useMemo(() => compactPageList(page, totalPages), [page, totalPages]);
  const showPagination = total > PAGE_SIZE;

  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const items = React.useMemo(() => {
    const skip = (page - 1) * PAGE_SIZE;
    return filtered.slice(skip, skip + PAGE_SIZE);
  }, [filtered, page]);

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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search…"
                className="mb-4 max-w-sm min-w-48"
                aria-label="Filter entries"
              />
              {showPagination ? (
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent className="flex-wrap justify-end">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        text="Previous"
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
                            className={p === page ? 'pointer-events-none cursor-default' : ''}
                            onClick={(e) => {
                              e.preventDefault();
                              if (p === page) return;
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
                        text="Next"
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

          <div className="mt-0 min-h-0 flex-1 overflow-auto pb-[72px] pt-0">
            <div className="px-4">
            {error ? <p className="mb-4 border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</p> : null}

            <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              <Table className="w-full border-collapse text-left [&_td]:px-4 [&_td]:py-4 [&_td]:text-left [&_th]:px-4 [&_th]:py-4 [&_th]:text-left">
                <TableHeader className="[&_tr]:border-0">
                  <TableRow className="border-0 border-b border-neutral-200 bg-neutral-100 hover:bg-neutral-100">
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
                      <TableCell colSpan={4} className="text-sm text-neutral-500">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {loaded &&
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
                          aria-label={`Edit: ${primary || 'entry'}`}
                        >
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

