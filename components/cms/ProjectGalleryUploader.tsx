'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GripVertical, Trash2, ArrowLeft, ImagePlus } from 'lucide-react';

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
};

const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/tiff']);
const MAX_BYTES = 15 * 1024 * 1024;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ProjectGalleryUploader(props: {
  value: EntryLink[];
  onChange: (next: EntryLink[]) => void;
  managementApiRoot?: string;
  projectSlug?: string;
}) {
  const { value, onChange, managementApiRoot = '/api/contentful', projectSlug } = props;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [previews, setPreviews] = React.useState<Record<string, { url: string | null }>>({});
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [sheetView, setSheetView] = React.useState<'grid' | 'detail'>('grid');
  const [selectedQueueId, setSelectedQueueId] = React.useState<string | null>(null);
  const draggingIdRef = React.useRef<string | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<{ url: string; title: string } | null>(null);

  const slugSafe = (projectSlug || '').trim();

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
    const ids = value.map((v) => v.sys.id);
    if (ids.length === 0) return;
    (async () => {
      try {
        const res = await fetch(`${managementApiRoot}/image-assets?ids=${encodeURIComponent(ids.join(','))}`, {
          cache: 'no-store',
        });
        const data = (await res.json()) as any;
        if (!res.ok) return;
        const map: Record<string, { url: string | null }> = {};
        for (const it of data.items || []) {
          map[it.entryId] = { url: it.url ?? null };
        }
        if (!cancelled) setPreviews(map);
      } catch {
        // ignore
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
        title: stem,
        alt: stem,
        previewUrl: URL.createObjectURL(f),
        status: 'idle',
        progress: 0,
      });
    }
    setItems((prev) => [...prev, ...next]);
  }, []);

  const setField = React.useCallback((id: string, key: 'title' | 'alt', v: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: v } : it)));
  }, []);

  const removeLocal = React.useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it?.previewUrl) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const uploadAll = React.useCallback(async () => {
    const targets = items.filter((it) => it.status === 'idle' && it.title.trim() && it.alt.trim());
    for (const it of targets) {
      setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: 'uploading', progress: 10, error: undefined } : x)));

      const form = new FormData();
      form.set('file', it.file);
      form.set('title', it.title.trim());
      form.set('alt', it.alt.trim());

      try {
        const res = await fetch('/api/upload?space=art', { method: 'POST', body: form });
        const data = (await res.json()) as any;
        if (!res.ok) throw new Error(data?.error || 'Falló la subida');
        const entryId: string | undefined = typeof data?.entryId === 'string' ? data.entryId : undefined;
        if (!entryId) throw new Error('Falta entryId en la respuesta');

        setItems((prev) =>
          prev.map((x) =>
            x.id === it.id ? { ...x, status: 'done', progress: 100, entryId } : x,
          ),
        );

        // Do NOT mutate the gallery immediately — user confirms with "Guardar" in the sheet.
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falló la subida';
        setItems((prev) => prev.map((x) => (x.id === it.id ? { ...x, status: 'error', progress: 0, error: msg } : x)));
      }
    }
  }, [items, onChange, value]);

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-zinc-900">Galería</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => setSheetOpen(true)}>
            Gestionar
          </Button>
        </div>
      </div>

      {value.length ? (
        <div className="border border-neutral-200">
          <div className="border-b border-neutral-200 px-4 py-4">
            <p className="text-xs font-medium text-neutral-600">Imágenes vinculadas ({value.length})</p>
          </div>
          <div className="divide-y divide-neutral-200">
            {value.map((l, idx) => {
              const entryId = l.sys.id;
              const title = desiredTitle(entryId, idx);
              const url = previews[entryId]?.url ?? null;

              return (
                <div
                  key={`${slugSafe || 'proyecto'}-${idx + 1}`}
                  className="flex items-center gap-3 px-4 py-4"
                  draggable
                  onDragStart={() => {
                    draggingIdRef.current = entryId;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    const from = draggingIdRef.current;
                    draggingIdRef.current = null;
                    if (!from || from === entryId) return;
                    const fromIdx = value.findIndex((x) => x.sys.id === from);
                    const toIdx = value.findIndex((x) => x.sys.id === entryId);
                    if (fromIdx < 0 || toIdx < 0) return;
                    const next = [...value];
                    const [moved] = next.splice(fromIdx, 1);
                    next.splice(toIdx, 0, moved);
                    onChange(next);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-4 w-4 text-zinc-400" />
                    <button
                      type="button"
                      className="h-12 w-12 overflow-hidden border border-neutral-200 bg-neutral-50"
                      onClick={() => {
                        if (!url) return;
                        setPreviewImage({ url, title });
                        setPreviewOpen(true);
                      }}
                      aria-label={url ? 'Ver imagen' : 'Imagen no disponible'}
                      disabled={!url}
                    >
                      {url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={url} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full" />
                      )}
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{title}</p>
                    <p className="truncate font-mono text-xs text-zinc-500">{entryId}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeLinked(entryId)} aria-label="Quitar">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-base">Agregar imágenes</SheetTitle>
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
                    Seleccionar archivos
                  </Button>
                  <Button type="button" onClick={() => void uploadAll()} disabled={items.every((it) => it.status !== 'idle')}>
                    Subir
                  </Button>
                </div>

                {items.length ? (
                  <div className="grid grid-cols-2 gap-2">
                    {items.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className="overflow-hidden border border-neutral-200 text-left hover:bg-neutral-50"
                        onClick={() => {
                          setSelectedQueueId(it.id);
                          setSheetView('detail');
                        }}
                      >
                        <div className="aspect-square w-full bg-zinc-50">
                          {it.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={it.previewUrl}
                              alt={it.title || it.file.name}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="p-2">
                          <p className="truncate text-xs font-medium text-zinc-900">{it.file.name}</p>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            {it.status === 'done' ? 'Subida' : it.status}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-neutral-300 bg-neutral-50/80 p-6 text-sm text-neutral-600">
                    Seleccioná imágenes para subirlas.
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
                  Volver
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
                          <Label className="text-xs text-zinc-600">Título</Label>
                          <Input value={it.title} onChange={(e) => setField(it.id, 'title', e.target.value)} />
                        </div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs text-zinc-600">Alt</Label>
                          <Input value={it.alt} onChange={(e) => setField(it.id, 'alt', e.target.value)} />
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
                          Quitar
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
              Guardar
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
}

