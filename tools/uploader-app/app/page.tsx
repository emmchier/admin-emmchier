'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Copy, Download, ExternalLink, Trash2 } from 'lucide-react';

type OutputFormat = 'webp' | 'jpeg' | 'png';
type WidthPreset = 'original' | 1200 | 800 | 400 | 'custom';

type ImageItem = {
  id: string;
  file: File;
  originalUrl: string;
  status: 'idle' | 'converting' | 'converted' | 'uploading' | 'publishing' | 'done' | 'error';
  progress: number;
  error?: string;
  contentful: { title: string; alt: string };
  processed?: {
    base64DataUrl: string;
    mimeType: string;
    size: number;
    width: number;
    height: number;
  };
  cdnUrl?: string;
};

const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/tiff',
]);

function formatKb(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function isValidMeta(i: ImageItem): boolean {
  return i.contentful.title.trim().length > 0 && i.contentful.alt.trim().length > 0;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extFromMime(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return 'bin';
}

export default function Home() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [format, setFormat] = useState<OutputFormat>('webp');
  const [quality, setQuality] = useState<number>(85);
  const [widthPreset, setWidthPreset] = useState<WidthPreset>(1200);
  const [customMaxWidth, setCustomMaxWidth] = useState<number>(2400);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busyRef = useRef(false);
  const timersRef = useRef<Map<string, number>>(new Map());

  const effectiveMaxWidth = useMemo(() => {
    if (widthPreset === 'original') return 99999;
    if (widthPreset === 'custom') return Math.max(1, Math.floor(customMaxWidth || 2400));
    return widthPreset;
  }, [customMaxWidth, widthPreset]);

  const canConvert = useMemo(() => {
    return items.length > 0 && items.every(isValidMeta) && !busyRef.current;
  }, [items]);

  const canUpload = useMemo(() => {
    return (
      items.length > 0 &&
      items.every((i) => isValidMeta(i) && i.status === 'converted') &&
      !busyRef.current
    );
  }, [items]);

  const simulateProgressRange = useCallback((id: string, from: number, to: number) => {
    const existing = timersRef.current.get(id);
    if (existing) window.clearInterval(existing);

    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, progress: Math.max(i.progress, from) } : i)),
    );

    const interval = window.setInterval(() => {
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== id) return i;
          if (i.progress >= to) return i;
          const bump = Math.random() * 7 + 3;
          return { ...i, progress: Math.min(to, i.progress + bump) };
        }),
      );
    }, 180);

    timersRef.current.set(id, interval);
  }, []);

  const stopProgress = useCallback((id: string) => {
    const t = timersRef.current.get(id);
    if (t) window.clearInterval(t);
    timersRef.current.delete(id);
  }, []);

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const next: ImageItem[] = [];
    const files = Array.from(list);

    for (const f of files) {
      if (f.size > MAX_BYTES) {
        next.push({
          id: makeId(),
          file: f,
          originalUrl: '',
          status: 'error',
          progress: 0,
          error: 'File too large (max 15MB)',
          contentful: { title: '', alt: '' },
        });
        continue;
      }
      if (!ALLOWED_TYPES.has(f.type)) {
        next.push({
          id: makeId(),
          file: f,
          originalUrl: '',
          status: 'error',
          progress: 0,
          error: 'Unsupported format',
          contentful: { title: '', alt: '' },
        });
        continue;
      }

      next.push({
        id: makeId(),
        file: f,
        originalUrl: URL.createObjectURL(f),
        status: 'idle',
        progress: 0,
        contentful: { title: '', alt: '' },
      });
    }

    setItems((prev) => [...prev, ...next]);
  }, []);

  const onPickFiles = useCallback(() => inputRef.current?.click(), []);

  const removeItem = useCallback(
    (id: string) => {
      stopProgress(id);
      setItems((prev) => {
        const item = prev.find((p) => p.id === id);
        if (item?.originalUrl) URL.revokeObjectURL(item.originalUrl);
        return prev.filter((p) => p.id !== id);
      });
    },
    [stopProgress],
  );

  const clearAll = useCallback(() => {
    timersRef.current.forEach((t) => window.clearInterval(t));
    timersRef.current.clear();
    setItems((prev) => {
      prev.forEach((p) => {
        if (p.originalUrl) URL.revokeObjectURL(p.originalUrl);
      });
      return [];
    });
    setGlobalError(null);
    busyRef.current = false;
  }, []);

  const updateMeta = useCallback((id: string, key: 'title' | 'alt', value: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, contentful: { ...i.contentful, [key]: value } } : i,
      ),
    );
  }, []);

  const handleConvert = useCallback(async () => {
    if (!canConvert) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setGlobalError(null);

    try {
      for (const item of items) {
        if (item.status === 'error') continue;

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'converting', progress: 0, error: undefined } : i,
          ),
        );

        simulateProgressRange(item.id, 0, 30);

        const form = new FormData();
        form.set('file', item.file);
        form.set('format', format);
        form.set('quality', String(quality));
        form.set('maxWidth', String(effectiveMaxWidth));

        const res = await fetch(`/api/upload?mode=convert`, { method: 'POST', body: form });
        if (!res.ok) throw new Error((await res.json()).error || 'Convert failed');
        const data = (await res.json()) as {
          base64: string;
          mimeType: string;
          processedSize: number;
          width: number;
          height: number;
        };

        stopProgress(item.id);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'converted',
                  progress: 30,
                  processed: {
                    base64DataUrl: `data:${data.mimeType};base64,${data.base64}`,
                    mimeType: data.mimeType,
                    size: data.processedSize,
                    width: data.width,
                    height: data.height,
                  },
                }
              : i,
          ),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Convert failed';
      setGlobalError(msg);
    } finally {
      busyRef.current = false;
    }
  }, [
    canConvert,
    effectiveMaxWidth,
    format,
    items,
    quality,
    simulateProgressRange,
    stopProgress,
  ]);

  const handleUpload = useCallback(async () => {
    if (!canUpload) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setGlobalError(null);

    try {
      console.log('Uploading batch:', items.length);
      for (const item of items) {
        if (item.status !== 'converted') continue;

        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'uploading', progress: 30 } : i)),
        );
        simulateProgressRange(item.id, 30, 90);

        const form = new FormData();
        form.set('file', item.file);
        form.set('title', item.contentful.title);
        form.set('alt', item.contentful.alt);
        form.set('format', format);
        form.set('quality', String(quality));
        form.set('maxWidth', String(effectiveMaxWidth));

        const res = await fetch(`/api/upload?mode=upload`, { method: 'POST', body: form });
        if (!res.ok) throw new Error((await res.json()).error || 'Upload failed');

        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, status: 'publishing', progress: 90 } : i)),
        );
        simulateProgressRange(item.id, 90, 100);

        const data = (await res.json()) as { url: string };

        stopProgress(item.id);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'done', progress: 100, cdnUrl: data.url } : i,
          ),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      setGlobalError(msg);
      setItems((prev) =>
        prev.map((i) => {
          if (i.status === 'uploading' || i.status === 'publishing') {
            return { ...i, status: 'error', error: msg };
          }
          return i;
        }),
      );
    } finally {
      busyRef.current = false;
    }
  }, [
    canUpload,
    effectiveMaxWidth,
    format,
    items,
    quality,
    simulateProgressRange,
    stopProgress,
  ]);

  const handleDownload = useCallback((item: ImageItem) => {
    if (!item.processed) return;
    const a = document.createElement('a');
    const ext = extFromMime(item.processed.mimeType);
    a.href = item.processed.base64DataUrl;
    a.download = item.file.name.replace(/\.\w+$/, `.${ext}`);
    a.click();
  }, []);

  const handleCopyUrl = useCallback(async (item: ImageItem) => {
    if (!item.cdnUrl) return;
    await navigator.clipboard.writeText(item.cdnUrl);
  }, []);

  const handleOpen = useCallback((item: ImageItem) => {
    if (!item.cdnUrl) return;
    window.open(item.cdnUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const onDrop = useCallback(
    async (ev: React.DragEvent) => {
      ev.preventDefault();
      if (!ev.dataTransfer?.files?.length) return;
      await addFiles(ev.dataTransfer.files);
    },
    [addFiles],
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-[220px]">
            <p className="text-sm font-medium text-zinc-900">Uploader Tool</p>
            <p className="text-xs text-zinc-500">Convert images locally, then publish to Contentful.</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs text-zinc-600">
              <span>Format</span>
              <select
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
                value={format}
                onChange={(e) => setFormat(e.target.value as OutputFormat)}
              >
                <option value="webp">webp</option>
                <option value="jpeg">jpeg</option>
                <option value="png">png</option>
              </select>
            </label>

            <label className="grid gap-1 text-xs text-zinc-600">
              <span>Quality ({quality})</span>
              <input
                className="h-9 w-[140px]"
                type="range"
                min={40}
                max={95}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>

            <label className="grid gap-1 text-xs text-zinc-600">
              <span>Max width</span>
              <select
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
                value={String(widthPreset)}
                onChange={(e) => setWidthPreset(e.target.value as WidthPreset)}
              >
                <option value="original">original</option>
                <option value="1200">1200px</option>
                <option value="800">800px</option>
                <option value="400">400px</option>
                <option value="custom">custom</option>
              </select>
            </label>

            {widthPreset === 'custom' ? (
              <label className="grid gap-1 text-xs text-zinc-600">
                <span>Custom</span>
                <input
                  className="h-9 w-[120px] rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
                  type="number"
                  min={1}
                  max={6000}
                  value={customMaxWidth}
                  onChange={(e) => setCustomMaxWidth(Number(e.target.value))}
                />
              </label>
            ) : null}

            <button
              type="button"
              onClick={handleConvert}
              disabled={!canConvert}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              Convert
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!canUpload}
              className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              Upload
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={items.length === 0}
              className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </header>

        {globalError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {globalError}
          </p>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/tiff"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        {items.length === 0 ? (
          <button
            type="button"
            onClick={onPickFiles}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex min-h-[380px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-white p-10 text-center transition hover:border-zinc-400"
          >
            <span className="text-base font-medium text-zinc-900">Drag &amp; drop images here</span>
            <span className="text-sm text-zinc-500">or click to upload</span>
            <span className="mt-2 text-xs text-zinc-500">
              Supported formats: PNG, JPG, JPEG, WEBP, TIFF · Max size: 15MB
            </span>
          </button>
        ) : (
          <div className="rounded-2xl border border-zinc-200 bg-white">
            <div className="flex items-center justify-between border-b border-zinc-200 p-3">
              <p className="text-sm text-zinc-700">{items.length} files</p>
              <button
                type="button"
                onClick={onPickFiles}
                className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-900"
              >
                Add more
              </button>
            </div>
            <ul className="divide-y divide-zinc-100">
              {items.map((i) => {
                const showProgress = i.status !== 'idle' && i.status !== 'converted' && i.status !== 'done';
                const isDone = i.status === 'done' && !!i.cdnUrl;
                return (
                  <li key={i.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="truncate text-sm font-medium text-zinc-900">{i.file.name}</p>
                          <span className="text-xs text-zinc-500">{formatKb(i.file.size)}</span>
                          <span className="text-xs text-zinc-500">{i.file.type || 'unknown'}</span>
                          {i.status === 'done' ? (
                            <span className="text-xs font-medium text-emerald-700">✓ Published</span>
                          ) : i.status === 'converted' ? (
                            <span className="text-xs font-medium text-zinc-700">Converted</span>
                          ) : i.status === 'converting' ? (
                            <span className="text-xs font-medium text-zinc-700">Converting…</span>
                          ) : i.status === 'uploading' ? (
                            <span className="text-xs font-medium text-zinc-700">Uploading…</span>
                          ) : i.status === 'publishing' ? (
                            <span className="text-xs font-medium text-zinc-700">Publishing…</span>
                          ) : i.status === 'error' ? (
                            <span className="text-xs font-medium text-red-700">Error</span>
                          ) : null}
                        </div>

                        {i.status === 'error' && i.error ? (
                          <p className="mt-2 text-sm text-red-700">{i.error}</p>
                        ) : null}

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <label className="grid gap-1 text-xs text-zinc-600">
                            <span>Title</span>
                            <input
                              className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
                              value={i.contentful.title}
                              onChange={(e) => updateMeta(i.id, 'title', e.target.value)}
                              placeholder="Title…"
                            />
                            {!i.contentful.title.trim() ? (
                              <span className="text-[11px] text-red-600">Title is required</span>
                            ) : null}
                          </label>
                          <label className="grid gap-1 text-xs text-zinc-600">
                            <span>Alt</span>
                            <input
                              className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900"
                              value={i.contentful.alt}
                              onChange={(e) => updateMeta(i.id, 'alt', e.target.value)}
                              placeholder="Alt…"
                            />
                            {!i.contentful.alt.trim() ? (
                              <span className="text-[11px] text-red-600">Alt is required</span>
                            ) : null}
                          </label>
                        </div>

                        {showProgress ? (
                          <div className="mt-3">
                            <div className="h-2 w-full overflow-hidden rounded bg-zinc-100">
                              <div
                                className="h-full bg-zinc-900 transition-all duration-200"
                                style={{ width: `${i.progress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-xs tabular-nums text-zinc-500">{Math.round(i.progress)}%</p>
                          </div>
                        ) : null}

                        {i.status === 'converted' && i.processed ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <button
                              type="button"
                              className="group overflow-hidden rounded-xl border border-zinc-200 bg-white"
                              onClick={() => window.open(i.originalUrl, '_blank')}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={i.originalUrl}
                                alt="Original preview"
                                className="h-48 w-full object-contain bg-zinc-50"
                              />
                              <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                                <span>Original</span>
                                <span>{formatKb(i.file.size)}</span>
                              </div>
                            </button>

                            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={i.processed.base64DataUrl}
                                alt="Processed preview"
                                className="h-48 w-full object-contain bg-zinc-50"
                              />
                              <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600">
                                <span>
                                  Processed · {i.processed.width}×{i.processed.height}
                                </span>
                                <span>{formatKb(i.processed.size)}</span>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleDownload(i)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900"
                              aria-label="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleCopyUrl(i)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900"
                              aria-label="Copy URL"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpen(i)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900"
                              aria-label="Open"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => removeItem(i.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
