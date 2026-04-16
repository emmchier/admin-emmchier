'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SchemaDrivenEntryForm } from '@/components/cms/SchemaDrivenEntryForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { buttonVariants } from '@/components/ui/button';
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
import { ArrowLeft, Eye, EyeOff, Loader2, MoreVertical } from 'lucide-react';
import { toast } from '@/lib/ui/snackbar';
import { useProjectEditorStore } from '@/lib/stores/projectEditorStore';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { isEntryPublished } from '@/lib/contentful/isEntryPublished';
import { useContentfulStore } from '@/lib/store/contentfulStore';

const contentTypeCache = new Map<string, any>();
const contentTypeInflight = new Map<string, Promise<any>>();

export type EntryEditorMode = 'create' | 'edit';

export type EntryEditorActions = {
  createEntryAction: (args: { contentTypeId: string; fields: Record<string, any> }) => Promise<{ id: string }>;
  updateEntryAction: (args: { entryId: string; fields: Record<string, any> }) => Promise<{ ok: boolean }>;
  deleteEntryAction: (entryId: string) => Promise<{ ok: boolean }>;
  publishEntryAction: (entryId: string) => Promise<{ ok: boolean }>;
  unpublishEntryAction: (entryId: string) => Promise<{ ok: boolean }>;
};

export type EntryEditorLabels = {
  createSubtitle: string;
  createEmptyTitle: string;
  editEmptyTitle: string;
  loading: string;
  save: string;
  createSubmit: string;
  publish: string;
  unpublish: string;
  refresh: string;
  moreAria: string;
  deleteMenu: string;
  deleteDialogTitle: string;
  deleteDialogDescription: (liveTitle: string) => string;
  cancel: string;
  deleteConfirm: string;
  publishedBadge: string;
  draftBadge: string;
  savedToast: string;
  publishToast: string;
  unpublishToast: string;
  refreshToast: string;
  refreshError: string;
  saveError: string;
  untitled: string;
};

const defaultLabelsEs: EntryEditorLabels = {
  createSubtitle: 'Nuevo registro',
  createEmptyTitle: 'Nuevo registro',
  editEmptyTitle: 'Entrada',
  loading: 'Cargando…',
  save: 'Guardar cambios',
  createSubmit: 'Crear',
  publish: 'Publicar',
  unpublish: 'Ocultar',
  refresh: 'Refresh',
  moreAria: 'Más',
  deleteMenu: 'Eliminar',
  deleteDialogTitle: 'Eliminar',
  deleteDialogDescription: (liveTitle) => `¿Estás seguro que querés eliminar '${liveTitle}'?`,
  cancel: 'Cancelar',
  deleteConfirm: 'Eliminar',
  publishedBadge: 'Publicado',
  draftBadge: 'Borrador',
  savedToast: 'Cambios guardados y publicados',
  publishToast: 'Publicado',
  unpublishToast: 'Oculto',
  refreshToast: 'Actualizado',
  refreshError: 'Error al actualizar',
  saveError: 'Error al guardar',
  untitled: 'Sin título',
};

export type EntryEditorProps = {
  contentTypeId: string;
  entryLocale: string;
  contentfulSpaceId: string;
  /** Management API base (default ART). */
  managementApiRoot?: string;
  actions: EntryEditorActions;
  mode: EntryEditorMode;
  entryId: string | null;
  onBack: () => void;
  onCreated: (id: string) => void;
  /** Field used for header + delete copy (default `title`) */
  displayTitleFieldId?: string;
  labels?: Partial<EntryEditorLabels>;
  /** Called when user confirms delete in dialog (optional; default logs) */
  onConfirmDelete?: (ctx: { entryId: string; liveTitle: string }) => void | Promise<void>;
  /** List cache entry: when `sys.id` matches `entryId`, skips GET `/api/contentful/entries/[id]`. */
  prefetchedEntry?: unknown;
};

export function EntryEditor(props: EntryEditorProps) {
  const {
    contentTypeId,
    entryLocale,
    contentfulSpaceId,
    managementApiRoot = '/api/contentful',
    actions,
    mode,
    entryId,
    onBack,
    onCreated,
    displayTitleFieldId = 'title',
    labels: labelsProp,
    onConfirmDelete,
    prefetchedEntry,
  } = props;

  const labels = React.useMemo(() => ({ ...defaultLabelsEs, ...labelsProp }), [labelsProp]);

  const syncStoreAfterLoad = React.useCallback(
    (loaded: any) => {
      if (!loaded || typeof loaded !== 'object') return;
      const store = useContentfulStore.getState();
      switch (contentTypeId) {
        case 'project':
          store.updateProject(loaded as any);
          break;
        case 'category':
          store.upsertCategory(loaded as any);
          break;
        case 'navigationGroup':
          store.upsertNavigationGroup(loaded as any);
          break;
        case 'tech':
          store.upsertTech(loaded as any);
          break;
        default:
          break;
      }
    },
    [contentTypeId],
  );

  const fetchContentTypeById = React.useCallback(async (id: string) => {
    const cacheKey = `${managementApiRoot}::${id}`;
    const cached = contentTypeCache.get(cacheKey);
    if (cached) return cached;

    const pending = contentTypeInflight.get(cacheKey);
    if (pending) return pending;

    const run = (async () => {
      const res = await fetch(`${managementApiRoot}/content-types`, { cache: 'no-store' });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data?.error || 'Failed to load content types');
      const items = data?.items as any[];
      const ct = items?.find((c) => c?.sys?.id === id);
      if (!ct) throw new Error(`Missing content type: ${id}`);
      contentTypeCache.set(cacheKey, ct);
      return ct;
    })();

    contentTypeInflight.set(cacheKey, run);
    try {
      return await run;
    } finally {
      contentTypeInflight.delete(cacheKey);
    }
  }, [managementApiRoot]);

  const fetchEntry = React.useCallback(
    async (id: string) => {
      const res = await fetch(`${managementApiRoot}/entries/${encodeURIComponent(id)}`, { cache: 'no-store' });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data?.error || 'Failed to load entry');
      return data?.item;
    },
    [managementApiRoot],
  );

  const headerLiveTitleRef = React.useRef('');

  const [contentType, setContentType] = React.useState<any | null>(null);
  const [entry, setEntry] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  // Refresh is global (header). Keep local editor state only.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const resetStore = useProjectEditorStore((s) => s.reset);
  const currentData = useProjectEditorStore((s) => s.currentData);
  const isDirty = useProjectEditorStore((s) => s.isDirty);

  const published = entry ? isEntryPublished(entry.sys) : false;

  const canUsePrefetchedEntry = React.useCallback(
    (candidate: unknown): candidate is any => {
      if (!candidate || typeof candidate !== 'object') return false;
      const c: any = candidate;
      if (!c.sys || c.sys.id !== entryId) return false;
      if (!c.fields || typeof c.fields !== 'object') return false;

      // For projects, the edit UI needs gallery + makingOf to render images and rich text.
      if (contentTypeId === 'project') {
        // Projects in the list cache might not have optional fields present as own-properties.
        // If the entry is already in Zustand with a `fields` object, treat it as sufficient and
        // avoid refetching on back/forward navigation.
        return true;
      }

      // Other models: minimal fields are enough for the form to render.
      return true;
    },
    [contentTypeId, entryId],
  );

  React.useEffect(() => {
    let cancelled = false;
    setError(null);
    setBusy(true);
    (async () => {
      try {
        const ct = await fetchContentTypeById(contentTypeId);
        if (cancelled) return;
        setContentType(ct);
        if (mode === 'create') {
          setEntry(null);
          resetStore({});
          return;
        }
        if (mode === 'edit' && entryId) {
          if (canUsePrefetchedEntry(prefetchedEntry)) {
            setEntry(prefetchedEntry);
            resetStore({});
          } else {
            const e = await fetchEntry(entryId);
            if (cancelled) return;
            setEntry(e);
            syncStoreAfterLoad(e);
            resetStore({});
          }
        } else {
          setEntry(null);
          resetStore({});
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load editor');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    canUsePrefetchedEntry,
    contentTypeId,
    entryId,
    fetchContentTypeById,
    fetchEntry,
    mode,
    prefetchedEntry,
    resetStore,
    syncStoreAfterLoad,
  ]);

  const onDelete = React.useCallback(async () => {
    if (!entryId) return;
    setDeleting(true);
    try {
      if (onConfirmDelete) {
        await onConfirmDelete({ entryId, liveTitle: headerLiveTitleRef.current });
      } else {
        await actions.deleteEntryAction(entryId);
        toast.success('Eliminado');
        onBack();
      }
    } finally {
      setDeleting(false);
      setConfirmDeleteOpen(false);
    }
  }, [actions, entryId, onBack, onConfirmDelete]);

  const onTogglePublish = React.useCallback(async () => {
    if (!entryId) return;
    setPublishing(true);
    try {
      if (published) await actions.unpublishEntryAction(entryId);
      else await actions.publishEntryAction(entryId);
      const next = await fetchEntry(entryId);
      setEntry(next);
      toast.success(published ? labels.unpublishToast : labels.publishToast);
    } finally {
      setPublishing(false);
    }
  }, [actions, entryId, fetchEntry, labels.publishToast, labels.unpublishToast, published]);

  // Refresh is global (header). Editor never refetches on demand.

  const applyOptimisticSaveToEntry = React.useCallback(
    (existingEntry: any, nextFields: Record<string, any>) => {
      if (!existingEntry || typeof existingEntry !== 'object') return null;
      const locale = entryLocale;
      const mergedFields = { ...(existingEntry.fields ?? {}) } as Record<string, any>;
      for (const [k, v] of Object.entries(nextFields)) {
        const prev = mergedFields[k];
        if (prev && typeof prev === 'object' && !Array.isArray(prev) && prev.sys == null) {
          mergedFields[k] = { ...prev, [locale]: v };
        } else {
          mergedFields[k] = { [locale]: v };
        }
      }

      const now = new Date().toISOString();
      const sys = { ...(existingEntry.sys ?? {}) } as Record<string, any>;
      if (!sys.updatedAt) sys.updatedAt = now;
      else sys.updatedAt = now;
      if (!sys.publishedAt) sys.publishedAt = now;

      return {
        ...existingEntry,
        sys,
        fields: mergedFields,
      };
    },
    [entryLocale],
  );

  const syncStoreAfterSave = React.useCallback((updated: any) => {
    if (!updated || typeof updated !== 'object') return;
    const store = useContentfulStore.getState();
    // `contentTypeId` here matches Contentful model id.
    switch (contentTypeId) {
      case 'project':
        store.updateProject(updated as any);
        break;
      case 'category':
        store.upsertCategory(updated as any);
        break;
      case 'navigationGroup':
        store.upsertNavigationGroup(updated as any);
        break;
      case 'tech':
        store.upsertTech(updated as any);
        break;
      default:
        break;
    }
  }, [contentTypeId]);

  const save = React.useCallback(async () => {
    if (saving) return;
    if (mode === 'edit' && !entryId) return;
    if (mode === 'edit' && !isDirty) return;

    setSaving(true);
    try {
      const fields = { ...(currentData ?? {}) } as Record<string, any>;

      if (mode === 'create') {
        const res = await actions.createEntryAction({ contentTypeId, fields });
        await actions.publishEntryAction(res.id);
        toast.success(labels.savedToast);
        onCreated(res.id);
        return;
      }

      await actions.updateEntryAction({ entryId: entryId!, fields });
      await actions.publishEntryAction(entryId!);
      // Avoid refetch: update local editor + Zustand cache immediately.
      const optimistic = applyOptimisticSaveToEntry(entry, fields);
      if (optimistic) {
        setEntry(optimistic);
        syncStoreAfterSave(optimistic);
      }
      toast.success(labels.savedToast);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : labels.saveError);
    } finally {
      setSaving(false);
    }
  }, [
    actions,
    applyOptimisticSaveToEntry,
    contentTypeId,
    currentData,
    entry,
    entryId,
    isDirty,
    labels.saveError,
    labels.savedToast,
    mode,
    onCreated,
    saving,
    syncStoreAfterSave,
  ]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes('mac');
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  const storedTitle =
    displayTitleFieldId === '__entryId__'
      ? ''
      : currentData && typeof currentData[displayTitleFieldId] === 'string'
        ? (currentData[displayTitleFieldId] as string).trim()
        : '';

  const entryTitle =
    displayTitleFieldId === '__entryId__' && entry?.sys?.id
      ? String(entry.sys.id)
      : entry?.fields?.[displayTitleFieldId] != null
        ? readLocalizedField(entry.fields[displayTitleFieldId], entryLocale)
        : '';

  const headerLiveTitle =
    storedTitle ||
    String(entryTitle || '') ||
    (mode === 'create' ? labels.createEmptyTitle : labels.editEmptyTitle);

  headerLiveTitleRef.current = headerLiveTitle;

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-12 bg-white">
      <div className="col-span-12 flex min-h-0 flex-1 flex-col lg:col-start-3 lg:col-span-8">
      <div className="shrink-0 space-y-3 px-4 pb-0 pt-0 my-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={onBack} aria-label="Volver">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-[20px] font-bold leading-tight text-neutral-900">{headerLiveTitle}</h2>
              {mode === 'edit' && entryId ? (
                <div className="mt-1 flex items-center gap-2">
                  <Badge className={published ? 'bg-emerald-600 text-white hover:bg-emerald-600' : ''} variant={published ? 'default' : 'secondary'}>
                    {published ? labels.publishedBadge : labels.draftBadge}
                  </Badge>
                </div>
              ) : (
                <p className="mt-1 text-sm text-zinc-500">{labels.createSubtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {mode === 'edit' ? null : null}

            <Button type="button" onClick={() => void save()} disabled={!isDirty || saving || busy}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {labels.save}
            </Button>

            {mode === 'edit' ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void onTogglePublish()}
                disabled={!entryId || publishing}
                aria-label={published ? labels.unpublish : labels.publish}
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span className="sr-only">{published ? labels.unpublish : labels.publish}</span>
              </Button>
            ) : null}

            {mode === 'edit' ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={labels.moreAria} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
                    <MoreVertical className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        setConfirmDeleteOpen(true);
                      }}
                    >
                      {labels.deleteMenu}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{labels.deleteDialogTitle}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {labels.deleteDialogDescription(headerLiveTitle)}
                        <span className="mt-2 block font-medium text-zinc-900">{String(entryTitle || labels.untitled)}</span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>{labels.cancel}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          void onDelete();
                        }}
                        className="bg-red-600 hover:bg-red-600/90"
                        disabled={deleting}
                      >
                        {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {labels.deleteConfirm}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
        <ScrollArea className="min-h-0 flex-1 bg-white">
          <div className="space-y-4 pb-[72px]">
            {error ? (
              <p className="border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</p>
            ) : null}

            {busy || !contentType ? (
              <p className="text-sm text-zinc-500">{labels.loading}</p>
            ) : (
              <SchemaDrivenEntryForm
                contentType={contentType}
                locale={entryLocale}
                entryId={entryId}
                contentfulSpaceId={contentfulSpaceId}
                managementApiRoot={managementApiRoot}
                initialFields={entry?.fields}
                submitLabel={mode === 'create' ? labels.createSubmit : labels.save}
                onSubmit={async () => {}}
                hideHeader
                hideSubmit
              />
            )}
          </div>
        </ScrollArea>
      </div>
      </div>
    </div>
  );
}
