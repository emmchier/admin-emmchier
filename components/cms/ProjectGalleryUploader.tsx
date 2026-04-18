'use client';

import * as React from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
import { GripVertical, Trash2, ArrowLeft, ImagePlus } from 'lucide-react';
import { contentfulService } from '@/services/contentfulService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  EntryFieldCharacterFooter,
  ENTRY_FIELD_CHAR_LIMIT,
  clampEntryFieldString,
} from '@/components/cms/entryFieldCharacterLimit';
import { cn } from '@/lib/utils';

type EntryLink = { sys: { type: 'Link'; linkType: 'Entry'; id: string } };

type UploadItem = {
  id: string;
  file: File;
  title: string;
  alt: string;
  previewUrl?: string;
  status: 'idle' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  entryId?: string;
  abort?: AbortController;
};

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/tiff']);
const MAX_BYTES = 15 * 1024 * 1024;

/** Display + upload “image name” (title) cap — list rows and asset title field */
const IMAGE_NAME_MAX = 50;

function truncateImageNameLabel(name: string, max = IMAGE_NAME_MAX): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max)}…`;
}

function SortableLinkedImageRow(props: {
  entryId: string;
  displayTitleFull: string;
  url: string | null;
  onPreview: () => void;
  onRemoveRequest: () => void;
}) {
  const { entryId, displayTitleFull, url, onPreview, onRemoveRequest } = props;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entryId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const shown = truncateImageNameLabel(displayTitleFull);
  const showTip = displayTitleFull.length > IMAGE_NAME_MAX;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-3 bg-white px-4 py-4 outline-none transition-[opacity,transform,box-shadow] duration-200 ease-out',
        isDragging &&
          'relative z-20 scale-[0.995] opacity-90 shadow-xl ring-2 ring-zinc-900/20',
      )}
    >
      <button
        type="button"
        className={cn(
          'flex shrink-0 cursor-grab touch-none items-center rounded-md border border-transparent p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing',
          isDragging && 'text-zinc-900',
        )}
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        <button
          type="button"
          className="h-12 w-12 shrink-0 overflow-hidden border border-neutral-200 bg-neutral-50"
          onClick={() => {
            if (!url) return;
            onPreview();
          }}
          aria-label={url ? 'Ver imagen' : 'Imagen no disponible'}
          disabled={!url}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={shown}
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
            />
          ) : (
            <div className="h-full w-full" />
          )}
        </button>
        <div className="min-w-0 flex-1 overflow-hidden">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="block min-w-0 truncate text-sm font-medium leading-snug text-zinc-900">
                  {shown}
                </p>
              </TooltipTrigger>
              {showTip ? (
                <TooltipContent side="top" align="start" className="max-w-sm whitespace-pre-wrap">
                  {displayTitleFull}
                </TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
          <p className="mt-0.5 truncate font-mono text-[11px] leading-tight text-zinc-500">{entryId}</p>
        </div>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={onRemoveRequest}
              aria-label="Remove image from gallery"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Remove image from gallery</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

type PreviewMap = Record<string, { url: string | null }>;
const previewsCache = new Map<string, PreviewMap>();
const previewsInflight = new Map<string, Promise<PreviewMap>>();

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type ProjectGalleryUploaderHandle = { open: () => void };

export const ProjectGalleryUploader = React.forwardRef<ProjectGalleryUploaderHandle, {
  value: EntryLink[];
  onChange: (next: EntryLink[]) => void;
  managementApiRoot?: string;
  projectSlug?: string;
}>(function ProjectGalleryUploader(props, ref) {
  const { value, onChange, managementApiRoot = '/api/contentful', projectSlug } = props;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [previews, setPreviews] = React.useState<Record<string, { url: string | null }>>({});
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetView, setSheetView] = React.useState<'grid' | 'detail'>('grid');
  const [selectedQueueId, setSelectedQueueId] = React.useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<{ url: string; title: string } | null>(null);
  const [pendingRemoveLinkedId, setPendingRemoveLinkedId] = React.useState<string | null>(null);

  const slugSafe = (projectSlug || '').trim();

  React.useImperativeHandle(
    ref,
    () => ({
      open: () => setSheetOpen(true),
    }),
    [],
  );

  const desiredTitle = React.useCallback(
    (imageAssetEntryId: string, index: number) => {
      // Rule: [slug]-[index]
      const base = slugSafe || 'proyecto';
      return `${base}-${index + 1}`;
    },
    [slugSafe],
  );

  React.useEffect(() => {
    let cancelled = false;
    const ids = value.map((v) => v.sys.id).filter(Boolean);
    if (ids.length === 0) return;

    // Cache-first previews: if we already resolved URLs for this set, paint instantly.
    const cacheKey = `${managementApiRoot}::${[...ids].sort().join(',')}`;
    const cached = previewsCache.get(cacheKey);
    if (cached) {
      setPreviews(cached);
      return;
    }
    (async () => {
      try {
        const pending = previewsInflight.get(cacheKey);
        const run =
          pending ??
          (async () => {
            const map: PreviewMap = {};
            const space = contentfulService.inferSpaceFromManagementApiRoot(managementApiRoot);
            const items = await contentfulService.getImageAssetPreviews({ space, entryIds: ids });
            for (const it of items || []) {
              const entryId = String((it as any).entryId ?? '');
              if (!entryId) continue;
              map[entryId] = { url: (it as any).url ?? null };
            }
            previewsCache.set(cacheKey, map);
            return map;
          })();

        previewsInflight.set(cacheKey, run);
        const map = await run;
        if (!cancelled) setPreviews(map);
      } catch {
        // ignore
      } finally {
        previewsInflight.delete(cacheKey);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [managementApiRoot, value]);

  const addFiles = React.useCallback((files: FileList | File[]) => {
    const next: UploadItem[] = [];
    for (const f of Array.from(files)) {
      if (!ALLOWED.has(f.type)) {
        next.push({
          id: makeId(),
          file: f,
          title: '',
          alt: '',
          status: 'error',
          progress: 0,
          error: 'Formato no soportado',
        });
        continue;
      }
      if (f.size > MAX_BYTES) {
        next.push({
          id: makeId(),
          file: f,
          title: '',
          alt: '',
          status: 'error',
          progress: 0,
          error: 'Archivo demasiado grande (máx. 15MB)',
        });
        continue;
      }
      const stem = f.name.replace(/\.\w+$/, '');
      next.push({
        id: makeId(),
        file: f,
        title: clampEntryFieldString(stem, IMAGE_NAME_MAX),
        alt: clampEntryFieldString(stem, ENTRY_FIELD_CHAR_LIMIT),
        previewUrl: URL.createObjectURL(f),
        status: 'idle',
        progress: 0,
      });
    }
    setItems((prev) => [...prev, ...next]);

    // Auto-upload (convert/compress server-side) immediately on add.
    for (const it of next) {
      if (it.status !== 'idle') continue;
      void (async () => {
        // XHR gives us upload progress; conversion time is reflected as "processing" near the end.
        const form = new FormData();
        form.set('file', it.file);
        form.set(
          'title',
          clampEntryFieldString(it.title.trim() || it.file.name, IMAGE_NAME_MAX),
        );
        form.set(
          'alt',
          clampEntryFieldString(it.alt.trim() || it.file.name, ENTRY_FIELD_CHAR_LIMIT),
        );

        setItems((prev) =>
          prev.map((x) => (x.id === it.id ? { ...x, status: 'uploading', progress: 1, error: undefined } : x)),
        );

        try {
          const entryId = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload?space=art');
            xhr.responseType = 'json';

            xhr.upload.onprogress = (ev) => {
              if (!ev.lengthComputable) return;
              const pct = Math.max(1, Math.min(95, Math.round((ev.loaded / ev.total) * 95)));
              setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, progress: pct } : x)));
            };

            xhr.onload = () => {
              const ok = xhr.status >= 200 && xhr.status < 300;
              const data = xhr.response as any;
              if (!ok) return reject(new Error(data?.error || 'Upload failed'));
              const id = typeof data?.entryId === 'string' ? data.entryId : '';
              if (!id) return reject(new Error('Missing entryId in response'));
              resolve(id);
            };

            xhr.onerror = () => reject(new Error('Upload failed'));
            xhr.onabort = () => reject(new Error('Upload canceled'));

            xhr.send(form);
          });

          setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: 'done', progress: 100, entryId } : x)));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Upload failed';
          setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: 'error', progress: 0, error: msg } : x)));
        }
      })();
    }
  }, []);

  const setField = React.useCallback((id: string, key: 'title' | 'alt', v: string) => {
    const capped =
      key === 'title'
        ? clampEntryFieldString(v, IMAGE_NAME_MAX)
        : clampEntryFieldString(v, ENTRY_FIELD_CHAR_LIMIT);
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: capped } : it)));
  }, []);

  const removeLocal = React.useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
    // Best-effort cleanup: if we already created an ImageAsset entry, delete it to avoid orphaned test content.
    const it = items.find((x) => x.id === id);
    const entryId = it?.entryId;
    if (entryId) {
      void (async () => {
        try {
          const loaded = await contentfulService.getEntryById({ space: 'art', entryId });
          if (loaded?.sys?.publishedAt) await contentfulService.unpublishEntry({ space: 'art', entryId });
        } catch {
          // ignore
        }
        await contentfulService.deleteEntry({ space: 'art', entryId }).catch(() => {});
      })();
    }
  }, [items]);

  // No manual "Upload" step: uploads/conversion run automatically on add.

  const commitUploadedToGallery = React.useCallback(() => {
    const uploaded = items.filter((it) => it.status === 'done' && it.entryId).map((it) => it.entryId!) ;
    if (uploaded.length === 0) {
      setSheetOpen(false);
      return;
    }
    const nextLinks: EntryLink[] = [
      ...value,
      ...uploaded.map((id) => ({ sys: { type: 'Link', linkType: 'Entry', id } as const })),
    ];
    onChange(nextLinks);
    setItems((prev) => {
      prev.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      });
      return [];
    });
    setSheetOpen(false);
    setSheetView('grid');
    setSelectedQueueId(null);
  }, [items, onChange, value]);

  const removeLinked = React.useCallback(
    (entryId: string) => {
      onChange(value.filter((l) => l.sys.id !== entryId));
    },
    [onChange, value],
  );

  React.useEffect(() => {
    return () => {
      // Cleanup local object URLs on unmount.
      items.forEach((it) => {
        if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const linkedSortIds = React.useMemo(() => value.map((l) => l.sys.id), [value]);

  const handleLinkedDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = value.findIndex((x) => x.sys.id === String(active.id));
      const newIndex = value.findIndex((x) => x.sys.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;
      onChange(arrayMove(value, oldIndex, newIndex));
    },
    [onChange, value],
  );

  return (
    <div className="space-y-3">
      {value.length ? (
        <div className="border border-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-4">
            <p className="text-xs font-medium text-neutral-600">Imágenes vinculadas ({value.length})</p>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleLinkedDragEnd}
          >
            <SortableContext items={linkedSortIds} strategy={verticalListSortingStrategy}>
              <div className="divide-y divide-neutral-200">
                {value.map((l, idx) => {
                  const entryId = l.sys.id;
                  const displayTitleFull = desiredTitle(entryId, idx);
                  const url = previews[entryId]?.url ?? null;

                  return (
                    <SortableLinkedImageRow
                      key={entryId}
                      entryId={entryId}
                      displayTitleFull={displayTitleFull}
                      url={url}
                      onPreview={() => {
                        setPreviewImage({
                          url: url!,
                          title: displayTitleFull,
                        });
                        setPreviewOpen(true);
                      }}
                      onRemoveRequest={() => setPendingRemoveLinkedId(entryId)}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-base">Add images</SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp,image/tiff"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />

            {sheetView === 'grid' ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Select files
                  </Button>
                </div>

                {items.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((it) => (
                      <div key={it.id} className="overflow-hidden border border-neutral-200 text-left">
                        <div className="relative aspect-square w-full bg-zinc-50">
                          {it.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={it.previewUrl} alt={it.title || it.file.name} className="h-full w-full object-cover" />
                          ) : null}

                          <div className="absolute right-2 top-2 flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    onClick={() => removeLocal(it.id)}
                                    aria-label="Remove"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remove</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="block w-full p-2 text-left hover:bg-neutral-50"
                          onClick={() => {
                            setSelectedQueueId(it.id);
                            setSheetView('detail');
                          }}
                        >
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="truncate text-xs font-medium text-zinc-900">
                                  {truncateImageNameLabel(it.file.name)}
                                </p>
                              </TooltipTrigger>
                              {it.file.name.length > IMAGE_NAME_MAX ? (
                                <TooltipContent side="top" className="max-w-sm break-all">
                                  {it.file.name}
                                </TooltipContent>
                              ) : null}
                            </Tooltip>
                          </TooltipProvider>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {it.status === 'uploading' ? 'Uploading…' : it.status === 'done' ? 'Ready' : it.status === 'error' ? 'Error' : 'Queued'}
                          </p>
                          {it.status === 'uploading' ? (
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-zinc-100">
                              <div className="h-full bg-zinc-900" style={{ width: `${it.progress}%` }} />
                            </div>
                          ) : null}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="border border-dashed border-neutral-300 bg-neutral-50/80 p-6 text-sm text-neutral-600"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const files = e.dataTransfer?.files;
                      if (files && files.length) addFiles(files);
                    }}
                  >
                    Drag & drop images here, or use “Select files”.
                  </div>
                )}
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSheetView('grid')}
                  className="px-0"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {(() => {
                  const it = items.find((x) => x.id === selectedQueueId);
                  if (!it) return null;
                  return (
                    <div className="space-y-3 border border-neutral-200 p-4">
                      <p className="text-sm font-medium text-zinc-900">{it.file.name}</p>

                      <div className="overflow-hidden border border-neutral-200 bg-neutral-50">
                        {it.previewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.previewUrl}
                            alt={it.title || it.file.name}
                            className="max-h-72 w-full object-contain"
                          />
                        ) : null}
                      </div>

                      {it.status === 'error' && it.error ? (
                        <p className="text-sm text-red-700">{it.error}</p>
                      ) : null}

                      <div className="grid gap-3">
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-zinc-600">Title</Label>
                          <Input
                            value={it.title}
                            maxLength={IMAGE_NAME_MAX}
                            onChange={(e) => setField(it.id, 'title', e.target.value)}
                          />
                          <EntryFieldCharacterFooter length={it.title.length} max={IMAGE_NAME_MAX} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-zinc-600">Alt</Label>
                          <Textarea
                            value={it.alt}
                            maxLength={ENTRY_FIELD_CHAR_LIMIT}
                            rows={4}
                            onChange={(e) => setField(it.id, 'alt', e.target.value)}
                          />
                          <EntryFieldCharacterFooter length={it.alt.length} />
                        </div>
                      </div>

                      {it.status === 'uploading' ? (
                        <div className="mt-2">
                          <div className="h-2 w-full overflow-hidden rounded bg-zinc-100">
                            <div className="h-full bg-zinc-900" style={{ width: `${it.progress}%` }} />
                          </div>
                        </div>
                      ) : null}

                      <div className="flex justify-end">
                        <Button type="button" variant="outline" onClick={() => removeLocal(it.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button type="button" onClick={commitUploadedToGallery}>
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={pendingRemoveLinkedId != null} onOpenChange={(open) => !open && setPendingRemoveLinkedId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove image from gallery?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the image from this project&apos;s gallery list. Save changes to apply. The asset remains in Contentful unless you delete it separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-600/90 focus-visible:ring-amber-600"
              onClick={(e) => {
                e.preventDefault();
                if (pendingRemoveLinkedId) removeLinked(pendingRemoveLinkedId);
                setPendingRemoveLinkedId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewImage(null);
        }}
      >
        <DialogContent className="max-w-5xl p-0">
          <div className="border-b border-zinc-200 px-4 py-3">
            <p className="truncate text-sm font-medium text-zinc-900">{previewImage?.title ?? 'Imagen'}</p>
          </div>
          <div className="max-h-[80vh] overflow-auto bg-black/5 p-4">
            {previewImage?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewImage.url} alt={previewImage.title} className="mx-auto h-auto max-h-[72vh] w-auto max-w-full" />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

