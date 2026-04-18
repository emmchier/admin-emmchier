'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SchemaDrivenEntryForm } from '@/components/cms/SchemaDrivenEntryForm';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Loader2,
  MoreVertical,
  Undo2,
} from 'lucide-react';
import { buildFlatFieldMapFromEntry } from '@/lib/contentful/readInitialFieldValue';
import { toast } from '@/lib/ui/snackbar';
import { useProjectEditorStore } from '@/lib/stores/projectEditorStore';
import { readLocalizedField } from '@/lib/contentful/readLocalizedField';
import { isEntryPublished } from '@/lib/contentful/isEntryPublished';
import { useContentfulStore } from '@/lib/store/contentfulStore';
import { contentfulService } from '@/services/contentfulService';
import { useProjectUnsavedNavigationGuard } from '@/lib/stores/projectUnsavedNavigationGuard';
import { cn } from '@/lib/utils';
import { normalizeRichTextFieldsForSave } from '@/lib/contentful/normalizeRichTextFieldsForSave';
import { sanitizeArtProjectTechLinksForSave } from '@/lib/contentful/sanitizeArtProjectTechLinksForSave';

const contentTypeCache = new Map<string, any>();
const contentTypeInflight = new Map<string, Promise<any>>();

export type EntryEditorMode = 'create' | 'edit';

export type EntryEditorActions = {
  createEntryAction: (args: {
    contentTypeId: string;
    fields: Record<string, any>;
  }) => Promise<{ id: string }>;
  updateEntryAction: (args: {
    entryId: string;
    fields: Record<string, any>;
  }) => Promise<{ ok: boolean }>;
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
  /** Project edit: reset unsaved changes to last baseline (opened / last saved). */
  revert: string;
};

const defaultLabelsEn: EntryEditorLabels = {
  createSubtitle: 'New entry',
  createEmptyTitle: 'New entry',
  editEmptyTitle: 'Entry',
  loading: 'Loading…',
  save: 'Save changes',
  createSubmit: 'Create',
  publish: 'Publish',
  unpublish: 'Unpublish',
  refresh: 'Refresh',
  moreAria: 'More',
  deleteMenu: 'Delete',
  deleteDialogTitle: 'Delete',
  deleteDialogDescription: (liveTitle) =>
    `Are you sure you want to delete '${liveTitle}'?`,
  cancel: 'Cancel',
  deleteConfirm: 'Delete',
  publishedBadge: 'Published',
  draftBadge: 'Draft',
  savedToast: 'Changes saved',
  publishToast: 'Published',
  unpublishToast: 'Unpublished',
  refreshToast: 'Updated',
  refreshError: 'Failed to refresh',
  saveError: 'Failed to save',
  untitled: 'Untitled',
  revert: 'Revert',
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
  onConfirmDelete?: (ctx: {
    entryId: string;
    liveTitle: string;
  }) => void | Promise<void>;
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

  const labels = React.useMemo(
    () => ({ ...defaultLabelsEn, ...labelsProp }),
    [labelsProp]
  );

  const syncStoreAfterLoad = React.useCallback(
    (loaded: any) => {
      if (!loaded || typeof loaded !== 'object') return;
      const store = useContentfulStore.getState();
      switch (contentTypeId) {
        case 'project':
          store.upsertProject(loaded as any);
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
    [contentTypeId]
  );

  const fetchContentTypeById = React.useCallback(
    async (id: string) => {
      const space =
        contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
      const cacheKey = `${space}::${id}`;
      const cached = contentTypeCache.get(cacheKey);
      if (cached) return cached;

      const pending = contentTypeInflight.get(cacheKey);
      if (pending) return pending;

      const run = (async () => {
        const items = await contentfulService.getContentTypes({ space });
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
    },
    [managementApiRoot]
  );

  const fetchEntry = React.useCallback(
    async (id: string) => {
      const space =
        contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
      return await contentfulService.getEntryById({ space, entryId: id });
    },
    [managementApiRoot]
  );

  const headerLiveTitleRef = React.useRef('');

  const [contentType, setContentType] = React.useState<any | null>(null);
  const [entry, setEntry] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  /** null = no pending toggle; queued publish state to apply on Save */
  const [publishIntent, setPublishIntent] = React.useState<boolean | null>(
    null
  );
  // Refresh is global (header). Keep local editor state only.
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const resetStore = useProjectEditorStore((s) => s.reset);
  const currentData = useProjectEditorStore((s) => s.currentData);
  const isDirty = useProjectEditorStore((s) => s.isDirty);
  const baselineEntryRef = React.useRef<any>(null);
  const baselineEntryIdRef = React.useRef<string | null>(null);
  const [formHydrationKey, setFormHydrationKey] = React.useState(0);
  const requestNavigateGuard = useProjectUnsavedNavigationGuard(
    (s) => s.requestNavigate
  );

  const displayPublished =
    entry != null &&
    (publishIntent !== null ? publishIntent : isEntryPublished(entry.sys));

  const badgeEntry = React.useMemo(() => {
    if (!entry) return entry;
    if (publishIntent === null) return entry;
    const sys = { ...entry.sys } as Record<string, unknown>;
    if (publishIntent) {
      if (typeof sys.publishedAt !== 'string' || !sys.publishedAt) {
        sys.publishedAt = new Date().toISOString();
      }
    } else {
      delete sys.publishedAt;
    }
    return { ...entry, sys };
  }, [entry, publishIntent]);

  const publishDirty = Boolean(
    mode === 'edit' &&
    entry &&
    publishIntent !== null &&
    publishIntent !== isEntryPublished(entry.sys)
  );

  React.useEffect(() => {
    useProjectUnsavedNavigationGuard.setState({
      unsavedPublishIntent: publishDirty,
    });
    return () =>
      useProjectUnsavedNavigationGuard.setState({
        unsavedPublishIntent: false,
      });
  }, [publishDirty]);

  const canUsePrefetchedEntry = React.useCallback(
    (candidate: unknown): candidate is any => {
      if (!candidate || typeof candidate !== 'object') return false;
      const c: any = candidate;
      if (!c.sys || c.sys.id !== entryId) return false;
      if (!c.fields || typeof c.fields !== 'object') return false;

      // Projects always refetch by id in the editor effect so rich text / gallery links match CMA.
      if (contentTypeId === 'project') return false;

      // Other models: minimal fields are enough for the form to render.
      return true;
    },
    [contentTypeId, entryId]
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
          const preferPrefetch =
            contentTypeId !== 'project' &&
            canUsePrefetchedEntry(prefetchedEntry);

          if (preferPrefetch) {
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

  React.useEffect(() => {
    setFormHydrationKey(0);
    setPublishIntent(null);
  }, [entryId]);

  React.useEffect(() => {
    if (mode !== 'edit' || !entryId || contentTypeId !== 'project' || !entry)
      return;
    if (baselineEntryIdRef.current !== entryId) {
      baselineEntryIdRef.current = entryId;
      baselineEntryRef.current = structuredClone(entry);
    }
  }, [mode, entryId, contentTypeId, entry]);

  const onRevert = React.useCallback(() => {
    if (contentTypeId !== 'project' || mode !== 'edit') return;
    const base = baselineEntryRef.current;
    if (!base || !contentType) return;
    const editable = (contentType.fields || []).filter(
      (f: any) => Boolean(f?.id) && !f.disabled && !f.omitted
    );
    const flat = buildFlatFieldMapFromEntry(base.fields, editable, entryLocale);
    resetStore(flat as any);
    setEntry(structuredClone(base));
    setFormHydrationKey((k) => k + 1);
    setPublishIntent(null);
  }, [contentTypeId, mode, contentType, entryLocale, resetStore]);

  React.useEffect(() => {
    const setRevertDraftFn =
      useProjectUnsavedNavigationGuard.getState().setRevertDraftFn;
    if (contentTypeId !== 'project' || mode !== 'edit') {
      setRevertDraftFn(null);
      return;
    }
    setRevertDraftFn(onRevert);
    return () => setRevertDraftFn(null);
  }, [contentTypeId, mode, onRevert]);

  const onDelete = React.useCallback(async () => {
    if (!entryId) return;
    setDeleting(true);
    try {
      if (onConfirmDelete) {
        await onConfirmDelete({
          entryId,
          liveTitle: headerLiveTitleRef.current,
        });
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

  const queuePublishToggle = React.useCallback(() => {
    if (!entryId || !entry) return;
    const serverPub = isEntryPublished(entry.sys);
    setPublishIntent((prev) => {
      const shown = prev !== null ? prev : serverPub;
      const next = !shown;
      return next === serverPub ? null : next;
    });
  }, [entry, entryId]);

  // Refresh is global (header). Editor never refetches on demand.

  const applyOptimisticSaveToEntry = React.useCallback(
    (existingEntry: any, nextFields: Record<string, any>) => {
      if (!existingEntry || typeof existingEntry !== 'object') return null;
      const locale = entryLocale;
      const mergedFields = { ...(existingEntry.fields ?? {}) } as Record<
        string,
        any
      >;
      for (const [k, v] of Object.entries(nextFields)) {
        const prev = mergedFields[k];
        if (
          prev &&
          typeof prev === 'object' &&
          !Array.isArray(prev) &&
          prev.sys == null
        ) {
          mergedFields[k] = { ...prev, [locale]: v };
        } else {
          mergedFields[k] = { [locale]: v };
        }
      }

      const now = new Date().toISOString();
      const sys = { ...(existingEntry.sys ?? {}) } as Record<string, any>;
      if (!sys.updatedAt) sys.updatedAt = now;
      else sys.updatedAt = now;

      return {
        ...existingEntry,
        sys,
        fields: mergedFields,
      };
    },
    [entryLocale]
  );

  const syncStoreAfterSave = React.useCallback(
    (updated: any) => {
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
    },
    [contentTypeId]
  );

  const save = React.useCallback(async () => {
    if (saving) return;
    if (mode === 'edit' && !entryId) return;

    const serverPublished = entry ? isEntryPublished(entry.sys) : false;
    const needsPublishStep =
      publishIntent !== null && publishIntent !== serverPublished;

    if (mode === 'edit' && !isDirty && !needsPublishStep) return;

    setSaving(true);
    try {
      const rawFields = { ...(currentData ?? {}) } as Record<string, unknown>;
      let fields = normalizeRichTextFieldsForSave(
        contentType,
        rawFields,
      ) as Record<string, any>;

      if (contentTypeId === 'project') {
        const knownTechIds = new Set(
          Object.keys(useContentfulStore.getState().techs),
        );
        fields = sanitizeArtProjectTechLinksForSave(
          fields as Record<string, unknown>,
          knownTechIds,
        ) as Record<string, any>;
      }

      if (mode === 'create') {
        const res = await actions.createEntryAction({ contentTypeId, fields });
        await actions.publishEntryAction(res.id);
        toast.success(labels.savedToast);
        onCreated(res.id);
        return;
      }

      let workingEntry = entry;

      if (isDirty) {
        await actions.updateEntryAction({ entryId: entryId!, fields });
        const optimistic = applyOptimisticSaveToEntry(entry, fields);
        if (optimistic) {
          workingEntry = optimistic;
          setEntry(optimistic);
        }
      }

      // Align with Contentful UI: saving field changes must publish so the entry
      // does not stay "Changed". Unless the user explicitly queued draft (eye → unpublish).
      const pubNow = isEntryPublished(workingEntry!.sys);
      if (publishIntent === false) {
        if (pubNow) {
          await actions.unpublishEntryAction(entryId!);
        }
      } else {
        const shouldPublish =
          publishIntent === true || (publishIntent === null && isDirty);
        if (shouldPublish) {
          await actions.publishEntryAction(entryId!);
        }
      }

      const next = await fetchEntry(entryId!);
      setEntry(next);
      syncStoreAfterSave(next);
      if (contentTypeId === 'project') {
        baselineEntryRef.current = structuredClone(next);
      }
      setPublishIntent(null);
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
    fetchEntry,
    isDirty,
    labels.saveError,
    labels.savedToast,
    mode,
    onCreated,
    publishIntent,
    saving,
    syncStoreAfterSave,
    contentType,
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

  /** Schema form submit is unused (save runs from the header); required by `SchemaDrivenEntryForm`. */
  const schemaFormSubmit = React.useCallback(
    async (_fields: Record<string, unknown>) => {
      void _fields;
      await Promise.resolve();
    },
    []
  );

  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-12 bg-white">
      <div className="col-span-12 flex min-h-0 flex-1 flex-col lg:col-start-3 lg:col-span-8">
        <div className="shrink-0 border-b border-neutral-200 bg-white px-4 pb-4 pt-0">
          <div className="flex flex-nowrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-2">
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => requestNavigateGuard(onBack)}
                      aria-label="Go back"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Go back</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="min-w-0 flex-1">
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h2 className="line-clamp-2 cursor-default wrap-break-word text-[20px] font-bold leading-tight text-neutral-900">
                        {headerLiveTitle}
                      </h2>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      align="start"
                      className="max-w-md whitespace-pre-wrap"
                    >
                      {headerLiveTitle}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {mode === 'edit' && entryId ? (
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge entry={badgeEntry ?? entry} />
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">
                    {labels.createSubtitle}
                  </p>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-nowrap items-center gap-2">
              {mode === 'edit' ? null : null}

              {contentTypeId === 'project' && mode === 'edit' && entryId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onRevert}
                  disabled={(!isDirty && !publishDirty) || saving || busy}
                >
                  <Undo2 className="mr-2 h-4 w-4" />
                  {labels.revert}
                </Button>
              ) : null}

              <Button
                type="button"
                onClick={() => void save()}
                disabled={(!isDirty && !publishDirty) || saving || busy}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {labels.save}
              </Button>

              {mode === 'edit' ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={queuePublishToggle}
                        disabled={!entryId || saving || busy}
                        aria-label={
                          displayPublished ? labels.unpublish : labels.publish
                        }
                      >
                        {displayPublished ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        <span className="sr-only">
                          {displayPublished ? labels.unpublish : labels.publish}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {displayPublished ? labels.unpublish : labels.publish}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}

              {mode === 'edit' ? (
                <>
                  <DropdownMenu>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <DropdownMenuTrigger
                            aria-label={labels.moreAria}
                            className={buttonVariants({
                              variant: 'ghost',
                              size: 'icon',
                            })}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                        </TooltipTrigger>
                        <TooltipContent>{labels.moreAria}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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

                  <AlertDialog
                    open={confirmDeleteOpen}
                    onOpenChange={setConfirmDeleteOpen}
                  >
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {labels.deleteDialogTitle}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {labels.deleteDialogDescription(headerLiveTitle)}
                          <span className="mt-2 block font-medium text-zinc-900">
                            {String(entryTitle || labels.untitled)}
                          </span>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>
                          {labels.cancel}
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => {
                            e.preventDefault();
                            void onDelete();
                          }}
                          className="bg-red-600 hover:bg-red-600/90"
                          disabled={deleting}
                        >
                          {deleting ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
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
        <div className="flex min-h-0 flex-1 flex-col pb-4 pt-0">
          <ScrollArea className="min-h-0 flex-1 bg-white">
            <div
              className={cn(
                'px-4 pb-[72px] pt-6',
                contentTypeId === 'project' ? 'space-y-8' : 'space-y-4'
              )}
            >
              {error ? (
                <p className="border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                  {error}
                </p>
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
                  formHydrationKey={formHydrationKey}
                  submitLabel={
                    mode === 'create' ? labels.createSubmit : labels.save
                  }
                  onSubmit={schemaFormSubmit}
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
